import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BASE_URL = 'https://api.softruck.com';

// Função para descobrir Enterprise ID automaticamente
async function descobrirEnterpriseId(token: string, publicKey: string): Promise<{ id: string; nome: string; cnpj?: string } | null> {
  try {
    const response = await fetch(`${BASE_URL}/v2/enterprises?attributes[]=name&attributes[]=cnpj&limit=10`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'public-key': publicKey,
      },
    });

    if (!response.ok) {
      console.error('[Descobrir Enterprise] Erro:', response.status);
      return null;
    }

    const data = await response.json();
    const enterprises = data?.data || [];
    
    if (enterprises.length === 0) {
      return null;
    }

    const enterprise = enterprises[0];
    return {
      id: enterprise.id,
      nome: enterprise.attributes?.name || 'Empresa Softruck',
      cnpj: enterprise.attributes?.cnpj,
    };
  } catch (error) {
    console.error('[Descobrir Enterprise] Erro:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { plataforma_codigo } = await req.json();

    if (!plataforma_codigo) {
      throw new Error('plataforma_codigo é obrigatório');
    }

    // Buscar plataforma
    const { data: plataforma, error: platError } = await supabase
      .from('rastreadores_config_plataformas')
      .select('*')
      .eq('plataforma', plataforma_codigo)
      .single();

    if (platError || !plataforma) {
      throw new Error(`Plataforma não encontrada: ${plataforma_codigo}`);
    }

    const baseUrl = plataforma.ambiente_atual === 'producao' 
      ? plataforma.api_url_producao 
      : plataforma.api_url_sandbox;

    let testeSucesso = false;
    let mensagem = '';
    let enterpriseInfo: { id: string; nome: string; cnpj?: string } | null = null;

    // Testar conexão usando secrets
    if (plataforma_codigo === 'softruck') {
      const publicKey = Deno.env.get('SOFTRUCK_PUBLIC_KEY');
      const username = Deno.env.get('SOFTRUCK_USERNAME');
      const password = Deno.env.get('SOFTRUCK_PASSWORD');
      const configuredEnterpriseId = Deno.env.get('SOFTRUCK_ENTERPRISE_ID');

      if (!publicKey || !username || !password) {
        mensagem = 'Credenciais Softruck não configuradas nos secrets (SOFTRUCK_PUBLIC_KEY, SOFTRUCK_USERNAME, SOFTRUCK_PASSWORD)';
      } else {
        try {
          // Autenticar
          const authResponse = await fetch(`${baseUrl}/v2/auth/login`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'public-key': publicKey,
            },
            body: JSON.stringify({ username, password })
          });

          const authData = await authResponse.json();
          const token = authData.token || authData.access_token || authData.data?.token;
          
          if (authResponse.ok && token) {
            testeSucesso = true;
            mensagem = 'Conexão Softruck estabelecida com sucesso!';
            
            // Tentar descobrir Enterprise ID se não estiver configurado
            if (!configuredEnterpriseId) {
              console.log('[Testar Conexão] SOFTRUCK_ENTERPRISE_ID não configurado, tentando descobrir...');
              enterpriseInfo = await descobrirEnterpriseId(token, publicKey);
              
              if (enterpriseInfo) {
                mensagem += ` | Enterprise descoberta: ${enterpriseInfo.nome} (ID: ${enterpriseInfo.id})`;
                console.log('[Testar Conexão] Enterprise descoberta:', enterpriseInfo);
                
                // Salvar enterprise_id na config da plataforma
                await supabase
                  .from('rastreadores_config_plataformas')
                  .update({ 
                    config: { 
                      ...(plataforma.config as Record<string, unknown> || {}),
                      enterprise_id: enterpriseInfo.id,
                      enterprise_nome: enterpriseInfo.nome,
                      enterprise_cnpj: enterpriseInfo.cnpj,
                      enterprise_descoberta_em: new Date().toISOString(),
                    },
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', plataforma.id);
                  
                mensagem += ' | ⚠️ Configure SOFTRUCK_ENTERPRISE_ID nos secrets para melhor performance.';
              } else {
                mensagem += ' | ⚠️ Não foi possível descobrir Enterprise ID. Configure SOFTRUCK_ENTERPRISE_ID manualmente.';
              }
            } else {
              mensagem += ` | Enterprise ID configurado: ${configuredEnterpriseId}`;
            }
          } else {
            mensagem = authData.message || authData.error?.message || `Erro na autenticação: ${authResponse.status}`;
          }
        } catch (fetchError) {
          mensagem = `Erro de conexão: ${fetchError instanceof Error ? fetchError.message : 'Falha na requisição'}`;
        }
      }

    } else if (plataforma_codigo === 'rede_veiculos') {
      const token = Deno.env.get('REDE_VEICULOS_TOKEN');

      if (!token) {
        mensagem = 'Token Rede Veículos não configurado nos secrets (REDE_VEICULOS_TOKEN)';
      } else if (token.length < 10) {
        mensagem = 'Token parece inválido (muito curto)';
      } else {
        testeSucesso = true;
        mensagem = 'Token Rede Veículos configurado com sucesso!';
      }
    } else {
      mensagem = `Plataforma ${plataforma_codigo} não suportada para teste`;
    }

    // Atualizar status do teste na tabela de credenciais (se existir)
    try {
      await supabase
        .from('rastreadores_credenciais')
        .upsert({
          plataforma_id: plataforma.id,
          testado_em: new Date().toISOString(),
          teste_sucesso: testeSucesso,
          teste_mensagem: mensagem,
          configurado: testeSucesso,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'plataforma_id' });
    } catch (credError) {
      console.log('[Testar Conexão] Tabela rastreadores_credenciais não existe, ignorando...');
    }

    return new Response(
      JSON.stringify({
        success: testeSucesso,
        mensagem,
        plataforma: plataforma.nome_exibicao,
        enterprise: enterpriseInfo,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao testar conexão:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        mensagem: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
