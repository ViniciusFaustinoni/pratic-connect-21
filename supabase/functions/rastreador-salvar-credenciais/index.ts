import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CredenciaisInput {
  public_key?: string;
  username?: string;
  password?: string;
  bearer_token?: string;
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

    const { plataforma_codigo, credenciais } = await req.json() as {
      plataforma_codigo: string;
      credenciais: CredenciaisInput;
    };

    if (!plataforma_codigo) {
      throw new Error('plataforma_codigo é obrigatório');
    }

    // Buscar plataforma
    const { data: plataforma, error: platError } = await supabase
      .from('rastreadores_config_plataformas')
      .select('id, plataforma, nome_exibicao')
      .eq('plataforma', plataforma_codigo)
      .single();

    if (platError || !plataforma) {
      throw new Error(`Plataforma não encontrada: ${plataforma_codigo}`);
    }

    // Validar credenciais conforme plataforma
    if (plataforma_codigo === 'softruck') {
      if (!credenciais.public_key || !credenciais.username || !credenciais.password) {
        throw new Error('Para Softruck, informe: Public Key, Username e Password');
      }
    } else if (plataforma_codigo === 'rede_veiculos') {
      if (!credenciais.bearer_token) {
        throw new Error('Para Rede Veículos, informe o Token Bearer');
      }
    }

    // Salvar/Atualizar credenciais
    const { error: upsertError } = await supabase
      .from('rastreadores_credenciais')
      .upsert({
        plataforma_id: plataforma.id,
        public_key: credenciais.public_key || null,
        username: credenciais.username || null,
        password_hash: credenciais.password || null,
        bearer_token: credenciais.bearer_token || null,
        configurado: false, // Será true após teste bem-sucedido
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'plataforma_id'
      });

    if (upsertError) throw upsertError;

    return new Response(
      JSON.stringify({
        success: true,
        mensagem: `Credenciais ${plataforma.nome_exibicao} salvas. Clique em "Testar Conexão" para validar.`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro ao salvar credenciais:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        mensagem: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
