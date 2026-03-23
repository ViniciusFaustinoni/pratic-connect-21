import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  nome: string;
  email: string;
  cpf?: string;
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  telefone?: string;
  senha?: string;
  perfil?: string;
  perfis?: string[];
  tipo: 'funcionario' | 'associado' | 'prestador';
  regioes_atendimento?: string[];
  capacidade_diaria?: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação via header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ code: 401, message: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Cliente com service role para operações admin
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Cliente com token do usuário para verificar permissões
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validar usuário autenticado
    // Importante: em Edge Functions não existe "sessão" persistida; então precisamos validar passando o JWT explicitamente.
    const token = authHeader.replace('Bearer ', '').trim();
    const { data: { user: currentUser }, error: userError } = await supabaseUser.auth.getUser(token);

    if (userError || !currentUser) {
      console.error('Erro ao validar usuário:', userError);
      return new Response(
        JSON.stringify({ code: 401, message: 'Token inválido ou expirado' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const currentUserId = currentUser.id;

    // Verificar permissão dinâmica via has_permission
    const { data: temPermissao } = await supabaseAdmin.rpc('has_permission', {
      _user_id: currentUserId,
      _permission: 'canCreateUser',
    });

    if (!temPermissao) {
      return new Response(
        JSON.stringify({ error: 'Sem permissão para criar usuários' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: CreateUserRequest = await req.json();
    const { nome, email, cpf, cnpj, razao_social, nome_fantasia, telefone, senha, perfil, perfis, tipo, regioes_atendimento, capacidade_diaria } = body;
    
    // Determinar perfis a adicionar
    const perfisParaAdicionar = perfis?.length ? perfis : (perfil ? [perfil] : ['vendedor_clt']);

    console.log(`Criando usuário: ${email}, tipo: ${tipo}, perfis: ${perfisParaAdicionar.join(', ')}`);

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

    // Verificar se CPF já existe (se fornecido)
    if (cpf) {
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
    }

    // Criar usuário no Auth (com ou sem senha)
    const createUserOptions: any = {
      email: email.toLowerCase(),
      email_confirm: true, // Email já confirmado
      user_metadata: {
        nome,
        cpf,
        telefone,
        tipo,
      }
    };
    
    // Se senha fornecida, usar ela. Senão, magic link
    if (senha) {
      createUserOptions.password = senha;
    }
    
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser(createUserOptions);

    if (authError) {
      console.error('Erro ao criar usuário no Auth:', authError);
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // O trigger handle_new_user já cria o profile, mas precisamos atualizar campos adicionais
    const updateData: any = { primeiro_acesso: !senha }; // Se tem senha, não é primeiro acesso
    if (cpf) updateData.cpf = cpf;
    if (telefone) updateData.telefone = telefone;
    if (regioes_atendimento?.length) updateData.regioes_atendimento = regioes_atendimento;
    if (capacidade_diaria) updateData.capacidade_diaria = capacidade_diaria;
    
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('user_id', authUser.user.id);

    if (updateError) {
      console.error('Erro ao atualizar profile:', updateError);
    }

    // Adicionar múltiplos roles na tabela user_roles
    for (const role of perfisParaAdicionar) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: authUser.user.id,
          role: role,
        });

      if (roleError) {
        console.error(`Erro ao adicionar role ${role}:`, roleError);
      }
    }

    // Se não passou senha, gerar magic link para definir senha
    let linkData = null;
    if (!senha) {
      const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: email.toLowerCase(),
        options: {
          redirectTo: `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/auth/definir-senha`,
        }
      });
      linkData = data;

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
    }

    // Registrar log de auditoria
    await supabaseAdmin
      .from('auth_logs')
      .insert({
        profile_id: authUser.user.id,
        email: email.toLowerCase(),
        acao: 'usuario_criado',
        metadata: {
          criado_por: currentUserId,
          tipo,
          perfis: perfisParaAdicionar,
          com_senha: !!senha,
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
