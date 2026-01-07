import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  nome: string;
  email: string;
  cpf: string;
  telefone?: string;
  perfil: string;
  tipo: 'funcionario' | 'associado' | 'prestador';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Cliente com service role para operações admin
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Cliente com token do usuário para verificar permissões
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verificar se usuário logado tem permissão
    const { data: { user: currentUser } } = await supabaseUser.auth.getUser();
    if (!currentUser) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se tem role de gerência
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', currentUser.id);

    const allowedRoles = ['diretor', 'gerente_comercial', 'supervisor_vendas'];
    const hasPermission = roles?.some(r => allowedRoles.includes(r.role));

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: 'Sem permissão para criar usuários' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: CreateUserRequest = await req.json();
    const { nome, email, cpf, telefone, perfil, tipo } = body;

    console.log(`Criando usuário: ${email}, tipo: ${tipo}, perfil: ${perfil}`);

    // Verificar se email já existe
    const { data: existingEmail } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingEmail) {
      return new Response(
        JSON.stringify({ error: 'Este email já está cadastrado' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se CPF já existe
    const { data: existingCPF } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('cpf', cpf)
      .maybeSingle();

    if (existingCPF) {
      return new Response(
        JSON.stringify({ error: 'Este CPF já está cadastrado' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Criar usuário no Auth (sem senha - usará magic link)
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      email_confirm: true, // Email já confirmado
      user_metadata: {
        nome,
        cpf,
        telefone,
        tipo,
      }
    });

    if (authError) {
      console.error('Erro ao criar usuário no Auth:', authError);
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // O trigger handle_new_user já cria o profile, mas precisamos atualizar campos adicionais
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        cpf,
        telefone,
        primeiro_acesso: true,
      })
      .eq('user_id', authUser.user.id);

    if (updateError) {
      console.error('Erro ao atualizar profile:', updateError);
    }

    // Adicionar role na tabela user_roles
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authUser.user.id,
        role: perfil,
      });

    if (roleError) {
      console.error('Erro ao adicionar role:', roleError);
    }

    // Gerar magic link para definir senha
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email.toLowerCase(),
      options: {
        redirectTo: `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/auth/definir-senha`,
      }
    });

    if (linkError) {
      console.error('Erro ao gerar magic link:', linkError);
    }

    // Enviar email de boas-vindas com link
    const appUrl = supabaseUrl.replace('.supabase.co', '.lovable.app');
    
    try {
      await supabaseAdmin.functions.invoke('send-email', {
        body: {
          template: 'acesso-funcionario',
          to: email.toLowerCase(),
          data: {
            nome,
            linkAcesso: linkData?.properties?.action_link || `${appUrl}/login`,
          }
        }
      });
      console.log('Email de acesso enviado');
    } catch (emailError) {
      console.error('Erro ao enviar email:', emailError);
      // Não falha a operação se email não for enviado
    }

    // Registrar log de auditoria
    await supabaseAdmin
      .from('auth_logs')
      .insert({
        profile_id: authUser.user.id,
        email: email.toLowerCase(),
        acao: 'usuario_criado',
        metadata: {
          criado_por: currentUser.id,
          tipo,
          perfil,
        }
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: authUser.user.id,
        message: 'Usuário criado com sucesso. Email de acesso enviado.'
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error('Erro na função create-user:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
