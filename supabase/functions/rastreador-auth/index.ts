import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCredenciaisSoftruck, getCredenciaisRedeVeiculos } from '../_shared/credenciais-hibridas.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AuthResult {
  token: string;
  refresh_token?: string;
  expires_at: Date;
  renovado_via?: 'cache' | 'refresh_token' | 'login_completo';
}

/**
 * Autenticação Softruck (OAuth JWT)
 * Usa credenciais híbridas (banco > ENV)
 */
// deno-lint-ignore no-explicit-any
async function authSoftruck(
  supabase: any,
  baseUrl: string, 
  existingRefreshToken?: string | null
): Promise<AuthResult> {
  const credenciais = await getCredenciaisSoftruck(supabase);

  if (!credenciais) {
    throw new Error('Credenciais Softruck não configuradas. Configure em Configurações > Integrações.');
  }

  const { public_key: publicKey, username, password } = credenciais;

  // Tentar usar refresh_token primeiro (se disponível)
  if (existingRefreshToken) {
    try {
      console.log('[Softruck Auth] Tentando renovar via refresh_token...');
      
      const refreshResponse = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'public-key': publicKey,
        },
        body: JSON.stringify({ refresh_token: existingRefreshToken })
      });

      if (refreshResponse.ok) {
        const data = await refreshResponse.json();
        
        if (data.data?.token) {
          console.log('[Softruck Auth] Token renovado via refresh_token');
          
          // Token renovado expira em ~7 dias
          const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          
          return {
            token: data.data.token,
            refresh_token: data.data.refresh_token || existingRefreshToken,
            expires_at,
            renovado_via: 'refresh_token',
          };
        }
      } else {
        console.log('[Softruck Auth] Refresh falhou, fazendo login completo');
      }
    } catch (e) {
      console.log('[Softruck Auth] Erro no refresh, fazendo login completo:', e);
    }
  }

  // Login completo
  console.log('[Softruck Auth] Autenticando via login...');
  
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
    console.error('[Softruck Auth] Erro login:', response.status, errorText);
    throw new Error(`Falha auth Softruck: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  
  if (!data.data?.token) {
    throw new Error('Token Softruck não retornado na resposta');
  }
  
  console.log('[Softruck Auth] Login completo com sucesso');
  
  // Token Softruck expira em ~7 dias (604800 segundos)
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  
  return {
    token: data.data.token,
    refresh_token: data.data.refresh_token,
    expires_at,
    renovado_via: 'login_completo',
  };
}

/**
 * RedeVeículos usa token fixo (Bearer)
 * Usa credenciais híbridas (banco > ENV)
 */
// deno-lint-ignore no-explicit-any
async function authRedeVeiculos(supabase: any): Promise<AuthResult> {
  const credenciais = await getCredenciaisRedeVeiculos(supabase);
  
  if (!credenciais) {
    throw new Error('Token Rede Veículos não configurado. Configure em Configurações > Integrações.');
  }
  
  // Token fixo - expiração longa (1 ano)
  const expires_at = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  
  return { token: credenciais.bearer_token, expires_at, renovado_via: 'cache' };
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
        console.log(`[Auth] Token ${plataforma} retornado do cache`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            token: cached.token,
            refresh_token: cached.refresh_token,
            from_cache: true,
            expires_at: cached.expires_at,
            renovado_via: 'cache',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Buscar refresh_token existente para tentar renovação (Softruck)
    let existingRefreshToken: string | null = null;
    if (plataforma === 'softruck') {
      const { data: tokenWithRefresh } = await supabase
        .from('rastreadores_tokens_cache')
        .select('refresh_token')
        .eq('plataforma', 'softruck')
        .not('refresh_token', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      existingRefreshToken = tokenWithRefresh?.refresh_token || null;
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

    // Autenticar
    let authResult: AuthResult;
    
    if (plataforma === 'softruck') {
      authResult = await authSoftruck(supabase, baseUrl, existingRefreshToken);
    } else {
      authResult = await authRedeVeiculos(supabase);
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

    // Registrar log de sucesso
    await supabase
      .from('rastreadores_logs')
      .insert({
        plataforma,
        operacao: 'autenticacao',
        status: 'sucesso',
        request: { force_refresh, renovado_via: authResult.renovado_via },
      });

    console.log(`[Auth] Token ${plataforma} obtido via: ${authResult.renovado_via}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        token: authResult.token,
        refresh_token: authResult.refresh_token,
        from_cache: false,
        expires_at: authResult.expires_at.toISOString(),
        renovado_via: authResult.renovado_via,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro auth rastreador:', error);
    
    // Registrar log de erro
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      
      await supabase
        .from('rastreadores_logs')
        .insert({
          plataforma: 'softruck',
          operacao: 'autenticacao',
          status: 'erro',
          erro_mensagem: error instanceof Error ? error.message : 'Erro desconhecido',
        });
    } catch (logError) {
      console.error('Falha ao registrar log de erro:', logError);
    }
    
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
