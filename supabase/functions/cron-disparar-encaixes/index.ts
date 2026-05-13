// @ts-nocheck
// Dispara confirmações de encaixe enfileiradas (5min após criação).
// Lê confirmacoes_agendamento com status='aguardando_disparo' e enviar_apos<=now()
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: pendentes, error } = await supabase
    .from('confirmacoes_agendamento')
    .select('id, telefone, payload_disparo, servico_id')
    .eq('status', 'aguardando_disparo')
    .lte('enviar_apos', new Date().toISOString())
    .limit(50);

  if (error) {
    console.error('[cron-disparar-encaixes] Query error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let enviados = 0;
  for (const conf of (pendentes || [])) {
    const payload = conf.payload_disparo || {};
    try {
      // Lock CAS: marcar como 'enviada' antes do envio
      const { data: lock } = await supabase
        .from('confirmacoes_agendamento')
        .update({ status: 'enviada', mensagem_enviada_em: new Date().toISOString() })
        .eq('id', conf.id)
        .eq('status', 'aguardando_disparo')
        .select('id');
      if (!lock?.length) continue;

      await supabase.functions.invoke('whatsapp-send-text', {
        body: {
          telefone: conf.telefone,
          mensagem: payload.mensagem || '',
          template_name: 'confirmacao_agendamento_v1',
          template_params: payload.template_params || [],
        },
      });

      // Sincronizar lock no servico
      if (conf.servico_id) {
        await supabase
          .from('servicos')
          .update({ confirmacao_whatsapp: 'aguardando_confirmacao_encaixe' })
          .eq('id', conf.servico_id)
          .is('confirmacao_whatsapp', null);
      }
      enviados++;
    } catch (e) {
      console.error('[cron-disparar-encaixes] Falha ao enviar', conf.id, e);
      await supabase
        .from('confirmacoes_agendamento')
        .update({ status: 'erro_envio' })
        .eq('id', conf.id);
    }
  }

  return new Response(JSON.stringify({ processados: pendentes?.length || 0, enviados }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
