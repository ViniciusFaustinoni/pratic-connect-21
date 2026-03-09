import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json() as NotificacaoManutencaoPayload;
    
    console.log('[notificar-manutencao-whatsapp] Payload recebido:', JSON.stringify(payload));

    if (!payload.telefone || !payload.nome_associado || !payload.data_agendada) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campos obrigatórios faltando' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      mensagem = `Olá ${payload.nome_associado}, sua Praticcar informa: foi agendada uma visita técnica para manutenção do rastreador do seu veículo para o dia ${dataFormatada} no período da ${periodoTexto}. Nosso técnico irá até o endereço informado. Por favor, esteja disponível no local. Dúvidas? Entre em contato conosco.`;
    }

    // Enviar via whatsapp-send-text
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data, error } = await supabase.functions.invoke('whatsapp-send-text', {
      body: {
        telefone: payload.telefone,
        mensagem,
        template_name: 'assistencia_confirmada',
        template_params: [
          payload.nome_associado,
          'Técnico Praticcar',
          `${dataFormatada} (${periodoTexto})`,
        ],
      }
    });

    if (error) {
      console.error('[notificar-manutencao-whatsapp] Erro ao invocar whatsapp-send-text:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao enviar mensagem' }),
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
