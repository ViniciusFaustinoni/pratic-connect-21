import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Buscar credenciais
    const { data: credenciais, error: credError } = await supabase
      .from('rastreadores_credenciais')
      .select('*')
      .eq('plataforma_id', plataforma.id)
      .single();

    if (credError || !credenciais) {
      throw new Error('Credenciais não encontradas. Salve as credenciais primeiro.');
    }

    const baseUrl = plataforma.ambiente_atual === 'producao' 
      ? plataforma.api_url_producao 
      : plataforma.api_url_sandbox;

    let testeSucesso = false;
    let mensagem = '';

    // Testar conexão conforme plataforma
    if (plataforma_codigo === 'softruck') {
      if (!credenciais.public_key || !credenciais.username || !credenciais.password_hash) {
        mensagem = 'Credenciais Softruck incompletas';
      } else {
        try {
          const response = await fetch(`${baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'public-key': credenciais.public_key,
            },
            body: JSON.stringify({
              username: credenciais.username,
              password: credenciais.password_hash,
            })
          });

          const data = await response.json();
          
          if (response.ok && data.data?.token) {
            testeSucesso = true;
            mensagem = 'Conexão Softruck estabelecida com sucesso!';
          } else {
            mensagem = data.message || data.error?.message || `Erro na autenticação: ${response.status}`;
          }
        } catch (fetchError) {
          mensagem = `Erro de conexão: ${fetchError instanceof Error ? fetchError.message : 'Falha na requisição'}`;
        }
      }

    } else if (plataforma_codigo === 'rede_veiculos') {
      if (!credenciais.bearer_token) {
        mensagem = 'Token não configurado';
      } else if (credenciais.bearer_token.length < 10) {
        mensagem = 'Token parece inválido (muito curto)';
      } else {
        // Token fixo - validação básica de formato
        testeSucesso = true;
        mensagem = 'Token Rede Veículos configurado com sucesso!';
      }
    } else {
      mensagem = `Plataforma ${plataforma_codigo} não suportada para teste`;
    }

    // Atualizar status do teste
    await supabase
      .from('rastreadores_credenciais')
      .update({
        testado_em: new Date().toISOString(),
        teste_sucesso: testeSucesso,
        teste_mensagem: mensagem,
        configurado: testeSucesso,
        updated_at: new Date().toISOString(),
      })
      .eq('plataforma_id', plataforma.id);

    return new Response(
      JSON.stringify({
        success: testeSucesso,
        mensagem,
        plataforma: plataforma.nome_exibicao,
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
