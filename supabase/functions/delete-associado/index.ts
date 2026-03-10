import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Helper para validar operações críticas e logar erros
function logIfError(
  operation: string,
  result: { error: any },
  context: Record<string, unknown>
) {
  if (result.error) {
    console.error(`[delete-associado] ERRO em ${operation}:`, {
      message: result.error.message,
      ...context,
    });
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    // Verificar permissão dinâmica via has_permission
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: temPermissao } = await adminClient.rpc('has_permission', {
      _user_id: user.id,
      _permission: 'canDeleteAssociado',
    });

    if (!temPermissao) {
      return new Response(
        JSON.stringify({ error: "Sem permissão para excluir associados" }),
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

    // 0. NOVO: Inativar e desvincular todos os veículos na Rede Veículos ANTES de excluir
    try {
      console.log(`[delete-associado] Inativando cliente na Rede Veículos...`);
      const inativarResponse = await fetch(
        `${supabaseUrl}/functions/v1/rede-veiculos-inativar-cliente-completo`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            associadoId,
            motivo: 'exclusao',
            observacoes: 'Exclusão permanente por diretor',
            atualizarBancoLocal: false,
            desvincular: true,
          }),
        }
      );
      const inativarResult = await inativarResponse.json();
      console.log(`[delete-associado] Resultado Rede Veículos:`, inativarResult);
    } catch (redeErr) {
      console.warn(`[delete-associado] Erro ao inativar na Rede Veículos (continuando):`, redeErr);
    }

    // 1. Fetch all contracts for this associate (by associado_id)
    const { data: contratos } = await supabaseAdmin
      .from("contratos")
      .select("id, cotacao_id")
      .eq("associado_id", associadoId);

    console.log(`[delete-associado] Contratos encontrados: ${contratos?.length || 0}`);

    // 1.5. Desvincular contrato_id do associado ANTES de excluir contratos (evita FK constraint)
    const unlinkResult = await supabaseAdmin
      .from("associados")
      .update({ contrato_id: null })
      .eq("id", associadoId);
    logIfError("desvincular contrato do associado", unlinkResult, { associadoId });
    
    console.log(`[delete-associado] Contrato desvinculado do associado`);

    // 2. For each contract, delete dependencies (INCLUINDO comissoes_deducoes)
    if (contratos && contratos.length > 0) {
      for (const contrato of contratos) {
        console.log(`[delete-associado] Limpando contrato: ${contrato.id}`);

        // **CRÍTICO**: Excluir comissoes_deducoes ANTES de excluir contratos (FK sem cascade)
        const comissoesDeducoesResult = await supabaseAdmin
          .from("comissoes_deducoes")
          .delete()
          .eq("contrato_id", contrato.id);
        logIfError("excluir comissoes_deducoes", comissoesDeducoesResult, { contrato_id: contrato.id });
        console.log(`[delete-associado] comissoes_deducoes excluídas para contrato: ${contrato.id}`);

        // Excluir comissoes (segurança adicional, mesmo com cascade)
        const comissoesResult = await supabaseAdmin
          .from("comissoes")
          .delete()
          .eq("contrato_id", contrato.id);
        logIfError("excluir comissoes", comissoesResult, { contrato_id: contrato.id });

        // Excluir instalacoes_pendentes_criacao (FK constraint)
        const instPendResult = await supabaseAdmin
          .from("instalacoes_pendentes_criacao")
          .delete()
          .eq("contrato_id", contrato.id);
        logIfError("excluir instalacoes_pendentes_criacao", instPendResult, { contrato_id: contrato.id });

        if (contrato.cotacao_id) {
          await supabaseAdmin.from("instalacoes_pendentes_criacao").delete().eq("cotacao_id", contrato.cotacao_id);
        }
        console.log(`[delete-associado] instalacoes_pendentes_criacao excluídas para contrato: ${contrato.id}`);

        // Excluir serviços vinculados
        const servicosResult = await supabaseAdmin.from("servicos").delete().eq("contrato_id", contrato.id);
        logIfError("excluir servicos", servicosResult, { contrato_id: contrato.id });

        if (contrato.cotacao_id) {
          await supabaseAdmin.from("servicos").delete().eq("cotacao_id", contrato.cotacao_id);
        }

        // Delete Asaas related
        const asaasResult = await supabaseAdmin.from("asaas_cobrancas").delete().eq("contrato_id", contrato.id);
        logIfError("excluir asaas_cobrancas", asaasResult, { contrato_id: contrato.id });
        
        // Delete contract documents
        await supabaseAdmin.from("contratos_documentos").delete().eq("contrato_id", contrato.id);
        await supabaseAdmin.from("contratos_historico").delete().eq("contrato_id", contrato.id);
        await supabaseAdmin.from("documentos_solicitados").delete().eq("contrato_id", contrato.id);
        
        // Delete gastos_beneficios
        await supabaseAdmin.from("gastos_beneficios").delete().eq("contrato_id", contrato.id);

        // Excluir blacklist_veiculos que referenciam vistorias do contrato ANTES de excluir vistorias
        const { data: vistoriasContrato } = await supabaseAdmin
          .from("vistorias")
          .select("id")
          .eq("contrato_id", contrato.id);
        
        if (vistoriasContrato && vistoriasContrato.length > 0) {
          for (const vistoria of vistoriasContrato) {
            await supabaseAdmin.from("blacklist_veiculos").delete().eq("vistoria_id", vistoria.id);
          }
        }

        // Delete installations and inspections linked to contract
        const instalacoesResult = await supabaseAdmin.from("instalacoes").delete().eq("contrato_id", contrato.id);
        logIfError("excluir instalacoes", instalacoesResult, { contrato_id: contrato.id });

        const vistoriasResult = await supabaseAdmin.from("vistorias").delete().eq("contrato_id", contrato.id);
        logIfError("excluir vistorias", vistoriasResult, { contrato_id: contrato.id });

        // Clear cotacao reference and delete
        if (contrato.cotacao_id) {
          await supabaseAdmin
            .from("cotacoes")
            .update({ contrato_gerado_id: null })
            .eq("id", contrato.cotacao_id);
          
          await supabaseAdmin.from("cotacao_beneficios").delete().eq("cotacao_id", contrato.cotacao_id);
          await supabaseAdmin.from("cotacoes").delete().eq("id", contrato.cotacao_id);
        }

        // Desvincular contrato do veículo antes de excluir o contrato
        const veiculoUnlinkResult = await supabaseAdmin
          .from("veiculos")
          .update({ contrato_id: null })
          .eq("contrato_id", contrato.id);
        logIfError("desvincular veiculo do contrato", veiculoUnlinkResult, { contrato_id: contrato.id });

        // Delete the contract itself
        const contratoDeleteResult = await supabaseAdmin.from("contratos").delete().eq("id", contrato.id);
        logIfError("excluir contrato", contratoDeleteResult, { contrato_id: contrato.id });
        
        if (contratoDeleteResult.error) {
          console.error(`[delete-associado] FALHA ao excluir contrato ${contrato.id}: ${contratoDeleteResult.error.message}`);
        } else {
          console.log(`[delete-associado] Contrato ${contrato.id} excluído com sucesso`);
        }
      }
    }

    // 2.1 VERIFICAR e excluir contratos restantes (segurança adicional)
    const { data: contratosRestantes } = await supabaseAdmin
      .from("contratos")
      .select("id")
      .eq("associado_id", associadoId);
    
    if (contratosRestantes && contratosRestantes.length > 0) {
      console.log(`[delete-associado] Encontrados ${contratosRestantes.length} contratos restantes, limpando dependências...`);
      
      for (const contrato of contratosRestantes) {
        // **CRÍTICO**: comissoes_deducoes primeiro!
        const comDeducResult = await supabaseAdmin.from("comissoes_deducoes").delete().eq("contrato_id", contrato.id);
        logIfError("force delete comissoes_deducoes", comDeducResult, { contrato_id: contrato.id });
        
        await supabaseAdmin.from("comissoes").delete().eq("contrato_id", contrato.id);
        await supabaseAdmin.from("instalacoes_pendentes_criacao").delete().eq("contrato_id", contrato.id);
        await supabaseAdmin.from("servicos").delete().eq("contrato_id", contrato.id);
        await supabaseAdmin.from("asaas_cobrancas").delete().eq("contrato_id", contrato.id);
        await supabaseAdmin.from("contratos_documentos").delete().eq("contrato_id", contrato.id);
        await supabaseAdmin.from("contratos_historico").delete().eq("contrato_id", contrato.id);
        await supabaseAdmin.from("documentos_solicitados").delete().eq("contrato_id", contrato.id);
        await supabaseAdmin.from("gastos_beneficios").delete().eq("contrato_id", contrato.id);
        await supabaseAdmin.from("instalacoes").delete().eq("contrato_id", contrato.id);
        await supabaseAdmin.from("vistorias").delete().eq("contrato_id", contrato.id);
        
        // Desvincular veículo
        await supabaseAdmin
          .from("veiculos")
          .update({ contrato_id: null })
          .eq("contrato_id", contrato.id);
        
        // Excluir contrato
        const forceDeleteResult = await supabaseAdmin.from("contratos").delete().eq("id", contrato.id);
        logIfError("force delete contrato", forceDeleteResult, { contrato_id: contrato.id });
      }
    }

    // 2.2 VERIFICAÇÃO FINAL: Checar se ainda existem contratos
    const { data: contratosFinal, count: contratosCount } = await supabaseAdmin
      .from("contratos")
      .select("id", { count: "exact", head: false })
      .eq("associado_id", associadoId);

    console.log(`[delete-associado] Contratos restantes após limpeza: ${contratosCount || 0}`);

    if (contratosFinal && contratosFinal.length > 0) {
      // Diagnóstico detalhado: verificar o que está bloqueando
      const diagnostico: Record<string, unknown>[] = [];
      
      for (const contrato of contratosFinal.slice(0, 5)) { // Limitar a 5 para não sobrecarregar
        const { count: comDeducCount } = await supabaseAdmin
          .from("comissoes_deducoes")
          .select("*", { count: "exact", head: true })
          .eq("contrato_id", contrato.id);
        
        diagnostico.push({
          contrato_id: contrato.id,
          comissoes_deducoes: comDeducCount || 0,
        });
      }

      console.error(`[delete-associado] BLOQUEIO: ${contratosFinal.length} contratos ainda existem:`, diagnostico);
      
      return new Response(
        JSON.stringify({
          error: "Não foi possível excluir todos os contratos do associado",
          contratos_restantes: contratosFinal.length,
          diagnostico,
          hint: "Existem dependências de banco bloqueando a exclusão. Verifique comissoes_deducoes ou outras FKs.",
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2.5. Excluir cotações órfãs vinculadas a leads do associado
    const { data: leads } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("associado_id", associadoId);

    console.log(`[delete-associado] Leads vinculados: ${leads?.length || 0}`);

    if (leads && leads.length > 0) {
      for (const lead of leads) {
        const { data: cotacoesLead } = await supabaseAdmin
          .from("cotacoes")
          .select("id")
          .eq("lead_id", lead.id);

        if (cotacoesLead && cotacoesLead.length > 0) {
          console.log(`[delete-associado] Excluindo ${cotacoesLead.length} cotações órfãs do lead: ${lead.id}`);
          
          for (const cotacao of cotacoesLead) {
            await supabaseAdmin.from("cotacao_beneficios").delete().eq("cotacao_id", cotacao.id);
            await supabaseAdmin.from("cotacoes_historico").delete().eq("cotacao_id", cotacao.id);
            await supabaseAdmin.from("servicos").delete().eq("cotacao_id", cotacao.id);
            await supabaseAdmin.from("instalacoes_pendentes_criacao").delete().eq("cotacao_id", cotacao.id);
            
            await supabaseAdmin
              .from("contratos")
              .update({ cotacao_id: null })
              .eq("cotacao_id", cotacao.id);

            await supabaseAdmin.from("agendamentos_base").delete().eq("cotacao_id", cotacao.id);
          }
          
          await supabaseAdmin.from("cotacoes").delete().eq("lead_id", lead.id);
        }
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
        // Excluir blacklist_veiculos que referenciam vistorias do veículo ANTES de excluir vistorias
        const { data: vistoriasVeiculo } = await supabaseAdmin
          .from("vistorias")
          .select("id")
          .eq("veiculo_id", veiculo.id);
        
        if (vistoriasVeiculo && vistoriasVeiculo.length > 0) {
          for (const vistoria of vistoriasVeiculo) {
            await supabaseAdmin.from("blacklist_veiculos").delete().eq("vistoria_id", vistoria.id);
          }
        }

        // Excluir blacklist_veiculos que referenciam o veículo diretamente
        await supabaseAdmin.from("blacklist_veiculos").delete().eq("veiculo_id", veiculo.id);

        // Delete veiculo dependencies
        await supabaseAdmin.from("vistorias").delete().eq("veiculo_id", veiculo.id);
        await supabaseAdmin.from("instalacoes").delete().eq("veiculo_id", veiculo.id);
        await supabaseAdmin.from("sinistros").delete().eq("veiculo_id", veiculo.id);
        await supabaseAdmin.from("chamados_assistencia").delete().eq("veiculo_id", veiculo.id);
        await supabaseAdmin.from("acionamentos_roubo_furto").delete().eq("veiculo_id", veiculo.id);
        
        // Update rastreadores - desvincular E voltar para estoque
        await supabaseAdmin
          .from("rastreadores")
          .update({ 
            veiculo_id: null,
            associado_id: null,
            associado_email: null,
            status: 'estoque',
            updated_at: new Date().toISOString()
          })
          .eq("veiculo_id", veiculo.id);

        // Desvincular contrato do veículo antes de excluir
        await supabaseAdmin
          .from("veiculos")
          .update({ contrato_id: null })
          .eq("id", veiculo.id);
      }
      
      await supabaseAdmin.from("veiculos").delete().eq("associado_id", associadoId);
    }

    // Excluir blacklist_veiculos que referenciam o associado diretamente
    await supabaseAdmin.from("blacklist_veiculos").delete().eq("associado_id", associadoId);

    // 13. Delete documentos
    await supabaseAdmin.from("documentos").delete().eq("associado_id", associadoId);

    // 14. Delete auth tokens
    await supabaseAdmin.from("auth_tokens_primeiro_acesso").delete().eq("associado_id", associadoId);

    // 15. Finally, delete the associate
    console.log(`[delete-associado] Todas as dependências limpas. Excluindo associado...`);
    
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
    try {
      await supabaseAdmin.from("auth_logs").insert({
        profile_id: user.id,
        acao: "exclusao_associado",
        modulo: "associados",
        metadata: {
          associado_id: associadoId,
          associado_nome: associado.nome,
          associado_cpf: associado.cpf,
          status_anterior: associado.status,
        },
      });
    } catch (logErr) {
      console.warn("[delete-associado] Erro ao registrar log:", logErr);
    }

    console.log(`[delete-associado] Associado ${associadoId} excluído com sucesso`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Associado ${associado.nome} excluído com sucesso`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[delete-associado] Erro geral:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
