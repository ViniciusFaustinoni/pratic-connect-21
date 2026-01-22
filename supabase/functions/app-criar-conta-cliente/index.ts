import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { associadoId, email, senha } = await req.json();

    console.log('Criando conta para associado:', associadoId);

    // 1. Validar inputs
    if (!associadoId || !email || !senha) {
      return new Response(
        JSON.stringify({ success: false, error: 'Dados incompletos. Preencha email e senha.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const emailNormalizado = email.toLowerCase().trim();

    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNormalizado)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email inválido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validar senha
    if (senha.length < 6) {
      return new Response(
        JSON.stringify({ success: false, error: 'Senha deve ter pelo menos 6 caracteres' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!/[0-9]/.test(senha)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Senha deve conter pelo menos um número' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 2. Buscar associado e validar
    const { data: associado, error: assocError } = await supabase
      .from('associados')
      .select('id, nome, telefone, cpf, status, user_id')
      .eq('id', associadoId)
      .single();

    if (assocError || !associado) {
      console.error('Associado não encontrado:', assocError);
      return new Response(
        JSON.stringify({ success: false, error: 'Associado não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (associado.user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Você já possui uma conta. Use "Esqueci minha senha" se necessário.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (associado.status !== 'ativo') {
      return new Response(
        JSON.stringify({ success: false, error: 'Seu cadastro ainda não foi ativado.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 3. Verificar se email já está em uso
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', emailNormalizado)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Este email já está em uso. Escolha outro email.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 4. Criar usuário no Auth com o EMAIL escolhido pelo cliente
    console.log('Criando usuário no Auth com email:', emailNormalizado);
    
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: emailNormalizado,
      password: senha,
      email_confirm: true,
      user_metadata: {
        nome: associado.nome,
        tipo: 'associado',
        cpf: associado.cpf
      }
    });

    if (authError) {
      console.error('Erro ao criar usuário Auth:', authError);
      
      if (authError.message?.includes('already been registered')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Este email já está cadastrado no sistema.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao criar conta: ' + authError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const userId = authData.user.id;
    console.log('Usuário criado com ID:', userId);

    // 5. Vincular user_id ao associado
    const { error: updateError } = await supabase
      .from('associados')
      .update({ user_id: userId })
      .eq('id', associadoId);

    if (updateError) {
      console.error('Erro ao vincular user_id ao associado:', updateError);
    }

    // 6. Criar/Atualizar profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        user_id: userId,
        nome: associado.nome,
        email: emailNormalizado,
        telefone: associado.telefone,
        cpf: associado.cpf,
        tipo: 'associado',
        ativo: true,
        primeiro_acesso: false
      }, { onConflict: 'user_id' });

    if (profileError) {
      console.error('Erro ao criar profile:', profileError);
    }

    // 7. Adicionar role de associado
    const { error: roleError } = await supabase
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: 'associado'
      }, { onConflict: 'user_id,role' });

    if (roleError) {
      console.error('Erro ao adicionar role:', roleError);
    }

    // 8. Registrar histórico
    await supabase
      .from('associados_historico')
      .insert({
        associado_id: associadoId,
        tipo: 'acesso_criado',
        descricao: `Conta criada via área do cliente (email: ${emailNormalizado})`
      });

    // 9. Registrar log de auth
    await supabase
      .from('auth_logs')
      .insert({
        email: emailNormalizado,
        acao: 'conta_criada_cliente',
        metadata: {
          associado_id: associadoId,
          origem: 'area_cliente'
        }
      });

    console.log('Conta criada com sucesso para:', emailNormalizado);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Conta criada com sucesso!'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função app-criar-conta-cliente:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno. Tente novamente.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
