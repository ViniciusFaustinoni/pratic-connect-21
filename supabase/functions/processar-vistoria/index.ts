import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProcessarVistoriaPayload {
  vistoria_id: string;
  decisao: 'aprovada' | 'aprovada_com_ressalvas' | 'reprovada';
  analista_id: string;
  observacoes?: string;
  ressalvas?: string;
  motivo_reprovacao?: string;
  permitir_nova_tentativa?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'Configuração do Supabase ausente' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload: ProcessarVistoriaPayload = await req.json();
    const { 
      vistoria_id, 
      decisao, 
      analista_id, 
      observacoes, 
      ressalvas, 
      motivo_reprovacao,
      permitir_nova_tentativa 
    } = payload;

    console.log(`[processar-vistoria] Iniciando - Vistoria: ${vistoria_id}, Decisão: ${decisao}`);

    // Validações
    if (!vistoria_id || !decisao || !analista_id) {
      throw new Error('vistoria_id, decisao e analista_id são obrigatórios');
    }

    // 1. Buscar dados da vistoria com relacionamentos
    const { data: vistoria, error: vistoriaError } = await supabase
      .from('vistorias')
      .select(`
        *,
        associado:associados!vistorias_associado_id_fkey (
          id, nome, email, telefone, whatsapp
        ),
        veiculo:veiculos!vistorias_veiculo_id_fkey (
          id, placa, modelo, marca
        )
      `)
      .eq('id', vistoria_id)
      .single();

    if (vistoriaError || !vistoria) {
      console.error('[processar-vistoria] Vistoria não encontrada:', vistoriaError);
      throw new Error('Vistoria não encontrada');
    }

    console.log(`[processar-vistoria] Vistoria encontrada - Associado: ${vistoria.associado?.nome}`);

    // 2. Determinar status final
    const statusFinal = decisao === 'aprovada_com_ressalvas' ? 'aprovada' : decisao;

    // 3. Atualizar vistoria com a decisão
    const updateData: Record<string, unknown> = {
      status: statusFinal,
      observacoes_analise: observacoes || null,
      analisado_por: analista_id,
      analisado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (decisao === 'aprovada_com_ressalvas') {
      updateData.ressalvas = ressalvas;
    }

    if (decisao === 'reprovada') {
      updateData.motivo_reprovacao = motivo_reprovacao;
    }

    const { error: updateError } = await supabase
      .from('vistorias')
      .update(updateData)
      .eq('id', vistoria_id);

    if (updateError) {
      console.error('[processar-vistoria] Erro ao atualizar vistoria:', updateError);
      throw updateError;
    }

    console.log(`[processar-vistoria] Vistoria atualizada com status: ${statusFinal}`);

    let instalacao_id: string | null = null;
    let nova_vistoria_id: string | null = null;

    // 4. Processar baseado na decisão
    if (decisao === 'aprovada' || decisao === 'aprovada_com_ressalvas') {
      // === VISTORIA APROVADA ===
      console.log('[processar-vistoria] Processando aprovação da análise...');

      // 4.1 VERIFICAR SE RASTREADOR JÁ FOI VINCULADO PELO VISTORIADOR
      const { data: rastreadorVinculado } = await supabase
        .from('rastreadores')
        .select('id, imei, codigo, plataforma')
        .eq('veiculo_id', vistoria.veiculo_id)
        .eq('status', 'instalado')
        .maybeSingle();

      if (rastreadorVinculado) {
        // RASTREADOR JÁ VINCULADO - Ativar via API e depois localmente
        console.log(`[processar-vistoria] Rastreador já vinculado: ${rastreadorVinculado.codigo} (${rastreadorVinculado.plataforma})`);
        
        // 4.1a NOVO: Chamar API da plataforma para ativar o dispositivo
        if (rastreadorVinculado.plataforma === 'softruck') {
          console.log('[processar-vistoria] Ativando via API Softruck...');
          
          try {
            const softruckResponse = await fetch(`${supabaseUrl}/functions/v1/softruck-ativar-dispositivo`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({
                imei: rastreadorVinculado.imei,
                veiculoId: vistoria.veiculo_id,
                associadoId: vistoria.associado_id,
              }),
            });
            
            const softruckResult = await softruckResponse.json();
            
            if (!softruckResult.success) {
              console.error('[processar-vistoria] Erro Softruck:', softruckResult.error);
              // Não bloquear aprovação, apenas logar erro
            } else {
              console.log('[processar-vistoria] Dispositivo ativado na Softruck:', softruckResult.softruck_device_id);
            }
          } catch (apiError) {
            console.error('[processar-vistoria] Erro ao chamar API Softruck:', apiError);
            // Não bloquear aprovação
          }
        }
        
        // 4.2a Ativar veículo com cobertura total
        const { error: veicError } = await supabase
          .from('veiculos')
          .update({ 
            status: 'ativo',
            cobertura_total: true,
            cobertura_roubo_furto: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', vistoria.veiculo_id);

        if (veicError) {
          console.error('[processar-vistoria] Erro ao ativar veículo:', veicError);
        } else {
          console.log('[processar-vistoria] Veículo ativado com cobertura total');
        }

        // 4.3a Ativar associado
        const { error: assocError } = await supabase
          .from('associados')
          .update({ 
            status: 'ativo',
            data_ativacao: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', vistoria.associado_id);

        if (assocError) {
          console.error('[processar-vistoria] Erro ao ativar associado:', assocError);
        } else {
          console.log('[processar-vistoria] Associado ativado');
        }

        // 4.4a Registrar no histórico
        try {
          await supabase.from('associados_historico').insert({
            associado_id: vistoria.associado_id,
            tipo: 'ativacao',
            descricao: `Cliente ativado automaticamente. Rastreador ${rastreadorVinculado.codigo} vinculado na vistoria e ativado via ${rastreadorVinculado.plataforma}.`,
            dados_novos: { 
              vistoria_id, 
              decisao,
              rastreador_id: rastreadorVinculado.id,
              rastreador_codigo: rastreadorVinculado.codigo,
              plataforma: rastreadorVinculado.plataforma,
              ativacao_automatica: true,
            },
            usuario_id: analista_id,
          });
          console.log('[processar-vistoria] Histórico de ativação registrado');
        } catch (histError) {
          console.error('[processar-vistoria] Erro ao registrar histórico:', histError);
        }

      } else {
        // RASTREADOR NÃO VINCULADO - Manter em análise (fluxo legado)
        console.log('[processar-vistoria] Rastreador não vinculado - aguardando ação manual');

        // 4.2b Atualizar status do veículo para em_analise
        const { error: veicError } = await supabase
          .from('veiculos')
          .update({ 
            status: 'em_analise',
            cobertura_roubo_furto: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', vistoria.veiculo_id);

        if (veicError) {
          console.error('[processar-vistoria] Erro ao atualizar veículo:', veicError);
        }

        // 4.3b Registrar no histórico
        try {
          await supabase.from('associados_historico').insert({
            associado_id: vistoria.associado_id,
            tipo: 'vistoria_aprovada',
            descricao: decisao === 'aprovada' 
              ? 'Vistoria de entrada aprovada. Aguardando vínculo do rastreador.'
              : `Vistoria aprovada com ressalvas: ${ressalvas}. Aguardando vínculo do rastreador.`,
            dados_novos: { 
              vistoria_id, 
              decisao,
              ressalvas: ressalvas || null,
            },
            usuario_id: analista_id,
          });
          console.log('[processar-vistoria] Histórico registrado');
        } catch (histError) {
          console.error('[processar-vistoria] Erro ao registrar histórico:', histError);
        }

        // 4.4b Criar notificação para vincular rastreador manualmente
        try {
          await supabase.from('notificacoes_sistema').insert({
            titulo: '⚠️ Vistoria aprovada - Rastreador pendente',
            mensagem: `${vistoria.associado?.nome} - ${vistoria.veiculo?.modelo} (${vistoria.veiculo?.placa}) - Rastreador não vinculado na vistoria`,
            tipo: 'warning',
            destino: 'perfil',
            destino_role: 'analista_cadastro',
            link: `/cadastro/vistorias/${vistoria_id}/analise`,
          });
          console.log('[processar-vistoria] Notificação de rastreador pendente criada');
        } catch (notifError) {
          console.error('[processar-vistoria] Erro ao criar notificação:', notifError);
        }
      }

    } else {
      // === VISTORIA REPROVADA ===
      console.log('[processar-vistoria] Processando reprovação...');

      // 4.1 Atualizar status do veículo para em_analise (aguardando nova tentativa ou suspenso)
      const { error: veicError } = await supabase
        .from('veiculos')
        .update({ 
          status: permitir_nova_tentativa ? 'em_analise' : 'suspenso',
          updated_at: new Date().toISOString(),
        })
        .eq('id', vistoria.veiculo_id);

      if (veicError) {
        console.error('[processar-vistoria] Erro ao atualizar veículo:', veicError);
      }

      // 4.2 Registrar no histórico
      try {
        await supabase.from('associados_historico').insert({
          associado_id: vistoria.associado_id,
          tipo: 'vistoria_reprovada',
          descricao: `Vistoria reprovada: ${motivo_reprovacao}`,
          dados_novos: { 
            vistoria_id, 
            motivo: motivo_reprovacao, 
            permitir_nova_tentativa 
          },
          usuario_id: analista_id,
        });
      } catch (histError) {
        console.error('[processar-vistoria] Erro ao registrar histórico:', histError);
      }

      // 4.3 Se permitir nova tentativa, criar nova vistoria
      if (permitir_nova_tentativa) {
        const { data: novaVistoria, error: novaError } = await supabase
          .from('vistorias')
          .insert({
            associado_id: vistoria.associado_id,
            veiculo_id: vistoria.veiculo_id,
            tipo: vistoria.tipo || 'instalacao',
            status: 'pendente',
          })
          .select('id')
          .single();

        if (novaError) {
          console.error('[processar-vistoria] Erro ao criar nova vistoria:', novaError);
        } else {
          nova_vistoria_id = novaVistoria.id;
          console.log(`[processar-vistoria] Nova vistoria criada: ${nova_vistoria_id}`);
        }
      }
    }

    // 5. Notificar cliente via edge function
    const tipoNotificacao = decisao === 'reprovada' 
      ? (permitir_nova_tentativa ? 'vistoria_nova_tentativa' : 'vistoria_reprovada')
      : 'vistoria_aprovada_aguardando_ativacao';

    try {
      await supabase.functions.invoke('notificar-cliente', {
        body: {
          tipo: tipoNotificacao,
          associado_id: vistoria.associado_id,
          dados: {
            vistoria_id,
            motivo: motivo_reprovacao,
            ressalvas,
            nova_vistoria_id,
            instalacao_id,
          },
        },
      });
      console.log('[processar-vistoria] Cliente notificado');
    } catch (notifyError) {
      console.error('[processar-vistoria] Erro ao notificar cliente:', notifyError);
      // Continua mesmo se falhar
    }

    console.log('[processar-vistoria] Processamento concluído com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true, 
        decisao: statusFinal,
        instalacao_id,
        nova_vistoria_id,
        mensagem: decisao === 'reprovada' 
          ? 'Vistoria reprovada. Cliente notificado.'
          : 'Vistoria aprovada. Aguardando ativação do rastreador pelo analista.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[processar-vistoria] Erro:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});