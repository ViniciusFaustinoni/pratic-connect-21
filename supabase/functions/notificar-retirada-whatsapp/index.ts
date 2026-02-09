import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json() as NotificacaoRetiradaPayload;
    
    console.log('[notificar-retirada-whatsapp] Payload recebido:', JSON.stringify(payload));

    // Validar campos obrigatórios
    if (!payload.telefone || !payload.nome_associado || !payload.data_agendada) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campos obrigatórios faltando' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o webhook está configurado
    const webhookUrl = Deno.env.get('N8N_WEBHOOK_URL_RETIRADA');
    if (!webhookUrl) {
      console.warn('[notificar-retirada-whatsapp] N8N_WEBHOOK_URL_RETIRADA não configurada');
      return new Response(
        JSON.stringify({ success: false, reason: 'webhook_not_configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Formatar data
    const dataFormatada = new Date(payload.data_agendada).toLocaleDateString('pt-BR');
    const periodoTexto = payload.periodo === 'manha' ? 'manhã' : 'tarde';

    // Montar mensagem conforme regulamento (sem CPF)
    const mensagem = `Prezado(a) ${payload.nome_associado}, informamos que a retirada do equipamento rastreador do veículo ${payload.veiculo_modelo} • ${payload.veiculo_placa} está agendada para ${dataFormatada} no período da ${periodoTexto}. Local: ${payload.local}. Prazo para comparecimento: 48 horas. Em caso de não comparecimento, será aplicada multa de R$400 conforme regulamento. Praticcar.`;

    // Limpar telefone (apenas números)
    const telefoneLimpo = payload.telefone.replace(/\D/g, '');

    // Preparar payload para o webhook
    const webhookPayload = {
      telefone: telefoneLimpo,
      mensagem,
      tipo: 'retirada_agendada',
      dados: {
        nome_associado: payload.nome_associado,
        veiculo_modelo: payload.veiculo_modelo,
        veiculo_placa: payload.veiculo_placa,
        data_agendada: payload.data_agendada,
        periodo: payload.periodo,
        local: payload.local,
        motivo: payload.motivo,
      },
    };

    console.log('[notificar-retirada-whatsapp] Enviando para webhook n8n...');

    // Enviar para o webhook n8n
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
    });

    if (!webhookResponse.ok) {
      console.error('[notificar-retirada-whatsapp] Erro do webhook:', webhookResponse.status);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao enviar para webhook' }),
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
