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

    const supabaseUrl = "https://iyxdgmukrrdkffraptsx.supabase.co";
    const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI";
    
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

    // Verificar se o usuário tem role de diretor ou admin_master
    const { data: roles, error: rolesError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError) {
      return new Response(
        JSON.stringify({ error: "Erro ao verificar permissões" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isDiretor = roles?.some((r) => r.role === "diretor");
    const isAdminMaster = roles?.some((r) => r.role === "admin_master");

    if (!isDiretor && !isAdminMaster) {
      return new Response(
        JSON.stringify({ error: "Apenas diretores e admin master podem alterar emails" }),
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

    // Criar cliente admin para operações privilegiadas
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Configuração do servidor inválida" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar email atual do usuário para log
    const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const emailAntigo = targetUser?.user?.email;

    // Verificar se o email já está em uso
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(
      u => u.email?.toLowerCase() === novoEmail.toLowerCase() && u.id !== userId
    );

    if (emailExists) {
      return new Response(
        JSON.stringify({ error: "Este email já está em uso por outro usuário" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Atualizar o email do usuário (sem confirmação - admin)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { 
        email: novoEmail,
        email_confirm: true  // Confirma automaticamente
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
