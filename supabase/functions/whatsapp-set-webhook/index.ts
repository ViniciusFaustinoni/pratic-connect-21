import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = 'https://iyxdgmukrrdkffraptsx.supabase.co'
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { instancia_id } = await req.json();

    console.log('[whatsapp-set-webhook] Iniciando configuração para instância:', instancia_id);

    // Buscar instância (principal se não informada)
    const { data: instancia, error } = await supabase
      .from('whatsapp_instancias')
      .select('*')
      .eq(instancia_id ? 'id' : 'principal', instancia_id || true)
      .eq('ativa', true)
      .single();

    if (error || !instancia) {
      console.error('[whatsapp-set-webhook] Instância não encontrada:', error);
      throw new Error('Instância não encontrada');
    }

    console.log('[whatsapp-set-webhook] Instância encontrada:', instancia.instance_name);

    const apiKey = Deno.env.get('EVOLUTION_API_KEY');
    if (!apiKey) {
      throw new Error('EVOLUTION_API_KEY não configurada');
    }

    // Configurar webhook na Evolution API
    const webhookPayload = {
      url: WEBHOOK_URL,
      enabled: true,
      webhook_by_events: false,
      webhook_base64: false,
      events: [
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'CONNECTION_UPDATE'
      ]
    };

    console.log('[whatsapp-set-webhook] Enviando configuração para Evolution API:', {
      url: `${instancia.api_url}/webhook/set/${instancia.instance_name}`,
      payload: webhookPayload
    });

    const response = await fetch(
      `${instancia.api_url}/webhook/set/${instancia.instance_name}`,
      {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(webhookPayload)
      }
    );

    const responseText = await response.text();
    console.log('[whatsapp-set-webhook] Resposta Evolution API:', response.status, responseText);

    if (!response.ok) {
      throw new Error(`Erro ao configurar webhook: ${response.status} - ${responseText}`);
    }

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    // Atualizar banco com webhook configurado
    const { error: updateError } = await supabase
      .from('whatsapp_instancias')
      .update({
        webhook_url: WEBHOOK_URL,
        webhook_enabled: true,
        webhook_events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'],
        updated_at: new Date().toISOString(),
      })
      .eq('id', instancia.id);

    if (updateError) {
      console.error('[whatsapp-set-webhook] Erro ao atualizar banco:', updateError);
    }

    // Registrar log
    await supabase
      .from('whatsapp_logs')
      .insert({
        instancia_id: instancia.id,
        tipo: 'webhook_config',
        evento: 'webhook_set',
        payload: webhookPayload,
        resposta: responseData,
      });

    console.log('[whatsapp-set-webhook] Webhook configurado com sucesso!');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook configurado com sucesso',
        webhook_url: WEBHOOK_URL,
        instancia: {
          id: instancia.id,
          nome: instancia.nome,
          instance_name: instancia.instance_name,
        },
        evolution_response: responseData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[whatsapp-set-webhook] Erro:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
