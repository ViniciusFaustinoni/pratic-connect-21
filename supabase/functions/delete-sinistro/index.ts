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

    // Cliente autenticado para verificar usuário
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Cliente admin para bypass de RLS
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar usuário autenticado
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = claimsData.claims.sub;

    // Buscar profile do usuário
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
        JSON.stringify({ error: "Apenas diretores podem excluir sinistros" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obter dados do body
    const { sinistroId, motivo } = await req.json();

    if (!sinistroId) {
      return new Response(
        JSON.stringify({ error: "ID do sinistro é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!motivo || motivo.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: "Motivo da exclusão é obrigatório (mínimo 5 caracteres)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar dados do sinistro para auditoria
    const { data: sinistro, error: sinistroError } = await supabaseAdmin
      .from("sinistros")
      .select(`
        *,
        associado:associados(id, nome, cpf)
      `)
      .eq("id", sinistroId)
      .single();

    if (sinistroError || !sinistro) {
      return new Response(
        JSON.stringify({ error: "Sinistro não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[delete-sinistro] Iniciando exclusão do sinistro ${sinistro.protocolo} por ${profile.nome}`);

    // ============================================
    // EXCLUSÃO EM CASCATA
    // ============================================

    // 1. Excluir mensagens do sinistro
    const { error: msgError } = await supabaseAdmin
      .from("sinistro_mensagens")
      .delete()
      .eq("sinistro_id", sinistroId);
    
    if (msgError) {
      console.error("[delete-sinistro] Erro ao excluir mensagens:", msgError);
    }

    // 2. Buscar fotos e excluir do storage
    const { data: fotos } = await supabaseAdmin
      .from("sinistro_fotos")
      .select("id, storage_path")
      .eq("sinistro_id", sinistroId);

    if (fotos && fotos.length > 0) {
      for (const foto of fotos) {
        try {
          if (foto.storage_path) {
            // storage_path format: "bucket/path/to/file"
            const parts = foto.storage_path.split("/");
            const bucket = parts[0];
            const filePath = parts.slice(1).join("/");
            if (bucket && filePath) {
              await supabaseAdmin.storage.from(bucket).remove([filePath]);
            }
          }
        } catch (e) {
          console.error("[delete-sinistro] Erro ao excluir foto do storage:", e);
        }
      }
    }

    // 3. Excluir registros de fotos
    const { error: fotosError } = await supabaseAdmin
      .from("sinistro_fotos")
      .delete()
      .eq("sinistro_id", sinistroId);

    if (fotosError) {
      console.error("[delete-sinistro] Erro ao excluir fotos:", fotosError);
    }

    // 4. Excluir documentos
    const { error: docsError } = await supabaseAdmin
      .from("sinistro_documentos")
      .delete()
      .eq("sinistro_id", sinistroId);

    if (docsError) {
      console.error("[delete-sinistro] Erro ao excluir documentos:", docsError);
    }

    // 5. Excluir histórico
    const { error: histError } = await supabaseAdmin
      .from("sinistro_historico")
      .delete()
      .eq("sinistro_id", sinistroId);

    if (histError) {
      console.error("[delete-sinistro] Erro ao excluir histórico:", histError);
    }

    // 6. Excluir gastos de benefícios vinculados
    const { error: gastosError } = await supabaseAdmin
      .from("gastos_beneficios")
      .delete()
      .eq("sinistro_id", sinistroId);

    if (gastosError) {
      console.error("[delete-sinistro] Erro ao excluir gastos:", gastosError);
    }

    // 7. Desvincular ordens de serviço
    const { error: osError } = await supabaseAdmin
      .from("ordens_servico")
      .update({ sinistro_id: null })
      .eq("sinistro_id", sinistroId);

    if (osError) {
      console.error("[delete-sinistro] Erro ao desvincular ordens de serviço:", osError);
    }

    // 8. Desvincular processos (não exclui, apenas remove referência)
    const { error: processosError } = await supabaseAdmin
      .from("processos")
      .update({ sinistro_id: null })
      .eq("sinistro_id", sinistroId);

    if (processosError) {
      console.error("[delete-sinistro] Erro ao desvincular processos:", processosError);
    }

    // 9. Excluir sinistro principal
    const { error: deleteError } = await supabaseAdmin
      .from("sinistros")
      .delete()
      .eq("id", sinistroId);

    if (deleteError) {
      console.error("[delete-sinistro] Erro ao excluir sinistro:", deleteError);
      return new Response(
        JSON.stringify({ error: "Erro ao excluir sinistro: " + deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 10. Registrar log de auditoria
    await supabaseAdmin.from("auth_logs").insert({
      acao: "excluir_sinistro",
      modulo: "sinistros",
      email: profile.email,
      profile_id: profile.id,
      metadata: {
        sinistro_id: sinistroId,
        protocolo: sinistro.protocolo,
        associado_id: sinistro.associado_id,
        associado_nome: sinistro.associado?.nome,
        motivo: motivo.trim(),
        tipo: sinistro.tipo,
        status: sinistro.status,
        excluido_por: profile.nome,
      },
    });

    console.log(`[delete-sinistro] Sinistro ${sinistro.protocolo} excluído com sucesso`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sinistro ${sinistro.protocolo} excluído permanentemente`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[delete-sinistro] Erro:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
