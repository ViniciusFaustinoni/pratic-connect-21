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
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Token de autenticação obrigatório" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar usuário
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    // Buscar profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, email")
      .eq("user_id", userId)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "Perfil não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se é diretor
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const isDiretor = roles?.some((r) => r.role === "diretor");
    if (!isDiretor) {
      return new Response(
        JSON.stringify({ error: "Apenas diretores podem excluir chamados" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obter dados do body
    const { chamadoId, motivo } = await req.json();

    if (!chamadoId) {
      return new Response(
        JSON.stringify({ error: "ID do chamado é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!motivo || motivo.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: "Motivo da exclusão é obrigatório (mínimo 5 caracteres)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar dados do chamado para auditoria
    const { data: chamado, error: chamadoError } = await supabaseAdmin
      .from("chamados_assistencia")
      .select(`
        *,
        associado:associados(id, nome, cpf)
      `)
      .eq("id", chamadoId)
      .single();

    if (chamadoError || !chamado) {
      return new Response(
        JSON.stringify({ error: "Chamado não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[delete-chamado-assistencia] Iniciando exclusão do chamado ${chamado.protocolo} por ${profile.nome}`);

    // ============================================
    // EXCLUSÃO EM CASCATA
    // ============================================

    // 1. Excluir atendimentos
    const { error: atendError } = await supabaseAdmin
      .from("chamados_assistencia_atendimentos")
      .delete()
      .eq("chamado_id", chamadoId);

    if (atendError) {
      console.error("[delete-chamado-assistencia] Erro ao excluir atendimentos:", atendError);
    }

    // 2. Excluir histórico
    const { error: histError } = await supabaseAdmin
      .from("chamados_assistencia_historico")
      .delete()
      .eq("chamado_id", chamadoId);

    if (histError) {
      console.error("[delete-chamado-assistencia] Erro ao excluir histórico:", histError);
    }

    // 3. Desvincular sinistros relacionados
    const { error: sinistrosError } = await supabaseAdmin
      .from("sinistros")
      .update({ chamado_origem_id: null, chamado_assistencia_id: null })
      .or(`chamado_origem_id.eq.${chamadoId},chamado_assistencia_id.eq.${chamadoId}`);

    if (sinistrosError) {
      console.error("[delete-chamado-assistencia] Erro ao desvincular sinistros:", sinistrosError);
    }

    // 4. Limpar histórico de conversa da IA do associado
    const { error: chatError } = await supabaseAdmin
      .from("chat_mensagens_ia")
      .delete()
      .eq("associado_id", chamado.associado_id);

    if (chatError) {
      console.error("[delete-chamado-assistencia] Erro ao limpar chat_mensagens_ia:", chatError);
    }

    // 5. Excluir chamado principal
    const { error: deleteError } = await supabaseAdmin
      .from("chamados_assistencia")
      .delete()
      .eq("id", chamadoId);

    if (deleteError) {
      console.error("[delete-chamado-assistencia] Erro ao excluir chamado:", deleteError);
      return new Response(
        JSON.stringify({ error: "Erro ao excluir chamado: " + deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Registrar log de auditoria
    await supabaseAdmin.from("auth_logs").insert({
      acao: "excluir_chamado_assistencia",
      modulo: "assistencia",
      email: profile.email,
      profile_id: profile.id,
      metadata: {
        chamado_id: chamadoId,
        protocolo: chamado.protocolo,
        associado_id: chamado.associado_id,
        associado_nome: chamado.associado?.nome,
        motivo: motivo.trim(),
        tipo_servico: chamado.tipo_servico,
        status: chamado.status,
        excluido_por: profile.nome,
      },
    });

    console.log(`[delete-chamado-assistencia] Chamado ${chamado.protocolo} excluído com sucesso`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Chamado ${chamado.protocolo} excluído permanentemente`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[delete-chamado-assistencia] Erro:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
