// deno-lint-ignore-file no-explicit-any

/**
 * Módulo de Credenciais ASAAS
 * 
 * Busca credenciais com prioridade:
 * 1. Banco de dados (integracoes_credenciais) - criptografado com AES-256-GCM + PBKDF2
 * 2. Supabase Secrets (variáveis de ambiente) - fallback
 */

export interface AsaasConfig {
  apiKey: string;
  baseUrl: string;
  ambiente: 'sandbox' | 'production';
}

/**
 * Deriva chave usando PBKDF2 (mesmo método do integracoes-credenciais)
 */
async function deriveKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('integracoes_credenciais_salt'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

/**
 * Descriptografar credenciais usando AES-256-GCM + PBKDF2
 */
async function descriptografar(
  encryptedBase64: string, 
  ivBase64: string, 
  secret: string
): Promise<Record<string, string>> {
  const key = await deriveKey(secret);
  const encrypted = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );

  return JSON.parse(new TextDecoder().decode(decrypted));
}

/**
 * Determinar ambiente e base URL a partir da API key
 */
function resolveAmbiente(apiKey: string, ambienteExplicito?: string): { ambiente: 'sandbox' | 'production'; baseUrl: string } {
  let ambiente: 'sandbox' | 'production';
  
  if (ambienteExplicito) {
    ambiente = ambienteExplicito === 'production' ? 'production' : 'sandbox';
  } else {
    // $aact_ = produção, _hmlg_ = sandbox
    const isSandbox = apiKey.includes('_hmlg_');
    ambiente = isSandbox ? 'sandbox' : 'production';
  }

  const baseUrl = ambiente === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';

  return { ambiente, baseUrl };
}

/**
 * Buscar credenciais ASAAS do banco de dados ou ENV
 * 
 * @param supabase - Cliente Supabase (com service_role)
 * @returns AsaasConfig ou null se não configurado
 */
export async function getAsaasConfig(supabase: any): Promise<AsaasConfig | null> {
  const encryptionKey = Deno.env.get('INTEGRACOES_ENCRYPTION_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  try {
    // 1. Tentar buscar do banco de dados
    const { data: credencial, error } = await supabase
      .from('integracoes_credenciais')
      .select('credenciais_encrypted, iv, configurado, ambiente')
      .eq('integracao', 'asaas')
      .eq('configurado', true)
      .maybeSingle();

    if (!error && credencial?.credenciais_encrypted && credencial?.iv) {
      console.log('[AsaasConfig] Usando credenciais do banco de dados');
      const decrypted = await descriptografar(
        credencial.credenciais_encrypted, 
        credencial.iv, 
        encryptionKey
      );
      
      const apiKey = decrypted.api_key || decrypted.apiKey || decrypted.ASAAS_API_KEY;
      if (apiKey) {
        const { ambiente, baseUrl } = resolveAmbiente(apiKey, credencial.ambiente);
        console.log(`[AsaasConfig] Ambiente: ${ambiente} | Base URL: ${baseUrl}`);
        return { apiKey, baseUrl, ambiente };
      }
      console.warn('[AsaasConfig] Credenciais do banco sem api_key, tentando ENV...');
    }
  } catch (dbError) {
    console.warn('[AsaasConfig] Erro ao buscar do banco:', dbError);
  }

  // 2. Fallback para ENV
  const envKey = Deno.env.get('ASAAS_API_KEY');
  if (envKey) {
    console.log('[AsaasConfig] Usando credenciais do ENV (fallback)');
    const envExplicito = Deno.env.get('ASAAS_ENV');
    const { ambiente, baseUrl } = resolveAmbiente(envKey, envExplicito || undefined);
    console.log(`[AsaasConfig] Ambiente: ${ambiente} | Base URL: ${baseUrl}`);
    return { apiKey: envKey, baseUrl, ambiente };
  }

  console.error('[AsaasConfig] Nenhuma credencial ASAAS encontrada');
  return null;
}
