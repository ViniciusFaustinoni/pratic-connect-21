import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfiguracaoNumero } from "../_shared/config-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ success: false, error: "Configuração ausente" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { solicitacao_id, cenario_override } = await req.json();

    if (!solicitacao_id) {
      return new Response(JSON.stringify({ success: false, error: "solicitacao_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[efetivar-troca] Iniciando efetivação para solicitação ${solicitacao_id}`);

    // 1. Buscar solicitação
    const { data: solicitacao, error: solError } = await supabase
      .from("chat_solicitacoes_ia")
      .select("*")
      .eq("id", solicitacao_id)
      .single();

    if (solError || !solicitacao) {
      console.error("[efetivar-troca] Solicitação não encontrada:", solError);
      return new Response(JSON.stringify({ success: false, error: "Solicitação não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dados = solicitacao.dados as Record<string, unknown> || {};
    const dadosNovoTitular = solicitacao.dados_novo_titular as Record<string, string> | null;

    if (!dadosNovoTitular?.cpf) {
      return new Response(JSON.stringify({ success: false, error: "Dados do novo titular incompletos (CPF obrigatório)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine cenário
    const resultadoProtocolo = dados.resultado_protocolo as string || solicitacao.resultado_protocolo as string || "";
    const cenario = cenario_override || (resultadoProtocolo.includes("TRC-DISP-") ? "A" : "B");
    console.log(`[efetivar-troca] Cenário: ${cenario}`);

    // 2. Buscar veículo
    let veiculoId = dados.veiculo_id as string;
    if (!veiculoId) {
      const { data: veiculos } = await supabase
        .from("veiculos")
        .select("id")
        .eq("associado_id", solicitacao.associado_id)
        .eq("status", "ativo")
        .limit(1);
      veiculoId = veiculos?.[0]?.id;
    }

    if (!veiculoId) {
      // Try any vehicle linked to the associado
      const { data: veiculos } = await supabase
        .from("veiculos")
        .select("id")
        .eq("associado_id", solicitacao.associado_id)
        .order("created_at", { ascending: false })
        .limit(1);
      veiculoId = veiculos?.[0]?.id;
    }

    if (!veiculoId) {
      return new Response(JSON.stringify({ success: false, error: "Veículo não encontrado para o associado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[efetivar-troca] Veículo: ${veiculoId}`);

    // 3. Buscar/Criar associado do novo titular
    const cpfLimpo = dadosNovoTitular.cpf.replace(/\D/g, "");
    let novoAssociadoId: string;

    const { data: associadoExistente } = await supabase
      .from("associados")
      .select("id, status")
      .eq("cpf", cpfLimpo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (associadoExistente) {
      novoAssociadoId = associadoExistente.id;
      console.log(`[efetivar-troca] Associado existente encontrado: ${novoAssociadoId} (status: ${associadoExistente.status})`);

      // Reactivate if inactive
      if (associadoExistente.status !== "ativo") {
        await supabase
          .from("associados")
          .update({ status: "ativo", updated_at: new Date().toISOString() })
          .eq("id", novoAssociadoId);
        console.log(`[efetivar-troca] Associado reativado`);
      }
    } else {
      // Create new associado
      const { data: novoAssociado, error: criarError } = await supabase
        .from("associados")
        .insert({
          nome: dadosNovoTitular.nome,
          cpf: cpfLimpo,
          email: dadosNovoTitular.email || null,
          telefone: dadosNovoTitular.telefone || null,
          whatsapp: dadosNovoTitular.telefone || null,
          status: "ativo",
          tipo_entrada: "troca_titularidade",
        })
        .select("id")
        .single();

      if (criarError || !novoAssociado) {
        console.error("[efetivar-troca] Erro ao criar associado:", criarError);
        return new Response(JSON.stringify({ success: false, error: "Erro ao criar novo associado" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      novoAssociadoId = novoAssociado.id;
      console.log(`[efetivar-troca] Novo associado criado: ${novoAssociadoId}`);
    }

    // 4. Buscar contrato ativo do titular anterior
    const { data: contratoAnterior } = await supabase
      .from("contratos")
      .select("id, plano_id, valor_mensal, cota_participacao, vendedor_id, dia_vencimento, veiculo_id, numero")
      .eq("associado_id", solicitacao.associado_id)
      .in("status", ["ativo", "pendente"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!contratoAnterior) {
      console.warn("[efetivar-troca] Nenhum contrato ativo encontrado para o titular anterior, continuando sem herança de contrato");
    }

    // 5. Ler configurações
    const taxaTroca = await getConfiguracaoNumero(supabase, "taxa_troca_titularidade", 50);
    const carenciaPadrao = await getConfiguracaoNumero(supabase, "carencia_dias_padrao", 120);
    const carenciaCenarioA = await getConfiguracaoNumero(supabase, "carencia_troca_titularidade_cenario_a", 0);

    const carenciaDias = cenario === "A" ? carenciaCenarioA : carenciaPadrao;
    const carenciaIsenta = carenciaDias === 0;

    console.log(`[efetivar-troca] Config: taxa=${taxaTroca}, carência=${carenciaDias} dias (isenta: ${carenciaIsenta})`);

    // 6. Transferir veículo
    const { error: transferError } = await supabase
      .from("veiculos")
      .update({
        associado_id: novoAssociadoId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", veiculoId);

    if (transferError) {
      console.error("[efetivar-troca] Erro ao transferir veículo:", transferError);
      return new Response(JSON.stringify({ success: false, error: "Erro ao transferir veículo" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[efetivar-troca] Veículo ${veiculoId} transferido para ${novoAssociadoId}`);

    // 7. Criar contrato do novo titular
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
    const numeroContrato = `TRC-${year}${month}${day}-${random}`;

    // Determine vendedor: from previous contract, or from solicitação creator
    let vendedorId = contratoAnterior?.vendedor_id || null;
    if (!vendedorId && solicitacao.criado_por) {
      // Try to use the consultant who created the request
      const { data: profileCriador } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", solicitacao.criado_por)
        .maybeSingle();
      vendedorId = profileCriador?.id || null;
    }

    const dataInicio = now.toISOString().split("T")[0];
    let dataFimCarencia: string | null = null;
    if (!carenciaIsenta && carenciaDias > 0) {
      const fimCarencia = new Date(now);
      fimCarencia.setDate(fimCarencia.getDate() + carenciaDias);
      dataFimCarencia = fimCarencia.toISOString().split("T")[0];
    }

    const contratoData: Record<string, unknown> = {
      numero: numeroContrato,
      associado_id: novoAssociadoId,
      veiculo_id: veiculoId,
      plano_id: contratoAnterior?.plano_id,
      valor_adesao: 0, // Troca de titularidade não tem adesão, tem taxa separada
      valor_mensal: contratoAnterior?.valor_mensal || 0,
      cota_participacao: contratoAnterior?.cota_participacao || null,
      dia_vencimento: contratoAnterior?.dia_vencimento || now.getDate(),
      vendedor_id: vendedorId,
      status: "ativo",
      data_inicio: dataInicio,
      data_ativacao: now.toISOString(),
      tipo_entrada: "troca_titularidade",
      origem_troca_titularidade_id: solicitacao_id,
      carencia_isenta: carenciaIsenta,
      carencia_motivo_isencao: carenciaIsenta ? `Cenário ${cenario}: carência dispensada na troca de titularidade` : null,
    };

    // Copy vehicle data for the contract snapshot
    const { data: veiculoData } = await supabase
      .from("veiculos")
      .select("placa, marca, modelo, ano, cor, chassi, renavam, valor_fipe")
      .eq("id", veiculoId)
      .maybeSingle();

    if (veiculoData) {
      contratoData.veiculo_placa = veiculoData.placa;
      contratoData.veiculo_marca = veiculoData.marca;
      contratoData.veiculo_modelo = veiculoData.modelo;
      contratoData.veiculo_ano = veiculoData.ano;
      contratoData.veiculo_cor = veiculoData.cor;
      contratoData.veiculo_chassi = veiculoData.chassi;
      contratoData.veiculo_renavam = veiculoData.renavam;
      contratoData.veiculo_valor_fipe = veiculoData.valor_fipe;
    }

    // Copy client data
    contratoData.cliente_nome = dadosNovoTitular.nome;
    contratoData.cliente_cpf = cpfLimpo;
    contratoData.cliente_email = dadosNovoTitular.email || null;
    contratoData.cliente_telefone = dadosNovoTitular.telefone || null;

    const { data: novoContrato, error: contratoError } = await supabase
      .from("contratos")
      .insert(contratoData)
      .select("id, numero")
      .single();

    if (contratoError || !novoContrato) {
      console.error("[efetivar-troca] Erro ao criar contrato:", contratoError);
      // Rollback: revert vehicle transfer
      await supabase
        .from("veiculos")
        .update({ associado_id: solicitacao.associado_id })
        .eq("id", veiculoId);
      return new Response(JSON.stringify({ success: false, error: "Erro ao criar contrato do novo titular" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[efetivar-troca] Contrato criado: ${novoContrato.numero} (${novoContrato.id})`);

    // 8. Encerrar contrato anterior
    if (contratoAnterior) {
      const { error: cancelError } = await supabase
        .from("contratos")
        .update({
          status: "cancelado",
          data_cancelamento: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("id", contratoAnterior.id);

      if (cancelError) {
        console.error("[efetivar-troca] Erro ao encerrar contrato anterior:", cancelError);
      } else {
        console.log(`[efetivar-troca] Contrato anterior ${contratoAnterior.numero || contratoAnterior.id} encerrado`);
      }

      // Register contract history
      await supabase.from("contratos_historico").insert({
        contrato_id: contratoAnterior.id,
        evento: "cancelado_troca_titularidade",
        descricao: `Contrato encerrado por troca de titularidade. Novo contrato: ${novoContrato.numero}`,
        dados: { novo_contrato_id: novoContrato.id, novo_associado_id: novoAssociadoId },
      });
    }

    // Register history for new contract
    await supabase.from("contratos_historico").insert({
      contrato_id: novoContrato.id,
      evento: "gerado_troca_titularidade",
      descricao: `Contrato gerado por troca de titularidade. Cenário ${cenario}.${contratoAnterior ? ` Contrato anterior: ${contratoAnterior.numero || contratoAnterior.id}` : ""}`,
      dados: { cenario, contrato_anterior_id: contratoAnterior?.id, solicitacao_id },
    });

    // 9. Sincronizar/Criar cliente ASAAS
    let asaasOk = false;
    try {
      const syncResp = await fetch(`${SUPABASE_URL}/functions/v1/asaas-clientes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ action: "sincronizar", associado_id: novoAssociadoId }),
      });
      const syncData = await syncResp.json();
      asaasOk = syncData.success === true;
      console.log(`[efetivar-troca] ASAAS sync: ${asaasOk ? "OK" : "falhou"}`, syncData);
    } catch (asaasErr) {
      console.error("[efetivar-troca] Erro ao sincronizar ASAAS (não bloqueante):", asaasErr);
    }

    // 10. Gerar cobrança da taxa de troca
    if (taxaTroca > 0) {
      try {
        const dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + 5); // 5 dias para pagamento
        const dueDateStr = dueDate.toISOString().split("T")[0];

        const cobrancaResp = await fetch(`${SUPABASE_URL}/functions/v1/asaas-cobrancas`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            action: "criar",
            associado_id: novoAssociadoId,
            dados: {
              billingType: "UNDEFINED",
              value: taxaTroca,
              dueDate: dueDateStr,
              description: `Taxa de troca de titularidade - Contrato ${novoContrato.numero}`,
              externalReference: novoContrato.id,
            },
            tipo: "taxa_troca_titularidade",
            contrato_id: novoContrato.id,
          }),
        });
        const cobrancaData = await cobrancaResp.json();
        console.log(`[efetivar-troca] Cobrança taxa: ${cobrancaData.success ? "OK" : "falhou"}`, cobrancaData);
      } catch (cobrErr) {
        console.error("[efetivar-troca] Erro ao gerar cobrança da taxa (não bloqueante):", cobrErr);
      }
    }

    // 11. Atualizar solicitação com dados da efetivação
    const dadosAtualizados = {
      ...(typeof dados === "object" ? dados : {}),
      cenario,
      novo_associado_id: novoAssociadoId,
      novo_contrato_id: novoContrato.id,
      novo_contrato_numero: novoContrato.numero,
      contrato_anterior_id: contratoAnterior?.id || null,
      efetivado_em: now.toISOString(),
    };

    await supabase
      .from("chat_solicitacoes_ia")
      .update({ dados: dadosAtualizados })
      .eq("id", solicitacao_id);

    console.log(`[efetivar-troca] Solicitação atualizada com dados da efetivação`);

    // 12. Registrar histórico para ambos os associados
    const { data: associadoAntigo } = await supabase
      .from("associados")
      .select("nome")
      .eq("id", solicitacao.associado_id)
      .maybeSingle();

    await supabase.from("associados_historico").insert([
      {
        associado_id: solicitacao.associado_id,
        tipo: "troca_titularidade_saida",
        descricao: `Veículo transferido para ${dadosNovoTitular.nome} por troca de titularidade (Cenário ${cenario}).`,
        dados_novos: {
          novo_associado_id: novoAssociadoId,
          novo_contrato_id: novoContrato.id,
          veiculo_id: veiculoId,
          cenario,
        },
      },
      {
        associado_id: novoAssociadoId,
        tipo: "troca_titularidade_entrada",
        descricao: `Veículo recebido de ${associadoAntigo?.nome || "titular anterior"} por troca de titularidade (Cenário ${cenario}).`,
        dados_novos: {
          associado_anterior_id: solicitacao.associado_id,
          contrato_id: novoContrato.id,
          veiculo_id: veiculoId,
          cenario,
        },
      },
    ]);

    // 13. Log de auditoria
    await supabase.from("logs_auditoria").insert({
      acao: "troca_titularidade_efetivada",
      modulo: "solicitacoes",
      descricao: `Troca de titularidade efetivada (Cenário ${cenario}). Novo titular: ${dadosNovoTitular.nome}. Contrato: ${novoContrato.numero}.`,
      dados_novos: {
        solicitacao_id,
        cenario,
        associado_anterior_id: solicitacao.associado_id,
        novo_associado_id: novoAssociadoId,
        veiculo_id: veiculoId,
        contrato_anterior_id: contratoAnterior?.id,
        novo_contrato_id: novoContrato.id,
        taxa_troca: taxaTroca,
        carencia_dias: carenciaDias,
        carencia_isenta: carenciaIsenta,
      },
    });

    console.log(`[efetivar-troca] ✅ Efetivação concluída com sucesso`);

    return new Response(
      JSON.stringify({
        success: true,
        cenario,
        novo_associado_id: novoAssociadoId,
        novo_contrato_id: novoContrato.id,
        novo_contrato_numero: novoContrato.numero,
        contrato_anterior_id: contratoAnterior?.id || null,
        taxa_troca: taxaTroca,
        carencia_dias: carenciaDias,
        carencia_isenta: carenciaIsenta,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    console.error("[efetivar-troca] Erro:", msg, error);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
