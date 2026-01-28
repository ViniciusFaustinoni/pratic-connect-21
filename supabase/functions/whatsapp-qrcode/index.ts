import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Normalizar base64 - garantir que tenha o prefixo correto
function normalizeBase64(data: string | undefined): string | undefined {
  if (!data) return undefined;
  // Se já tem o prefixo data:image, retornar como está
  if (data.startsWith('data:image')) {
    return data;
  }
  // Se não tem, adicionar o prefixo
  return `data:image/png;base64,${data}`;
}

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

    // Buscar instância
    const { data: instancia, error } = await supabase
      .from('whatsapp_instancias')
      .select('*')
      .eq(instancia_id ? 'id' : 'principal', instancia_id || true)
      .eq('ativa', true)
      .single();

    if (error || !instancia) {
      throw new Error('Instância não encontrada');
    }

    const apiKey = Deno.env.get('EVOLUTION_API_KEY');
    if (!apiKey) {
      throw new Error('EVOLUTION_API_KEY não configurada');
    }

    // Primeiro, verificar se a instância existe na Evolution API
    const checkResponse = await fetch(
      `${instancia.api_url}/instance/fetchInstances`,
      {
        method: 'GET',
        headers: { 'apikey': apiKey }
      }
    );

    let instanceExists = false;
    if (checkResponse.ok) {
      const instances = await checkResponse.json();
      instanceExists = Array.isArray(instances) && 
        instances.some((i: { name?: string }) => i.name === instancia.instance_name);
    }

    // Se não existe, criar a instância
    if (!instanceExists) {
      console.log('Criando instância:', instancia.instance_name);
      
      const createResponse = await fetch(
        `${instancia.api_url}/instance/create`,
        {
          method: 'POST',
          headers: { 
            'apikey': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            instanceName: instancia.instance_name,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS',
          })
        }
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('Erro ao criar instância:', errorText);
        throw new Error('Erro ao criar instância na Evolution API');
      }

      const createData = await createResponse.json();
      
      // Log da criação
      await supabase
        .from('whatsapp_logs')
        .insert({
          instancia_id: instancia.id,
          tipo: 'instance_create',
          evento: 'create',
          resposta: createData,
        });

      // Atualizar status
      await supabase
        .from('whatsapp_instancias')
        .update({
          status: 'qrcode',
          updated_at: new Date().toISOString(),
        })
        .eq('id', instancia.id);

      return new Response(
        JSON.stringify({
          success: true,
          qrcode: normalizeBase64(createData.qrcode?.base64),
          code: createData.qrcode?.code,
          pairingCode: createData.qrcode?.pairingCode,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Instância existe, solicitar QR Code para conectar
    const response = await fetch(
      `${instancia.api_url}/instance/connect/${instancia.instance_name}`,
      {
        method: 'GET',
        headers: { 'apikey': apiKey }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro ao obter QR Code:', errorText);
      throw new Error('Erro ao obter QR Code');
    }

    const data = await response.json();

    // Atualizar status
    await supabase
      .from('whatsapp_instancias')
      .update({
        status: 'qrcode',
        updated_at: new Date().toISOString(),
      })
      .eq('id', instancia.id);

    // Log
    await supabase
      .from('whatsapp_logs')
      .insert({
        instancia_id: instancia.id,
        tipo: 'qrcode_request',
        evento: 'connect',
        resposta: { hasQrcode: !!data.base64 },
      });

    return new Response(
      JSON.stringify({
        success: true,
        qrcode: normalizeBase64(data.base64),
        code: data.code,
        pairingCode: data.pairingCode,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao obter QR Code:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
