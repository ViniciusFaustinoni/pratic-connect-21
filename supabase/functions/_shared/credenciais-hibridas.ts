// deno-lint-ignore-file no-explicit-any

/**
 * Módulo de Credenciais Híbridas
 * 
 * Busca credenciais com prioridade:
 * 1. Banco de dados (integracoes_credenciais) - criptografado com AES-256-GCM
 * 2. Supabase Secrets (variáveis de ambiente) - fallback
 */

interface CredenciaisSoftruck {
  public_key: string;
  username: string;
  password: string;
  enterprise_id?: string;
}

interface CredenciaisRedeVeiculos {
  bearer_token: string;
}

/**
 * Descriptografar credenciais usando AES-256-GCM
 */
async function descriptografar(encryptedData: string, key: string): Promise<Record<string, string>> {
  try {
    const [ivHex, encryptedHex] = encryptedData.split(':');
    
    if (!ivHex || !encryptedHex) {
      throw new Error('Formato de dados criptografados inválido');
    }

    const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    
    // Importar chave
    const keyBuffer = new TextEncoder().encode(key.slice(0, 32).padEnd(32, '0'));
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encrypted
    );

    const decryptedText = new TextDecoder().decode(decrypted);
    return JSON.parse(decryptedText);
  } catch (error) {
    console.error('[Credenciais] Erro ao descriptografar:', error);
    throw error;
  }
}

/**
 * Buscar credenciais Softruck do banco ou ENV
 */
export async function getCredenciaisSoftruck(supabase: any): Promise<CredenciaisSoftruck | null> {
  const encryptionKey = Deno.env.get('INTEGRACOES_ENCRYPTION_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  try {
    // 1. Tentar buscar do banco de dados
    const { data: credencial, error } = await supabase
      .from('integracoes_credenciais')
      .select('credenciais_encrypted, configurado')
      .eq('integracao', 'softruck')
      .eq('configurado', true)
      .maybeSingle();

    if (!error && credencial?.credenciais_encrypted) {
      console.log('[Credenciais] Softruck: usando credenciais do banco de dados');
      const decrypted = await descriptografar(credencial.credenciais_encrypted, encryptionKey);
      
      // Validar campos obrigatórios
      if (decrypted.public_key && decrypted.username && decrypted.password) {
        return {
          public_key: decrypted.public_key,
          username: decrypted.username,
          password: decrypted.password,
          enterprise_id: decrypted.enterprise_id,
        };
      }
      console.warn('[Credenciais] Softruck: credenciais do banco incompletas, tentando ENV...');
    }
  } catch (dbError) {
    console.warn('[Credenciais] Softruck: erro ao buscar do banco:', dbError);
  }

  // 2. Fallback para ENV
  const publicKey = Deno.env.get('SOFTRUCK_PUBLIC_KEY');
  const username = Deno.env.get('SOFTRUCK_USERNAME');
  const password = Deno.env.get('SOFTRUCK_PASSWORD');
  const enterpriseId = Deno.env.get('SOFTRUCK_ENTERPRISE_ID');

  if (publicKey && username && password) {
    console.log('[Credenciais] Softruck: usando credenciais do ENV');
    return {
      public_key: publicKey,
      username: username,
      password: password,
      enterprise_id: enterpriseId,
    };
  }

  console.error('[Credenciais] Softruck: nenhuma credencial encontrada');
  return null;
}

/**
 * Buscar credenciais Rede Veículos do banco ou ENV
 */
export async function getCredenciaisRedeVeiculos(supabase: any): Promise<CredenciaisRedeVeiculos | null> {
  const encryptionKey = Deno.env.get('INTEGRACOES_ENCRYPTION_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  try {
    // 1. Tentar buscar do banco de dados
    const { data: credencial, error } = await supabase
      .from('integracoes_credenciais')
      .select('credenciais_encrypted, configurado')
      .eq('integracao', 'rede_veiculos')
      .eq('configurado', true)
      .maybeSingle();

    if (!error && credencial?.credenciais_encrypted) {
      console.log('[Credenciais] Rede Veículos: usando credenciais do banco de dados');
      const decrypted = await descriptografar(credencial.credenciais_encrypted, encryptionKey);
      
      // Validar campo obrigatório
      if (decrypted.bearer_token) {
        return {
          bearer_token: decrypted.bearer_token,
        };
      }
      console.warn('[Credenciais] Rede Veículos: credenciais do banco incompletas, tentando ENV...');
    }
  } catch (dbError) {
    console.warn('[Credenciais] Rede Veículos: erro ao buscar do banco:', dbError);
  }

  // 2. Fallback para ENV
  const token = Deno.env.get('REDE_VEICULOS_TOKEN');

  if (token) {
    console.log('[Credenciais] Rede Veículos: usando credenciais do ENV');
    return {
      bearer_token: token,
    };
  }

  console.error('[Credenciais] Rede Veículos: nenhuma credencial encontrada');
  return null;
}
