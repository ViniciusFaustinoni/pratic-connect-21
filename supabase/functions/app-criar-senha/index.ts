import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { token, senha } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token não informado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!senha || senha.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'Senha deve ter pelo menos 6 caracteres' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Buscar e validar token
    const { data: tokenData, error: tokenError } = await supabase
      .from('auth_tokens_primeiro_acesso')
      .select('*, associados(*)')
      .eq('token', token)
      .eq('usado', false)
      .single();

    if (tokenError || !tokenData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido ou já utilizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Verificar se não expirou
    if (new Date(tokenData.expira_em) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token expirado. Solicite um novo link.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const associado = tokenData.associados;

    if (!associado) {
      return new Response(
        JSON.stringify({ success: false, error: 'Associado não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Se associado já tem user_id (criado pelo ativar-associado), atualizar a senha
    if (associado.user_id) {
      console.log('Associado já tem user_id, atualizando senha...');

      const { error: updateAuthError } = await supabase.auth.admin.updateUserById(
        associado.user_id,
        { password: senha }
      );

      if (updateAuthError) {
        console.error('Erro ao atualizar senha:', updateAuthError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao atualizar senha' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Marcar primeiro_acesso como false no profile
      await supabase
        .from('profiles')
        .update({ primeiro_acesso: false })
        .eq('user_id', associado.user_id);

      // Marcar token como usado
      await supabase
        .from('auth_tokens_primeiro_acesso')
        .update({ usado: true, usado_em: new Date().toISOString() })
        .eq('id', tokenData.id);

      // Registrar histórico
      await supabase
        .from('associados_historico')
        .insert({
          associado_id: associado.id,
          tipo: 'senha_definida',
          descricao: 'Senha definida pelo associado no primeiro acesso'
        });

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Senha definida com sucesso! Você já pode fazer login.',
          cpf: associado.cpf
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Criar email do associado (CPF@associado.pratic.com.br)
    const email = `${associado.cpf}@associado.pratic.com.br`;

    // 5. Criar usuário no Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: {
        nome: associado.nome,
        tipo: 'associado',
        cpf: associado.cpf
      }
    });

    if (authError) {
      console.error('Erro ao criar usuário:', authError);
      
      // Se usuário já existe, tentar atualizar a senha
      if (authError.message.includes('already been registered')) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Conta já existe. Use "Esqueci minha senha".' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error('Erro ao criar conta');
    }

    const userId = authData.user.id;

    // 6. Vincular user_id ao associado
    const { error: updateError } = await supabase
      .from('associados')
      .update({ user_id: userId })
      .eq('id', associado.id);

    if (updateError) {
      console.error('Erro ao vincular usuário:', updateError);
    }

    // 7. Criar profile se não existir (trigger pode não ter criado)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!existingProfile) {
      await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          nome: associado.nome,
          email: associado.email || email,
          telefone: associado.telefone,
          cpf: associado.cpf,
          tipo: 'associado',
          ativo: true,
          bloqueado: false
        });
    }

    // 8. Adicionar role de associado
    await supabase
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: 'associado'
      }, {
        onConflict: 'user_id,role'
      });

    // 9. Marcar token como usado
    await supabase
      .from('auth_tokens_primeiro_acesso')
      .update({ 
        usado: true, 
        usado_em: new Date().toISOString() 
      })
      .eq('id', tokenData.id);

    // 10. Registrar log de sucesso
    await supabase
      .from('auth_logs')
      .insert({
        profile_id: existingProfile?.id,
        email: associado.email || email,
        acao: 'primeiro_acesso_concluido',
        metadata: { 
          associado_id: associado.id,
          metodo: 'token_link'
        }
      });

    // 11. Registrar no histórico do associado
    await supabase
      .from('associados_historico')
      .insert({
        associado_id: associado.id,
        tipo: 'acesso_criado',
        descricao: 'Primeiro acesso ao app criado com sucesso'
      });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Senha criada com sucesso! Você já pode fazer login.',
        cpf: associado.cpf
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao criar senha';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
