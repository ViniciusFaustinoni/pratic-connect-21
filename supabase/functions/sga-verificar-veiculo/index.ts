import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { placa } = await req.json();

    if (!placa || typeof placa !== 'string' || placa.replace(/[^A-Za-z0-9]/g, '').length < 7) {
      return new Response(
        JSON.stringify({ existe: false, error: 'Placa inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const placaLimpa = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar credenciais Hinova (mesma lógica do sga-hinova-sync)
    let hinovaApiUrl = Deno.env.get('HINOVA_API_URL') || 'https://api.hinova.com.br/api/sga/v2';
    let hinovaToken = Deno.env.get('HINOVA_TOKEN');
    let hinovaUsuario = Deno.env.get('HINOVA_USUARIO');
    let hinovaSenha = Deno.env.get('HINOVA_SENHA');

    if (!hinovaToken || !hinovaUsuario || !hinovaSenha) {
      console.log('[SGA Verificar] Credenciais incompletas em ENV, buscando do banco...');
      try {
        const { data, error } = await supabase
          .from('integracoes_credenciais')
          .select('credenciais_encrypted, iv, configurado')
          .eq('integracao', 'hinova')
          .single();

        if (!error && data?.configurado && data?.credenciais_encrypted && data?.iv) {
          const encoder = new TextEncoder();
          const keyMaterial = await crypto.subtle.importKey(
            'raw', encoder.encode(supabaseServiceKey), { name: 'PBKDF2' }, false, ['deriveKey']
          );
          const key = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: encoder.encode('integracoes_credenciais_salt'), iterations: 100000, hash: 'SHA-256' },
            keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
          );
          const encrypted = Uint8Array.from(atob(data.credenciais_encrypted), c => c.charCodeAt(0));
          const iv = Uint8Array.from(atob(data.iv), c => c.charCodeAt(0));
          const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted);
          const creds = JSON.parse(new TextDecoder().decode(decrypted));

          hinovaToken = creds.token || hinovaToken;
          hinovaUsuario = creds.usuario || hinovaUsuario;
          hinovaSenha = creds.senha || hinovaSenha;
          if (creds.api_url) hinovaApiUrl = creds.api_url;
          console.log('[SGA Verificar] Credenciais carregadas do banco');
        }
      } catch (e) {
        console.error('[SGA Verificar] Erro ao buscar credenciais do banco:', e);
      }
    }

    if (!hinovaToken) {
      console.error('[SGA Verificar] Token Hinova não configurado');
      // Sem credenciais, não podemos verificar — permitir cotação
      return new Response(
        JSON.stringify({ existe: false, aviso: 'Credenciais SGA não configuradas' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Autenticar na API Hinova
    const authResponse = await fetch(`${hinovaApiUrl}/usuario/autenticar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hinovaToken}`,
      },
      body: JSON.stringify({ usuario: hinovaUsuario, senha: hinovaSenha }),
    });

    const authText = await authResponse.text();
    let authData;
    try {
      authData = JSON.parse(authText);
    } catch {
      console.error('[SGA Verificar] Resposta auth não-JSON:', authText.substring(0, 200));
      return new Response(
        JSON.stringify({ existe: false, aviso: 'Erro ao autenticar no SGA' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!authResponse.ok || !authData.token_usuario) {
      console.error('[SGA Verificar] Falha na autenticação:', authData.mensagem);
      return new Response(
        JSON.stringify({ existe: false, aviso: 'Falha na autenticação SGA' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar veículo pela placa
    console.log(`[SGA Verificar] Buscando veículo com placa: ${placaLimpa}`);
    const veiculoResponse = await fetch(`${hinovaApiUrl}/veiculo/buscar/${placaLimpa}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${hinovaToken}`,
        'token_usuario': authData.token_usuario,
      },
    });

    const veiculoText = await veiculoResponse.text();

    // 404 ou resposta vazia = veículo não encontrado
    if (veiculoResponse.status === 404) {
      console.log('[SGA Verificar] Veículo não encontrado (404)');
      return new Response(
        JSON.stringify({ existe: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let veiculoData;
    try {
      veiculoData = JSON.parse(veiculoText);
    } catch {
      console.log('[SGA Verificar] Resposta não-JSON, considerando não encontrado');
      return new Response(
        JSON.stringify({ existe: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se retornou dados válidos
    const veiculoEncontrado = Array.isArray(veiculoData) 
      ? veiculoData.length > 0 
      : (veiculoData && typeof veiculoData === 'object' && veiculoData.codigo_veiculo);

    if (veiculoEncontrado) {
      console.log('[SGA Verificar] Veículo ENCONTRADO no SGA');
      return new Response(
        JSON.stringify({ 
          existe: true, 
          mensagem: 'Veículo já cadastrado no sistema SGA (Hinova)' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[SGA Verificar] Veículo não encontrado no SGA');
    return new Response(
      JSON.stringify({ existe: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SGA Verificar] Erro geral:', error);
    // Em caso de erro, não bloquear a cotação
    return new Response(
      JSON.stringify({ existe: false, aviso: 'Erro ao verificar no SGA' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
