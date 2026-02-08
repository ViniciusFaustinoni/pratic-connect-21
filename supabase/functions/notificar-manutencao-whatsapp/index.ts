import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificacaoManutencaoPayload {
  telefone: string;
  nome_associado: string;
  data_agendada: string;
  periodo: 'manha' | 'tarde';
  tipo_local: 'base' | 'rota' | 'ponto_instalacao';
  endereco?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json() as NotificacaoManutencaoPayload;
    
    console.log('[notificar-manutencao-whatsapp] Payload recebido:', JSON.stringify(payload));

    // Validar campos obrigatórios
    if (!payload.telefone || !payload.nome_associado || !payload.data_agendada) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campos obrigatórios faltando' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o webhook está configurado
    const webhookUrl = Deno.env.get('N8N_WEBHOOK_URL_MANUTENCAO');
    if (!webhookUrl) {
      console.warn('[notificar-manutencao-whatsapp] N8N_WEBHOOK_URL_MANUTENCAO não configurada');
      return new Response(
        JSON.stringify({ success: false, reason: 'webhook_not_configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Formatar data
    const dataFormatada = new Date(payload.data_agendada).toLocaleDateString('pt-BR');
    const periodoTexto = payload.periodo === 'manha' ? 'manhã' : 'tarde';

    // Montar mensagem conforme tipo de local
    let mensagem: string;
    
    if (payload.tipo_local === 'base' || payload.tipo_local === 'ponto_instalacao') {
      mensagem = `Olá ${payload.nome_associado}, sua Praticcar informa: foi agendada uma manutenção do rastreador do seu veículo para o dia ${dataFormatada} no período da ${periodoTexto}. Por favor, compareça à nossa sede no endereço: ${payload.endereco || 'Sede Praticcar'}. Prazo: 48 horas. Em caso de não comparecimento, as proteções contra roubo, furto e colisão poderão ser suspensas. Dúvidas? Entre em contato conosco.`;
    } else {
      // tipo_local === 'rota'
      mensagem = `Olá ${payload.nome_associado}, sua Praticcar informa: foi agendada uma visita técnica para manutenção do rastreador do seu veículo para o dia ${dataFormatada} no período da ${periodoTexto}. Nosso técnico irá até o endereço informado. Por favor, esteja disponível no local. Dúvidas? Entre em contato conosco.`;
    }

    // Limpar telefone (apenas números)
    const telefoneLimpo = payload.telefone.replace(/\D/g, '');

    // Preparar payload para o webhook
    const webhookPayload = {
      telefone: telefoneLimpo,
      mensagem,
      tipo: 'manutencao_agendamento',
      dados: {
        nome_associado: payload.nome_associado,
        data_agendada: payload.data_agendada,
        periodo: payload.periodo,
        tipo_local: payload.tipo_local,
        endereco: payload.endereco,
      },
    };

    console.log('[notificar-manutencao-whatsapp] Enviando para webhook n8n...');

    // Enviar para o webhook n8n
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload),
    });

    if (!webhookResponse.ok) {
      console.error('[notificar-manutencao-whatsapp] Erro do webhook:', webhookResponse.status);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao enviar para webhook' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[notificar-manutencao-whatsapp] Notificação enviada com sucesso');

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[notificar-manutencao-whatsapp] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
