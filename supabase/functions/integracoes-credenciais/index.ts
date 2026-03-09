import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Algoritmo: AES-256-GCM
// A chave é derivada do SERVICE_ROLE_KEY (hash SHA-256)

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
    ['encrypt', 'decrypt']
  );
}

async function encrypt(data: string, secret: string): Promise<{ encrypted: string; iv: string }> {
  const key = await deriveKey(secret);
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );
  
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv))
  };
}

async function decrypt(encryptedData: string, ivString: string, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  const decoder = new TextDecoder();
  
  const encrypted = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivString), c => c.charCodeAt(0));
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );
  
  return decoder.decode(decrypted);
}

// Definição dos campos por integração
const integracoesSchema: Record<string, { campos: { nome: string; label: string; tipo: 'text' | 'password'; obrigatorio: boolean }[] }> = {
  hinova: {
    campos: [
      { nome: 'token', label: 'Token Bearer (gerado no SGA)', tipo: 'password', obrigatorio: true },
      { nome: 'usuario', label: 'Usuário do SGA', tipo: 'text', obrigatorio: true },
      { nome: 'senha', label: 'Senha do SGA', tipo: 'password', obrigatorio: true },
      { nome: 'codigo_conta', label: 'Código da Conta (opcional)', tipo: 'text', obrigatorio: false },
      { nome: 'codigo_voluntario', label: 'Código Voluntário', tipo: 'text', obrigatorio: false },
    ]
  },
  softruck: {
    campos: [
      { nome: 'public_key', label: 'Public Key', tipo: 'password', obrigatorio: true },
      { nome: 'username', label: 'Usuário', tipo: 'text', obrigatorio: true },
      { nome: 'password', label: 'Senha', tipo: 'password', obrigatorio: true },
      { nome: 'enterprise_id', label: 'Enterprise ID (opcional)', tipo: 'text', obrigatorio: false },
    ]
  },
  rede_veiculos: {
    campos: [
      { nome: 'bearer_token', label: 'Token Bearer', tipo: 'password', obrigatorio: true },
    ]
  },
  asaas: {
    campos: [
      { nome: 'api_key', label: 'API Key', tipo: 'password', obrigatorio: true },
      { nome: 'ambiente', label: 'Ambiente (production/sandbox)', tipo: 'text', obrigatorio: false },
    ]
  },
  autentique: {
    campos: [
      { nome: 'api_key', label: 'API Key', tipo: 'password', obrigatorio: true },
    ]
  },
  resend: {
    campos: [
      { nome: 'api_key', label: 'API Key', tipo: 'password', obrigatorio: true },
    ]
  },
  whatsapp: {
    campos: [
      { nome: 'api_key', label: 'API Key Evolution', tipo: 'password', obrigatorio: true },
      { nome: 'api_url', label: 'URL da API Evolution', tipo: 'text', obrigatorio: true },
    ]
  },
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;

    // Verificar permissão dinâmica via has_permission
    const { data: temPermissao } = await supabase.rpc('has_permission', {
      _user_id: userId,
      _permission: 'canManageIntegracoes',
    });

    if (!temPermissao) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sem permissão para gerenciar integrações' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const integracao = url.searchParams.get('integracao');

    // ========================================
    // GET - Listar status ou schema
    // ========================================
    if (req.method === 'GET') {
      // Se pediu schema, retornar campos disponíveis
      if (url.searchParams.get('schema') === 'true') {
        return new Response(
          JSON.stringify({ success: true, schema: integracoesSchema }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar status de todas ou de uma específica
      let query = supabase
        .from('integracoes_credenciais')
        .select('integracao, configurado, testado_em, teste_sucesso, teste_mensagem, updated_at');

      if (integracao) {
        query = query.eq('integracao', integracao);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[integracoes-credenciais] Erro ao buscar:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Nunca retornar valores das credenciais, apenas status
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // POST - Salvar credenciais ou atualizar status de teste
    // ========================================
    if (req.method === 'POST') {
      const body = await req.json();
      const { integracao: integracaoNome, credenciais, teste_sucesso, teste_mensagem } = body;

      if (!integracaoNome) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nome da integração é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validar se a integração é conhecida
      if (!integracoesSchema[integracaoNome]) {
        return new Response(
          JSON.stringify({ success: false, error: `Integração desconhecida: ${integracaoNome}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar profile_id do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      // Verificar se já existe registro para esta integração
      const { data: registroExistente } = await supabase
        .from('integracoes_credenciais')
        .select('id, credenciais_encrypted, iv, configurado')
        .eq('integracao', integracaoNome)
        .single();

      // ========================================
      // CASO 1: Atualização somente do status de teste
      // (credenciais vazio/ausente e teste_sucesso presente)
      // ========================================
      const credenciaisVazio = !credenciais || Object.keys(credenciais).length === 0 || 
                               Object.values(credenciais).every(v => !v || (typeof v === 'string' && v.trim() === ''));
      
      if (credenciaisVazio && typeof teste_sucesso === 'boolean') {
        // Só podemos atualizar status se já existe registro configurado
        if (!registroExistente?.configurado) {
          return new Response(
            JSON.stringify({ success: false, error: 'Não há credenciais configuradas para atualizar status de teste' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: updateError } = await supabase
          .from('integracoes_credenciais')
          .update({
            teste_sucesso,
            teste_mensagem: teste_mensagem || null,
            testado_em: new Date().toISOString(),
            updated_by: profile?.id || null,
            updated_at: new Date().toISOString(),
          })
          .eq('integracao', integracaoNome);

        if (updateError) {
          console.error('[integracoes-credenciais] Erro ao atualizar status de teste:', updateError);
          return new Response(
            JSON.stringify({ success: false, error: updateError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[integracoes-credenciais] Status de teste atualizado para: ${integracaoNome}`);

        return new Response(
          JSON.stringify({ success: true, mensagem: 'Status de teste atualizado com sucesso' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ========================================
      // CASO 2: Salvar/Atualizar credenciais
      // ========================================
      if (credenciaisVazio) {
        return new Response(
          JSON.stringify({ success: false, error: 'Credenciais são obrigatórias para salvar' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let credenciaisParaSalvar: Record<string, string> = {};
      const schema = integracoesSchema[integracaoNome];

      // Se já existe registro configurado, fazer merge com credenciais existentes
      if (registroExistente?.configurado && registroExistente.credenciais_encrypted && registroExistente.iv) {
        try {
          const credenciaisExistentes = JSON.parse(
            await decrypt(registroExistente.credenciais_encrypted, registroExistente.iv, supabaseServiceKey)
          );
          
          // Começar com as existentes
          credenciaisParaSalvar = { ...credenciaisExistentes };
          
          // Sobrescrever com as novas que não estão vazias
          for (const [key, value] of Object.entries(credenciais)) {
            if (value && typeof value === 'string' && value.trim() !== '') {
              credenciaisParaSalvar[key] = value;
            }
          }
        } catch (decryptError) {
          console.error('[integracoes-credenciais] Erro ao descriptografar credenciais existentes:', decryptError);
          // Se falhar a descriptografia, usar apenas as novas
          credenciaisParaSalvar = { ...credenciais };
        }
      } else {
        // Novo registro, usar apenas as credenciais fornecidas
        credenciaisParaSalvar = { ...credenciais };
      }

      // Validar campos obrigatórios no resultado final do merge
      for (const campo of schema.campos) {
        if (campo.obrigatorio && !credenciaisParaSalvar[campo.nome]) {
          return new Response(
            JSON.stringify({ success: false, error: `Campo obrigatório não preenchido: ${campo.label}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Criptografar credenciais
      const { encrypted, iv } = await encrypt(JSON.stringify(credenciaisParaSalvar), supabaseServiceKey);

      // Preparar dados para upsert
      const dadosUpsert: Record<string, unknown> = {
        integracao: integracaoNome,
        credenciais_encrypted: encrypted,
        iv,
        configurado: true,
        updated_by: profile?.id || null,
        updated_at: new Date().toISOString(),
      };

      // Se veio status de teste junto com credenciais, atualizar também
      if (typeof teste_sucesso === 'boolean') {
        dadosUpsert.teste_sucesso = teste_sucesso;
        dadosUpsert.teste_mensagem = teste_mensagem || null;
        dadosUpsert.testado_em = new Date().toISOString();
      }

      // Upsert (insert ou update)
      const { error: upsertError } = await supabase
        .from('integracoes_credenciais')
        .upsert(dadosUpsert, { onConflict: 'integracao' });

      if (upsertError) {
        console.error('[integracoes-credenciais] Erro ao salvar:', upsertError);
        return new Response(
          JSON.stringify({ success: false, error: upsertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[integracoes-credenciais] Credenciais salvas para: ${integracaoNome}`);

      return new Response(
        JSON.stringify({ success: true, mensagem: 'Credenciais salvas com sucesso' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // DELETE - Remover credenciais
    // ========================================
    if (req.method === 'DELETE') {
      if (!integracao) {
        return new Response(
          JSON.stringify({ success: false, error: 'Parâmetro integracao é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: deleteError } = await supabase
        .from('integracoes_credenciais')
        .delete()
        .eq('integracao', integracao);

      if (deleteError) {
        console.error('[integracoes-credenciais] Erro ao deletar:', deleteError);
        return new Response(
          JSON.stringify({ success: false, error: deleteError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[integracoes-credenciais] Credenciais removidas para: ${integracao}`);

      return new Response(
        JSON.stringify({ success: true, mensagem: 'Credenciais removidas com sucesso' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Método não suportado' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[integracoes-credenciais] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Função exportada para outras edge functions usarem
export async function getCredenciais(supabase: any, integracao: string, serviceKey: string): Promise<Record<string, string> | null> {
  try {
    const { data, error } = await supabase
      .from('integracoes_credenciais')
      .select('credenciais_encrypted, iv, configurado')
      .eq('integracao', integracao)
      .single();

    if (error || !data || !data.configurado) {
      return null;
    }

    const decrypted = await decrypt(data.credenciais_encrypted, data.iv, serviceKey);
    return JSON.parse(decrypted);
  } catch (e) {
    console.error(`[getCredenciais] Erro ao descriptografar ${integracao}:`, e);
    return null;
  }
}
