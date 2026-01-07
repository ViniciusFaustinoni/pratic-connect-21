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

    const baseUrl = plataforma.ambiente_atual === 'producao' 
      ? plataforma.api_url_producao 
      : plataforma.api_url_sandbox;

    let testeSucesso = false;
    let mensagem = '';

    // Testar conexão usando secrets
    if (plataforma_codigo === 'softruck') {
      const publicKey = Deno.env.get('SOFTRUCK_PUBLIC_KEY');
      const username = Deno.env.get('SOFTRUCK_USERNAME');
      const password = Deno.env.get('SOFTRUCK_PASSWORD');

      if (!publicKey || !username || !password) {
        mensagem = 'Credenciais Softruck não configuradas nos secrets';
      } else {
        try {
          const response = await fetch(`${baseUrl}/auth/login`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'public-key': publicKey,
            },
            body: JSON.stringify({ username, password })
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
      const token = Deno.env.get('REDE_VEICULOS_TOKEN');

      if (!token) {
        mensagem = 'Token Rede Veículos não configurado nos secrets';
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
