import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendLocationPayload {
  telefone: string;
  latitude: number;
  longitude: number;
  name?: string;           // Nome do local (aparece em negrito no WhatsApp)
  address?: string;        // Endereço formatado (aparece abaixo do nome)
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

// Validar coordenadas
function validarCoordenadas(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
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
    const payload: SendLocationPayload = await req.json();
    console.log('[whatsapp-send-location] Payload recebido:', JSON.stringify(payload));

    // Validações
    if (!payload.telefone) {
      throw new Error('telefone é obrigatório');
    }
    if (payload.latitude === undefined || payload.longitude === undefined) {
      throw new Error('latitude e longitude são obrigatórios');
    }
    if (!validarCoordenadas(payload.latitude, payload.longitude)) {
      throw new Error('Coordenadas inválidas. Latitude deve estar entre -90 e 90, longitude entre -180 e 180');
    }

    const telefoneFormatado = formatarTelefone(payload.telefone);

    // Buscar instância ativa
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
      console.error('[whatsapp-send-location] Instância não encontrada:', instanciaError);
      throw new Error('Nenhuma instância WhatsApp ativa encontrada');
    }

    // Verificar status da conexão
    if (instancia.status !== 'open') {
      console.log(`[whatsapp-send-location] WhatsApp desconectado. Status: ${instancia.status}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'WhatsApp não está conectado. Acesse as configurações para reconectar.',
          status: instancia.status
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('EVOLUTION_API_KEY');
    if (!apiKey) {
      throw new Error('EVOLUTION_API_KEY não configurada');
    }

    // Buscar endereço via reverse geocoding se não fornecido
    let locationName = payload.name || 'Localização';
    let locationAddress = payload.address || '';

    if (!payload.address) {
      try {
        console.log('[whatsapp-send-location] Buscando endereço via reverse geocoding...');
        const geocodeResponse = await fetch(
          `${supabaseUrl}/functions/v1/reverse-geocode`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              latitude: payload.latitude,
              longitude: payload.longitude,
            }),
          }
        );

        if (geocodeResponse.ok) {
          const geocodeData = await geocodeResponse.json();
          if (geocodeData.success && geocodeData.endereco_completo) {
            locationAddress = geocodeData.endereco_completo;
            console.log('[whatsapp-send-location] Endereço obtido:', locationAddress);
          }
        }
      } catch (geoErr) {
        console.warn('[whatsapp-send-location] Erro no geocoding (continuando):', geoErr);
      }
    }

    // Se ainda não tiver endereço, usar coordenadas
    if (!locationAddress) {
      locationAddress = `${payload.latitude.toFixed(6)}, ${payload.longitude.toFixed(6)}`;
    }

    // Truncar para limites da API
    locationName = locationName.substring(0, 200);
    locationAddress = locationAddress.substring(0, 500);

    // Registrar no banco
    const { data: msgDb, error: insertError } = await supabase
      .from('whatsapp_mensagens')
      .insert({
        instancia_id: instancia.id,
        telefone: telefoneFormatado,
        tipo: 'location',
        mensagem: `📍 ${locationName}: ${locationAddress}`,
        status: 'enviando',
        referencia_tipo: payload.referencia_tipo || null,
        referencia_id: payload.referencia_id || null,
        direcao: 'saida',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[whatsapp-send-location] Erro ao inserir mensagem:', insertError);
      throw new Error('Erro ao registrar mensagem no banco');
    }

    // Montar body para Evolution API - POST /message/sendLocation/{instanceName}
    const locationBody = {
      number: telefoneFormatado,
      name: locationName,
      address: locationAddress,
      latitude: payload.latitude,
      longitude: payload.longitude,
    };

    console.log('[whatsapp-send-location] Enviando para Evolution API:', JSON.stringify(locationBody));

    // Enviar via Evolution API
    const response = await fetch(
      `${instancia.api_url}/message/sendLocation/${instancia.instance_name}`,
      {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(locationBody)
      }
    );

    const result = await response.json();
    console.log('[whatsapp-send-location] Resposta Evolution API:', JSON.stringify(result));

    // Log da chamada
    await supabase
      .from('whatsapp_logs')
      .insert({
        instancia_id: instancia.id,
        tipo: 'api_call',
        evento: 'sendLocation',
        payload: locationBody,
        resposta: result,
      });

    if (result.key?.id) {
      // Sucesso - atualizar mensagem
      await supabase
        .from('whatsapp_mensagens')
        .update({
          status: 'enviada',
          message_id: result.key.id,
          sent_at: new Date().toISOString(),
        })
        .eq('id', msgDb.id);

      console.log('[whatsapp-send-location] Localização enviada com sucesso:', result.key.id);

      return new Response(
        JSON.stringify({
          success: true,
          mensagem_id: msgDb.id,
          message_id: result.key.id,
          location: {
            name: locationName,
            address: locationAddress,
            latitude: payload.latitude,
            longitude: payload.longitude,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Erro na Evolution API
      const erroMsg = result.message || result.error || 'Erro ao enviar localização';
      
      await supabase
        .from('whatsapp_mensagens')
        .update({
          status: 'erro',
          erro_mensagem: erroMsg,
        })
        .eq('id', msgDb.id);

      console.error('[whatsapp-send-location] Erro Evolution API:', erroMsg);
      throw new Error(erroMsg);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[whatsapp-send-location] Erro:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
