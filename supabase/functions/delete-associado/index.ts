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

    // Check if user is a director
    const { data: roles, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (roleError) {
      console.error("[delete-associado] Erro ao verificar role:", roleError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar permissões" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isDiretor = roles?.some((r) => r.role === "diretor");
    if (!isDiretor) {
      return new Response(
        JSON.stringify({ error: "Apenas diretores podem excluir associados" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get request body
    const body = await req.json();
    const { associadoId } = body;

    if (!associadoId) {
      return new Response(
        JSON.stringify({ error: "ID do associado é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[delete-associado] Iniciando exclusão do associado: ${associadoId}`);

    // Use service role for deletions (bypass RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch associate info for audit
    const { data: associado } = await supabaseAdmin
      .from("associados")
      .select("nome, cpf, email, status")
      .eq("id", associadoId)
      .single();

    if (!associado) {
      return new Response(
        JSON.stringify({ error: "Associado não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[delete-associado] Excluindo associado: ${associado.nome} (${associado.cpf})`);

    // 1. Fetch all contracts for this associate
    const { data: contratos } = await supabaseAdmin
      .from("contratos")
      .select("id, cotacao_id")
      .eq("associado_id", associadoId);

    console.log(`[delete-associado] Contratos encontrados: ${contratos?.length || 0}`);

    // 2. For each contract, delete dependencies
    if (contratos && contratos.length > 0) {
      for (const contrato of contratos) {
        console.log(`[delete-associado] Limpando contrato: ${contrato.id}`);

        // Delete Asaas related
        await supabaseAdmin.from("asaas_cobrancas").delete().eq("contrato_id", contrato.id);
        
        // Delete contract documents
        await supabaseAdmin.from("contratos_documentos").delete().eq("contrato_id", contrato.id);
        await supabaseAdmin.from("contratos_historico").delete().eq("contrato_id", contrato.id);
        await supabaseAdmin.from("documentos_solicitados").delete().eq("contrato_id", contrato.id);
        
        // Delete gastos_beneficios
        await supabaseAdmin.from("gastos_beneficios").delete().eq("contrato_id", contrato.id);

        // Delete installations and inspections linked to contract
        await supabaseAdmin.from("instalacoes").delete().eq("contrato_id", contrato.id);
        await supabaseAdmin.from("vistorias").delete().eq("contrato_id", contrato.id);

        // Clear cotacao reference and delete
        if (contrato.cotacao_id) {
          await supabaseAdmin
            .from("cotacoes")
            .update({ contrato_gerado_id: null })
            .eq("id", contrato.cotacao_id);
          
          // Delete cotacao beneficios first
          await supabaseAdmin.from("cotacao_beneficios").delete().eq("cotacao_id", contrato.cotacao_id);
          await supabaseAdmin.from("cotacoes").delete().eq("id", contrato.cotacao_id);
        }

        // Delete the contract itself
        await supabaseAdmin.from("contratos").delete().eq("id", contrato.id);
      }
    }

    // 3. Unlink leads (keep for history)
    const { error: leadsError } = await supabaseAdmin
      .from("leads")
      .update({ associado_id: null })
      .eq("associado_id", associadoId);
    
    if (leadsError) {
      console.log(`[delete-associado] Aviso ao desvincular leads: ${leadsError.message}`);
    }

    // 4. Delete cobranca related tables
    await supabaseAdmin.from("cobranca_fila").delete().eq("associado_id", associadoId);
    await supabaseAdmin.from("cobranca_contatos").delete().eq("associado_id", associadoId);
    await supabaseAdmin.from("regua_execucoes").delete().eq("associado_id", associadoId);
    
    // Delete acordos and related
    const { data: acordos } = await supabaseAdmin
      .from("acordos")
      .select("id")
      .eq("associado_id", associadoId);
    
    if (acordos && acordos.length > 0) {
      for (const acordo of acordos) {
        await supabaseAdmin.from("acordo_parcelas").delete().eq("acordo_id", acordo.id);
      }
      await supabaseAdmin.from("acordos").delete().eq("associado_id", associadoId);
    }

    // 5. Delete cobrancas (independent of contract)
    await supabaseAdmin.from("cobrancas").delete().eq("associado_id", associadoId);

    // 6. Delete negativacoes
    await supabaseAdmin.from("negativacoes").delete().eq("associado_id", associadoId);

    // 7. Delete legal tables
    await supabaseAdmin.from("processos").delete().eq("associado_id", associadoId);
    await supabaseAdmin.from("consultas_juridicas").delete().eq("associado_id", associadoId);

    // 8. Delete other tables
    await supabaseAdmin.from("ordens_servico").delete().eq("associado_id", associadoId);
    await supabaseAdmin.from("ouvidoria_manifestacoes").delete().eq("associado_id", associadoId);
    await supabaseAdmin.from("documento_gerados").delete().eq("associado_id", associadoId);

    // 9. Delete indicacoes (both sides)
    await supabaseAdmin.from("indicacoes").delete().eq("associado_id", associadoId);
    await supabaseAdmin.from("indicacoes").delete().eq("indicador_id", associadoId);

    // 10. Delete Asaas client and payments
    await supabaseAdmin.from("asaas_pagamentos").delete().eq("associado_id", associadoId);
    await supabaseAdmin.from("asaas_cobrancas").delete().eq("associado_id", associadoId);
    await supabaseAdmin.from("asaas_clientes").delete().eq("associado_id", associadoId);

    // 11. Delete historico
    await supabaseAdmin.from("associados_historico").delete().eq("associado_id", associadoId);

    // 12. Delete veiculos (they have their own dependencies)
    const { data: veiculos } = await supabaseAdmin
      .from("veiculos")
      .select("id")
      .eq("associado_id", associadoId);

    if (veiculos && veiculos.length > 0) {
      for (const veiculo of veiculos) {
        // Delete veiculo dependencies
        await supabaseAdmin.from("vistorias").delete().eq("veiculo_id", veiculo.id);
        await supabaseAdmin.from("instalacoes").delete().eq("veiculo_id", veiculo.id);
        await supabaseAdmin.from("sinistros").delete().eq("veiculo_id", veiculo.id);
        await supabaseAdmin.from("chamados_assistencia").delete().eq("veiculo_id", veiculo.id);
        
        // Update rastreadores to unlink
        await supabaseAdmin
          .from("rastreadores")
          .update({ veiculo_id: null })
          .eq("veiculo_id", veiculo.id);
      }
      
      await supabaseAdmin.from("veiculos").delete().eq("associado_id", associadoId);
    }

    // 13. Delete documentos
    await supabaseAdmin.from("documentos").delete().eq("associado_id", associadoId);

    // 14. Delete auth tokens
    await supabaseAdmin.from("auth_tokens_primeiro_acesso").delete().eq("associado_id", associadoId);

    // 15. Finally, delete the associate
    const { error: deleteError } = await supabaseAdmin
      .from("associados")
      .delete()
      .eq("id", associadoId);

    if (deleteError) {
      console.error(`[delete-associado] Erro ao excluir associado: ${deleteError.message}`);
      return new Response(
        JSON.stringify({ error: `Erro ao excluir associado: ${deleteError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 16. Log the action
    await supabaseAdmin.from("auth_logs").insert({
      acao: "excluir_associado",
      modulo: "associados",
      email: user.email,
      profile_id: user.id,
      metadata: {
        associado_id: associadoId,
        associado_nome: associado.nome,
        associado_cpf: associado.cpf,
        associado_status: associado.status,
        contratos_excluidos: contratos?.length || 0,
        veiculos_excluidos: veiculos?.length || 0,
      },
    });

    console.log(`[delete-associado] Associado excluído com sucesso: ${associado.nome}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Associado ${associado.nome} excluído com sucesso`,
        details: {
          contratos_excluidos: contratos?.length || 0,
          veiculos_excluidos: veiculos?.length || 0,
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[delete-associado] Erro:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
