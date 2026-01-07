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
}

function formatarTelefone(telefone: string): string {
  let limpo = telefone.replace(/\D/g, '');
  if (!limpo.startsWith('55')) {
    limpo = '55' + limpo;
  }
  return limpo;
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

    // Validações
    if (!payload.telefone) {
      throw new Error('telefone é obrigatório');
    }
    if (!payload.media_url && !payload.media_base64) {
      throw new Error('media_url ou media_base64 é obrigatório');
    }
    if (!payload.media_type) {
      throw new Error('media_type é obrigatório');
    }
    if (!payload.mimetype) {
      throw new Error('mimetype é obrigatório');
    }
    if (payload.media_type === 'document' && !payload.filename) {
      throw new Error('filename é obrigatório para documentos');
    }

    const telefoneFormatado = formatarTelefone(payload.telefone);

    // Buscar instância
    let query = supabase
      .from('whatsapp_instancias')
      .select('*')
      .eq('ativa', true);

    if (payload.instancia_id) {
      query = query.eq('id', payload.instancia_id);
    } else {
      query = query.eq('principal', true);
    }

    const { data: instancia, error: instanciaError } = await query.single();

    if (instanciaError || !instancia) {
      throw new Error('Nenhuma instância WhatsApp ativa encontrada');
    }

    if (instancia.status !== 'open') {
      throw new Error('WhatsApp não está conectado');
    }

    const apiKey = Deno.env.get('EVOLUTION_API_KEY');
    if (!apiKey) {
      throw new Error('EVOLUTION_API_KEY não configurada');
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

    if (insertError) {
      console.error('Erro ao inserir mensagem:', insertError);
      throw new Error('Erro ao registrar mensagem no banco');
    }

    // Montar body para Evolution API
    const mediaBody: Record<string, unknown> = {
      number: telefoneFormatado,
      mediatype: payload.media_type,
      mimetype: payload.mimetype,
      caption: payload.caption || '',
      media: payload.media_base64 || payload.media_url,
    };

    if (payload.filename) {
      mediaBody.fileName = payload.filename;
    }

    // Enviar via Evolution API
    const response = await fetch(
      `${instancia.api_url}/message/sendMedia/${instancia.instance_name}`,
      {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mediaBody)
      }
    );

    const result = await response.json();

    // Log da resposta
    await supabase
      .from('whatsapp_logs')
      .insert({
        instancia_id: instancia.id,
        tipo: 'api_call',
        evento: 'sendMedia',
        payload: mediaBody,
        resposta: result,
      });

    if (result.key?.id) {
      await supabase
        .from('whatsapp_mensagens')
        .update({
          status: 'enviada',
          message_id: result.key.id,
          sent_at: new Date().toISOString(),
        })
        .eq('id', msgDb.id);

      return new Response(
        JSON.stringify({
          success: true,
          mensagem_id: msgDb.id,
          message_id: result.key.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      const erroMsg = result.message || result.error || 'Erro ao enviar mídia';
      
      await supabase
        .from('whatsapp_mensagens')
        .update({
          status: 'erro',
          erro_mensagem: erroMsg,
        })
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
