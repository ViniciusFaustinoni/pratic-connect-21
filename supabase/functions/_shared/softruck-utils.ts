/**
 * Módulo compartilhado de utilitários Softruck
 * 
 * Funções centralizadas para autenticação e chamadas à API Softruck
 * com tratamento automático de erro 401 e renovação de token
 */

/**
 * Resultado de autenticação Softruck
 */
export interface SoftruckAuthResult {
  token: string;
  refresh_token?: string;
  expires_at: Date;
  from_cache: boolean;
  renovado_via?: 'cache' | 'refresh_token' | 'login_completo';
}

/**
 * Opções para chamada Softruck com retry
 */
export interface SoftruckFetchOptions {
  supabaseUrl: string;
  supabaseKey: string;
  url: string;
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  maxRetries?: number;
}

/**
 * Resultado de uma chamada Softruck
 */
export interface SoftruckFetchResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  tentativas: number;
  token_renovado: boolean;
}

/**
 * Obtém token Softruck via edge function rastreador-auth
 */
export async function getSoftruckToken(
  supabaseUrl: string,
  supabaseKey: string,
  forceRefresh = false
): Promise<SoftruckAuthResult> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/rastreador-auth`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ 
        plataforma: 'softruck', 
        force_refresh: forceRefresh 
      })
    }
  );

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Falha na autenticação Softruck');
  }

  return {
    token: data.token,
    refresh_token: data.refresh_token,
    expires_at: new Date(data.expires_at),
    from_cache: data.from_cache || false,
    renovado_via: data.renovado_via,
  };
}

/**
 * Realiza chamada à API Softruck com retry automático em erro 401
 * 
 * Se receber 401 Unauthorized:
 * 1. Força renovação do token via rastreador-auth
 * 2. Atualiza o header Authorization
 * 3. Repete a chamada
 */
export async function softruckFetchWithRetry<T = unknown>(
  options: SoftruckFetchOptions
): Promise<SoftruckFetchResult<T>> {
  const { 
    supabaseUrl, 
    supabaseKey, 
    url, 
    method = 'GET', 
    body, 
    headers = {},
    maxRetries = 2 
  } = options;

  let tokenRenovado = false;
  let currentToken = headers['Authorization']?.replace('Bearer ', '') || '';
  const publicKey = Deno.env.get('SOFTRUCK_PUBLIC_KEY') || '';

  for (let tentativa = 1; tentativa <= maxRetries; tentativa++) {
    try {
      // Se não tem token, buscar
      if (!currentToken) {
        const auth = await getSoftruckToken(supabaseUrl, supabaseKey, false);
        currentToken = auth.token;
      }

      const fetchHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`,
        'public-key': publicKey,
        ...headers,
      };

      const fetchOptions: RequestInit = {
        method,
        headers: fetchHeaders,
      };

      if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE')) {
        fetchOptions.body = JSON.stringify(body);
      }

      console.log(`[Softruck] ${method} ${url} (tentativa ${tentativa}/${maxRetries})`);
      
      const response = await fetch(url, fetchOptions);

      // Se 401, renovar token e tentar novamente
      if (response.status === 401) {
        console.warn(`[Softruck] Erro 401 na tentativa ${tentativa}/${maxRetries}`);
        
        if (tentativa < maxRetries) {
          console.log('[Softruck] Forçando renovação de token...');
          const auth = await getSoftruckToken(supabaseUrl, supabaseKey, true);
          currentToken = auth.token;
          tokenRenovado = true;
          console.log(`[Softruck] Token renovado via: ${auth.renovado_via}`);
          continue;
        }
        
        const errorText = await response.text();
        return {
          success: false,
          error: `Token inválido após ${maxRetries} tentativas: ${errorText}`,
          tentativas: tentativa,
          token_renovado: tokenRenovado,
        };
      }

      // Outros erros HTTP
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Softruck] Erro ${response.status}: ${errorText}`);
        return {
          success: false,
          error: `Erro Softruck ${response.status}: ${errorText}`,
          tentativas: tentativa,
          token_renovado: tokenRenovado,
        };
      }

      // Sucesso
      const data = await response.json();
      return {
        success: true,
        data: data as T,
        tentativas: tentativa,
        token_renovado: tokenRenovado,
      };

    } catch (error) {
      console.error(`[Softruck] Erro na tentativa ${tentativa}:`, error);
      
      if (tentativa === maxRetries) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
          tentativas: tentativa,
          token_renovado: tokenRenovado,
        };
      }
    }
  }

  return {
    success: false,
    error: 'Erro inesperado',
    tentativas: maxRetries,
    token_renovado: tokenRenovado,
  };
}

/**
 * Registra log de erro de autenticação no banco
 */
export async function logAuthError(
  supabase: any,
  plataforma: string,
  operacao: string,
  erro: string,
  rastreadorId?: string
): Promise<void> {
  try {
    await supabase
      .from('rastreadores_logs')
      .insert({
        rastreador_id: rastreadorId || null,
        plataforma,
        operacao,
        status: 'erro',
        erro_mensagem: erro,
      });
  } catch (e) {
    console.error('[logAuthError] Falha ao registrar log:', e);
  }
}

/**
 * Verifica se o erro é relacionado a autenticação
 */
export function isAuthError(status: number, errorText: string): boolean {
  return (
    status === 401 ||
    status === 403 ||
    errorText.toLowerCase().includes('unauthorized') ||
    errorText.toLowerCase().includes('token') ||
    errorText.toLowerCase().includes('public key')
  );
}
