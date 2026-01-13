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

    // Criar cliente com token do usuário para verificar permissões
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

    // Verificar se o usuário tem role de diretor
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
    if (!isDiretor) {
      return new Response(
        JSON.stringify({ error: "Apenas diretores podem excluir usuários" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obter dados da requisição
    const { userId, profileId } = await req.json();
    
    if (!profileId) {
      return new Response(
        JSON.stringify({ error: "ID do perfil não fornecido" }),
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

    // Buscar o user_id do profile se não foi fornecido
    let authUserId = userId;
    if (!authUserId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("id", profileId)
        .single();
      
      authUserId = profile?.user_id;
    }

    // Primeiro, excluir o profile (vai cascatear para user_roles por causa da FK)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .delete()
      .eq("id", profileId);

    if (profileError) {
      console.error("Erro ao excluir profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Erro ao excluir perfil do usuário" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Se tem user_id, excluir o usuário do Auth também
    if (authUserId) {
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(authUserId);
      if (authError) {
        console.error("Erro ao excluir usuário do Auth:", authError);
        // Não retornar erro porque o profile já foi excluído
      }
    }

    // Registrar log de auditoria
    await supabaseAdmin.from("auth_logs").insert({
      acao: "excluir",
      email: user.email,
      profile_id: user.id,
      metadata: { 
        usuario_excluido_profile_id: profileId,
        usuario_excluido_auth_id: authUserId,
      },
    });

    return new Response(
      JSON.stringify({ success: true, message: "Usuário excluído permanentemente" }),
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
