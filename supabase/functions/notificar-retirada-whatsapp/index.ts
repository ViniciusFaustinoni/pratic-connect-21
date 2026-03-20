import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificacaoRetiradaPayload {
  telefone: string;
  nome_associado: string;
  veiculo_modelo: string;
  veiculo_placa: string;
  data_agendada: string;
  periodo: 'manha' | 'tarde';
  local: string;
  motivo?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json() as NotificacaoRetiradaPayload;
    
    console.log('[notificar-retirada-whatsapp] Payload recebido:', JSON.stringify(payload));

    if (!payload.telefone || !payload.nome_associado || !payload.data_agendada) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campos obrigatórios faltando' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enviar via whatsapp-send-text
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Buscar valor da multa da tabela configuracoes
    const { data: cfgMulta } = await supabase.from('configuracoes').select('valor').eq('chave', 'multa_rastreador').single();
    const valorMulta = cfgMulta ? parseInt(cfgMulta.valor) : 400;

    // Formatar data
    const dataFormatada = new Date(payload.data_agendada).toLocaleDateString('pt-BR');
    const periodoTexto = payload.periodo === 'manha' ? 'manhã' : 'tarde';

    // Montar mensagem
    const mensagem = `Prezado(a) ${payload.nome_associado}, informamos que a retirada do equipamento rastreador do veículo ${payload.veiculo_modelo} • ${payload.veiculo_placa} está agendada para ${dataFormatada} no período da ${periodoTexto}. Local: ${payload.local}. Prazo para comparecimento: 48 horas. Em caso de não comparecimento, será aplicada multa de R$${valorMulta} conforme regulamento. Praticcar.`;

    const { data, error } = await supabase.functions.invoke('whatsapp-send-text', {
      body: {
        telefone: payload.telefone,
        mensagem,
        template_name: 'sinistro_atualizado',
        template_params: [
          payload.nome_associado?.split(' ')[0] || 'Associado',
          'Retirada de rastreador',
          `Agendada para ${dataFormatada} - ${periodoTexto}. Local: ${payload.local}`,
        ],
      }
    });

    if (error) {
      console.error('[notificar-retirada-whatsapp] Erro ao invocar whatsapp-send-text:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao enviar mensagem' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[notificar-retirada-whatsapp] Notificação enviada com sucesso');

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[notificar-retirada-whatsapp] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
