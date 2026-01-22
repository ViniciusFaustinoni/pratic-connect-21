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
        // RASTREADOR JÁ VINCULADO - Aprovar cobertura roubo/furto
        // A ativação na plataforma Softruck será feita MANUALMENTE pelo analista
        console.log(`[processar-vistoria] Rastreador já vinculado: ${rastreadorVinculado.codigo} (${rastreadorVinculado.plataforma})`);
        console.log('[processar-vistoria] Ativação Softruck será feita manualmente pelo analista');
        
        // 4.2a Atualizar veículo - aprovar cobertura roubo/furto mas NÃO cobertura total
        // A cobertura total só será liberada quando o analista clicar em "Ativar Rastreador"
        const { error: veicError } = await supabase
          .from('veiculos')
          .update({ 
            status: 'em_analise',
            cobertura_total: false,  // NÃO ativar cobertura total automaticamente
            cobertura_roubo_furto: true,  // Aprovar cobertura roubo/furto
            updated_at: new Date().toISOString(),
          })
          .eq('id', vistoria.veiculo_id);

        if (veicError) {
          console.error('[processar-vistoria] Erro ao atualizar veículo:', veicError);
        } else {
          console.log('[processar-vistoria] Veículo aprovado para cobertura roubo/furto - aguardando ativação do rastreador');
        }

        // 4.3a NÃO ativar associado automaticamente - será ativado quando o rastreador for ativado
        console.log('[processar-vistoria] Associado será ativado quando rastreador for ativado na plataforma');

        // 4.4a Registrar no histórico
        try {
          await supabase.from('associados_historico').insert({
            associado_id: vistoria.associado_id,
            tipo: 'vistoria_aprovada',
            descricao: `Vistoria aprovada. Cobertura roubo/furto liberada. Rastreador ${rastreadorVinculado.codigo} vinculado - aguardando ativação manual na plataforma ${rastreadorVinculado.plataforma}.`,
            dados_novos: { 
              vistoria_id, 
              decisao,
              rastreador_id: rastreadorVinculado.id,
              rastreador_codigo: rastreadorVinculado.codigo,
              plataforma: rastreadorVinculado.plataforma,
              aguardando_ativacao: true,
            },
            usuario_id: analista_id,
          });
          console.log('[processar-vistoria] Histórico registrado');
        } catch (histError) {
          console.error('[processar-vistoria] Erro ao registrar histórico:', histError);
        }

        // 4.5a Criar notificação para ativar rastreador manualmente
        try {
          await supabase.from('notificacoes_sistema').insert({
            titulo: '🔧 Rastreador instalado - Ativar na plataforma',
            mensagem: `${vistoria.associado?.nome} - ${vistoria.veiculo?.modelo} (${vistoria.veiculo?.placa}) - Rastreador ${rastreadorVinculado.codigo} aguardando ativação`,
            tipo: 'info',
            destino: 'perfil',
            destino_role: 'analista_cadastro',
            link: `/cadastro/instalacoes/${vistoria.instalacao_id || vistoria_id}/ativar`,
          });
          console.log('[processar-vistoria] Notificação de ativação pendente criada');
        } catch (notifError) {
          console.error('[processar-vistoria] Erro ao criar notificação:', notifError);
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