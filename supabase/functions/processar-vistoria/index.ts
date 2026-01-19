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
      console.log('[processar-vistoria] Processando aprovação...');

      // 4.1 Criar registro de instalação
      if (vistoria.associado_id && vistoria.veiculo_id) {
        const { data: instalacao, error: instalacaoError } = await supabase
          .from('instalacoes')
          .insert({
            associado_id: vistoria.associado_id,
            veiculo_id: vistoria.veiculo_id,
            status: 'agendada', // Enum válido
            data_agendada: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (instalacaoError) {
          console.error('[processar-vistoria] Erro ao criar instalação:', instalacaoError);
        } else {
          instalacao_id = instalacao.id;
          console.log(`[processar-vistoria] Instalação criada: ${instalacao_id}`);
        }
      }

      // 4.2 Atualizar status do associado
      const { error: assocError } = await supabase
        .from('associados')
        .update({ 
          status: 'aguardando_instalacao',
          updated_at: new Date().toISOString(),
        })
        .eq('id', vistoria.associado_id);

      if (assocError) {
        console.error('[processar-vistoria] Erro ao atualizar associado:', assocError);
      } else {
        console.log('[processar-vistoria] Status do associado atualizado para aguardando_instalacao');
      }

      // 4.3 Atualizar status do veículo e ativar cobertura roubo/furto (autovistoria)
      const { error: veicError } = await supabase
        .from('veiculos')
        .update({ 
          status: 'instalacao_pendente',
          cobertura_roubo_furto: true, // Analista aprova cobertura parcial na autovistoria
          updated_at: new Date().toISOString(),
        })
        .eq('id', vistoria.veiculo_id);

      if (veicError) {
        console.error('[processar-vistoria] Erro ao atualizar veículo:', veicError);
      } else {
        console.log('[processar-vistoria] Status do veículo atualizado para instalacao_pendente com cobertura_roubo_furto ativada');
      }

      // 4.4 Registrar no histórico
      try {
        await supabase.from('associados_historico').insert({
          associado_id: vistoria.associado_id,
          tipo: 'vistoria_aprovada',
          descricao: decisao === 'aprovada' 
            ? 'Vistoria aprovada - Instalação na fila'
            : `Vistoria aprovada com ressalvas: ${ressalvas}`,
          dados_novos: { 
            vistoria_id, 
            instalacao_id,
            decisao,
            ressalvas: ressalvas || null,
          },
          usuario_id: analista_id,
        });
        console.log('[processar-vistoria] Histórico registrado');
      } catch (histError) {
        console.error('[processar-vistoria] Erro ao registrar histórico:', histError);
      }

      // 4.5 Criar notificação interna para coordenadores (usando notificacoes_sistema)
      try {
        await supabase.from('notificacoes_sistema').insert({
          titulo: '🚗 Nova instalação na fila',
          mensagem: `${vistoria.associado?.nome} - ${vistoria.veiculo?.modelo} (${vistoria.veiculo?.placa})`,
          tipo: 'info',
          destino: 'perfil',
          destino_role: 'coordenador',
          link: instalacao_id ? `/monitoramento/instalacoes/${instalacao_id}` : '/monitoramento/instalacoes',
        });
        console.log('[processar-vistoria] Notificação de sistema criada');
      } catch (notifError) {
        console.error('[processar-vistoria] Erro ao criar notificação:', notifError);
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
            tipo: vistoria.tipo || 'entrada',
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
      : 'vistoria_aprovada';

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
          : 'Vistoria aprovada. Instalação criada na fila.',
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