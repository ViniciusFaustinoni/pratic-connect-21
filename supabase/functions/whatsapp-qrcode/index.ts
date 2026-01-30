import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const WEBHOOK_URL = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
    
    const supabase = createClient(
      supabaseUrl,
      supabaseServiceKey
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
      `${instancia.api_url}/instance/fetchInstances?instanceName=${instancia.instance_name}`,
      {
        method: 'GET',
        headers: { 'apikey': apiKey }
      }
    );

    let instanceExists = false;
    if (checkResponse.ok) {
      const instances = await checkResponse.json();
      // Evolution API v2.3 retorna array com instanceName (não name)
      instanceExists = Array.isArray(instances) && 
        instances.some((i: { instanceName?: string; name?: string }) => 
          i.instanceName === instancia.instance_name || i.name === instancia.instance_name
        );
      console.log('[whatsapp-qrcode] Instância existente:', instanceExists, 'instances:', JSON.stringify(instances).slice(0, 300));
    }

    // Se não existe, criar a instância
    if (!instanceExists) {
      console.log('[whatsapp-qrcode] Criando instância:', instancia.instance_name);
      
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
            // Webhook com estrutura da v2.3
            webhook: {
              enabled: true,
              url: WEBHOOK_URL,
              byEvents: false,
              base64: false,
              events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE']
            }
          })
        }
      );

      // Se der erro 403 "already in use", a instância já existe - continuar
      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => null);
        console.log('[whatsapp-qrcode] Erro ao criar instância:', JSON.stringify(errorData));
        
        // Verificar se é erro de instância já existente
        const isAlreadyInUse = errorData?.response?.message?.some?.((m: string) => 
          m.includes('already in use')
        );
        
        if (isAlreadyInUse) {
          console.log('[whatsapp-qrcode] Instância já existe, continuando para connect...');
          instanceExists = true;
        } else {
          throw new Error(`Erro ao criar instância: ${JSON.stringify(errorData)}`);
        }
      } else {
        const createData = await createResponse.json();
        console.log('[whatsapp-qrcode] Instância criada:', JSON.stringify(createData).slice(0, 500));
        
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

        // Se a criação já retornou QR Code, usar diretamente
        const qr = createData.qrcode || createData;
        if (qr?.base64 || qr?.code || qr?.pairingCode) {
          return new Response(
            JSON.stringify({
              success: true,
              qrcode: normalizeBase64(qr.base64),
              code: qr.code,
              pairingCode: qr.pairingCode,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Instância existe, solicitar dados de conexão (QR string / pairingCode)
    // Observação: em algumas versões da Evolution API, /connect retorna apenas {count, code, pairingCode}
    // (sem base64). Vamos retentar por alguns segundos até o code aparecer.
    const connectUrl = `${instancia.api_url}/instance/connect/${instancia.instance_name}`;

    let qrcodeBase64: string | undefined;
    let pairingCode: string | undefined;
    let code: string | undefined;
    let count: number | undefined;

    for (let attempt = 1; attempt <= 6; attempt++) {
      const response = await fetch(connectUrl, {
        method: 'GET',
        headers: { 'apikey': apiKey },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro ao obter QR Code:', errorText);
        throw new Error('Erro ao obter QR Code');
      }

      const data = await response.json();
      console.log(`[whatsapp-qrcode] Resposta /connect (tentativa ${attempt}):`, JSON.stringify(data).slice(0, 500));

      // Evolution API pode retornar o QR Code em diferentes formatos
      qrcodeBase64 = data.base64 || data.qrcode?.base64 || data.qrcode;
      pairingCode = data.pairingCode || data.qrcode?.pairingCode;
      code = data.code || data.qrcode?.code;
      count = data.count ?? data.qrcode?.count;

      if (qrcodeBase64 || code || pairingCode) break;

      // Se ainda não veio nada, aguardar um pouco e tentar novamente
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Se a API ficar presa retornando {count: 0} sem code/pairing/base64,
    // tentar reiniciar a instância e solicitar novamente.
    if (!qrcodeBase64 && !code && !pairingCode && (count === 0 || typeof count === 'undefined')) {
      try {
        console.log('[whatsapp-qrcode] Nenhum QR retornado (count=0). Tentando restart da instância...');
        const restartResp = await fetch(
          `${instancia.api_url}/instance/restart/${instancia.instance_name}`,
          { method: 'PUT', headers: { 'apikey': apiKey } }
        );

        console.log('[whatsapp-qrcode] Restart status:', restartResp.status);
        // aguardar um pouco para a instância subir
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const response = await fetch(connectUrl, {
          method: 'GET',
          headers: { 'apikey': apiKey },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[whatsapp-qrcode] Resposta /connect após restart:', JSON.stringify(data).slice(0, 500));
          qrcodeBase64 = data.base64 || data.qrcode?.base64 || data.qrcode;
          pairingCode = data.pairingCode || data.qrcode?.pairingCode;
          code = data.code || data.qrcode?.code;
          count = data.count ?? data.qrcode?.count;
        }
      } catch (e) {
        console.log('[whatsapp-qrcode] Falha ao reiniciar instância:', e);
      }
    }

    // Se não tiver base64, tentar buscar explicitamente via /fetchQrCode (se existir nesta versão)
    if (!qrcodeBase64) {
      console.log('[whatsapp-qrcode] Base64 não retornado em /connect, tentando /fetchQrCode...');

      const qrFetchResponse = await fetch(
        `${instancia.api_url}/instance/fetchQrCode/${instancia.instance_name}`,
        {
          method: 'GET',
          headers: { 'apikey': apiKey }
        }
      );

      if (qrFetchResponse.ok) {
        const qrData = await qrFetchResponse.json();
        console.log('[whatsapp-qrcode] Resposta /fetchQrCode:', JSON.stringify(qrData).slice(0, 500));
        qrcodeBase64 = qrData.base64 || qrData.qrcode?.base64 || qrData.qrcode;
        pairingCode = pairingCode || qrData.pairingCode || qrData.qrcode?.pairingCode;
        code = code || qrData.code || qrData.qrcode?.code;
        count = count ?? qrData.count ?? qrData.qrcode?.count;
      } else {
        console.log('[whatsapp-qrcode] /fetchQrCode retornou erro:', qrFetchResponse.status);
      }
    }

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
        resposta: { hasQrcode: !!qrcodeBase64, hasCode: !!code, hasPairingCode: !!pairingCode },
      });

    return new Response(
      JSON.stringify({
        success: true,
        qrcode: normalizeBase64(qrcodeBase64),
        code: code,
        pairingCode: pairingCode,
        count: count,
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
