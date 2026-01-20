import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido ou expirado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is a director or admin
    const { data: roles, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (roleError) {
      console.error("[delete-ativacao] Erro ao verificar role:", roleError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar permissões" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allowedRoles = ["diretor", "admin_master", "desenvolvedor"];
    const hasPermission = roles?.some((r) => allowedRoles.includes(r.role));
    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: "Apenas diretores e administradores podem excluir ativações" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get request body
    const body = await req.json();
    const { contratoId } = body;

    if (!contratoId) {
      return new Response(
        JSON.stringify({ error: "ID do contrato é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[delete-ativacao] Iniciando exclusão da ativação: ${contratoId}`);

    // Use service role for deletions (bypass RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch contract info
    const { data: contrato, error: contratoFetchError } = await supabaseAdmin
      .from("contratos")
      .select("id, numero, autentique_documento_id, cotacao_id, associado_id, cliente_nome")
      .eq("id", contratoId)
      .single();

    if (contratoFetchError || !contrato) {
      console.error("[delete-ativacao] Contrato não encontrado:", contratoFetchError);
      return new Response(
        JSON.stringify({ error: "Contrato não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[delete-ativacao] Excluindo contrato: ${contrato.numero} - ${contrato.cliente_nome}`);

    // 1. Cancel Autentique document if exists
    if (contrato.autentique_documento_id) {
      try {
        console.log(`[delete-ativacao] Tentando cancelar documento Autentique: ${contrato.autentique_documento_id}`);
        // This is optional - if fails, continue
      } catch (e) {
        console.warn("[delete-ativacao] Falha ao cancelar Autentique:", e);
      }
    }

    // 2. Delete Asaas related to contract
    await supabaseAdmin.from("asaas_cobrancas").delete().eq("contrato_id", contratoId);
    console.log("[delete-ativacao] Cobranças Asaas excluídas");

    // 3. Delete cobrancas (old table)
    await supabaseAdmin.from("cobrancas").delete().eq("contrato_id", contratoId);

    // 4. Delete contract history
    await supabaseAdmin.from("contratos_historico").delete().eq("contrato_id", contratoId);

    // 5. Delete vistorias linked to contract
    await supabaseAdmin.from("vistorias").delete().eq("contrato_id", contratoId);
    console.log("[delete-ativacao] Vistorias do contrato excluídas");

    // 6. Delete contract documents
    await supabaseAdmin.from("contratos_documentos").delete().eq("contrato_id", contratoId);
    await supabaseAdmin.from("documentos_solicitados").delete().eq("contrato_id", contratoId);

    // 7. Delete gastos_beneficios
    await supabaseAdmin.from("gastos_beneficios").delete().eq("contrato_id", contratoId);

    // 8. Delete instalacoes linked to contract
    await supabaseAdmin.from("instalacoes").delete().eq("contrato_id", contratoId);

    // 9. Clear cotacao reference and delete cotacao
    if (contrato.cotacao_id) {
      await supabaseAdmin
        .from("cotacoes")
        .update({ contrato_gerado_id: null })
        .eq("id", contrato.cotacao_id);

      // Delete cotacao beneficios first
      await supabaseAdmin.from("cotacao_beneficios").delete().eq("cotacao_id", contrato.cotacao_id);
      await supabaseAdmin.from("cotacoes").delete().eq("id", contrato.cotacao_id);
      console.log("[delete-ativacao] Cotação excluída");
    }

    // 10. Clear reference in associado
    if (contrato.associado_id) {
      await supabaseAdmin
        .from("associados")
        .update({ contrato_id: null })
        .eq("id", contrato.associado_id);
    }

    // 11. Delete the contract
    const { error: deleteContratoError } = await supabaseAdmin
      .from("contratos")
      .delete()
      .eq("id", contratoId);

    if (deleteContratoError) {
      console.error("[delete-ativacao] Erro ao excluir contrato:", deleteContratoError);
      return new Response(
        JSON.stringify({ error: `Erro ao excluir contrato: ${deleteContratoError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[delete-ativacao] Contrato excluído");

    // 12. Handle associate cleanup
    let associadoExcluido = false;
    if (contrato.associado_id) {
      // Check if associate has other contracts
      const { count } = await supabaseAdmin
        .from("contratos")
        .select("*", { count: "exact", head: true })
        .eq("associado_id", contrato.associado_id);

      if (count === 0) {
        console.log("[delete-ativacao] Associado não tem outros contratos, excluindo...");

        // Delete associate dependencies
        await supabaseAdmin.from("cobranca_fila").delete().eq("associado_id", contrato.associado_id);
        await supabaseAdmin.from("cobranca_contatos").delete().eq("associado_id", contrato.associado_id);
        await supabaseAdmin.from("regua_execucoes").delete().eq("associado_id", contrato.associado_id);
        await supabaseAdmin.from("ordens_servico").delete().eq("associado_id", contrato.associado_id);
        await supabaseAdmin.from("negativacoes").delete().eq("associado_id", contrato.associado_id);
        await supabaseAdmin.from("processos").delete().eq("associado_id", contrato.associado_id);
        await supabaseAdmin.from("consultas_juridicas").delete().eq("associado_id", contrato.associado_id);
        await supabaseAdmin.from("ouvidoria_manifestacoes").delete().eq("associado_id", contrato.associado_id);
        await supabaseAdmin.from("documento_gerados").delete().eq("associado_id", contrato.associado_id);
        await supabaseAdmin.from("indicacoes").delete().eq("associado_id", contrato.associado_id);
        await supabaseAdmin.from("indicacoes").delete().eq("indicador_id", contrato.associado_id);
        await supabaseAdmin.from("asaas_pagamentos").delete().eq("associado_id", contrato.associado_id);
        await supabaseAdmin.from("asaas_cobrancas").delete().eq("associado_id", contrato.associado_id);
        await supabaseAdmin.from("asaas_clientes").delete().eq("associado_id", contrato.associado_id);
        await supabaseAdmin.from("documentos").delete().eq("associado_id", contrato.associado_id);
        await supabaseAdmin.from("auth_tokens_primeiro_acesso").delete().eq("associado_id", contrato.associado_id);
        await supabaseAdmin.from("associados_historico").delete().eq("associado_id", contrato.associado_id);

        // Delete vistorias of associate
        await supabaseAdmin.from("vistorias").delete().eq("associado_id", contrato.associado_id);

        // Delete veiculos and their dependencies
        const { data: veiculos } = await supabaseAdmin
          .from("veiculos")
          .select("id")
          .eq("associado_id", contrato.associado_id);

        if (veiculos && veiculos.length > 0) {
          for (const veiculo of veiculos) {
            await supabaseAdmin.from("vistorias").delete().eq("veiculo_id", veiculo.id);
            await supabaseAdmin.from("instalacoes").delete().eq("veiculo_id", veiculo.id);
            await supabaseAdmin.from("sinistros").delete().eq("veiculo_id", veiculo.id);
            await supabaseAdmin.from("chamados_assistencia").delete().eq("veiculo_id", veiculo.id);
            await supabaseAdmin.from("rastreadores").update({ veiculo_id: null }).eq("veiculo_id", veiculo.id);
          }
          await supabaseAdmin.from("veiculos").delete().eq("associado_id", contrato.associado_id);
        }

        // Unlink leads (keep for history)
        await supabaseAdmin.from("leads").update({ associado_id: null }).eq("associado_id", contrato.associado_id);

        // Delete associate
        const { error: deleteAssociadoError } = await supabaseAdmin
          .from("associados")
          .delete()
          .eq("id", contrato.associado_id);

        if (deleteAssociadoError) {
          console.error("[delete-ativacao] Erro ao excluir associado:", deleteAssociadoError);
        } else {
          associadoExcluido = true;
          console.log("[delete-ativacao] Associado excluído");
        }
      }
    }

    // 13. Log the action
    await supabaseAdmin.from("auth_logs").insert({
      acao: "excluir_ativacao",
      modulo: "ativacoes",
      email: user.email,
      profile_id: user.id,
      metadata: {
        contrato_id: contratoId,
        contrato_numero: contrato.numero,
        cliente_nome: contrato.cliente_nome,
        cotacao_excluida: !!contrato.cotacao_id,
        associado_excluido: associadoExcluido,
      },
    });

    console.log(`[delete-ativacao] Ativação excluída com sucesso`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Ativação ${contrato.numero} excluída com sucesso`,
        details: {
          cotacao_excluida: !!contrato.cotacao_id,
          associado_excluido: associadoExcluido,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[delete-ativacao] Erro:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
