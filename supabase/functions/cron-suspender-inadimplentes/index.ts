import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configurações padrão
const DIAS_CARENCIA_PADRAO = 0; // Suspensão imediata no dia seguinte ao vencimento

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('[Cron Suspender Inadimplentes] Iniciando execução...');

  try {
    // ===== 1. Buscar configuração de carência =====
    const { data: configCarencia } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'inadimplencia_dias_carencia')
      .maybeSingle();

    const diasCarencia = configCarencia?.valor 
      ? parseInt(configCarencia.valor) 
      : DIAS_CARENCIA_PADRAO;

    // Verificar se notificação à Rede Veículos está habilitada
    const { data: configNotificar } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'inadimplencia_notificar_rede_veiculos')
      .maybeSingle();

    const notificarRedeVeiculos = configNotificar?.valor !== 'false';

    console.log(`[Cron] Dias de carência: ${diasCarencia}, Notificar Rede Veículos: ${notificarRedeVeiculos}`);

    // ===== 2. Data limite para vencimento =====
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - diasCarencia);
    const dataLimiteStr = dataLimite.toISOString().split('T')[0];

    console.log(`[Cron] Buscando cobranças vencidas antes de: ${dataLimiteStr}`);

    // ===== 3. Buscar associados ativos com cobranças vencidas além do período de carência =====
    // Usando subquery para encontrar associados com pelo menos uma cobrança OVERDUE antiga
    const { data: associadosInadimplentes, error: queryError } = await supabase
      .from('asaas_cobrancas')
      .select(`
        associado_id,
        associados!inner (
          id,
          nome,
          status
        )
      `)
      .eq('status', 'OVERDUE')
      .lte('data_vencimento', dataLimiteStr)
      .eq('associados.status', 'ativo')
      .not('tipo', 'eq', 'adesao'); // Ignorar cobranças de adesão

    if (queryError) {
      throw new Error(`Erro ao buscar inadimplentes: ${queryError.message}`);
    }

    // Agrupar por associado_id para evitar duplicatas
    const associadosUnicos = new Map<string, {
      id: string;
      nome: string;
      totalVencidas: number;
      diasMaiorAtraso: number;
      valorTotalPendente: number;
    }>();

    if (associadosInadimplentes) {
      for (const cobranca of associadosInadimplentes) {
        const associado = cobranca.associados as unknown as { id: string; nome: string; status: string };
        if (!associado?.id) continue;

        if (!associadosUnicos.has(associado.id)) {
          // Buscar detalhes das cobranças vencidas deste associado
          const { data: cobrancasVencidas } = await supabase
            .from('asaas_cobrancas')
            .select('valor, data_vencimento')
            .eq('associado_id', associado.id)
            .eq('status', 'OVERDUE');

          let valorTotal = 0;
          let maiorAtraso = 0;

          if (cobrancasVencidas) {
            const hoje = new Date();
            for (const cob of cobrancasVencidas) {
              valorTotal += cob.valor || 0;
              const venc = new Date(cob.data_vencimento);
              const dias = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
              if (dias > maiorAtraso) maiorAtraso = dias;
            }
          }

          associadosUnicos.set(associado.id, {
            id: associado.id,
            nome: associado.nome,
            totalVencidas: cobrancasVencidas?.length || 1,
            diasMaiorAtraso: maiorAtraso,
            valorTotalPendente: valorTotal,
          });
        }
      }
    }

    console.log(`[Cron] Encontrados ${associadosUnicos.size} associados para suspender`);

    // ===== 4. Suspender cada associado =====
    const resultados: Array<{
      associadoId: string;
      nome: string;
      suspenso: boolean;
      notificadoRedeVeiculos: boolean;
      error?: string;
    }> = [];

    for (const [associadoId, dados] of associadosUnicos) {
      try {
        console.log(`[Cron] Suspendendo associado: ${dados.nome} (${dados.diasMaiorAtraso} dias de atraso)`);

        // Suspender associado
        const { error: updateError } = await supabase
          .from('associados')
          .update({
            status: 'suspenso',
            motivo_bloqueio: `Suspensão automática: ${dados.totalVencidas} cobrança(s) vencida(s) há ${dados.diasMaiorAtraso} dias`,
            data_bloqueio: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', associadoId)
          .eq('status', 'ativo'); // Só suspende se ainda estiver ativo

        if (updateError) {
          throw new Error(`Erro ao atualizar status: ${updateError.message}`);
        }

        // Registrar histórico
        await supabase.from('associados_historico').insert({
          associado_id: associadoId,
          tipo: 'status_alterado',
          descricao: `Suspenso automaticamente por inadimplência (${dados.diasMaiorAtraso} dias de atraso)`,
          dados_anteriores: { status: 'ativo' },
          dados_novos: { 
            status: 'suspenso', 
            totalVencidas: dados.totalVencidas,
            diasAtraso: dados.diasMaiorAtraso,
            valorPendente: dados.valorTotalPendente,
          },
        });

        // Notificar associado
        const { data: associadoUser } = await supabase
          .from('associados')
          .select('user_id')
          .eq('id', associadoId)
          .single();

        if (associadoUser?.user_id) {
          await supabase.from('notificacoes').insert({
            user_id: associadoId,
            titulo: 'Conta Suspensa',
            mensagem: `Sua conta foi suspensa por inadimplência. Valor pendente: R$ ${dados.valorTotalPendente.toFixed(2)}. Regularize sua situação.`,
            tipo: 'alerta',
          });

          // Tentar enviar notificação por WhatsApp/Email
          try {
            await supabase.functions.invoke('disparar-notificacao', {
              body: {
                user_id: associadoUser.user_id,
                associado_id: associadoId,
                tipo: 'cobranca',
                subtipo: 'suspensao',
                dados: {
                  valor: dados.valorTotalPendente.toFixed(2),
                  dias_atraso: dados.diasMaiorAtraso,
                },
                forcar_envio: true,
              },
            });
          } catch (notifErr) {
            console.warn(`[Cron] Erro ao enviar notificação:`, notifErr);
          }
        }

        // Notificar Rede Veículos se habilitado
        let notificadoRedeVeiculos = false;
        if (notificarRedeVeiculos) {
          try {
            const redeResponse = await supabase.functions.invoke('rede-veiculos-informar-inadimplente', {
              body: {
                associadoId,
                motivo: 'suspensao_automatica',
                diasAtraso: dados.diasMaiorAtraso,
                valorPendente: dados.valorTotalPendente,
              },
            });

            if (redeResponse.data?.success) {
              notificadoRedeVeiculos = true;
              console.log(`[Cron] Rede Veículos notificada para ${dados.nome}`);
            }
          } catch (redeErr) {
            console.warn(`[Cron] Erro ao notificar Rede Veículos:`, redeErr);
          }
        }

        resultados.push({
          associadoId,
          nome: dados.nome,
          suspenso: true,
          notificadoRedeVeiculos,
        });

      } catch (err) {
        console.error(`[Cron] Erro ao processar ${dados.nome}:`, err);
        resultados.push({
          associadoId,
          nome: dados.nome,
          suspenso: false,
          notificadoRedeVeiculos: false,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      }
    }

    const suspensos = resultados.filter(r => r.suspenso).length;
    const notificados = resultados.filter(r => r.notificadoRedeVeiculos).length;

    console.log(`[Cron Suspender Inadimplentes] Concluído: ${suspensos} suspensos, ${notificados} notificados na Rede Veículos`);

    return new Response(
      JSON.stringify({
        success: true,
        total_processados: resultados.length,
        suspensos,
        notificados_rede_veiculos: notificados,
        dias_carencia: diasCarencia,
        resultados,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[Cron Suspender Inadimplentes] Erro:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
