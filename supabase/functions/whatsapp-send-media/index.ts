import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendMediaPayload {
  telefone: string;
  media_url?: string;
  media_base64?: string;
  media_type: 'image' | 'document' | 'audio' | 'video';
  mimetype: string;
  filename?: string;
  caption?: string;
  instancia_id?: string;
  referencia_tipo?: string;
  referencia_id?: string;
  verificar_conexao_real?: boolean;
}

function formatarTelefone(telefone: string): string {
  let limpo = telefone.replace(/\D/g, '');
  if (!limpo.startsWith('55')) limpo = '55' + limpo;
  return limpo;
}

async function enviarMediaViaMeta(
  supabase: any,
  telefoneFormatado: string,
  payload: SendMediaPayload,
) {
  const accessToken = Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
  if (!accessToken) throw new Error("META_WHATSAPP_ACCESS_TOKEN não configurado");

  const { data: metaConfig } = await supabase
    .from("whatsapp_meta_config")
    .select("phone_number_id")
    .eq("ativo", true)
    .single();

  if (!metaConfig?.phone_number_id) throw new Error("Configuração da Meta não encontrada");

  const mediaUrl = payload.media_url;
  if (!mediaUrl) throw new Error("media_url é obrigatório para envio via Meta");

  const metaBody: any = {
    messaging_product: "whatsapp",
    to: telefoneFormatado,
    type: payload.media_type,
  };

  // Montar payload conforme tipo de mídia
  if (payload.media_type === 'image') {
    metaBody.image = { link: mediaUrl, caption: payload.caption || '' };
  } else if (payload.media_type === 'document') {
    metaBody.document = { link: mediaUrl, caption: payload.caption || '', filename: payload.filename || 'documento' };
  } else if (payload.media_type === 'audio') {
    metaBody.audio = { link: mediaUrl };
  } else if (payload.media_type === 'video') {
    metaBody.video = { link: mediaUrl, caption: payload.caption || '' };
  }

  console.log(`[whatsapp-send-media] Enviando ${payload.media_type} via Meta para ${telefoneFormatado}`);

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${metaConfig.phone_number_id}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metaBody),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    console.error("[whatsapp-send-media] Erro Meta:", result);
    throw new Error(result.error?.message || "Erro ao enviar mídia via Meta");
  }

  const messageId = result.messages?.[0]?.id;

  await supabase.from("whatsapp_mensagens").insert({
    telefone: telefoneFormatado,
    tipo: payload.media_type,
    mensagem: payload.caption || null,
    media_url: mediaUrl,
    media_mimetype: payload.mimetype,
    media_filename: payload.filename || null,
    direcao: "saida",
    status: "enviada",
    message_id: messageId,
    referencia_tipo: payload.referencia_tipo || null,
    referencia_id: payload.referencia_id || null,
    provedor: "meta_oficial",
  });

  console.log(`[whatsapp-send-media] ✓ Meta: ${telefoneFormatado} - ID: ${messageId}`);
  return { success: true, mensagem_id: messageId, message_id: messageId };
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
    const payload: SendMediaPayload = await req.json();

    if (!payload.telefone) throw new Error('telefone é obrigatório');
    if (!payload.media_url && !payload.media_base64) throw new Error('media_url ou media_base64 é obrigatório');
    if (!payload.media_type) throw new Error('media_type é obrigatório');
    if (!payload.mimetype) throw new Error('mimetype é obrigatório');
    if (payload.media_type === 'document' && !payload.filename) throw new Error('filename é obrigatório para documentos');

    const telefoneFormatado = formatarTelefone(payload.telefone);

    // Verificar provedor ativo
    const { data: metaConfig } = await supabase
      .from("whatsapp_meta_config")
      .select("ativo")
      .limit(1)
      .maybeSingle();

    if (metaConfig?.ativo === true) {
      const result = await enviarMediaViaMeta(supabase, telefoneFormatado, payload);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ====== EVOLUTION API (fluxo original) ======
    let query = supabase.from('whatsapp_instancias').select('*').eq('ativa', true);
    if (payload.instancia_id) {
      query = query.eq('id', payload.instancia_id);
    } else {
      query = query.eq('principal', true);
    }

    const { data: instancia, error: instanciaError } = await query.single();
    if (instanciaError || !instancia) throw new Error('Nenhuma instância WhatsApp ativa encontrada');

    if (instancia.status !== 'open') {
      console.log(`[whatsapp-send-media] WhatsApp desconectado. Status: ${instancia.status}`);
      return new Response(
        JSON.stringify({ success: false, error: 'WhatsApp não está conectado.', status: instancia.status }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('EVOLUTION_API_KEY');
    if (!apiKey) throw new Error('EVOLUTION_API_KEY não configurada');

    // Verificação real (opcional)
    if (payload.verificar_conexao_real) {
      const statusResponse = await fetch(
        `${instancia.api_url}/instance/connectionState/${instancia.instance_name}`,
        { method: 'GET', headers: { 'apikey': apiKey } }
      );
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        if (statusData.instance?.state !== 'open') {
          await supabase.from('whatsapp_instancias')
            .update({ status: 'disconnected', updated_at: new Date().toISOString() })
            .eq('id', instancia.id);
          return new Response(
            JSON.stringify({ success: false, error: 'WhatsApp desconectou.', status: 'disconnected' }),
            { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Registrar no banco
    const { data: msgDb, error: insertError } = await supabase
      .from('whatsapp_mensagens')
      .insert({
        instancia_id: instancia.id,
        telefone: telefoneFormatado,
        tipo: payload.media_type,
        mensagem: payload.caption || null,
        media_url: payload.media_url || null,
        media_mimetype: payload.mimetype,
        media_filename: payload.filename || null,
        status: 'enviando',
        referencia_tipo: payload.referencia_tipo || null,
        referencia_id: payload.referencia_id || null,
        direcao: 'saida',
      })
      .select()
      .single();

    if (insertError) throw new Error('Erro ao registrar mensagem no banco');

    const mediaBody: Record<string, unknown> = {
      number: telefoneFormatado,
      mediatype: payload.media_type,
      mimetype: payload.mimetype,
      caption: payload.caption || '',
      media: payload.media_base64 || payload.media_url,
    };
    if (payload.filename) mediaBody.fileName = payload.filename;

    const response = await fetch(
      `${instancia.api_url}/message/sendMedia/${instancia.instance_name}`,
      {
        method: 'POST',
        headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(mediaBody)
      }
    );

    const result = await response.json();

    await supabase.from('whatsapp_logs').insert({
      instancia_id: instancia.id, tipo: 'api_call', evento: 'sendMedia',
      payload: mediaBody, resposta: result,
    });

    if (result.key?.id) {
      await supabase.from('whatsapp_mensagens')
        .update({ status: 'enviada', message_id: result.key.id, sent_at: new Date().toISOString() })
        .eq('id', msgDb.id);

      return new Response(
        JSON.stringify({ success: true, mensagem_id: msgDb.id, message_id: result.key.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      const erroMsg = result.message || result.error || 'Erro ao enviar mídia';
      await supabase.from('whatsapp_mensagens')
        .update({ status: 'erro', erro_mensagem: erroMsg })
        .eq('id', msgDb.id);
      throw new Error(erroMsg);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro whatsapp-send-media:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
