import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AuthResult {
  token: string;
  refresh_token?: string;
  expires_at: Date;
}

// Credenciais não são mais armazenadas localmente
// Tudo vem dos Supabase Secrets

/**
 * Autenticação Softruck (OAuth JWT)
 */
async function authSoftruck(baseUrl: string): Promise<AuthResult> {
  // Usar apenas secrets (fonte segura)
  const publicKey = Deno.env.get('SOFTRUCK_PUBLIC_KEY');
  const username = Deno.env.get('SOFTRUCK_USERNAME');
  const password = Deno.env.get('SOFTRUCK_PASSWORD');

  if (!publicKey || !username || !password) {
    throw new Error('Credenciais Softruck não configuradas. Configure em Monitoramento > Credenciais API.');
  }

  const response = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'public-key': publicKey,
    },
    body: JSON.stringify({ username, password })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha auth Softruck: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  
  if (!data.data?.token) {
    throw new Error('Token Softruck não retornado na resposta');
  }
  
  // Token Softruck expira em ~7 dias (604800 segundos)
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  
  return {
    token: data.data.token,
    refresh_token: data.data.refresh_token,
    expires_at,
  };
}

/**
 * RedeVeículos usa token fixo (Bearer)
 */
function authRedeVeiculos(): AuthResult {
  // Usar apenas secrets (fonte segura)
  const token = Deno.env.get('REDE_VEICULOS_TOKEN');
  
  if (!token) {
    throw new Error('Token Rede Veículos não configurado. Configure em Monitoramento > Credenciais API.');
  }
  
  // Token fixo - expiração longa (1 ano)
  const expires_at = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  
  return { token, expires_at };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { plataforma, force_refresh } = await req.json();

    // Validar plataforma
    if (!plataforma || !['rede_veiculos', 'softruck'].includes(plataforma)) {
      throw new Error('Plataforma inválida. Use: rede_veiculos ou softruck');
    }

    // Verificar cache de token (se não forçar refresh)
    if (!force_refresh) {
      const { data: cached } = await supabase
        .from('rastreadores_tokens_cache')
        .select('token, refresh_token, expires_at')
        .eq('plataforma', plataforma)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (cached) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            token: cached.token,
            from_cache: true,
            expires_at: cached.expires_at,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Buscar configuração da plataforma
    const { data: config, error: configError } = await supabase
      .from('rastreadores_config_plataformas')
      .select('*')
      .eq('plataforma', plataforma)
      .single();

    if (configError || !config) {
      throw new Error(`Plataforma não configurada: ${plataforma}`);
    }

    if (!config.ativa) {
      throw new Error(`Plataforma ${plataforma} está desativada`);
    }

    const baseUrl = config.ambiente_atual === 'producao' 
      ? config.api_url_producao 
      : config.api_url_sandbox;

    // Autenticar usando secrets
    let authResult: AuthResult;
    
    if (plataforma === 'softruck') {
      authResult = await authSoftruck(baseUrl);
    } else {
      authResult = authRedeVeiculos();
    }

    // Salvar token no cache
    await supabase
      .from('rastreadores_tokens_cache')
      .insert({
        plataforma,
        token: authResult.token,
        refresh_token: authResult.refresh_token || null,
        expires_at: authResult.expires_at.toISOString(),
      });

    // Limpar tokens expirados
    await supabase
      .from('rastreadores_tokens_cache')
      .delete()
      .eq('plataforma', plataforma)
      .lt('expires_at', new Date().toISOString());

    return new Response(
      JSON.stringify({ 
        success: true, 
        token: authResult.token,
        from_cache: false,
        expires_at: authResult.expires_at.toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro auth rastreador:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
