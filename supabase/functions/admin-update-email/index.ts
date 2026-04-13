import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Token de autenticação não fornecido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "https://iyxdgmukrrdkffraptsx.supabase.co";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI";
    
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verificar usuário autenticado
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar permissão dinâmica via has_permission
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Configuração do servidor inválida" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClientForRpc = createClient(supabaseUrl, supabaseServiceKey);

    const { data: temPermissao } = await adminClientForRpc.rpc('has_permission', {
      _user_id: user.id,
      _permission: 'canUpdateEmail',
    });

    if (!temPermissao) {
      return new Response(
        JSON.stringify({ error: "Sem permissão para alterar emails" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obter dados da requisição
    const { userId, novoEmail } = await req.json();
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "ID do usuário não fornecido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!novoEmail || !emailRegex.test(novoEmail)) {
      return new Response(
        JSON.stringify({ error: "Email inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reutilizar cliente admin já criado acima
    const supabaseAdmin = adminClientForRpc;

    // Buscar email atual do usuário para log
    const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const emailAntigo = targetUser?.user?.email;

    // Verificar se o email já está em uso - buscar por email específico
    const { data: { users: existingUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });
    
    // Tentar buscar usuário pelo email novo para verificar duplicidade
    // Usamos uma abordagem diferente: tentar atualizar e tratar o erro
    
    // Atualizar o email do usuário (sem confirmação - admin)
    console.log(`Tentando atualizar email do usuário ${userId} para ${novoEmail}`);
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { 
        email: novoEmail,
        email_confirm: true
      }
    );

    if (updateError) {
      console.error("Erro ao atualizar email:", updateError);
      return new Response(
        JSON.stringify({ error: "Erro ao alterar email: " + updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Atualizar email na tabela profiles
    await supabaseAdmin
      .from("profiles")
      .update({ email: novoEmail, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    // Registrar log de auditoria
    await supabaseAdmin.from("auth_logs").insert({
      acao: "alterar_email",
      email: user.email,
      profile_id: user.id,
      metadata: { 
        usuario_alterado_id: userId,
        email_antigo: emailAntigo,
        email_novo: novoEmail,
        tipo: "alteracao_administrativa",
      },
    });

    console.log(`Email alterado com sucesso: ${emailAntigo} -> ${novoEmail} por ${user.email}`);

    return new Response(
      JSON.stringify({ success: true, message: "Email alterado com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
