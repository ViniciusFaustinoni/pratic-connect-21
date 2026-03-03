import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mapeamento motivo → orientações (duplicado do frontend para uso server-side)
const ORIENTACOES_POR_MOTIVO: Record<string, string> = {
  condicoes_precarias:
    '🔧 Leve o veículo a uma oficina de confiança para uma revisão geral. Itens como pneus, faróis, lanternas e lataria precisam estar em boas condições.',
  danos_estruturais:
    '🛠️ O veículo apresentou danos na estrutura. Procure uma funilaria especializada para reparo e guarde os comprovantes.',
  adulteracoes:
    '⚙️ Foram identificadas modificações não originais. Restaure os itens alterados ao padrão de fábrica.',
  quilometragem_adulterada:
    '📊 Há indício de inconsistência no hodômetro. Solicite uma perícia veicular em empresa credenciada pelo DETRAN.',
  documentacao_irregular:
    '📄 A documentação está com pendências. Verifique junto ao DETRAN se há débitos, restrições ou transferência pendente.',
  chassi_divergente:
    '🔍 O número do chassi diverge do documento. Procure o DETRAN para regularização e perícia.',
  sinais_sinistro:
    '🚗 Sinais de sinistro anterior. Obtenha um laudo cautelar em empresa credenciada.',
  sistema_eletrico:
    '⚡ O sistema elétrico precisa de reparos. Leve a um eletricista automotivo para diagnóstico.',
  outro:
    '📋 Nosso técnico identificou uma pendência. Entre em contato para entender os detalhes.',
};

function getOrientacoes(motivo: string): string {
  return ORIENTACOES_POR_MOTIVO[motivo] || ORIENTACOES_POR_MOTIVO['outro'];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'Configuração ausente' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const agora = new Date();
    const tresDiasAtras = new Date(agora.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    let followupsDia3 = 0;
    let followupsDia7 = 0;

    // === FOLLOW-UP DIA 3 ===
    // Buscar serviços negados há mais de 3 dias sem follow-up enviado
    const { data: servicosDia3, error: errDia3 } = await supabase
      .from('servicos')
      .select('id, associado_id, veiculo_id, ressalvas_instalador, updated_at')
      .eq('decisao_instalador', 'negado')
      .eq('status', 'em_analise')
      .is('followup_recusa_enviado_em', null)
      .lte('updated_at', tresDiasAtras)
      .limit(50);

    if (errDia3) {
      console.error('[cron-followup-recusa] Erro ao buscar serviços dia 3:', errDia3);
    }

    if (servicosDia3 && servicosDia3.length > 0) {
      console.log(`[cron-followup-recusa] ${servicosDia3.length} serviços para follow-up dia 3`);

      for (const servico of servicosDia3) {
        try {
          // Buscar placa do veículo
          const { data: veiculo } = await supabase
            .from('veiculos')
            .select('placa')
            .eq('id', servico.veiculo_id)
            .single();

          const motivo = servico.ressalvas_instalador || 'outro';
          const orientacoes = getOrientacoes(motivo);
          const placa = veiculo?.placa || '';

          // Enviar follow-up via notificar-cliente
          const { error: notifError } = await supabase.functions.invoke('notificar-cliente', {
            body: {
              tipo: 'followup_recusa_dia3',
              associado_id: servico.associado_id,
              dados: {
                placa,
                orientacoes_resolucao: orientacoes,
              },
            },
          });

          if (notifError) {
            console.error(`[cron-followup-recusa] Erro ao notificar serviço ${servico.id}:`, notifError);
            continue;
          }

          // Marcar follow-up enviado
          await supabase
            .from('servicos')
            .update({ followup_recusa_enviado_em: agora.toISOString() })
            .eq('id', servico.id);

          followupsDia3++;
          console.log(`[cron-followup-recusa] Follow-up dia 3 enviado para serviço ${servico.id}`);
        } catch (err) {
          console.error(`[cron-followup-recusa] Erro processando serviço ${servico.id}:`, err);
        }
      }
    }

    // === FOLLOW-UP DIA 7 (segundo e último) ===
    // Buscar serviços com follow-up dia 3 enviado há mais de 4 dias (total 7 dias desde recusa)
    const quatroDiasAtrasDoFollowup = new Date(agora.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: servicosDia7, error: errDia7 } = await supabase
      .from('servicos')
      .select('id, associado_id, veiculo_id, ressalvas_instalador, followup_recusa_enviado_em')
      .eq('decisao_instalador', 'negado')
      .eq('status', 'em_analise')
      .not('followup_recusa_enviado_em', 'is', null)
      .lte('followup_recusa_enviado_em', quatroDiasAtrasDoFollowup)
      .limit(50);

    if (errDia7) {
      console.error('[cron-followup-recusa] Erro ao buscar serviços dia 7:', errDia7);
    }

    if (servicosDia7 && servicosDia7.length > 0) {
      console.log(`[cron-followup-recusa] ${servicosDia7.length} serviços para follow-up dia 7`);

      for (const servico of servicosDia7) {
        // Verificar se já enviou follow-up dia 7 (checando whatsapp_mensagens)
        const { data: jaEnviou } = await supabase
          .from('whatsapp_mensagens')
          .select('id')
          .eq('referencia_tipo', 'followup_recusa_dia7')
          .eq('referencia_id', servico.id)
          .limit(1);

        if (jaEnviou && jaEnviou.length > 0) continue;

        try {
          const { data: veiculo } = await supabase
            .from('veiculos')
            .select('placa')
            .eq('id', servico.veiculo_id)
            .single();

          const placa = veiculo?.placa || '';

          await supabase.functions.invoke('notificar-cliente', {
            body: {
              tipo: 'followup_recusa_dia7',
              associado_id: servico.associado_id,
              dados: {
                placa,
                orientacoes_resolucao: getOrientacoes(servico.ressalvas_instalador || 'outro'),
              },
            },
          });

          followupsDia7++;
          console.log(`[cron-followup-recusa] Follow-up dia 7 enviado para serviço ${servico.id}`);
        } catch (err) {
          console.error(`[cron-followup-recusa] Erro processando follow-up dia 7 serviço ${servico.id}:`, err);
        }
      }
    }

    const resumo = `Follow-ups enviados: Dia 3 = ${followupsDia3}, Dia 7 = ${followupsDia7}`;
    console.log(`[cron-followup-recusa] ${resumo}`);

    return new Response(
      JSON.stringify({ success: true, resumo, followupsDia3, followupsDia7 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[cron-followup-recusa] Erro:', msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
