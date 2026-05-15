import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getConfiguracaoNumero } from "../_shared/config-helper.ts";
import {
  alterarAssociadoHinova,
  alterarSituacaoVeiculoHinova,
  buscarAssociadoComVeiculosPorCpf,
  buscarVeiculoPorChassi,
  cadastrarAssociadoHinova,
  cadastrarHistoricoAtendimentoHinova,
  cadastrarVeiculoHinova,
  getHinovaSession,
  HinovaNotFoundError,
} from "../_shared/hinova-client.ts";


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
    const body = await req.json();
    const { solicitacao_id, cenario_override, retry_sga } = body;

    if (!solicitacao_id) {
      return new Response(JSON.stringify({ success: false, error: "solicitacao_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Guard: troca expirada não pode ser efetivada
    {
      const { data: trocaGuard } = await supabase
        .from("solicitacoes_troca_titularidade")
        .select("status")
        .eq("id", solicitacao_id)
        .maybeSingle();
      if (trocaGuard?.status === "expirada") {
        return new Response(JSON.stringify({ success: false, error: "Solicitação expirada — abrir nova cotação." }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ============================================
    // RETRY SGA — reexecuta só a etapa Hinova quando a troca já está efetivada/liberada
    // ============================================
    if (retry_sga) {
      console.log(`[efetivar-troca][retry-sga] Iniciando retry para ${solicitacao_id}`);
      const { data: troca, error: trocaErr } = await supabase
        .from("solicitacoes_troca_titularidade")
        .select("id, status, novo_associado_id, veiculo_id, associado_antigo_id, novo_titular_dados")
        .eq("id", solicitacao_id)
        .maybeSingle();

      if (trocaErr || !troca) {
        return new Response(JSON.stringify({ success: false, error: "Solicitação de troca não encontrada" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!troca.novo_associado_id || !troca.veiculo_id) {
        return new Response(JSON.stringify({ success: false, error: "Troca ainda não foi efetivada — não há novo associado/veículo para sincronizar" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const dadosNovo = (troca.novo_titular_dados || {}) as Record<string, string>;
      const cpfLimpo = (dadosNovo.cpf || "").replace(/\D/g, "");
      const { data: vehicleData } = await supabase
        .from("veiculos").select("placa, chassi, renavam, marca, modelo, ano, cor, valor_fipe").eq("id", troca.veiculo_id).maybeSingle();

      let sgaCodAss: number | null = null;
      let sgaCodVeic: number | null = null;
      try {
        // Garantir associado SGA
        try {
          const busca = await buscarAssociadoComVeiculosPorCpf(await getHinovaSession(supabase), cpfLimpo);
          sgaCodAss = busca.codigo_associado;
        } catch (e) {
          if (!(e instanceof HinovaNotFoundError)) throw e;
        }
        if (!sgaCodAss) {
          const cad = await cadastrarAssociadoHinova(supabase, {
            nome: dadosNovo.nome,
            cpf: cpfLimpo,
            email: dadosNovo.email || undefined,
            telefone_celular: (dadosNovo.telefone || "").replace(/\D/g, "") || undefined,
          });
          if (!cad.ok || !cad.codigo) throw new Error(`SGA cadastrarAssociado: ${cad.errors.join("; ") || cad.mensagem}`);
          sgaCodAss = cad.codigo;
        }
        await supabase.from("associados").update({
          codigo_hinova: sgaCodAss, sincronizado_hinova: true, sincronizado_hinova_em: new Date().toISOString(),
        }).eq("id", troca.novo_associado_id);

        // Veículo
        let codVeicAtual: number | null = null;
        let codAssVeic: number | null = null;
        if (vehicleData?.chassi) {
          try {
            const found = await buscarVeiculoPorChassi(supabase, vehicleData.chassi);
            if (found.found) {
              codVeicAtual = Number(found.found.codigo_veiculo) || null;
              codAssVeic = Number(found.found.codigo_associado) || null;
            }
          } catch (e) { console.warn("[retry-sga] buscaVeic:", (e as Error).message); }
        }

        if (!(codVeicAtual && codAssVeic === sgaCodAss)) {
          if (codVeicAtual) {
            const codCanc = await getConfiguracaoNumero(supabase, "sga_codigo_situacao_veiculo_cancelado", 3);
            await alterarSituacaoVeiculoHinova(supabase, codVeicAtual, codCanc).catch(e => console.warn("[retry-sga] cancelar veic antigo:", e?.message || e));
          }
          const codGrupo = await getConfiguracaoNumero(supabase, "sga_codigo_grupo_produto_padrao", 0);
          const cadVeic = await cadastrarVeiculoHinova(supabase, {
            codigo_associado: sgaCodAss,
            placa: vehicleData?.placa,
            chassi: vehicleData?.chassi,
            renavam: vehicleData?.renavam || undefined,
            marca: vehicleData?.marca || undefined,
            modelo: vehicleData?.modelo || undefined,
            ano_fabricacao: vehicleData?.ano || undefined,
            ano_modelo: vehicleData?.ano || undefined,
            cor: vehicleData?.cor || undefined,
            valor_fipe: vehicleData?.valor_fipe || undefined,
            codigo_grupo_produto: codGrupo || undefined,
          });
          if (!cadVeic.ok || !cadVeic.codigo) throw new Error(`SGA cadastrarVeiculo: ${cadVeic.errors.join("; ") || cadVeic.mensagem}`);
          sgaCodVeic = cadVeic.codigo;
        } else {
          sgaCodVeic = codVeicAtual;
        }

        await supabase.from("veiculos").update({
          codigo_hinova: sgaCodVeic, sincronizado_hinova: true, sincronizado_hinova_em: new Date().toISOString(),
        }).eq("id", troca.veiculo_id);

        await supabase.from("solicitacoes_troca_titularidade").update({
          sga_status: "sincronizado",
          sga_erro: null,
          sga_codigo_associado_novo: sgaCodAss,
          sga_codigo_veiculo_novo: sgaCodVeic,
          sga_sincronizado_em: new Date().toISOString(),
        }).eq("id", solicitacao_id);

        return new Response(JSON.stringify({ success: true, retry: true, sga_status: "sincronizado", sga_codigo_associado_novo: sgaCodAss, sga_codigo_veiculo_novo: sgaCodVeic }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (sgaErr) {
        const msg = (sgaErr as Error)?.message || String(sgaErr);
        console.error("[retry-sga] Falha:", msg);
        await supabase.from("solicitacoes_troca_titularidade").update({
          sga_status: "falha", sga_erro: msg,
        }).eq("id", solicitacao_id);
        return new Response(JSON.stringify({ success: false, error: msg, sga_status: "falha" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log(`[efetivar-troca] Iniciando efetivação para solicitação ${solicitacao_id}`);

    // 1. Buscar solicitação — tenta primeiro a tabela nova (solicitacoes_troca_titularidade)
    //    e cai no fluxo legado (chat_solicitacoes_ia) só se não encontrar.
    let solicitacao: any = null;
    let solicitacaoSource: 'nova' | 'legada' = 'nova';

    {
      const { data: novaSol } = await supabase
        .from("solicitacoes_troca_titularidade")
        .select("*")
        .eq("id", solicitacao_id)
        .maybeSingle();

      if (novaSol) {
        // Mapeia para o shape esperado pelo restante da função (que foi escrito
        // para chat_solicitacoes_ia).
        solicitacao = {
          id: novaSol.id,
          associado_id: novaSol.associado_antigo_id,
          criado_por: novaSol.criado_por,
          dados: { veiculo_id: novaSol.veiculo_id },
          dados_novo_titular: novaSol.novo_titular_dados,
          resultado_protocolo: null,
        };
      } else {
        const { data: legacySol, error: solError } = await supabase
          .from("chat_solicitacoes_ia")
          .select("*")
          .eq("id", solicitacao_id)
          .maybeSingle();
        if (solError || !legacySol) {
          console.error("[efetivar-troca] Solicitação não encontrada:", solError);
          return new Response(JSON.stringify({ success: false, error: "Solicitação não encontrada" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        solicitacao = legacySol;
        solicitacaoSource = 'legada';
      }
    }

    const dados = (solicitacao.dados as Record<string, unknown>) || {};
    const dadosNovoTitular = solicitacao.dados_novo_titular as Record<string, string> | null;

    if (!dadosNovoTitular?.cpf) {
      return new Response(JSON.stringify({ success: false, error: "Dados do novo titular incompletos (CPF obrigatório)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine cenário
    const resultadoProtocolo = (dados.resultado_protocolo as string) || (solicitacao.resultado_protocolo as string) || "";
    const cenario = cenario_override || (resultadoProtocolo.includes("TRC-DISP-") ? "A" : "B");
    console.log(`[efetivar-troca] Cenário: ${cenario} (source: ${solicitacaoSource})`);

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
      // Create new associado — copia endereço do novo_titular_dados (se enviado pelo
      // link público). Fallback adiado: depois que carregarmos contratoAnterior tentamos
      // herdar UF/CEP/cidade/bairro/logradouro para evitar erro "ESTADO inválido" no SGA.
      const ndt: Record<string, any> = (dadosNovoTitular as any) || {};
      const enderecoBase: Record<string, any> = {
        cep: (ndt.cep || '').toString().replace(/\D/g, '') || null,
        logradouro: ndt.logradouro || ndt.endereco || null,
        numero: ndt.numero || null,
        complemento: ndt.complemento || null,
        bairro: ndt.bairro || null,
        cidade: ndt.cidade || null,
        uf: ndt.uf || ndt.estado || null,
      };
      const { data: novoAssociado, error: criarError } = await supabase
        .from("associados")
        .insert({
          nome: dadosNovoTitular.nome,
          cpf: cpfLimpo,
          email: dadosNovoTitular.email || null,
          telefone: dadosNovoTitular.telefone || null,
          whatsapp: dadosNovoTitular.telefone || null,
          status: "ativo",
          ...enderecoBase,
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

    // 4.1 Fallback de endereço para o novo associado: se ainda estiver sem UF/CEP,
    //     herda do contrato anterior (snapshot que veio do CRLV/cotação).
    try {
      const { data: assocCheck } = await supabase
        .from("associados")
        .select("uf, cep, cidade, bairro, logradouro, numero, complemento")
        .eq("id", novoAssociadoId)
        .maybeSingle();
      if (assocCheck && contratoAnterior) {
        const { data: ctrFull } = await supabase
          .from("contratos")
          .select("cliente_uf, cliente_cep, cliente_cidade, cliente_bairro, cliente_logradouro, cliente_numero, cliente_complemento")
          .eq("id", contratoAnterior.id)
          .maybeSingle();
        if (ctrFull) {
          const patch: Record<string, unknown> = {};
          if (!assocCheck.uf && ctrFull.cliente_uf) patch.uf = ctrFull.cliente_uf;
          if (!assocCheck.cep && ctrFull.cliente_cep) patch.cep = String(ctrFull.cliente_cep).replace(/\D/g, '');
          if (!assocCheck.cidade && ctrFull.cliente_cidade) patch.cidade = ctrFull.cliente_cidade;
          if (!assocCheck.bairro && ctrFull.cliente_bairro) patch.bairro = ctrFull.cliente_bairro;
          if (!assocCheck.logradouro && ctrFull.cliente_logradouro) patch.logradouro = ctrFull.cliente_logradouro;
          if (!assocCheck.numero && ctrFull.cliente_numero) patch.numero = ctrFull.cliente_numero;
          if (!assocCheck.complemento && ctrFull.cliente_complemento) patch.complemento = ctrFull.cliente_complemento;
          if (Object.keys(patch).length) {
            await supabase.from("associados").update(patch).eq("id", novoAssociadoId);
            console.log(`[efetivar-troca] Endereço herdado do contrato anterior:`, Object.keys(patch));
          }
        }
      }
    } catch (e) {
      console.warn("[efetivar-troca] Fallback endereço falhou:", (e as Error)?.message);
    }

    // 5. Ler configurações
    const taxaTroca = await getConfiguracaoNumero(supabase, "taxa_troca_titularidade", 50);
    const carenciaPadrao = await getConfiguracaoNumero(supabase, "carencia_dias_padrao", 120);
    const carenciaCenarioA = await getConfiguracaoNumero(supabase, "carencia_troca_titularidade_cenario_a", 0);
    const carenciaVidrosDias = await getConfiguracaoNumero(supabase, "carencia_beneficio_vidros_dias", 120);

    const carenciaDias = cenario === "A" ? carenciaCenarioA : carenciaPadrao;
    const carenciaIsenta = carenciaDias === 0;

    console.log(`[efetivar-troca] Config: taxa=${taxaTroca}, carência=${carenciaDias} dias (isenta: ${carenciaIsenta}), vidros=${carenciaVidrosDias}`);

    // 6. Transferir veículo + LIMPAR cobertura suspensa por troca
    //    (motivo `troca_titularidade_em_andamento` foi setado quando a troca iniciou
    //     — após efetivada, a cobertura volta normal para o novo titular).
    const { error: transferError } = await supabase
      .from("veiculos")
      .update({
        associado_id: novoAssociadoId,
        em_troca_titularidade: false,
        troca_titularidade_id: null,
        troca_titularidade_iniciada_em: null,
        cobertura_suspensa: false,
        cobertura_suspensa_motivo: null,
        cobertura_suspensa_em: null,
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

    // Carência de vidros para troca de titularidade
    let dataCarenciaVidrosInicio: string | null = dataInicio;
    let dataCarenciaVidrosFim: string | null = null;
    if (carenciaVidrosDias > 0) {
      const fimVidros = new Date(now);
      fimVidros.setDate(fimVidros.getDate() + carenciaVidrosDias);
      dataCarenciaVidrosFim = fimVidros.toISOString().split("T")[0];
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
      // Carência de vidros e faróis
      data_carencia_vidros_inicio: dataCarenciaVidrosInicio,
      data_carencia_vidros_fim: dataCarenciaVidrosFim,
      carencia_vidros_isenta: false,
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

    // 8.1 Inativar antigo proprietário se ficou sem vínculos ativos
    try {
      const { data: inativado, error: inatErr } = await supabase.rpc(
        "fn_inativar_associado_se_orfao",
        {
          _associado_id: solicitacao.associado_id,
          _motivo: `Troca de titularidade efetivada (Cenário ${cenario}) — sem vínculos ativos restantes`,
        },
      );
      if (inatErr) {
        console.warn("[efetivar-troca] fn_inativar_associado_se_orfao:", inatErr.message);
      } else {
        console.log(
          `[efetivar-troca] Antigo proprietário ${solicitacao.associado_id}: ${inativado ? "inativado (sem vínculos)" : "mantido ativo (ainda possui vínculos)"}`,
        );
      }
    } catch (e) {
      console.warn("[efetivar-troca] erro inativação antigo:", (e as Error)?.message);
    }

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

    if (solicitacaoSource === 'legada') {
      await supabase
        .from("chat_solicitacoes_ia")
        .update({ dados: dadosAtualizados })
        .eq("id", solicitacao_id);
    }

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

    // 14. Notificar novo titular via WhatsApp
    try {
      const telefoneNovo = dadosNovoTitular.telefone || null;
      if (telefoneNovo) {
        const telLimpo = telefoneNovo.replace(/\D/g, "");
        const telFmt = telLimpo.startsWith("55") ? telLimpo : `55${telLimpo}`;

        const placaVeiculo = veiculoData?.placa || "N/A";
        const modeloVeiculo = veiculoData?.modelo || "";
        const marcaVeiculo = veiculoData?.marca || "";
        const veiculoDescricao = `${marcaVeiculo} ${modeloVeiculo}`.trim() || "seu veículo";

        const mensagemBoasVindas = `Olá, ${dadosNovoTitular.nome}! 🎉\n\nSeja bem-vindo(a) à *Praticcar*!\n\nSeu veículo *${veiculoDescricao}* (placa *${placaVeiculo}*) foi registrado em seu nome com sucesso.\n\n📋 *Contrato:* ${novoContrato.numero}\n\nBaixe nosso app para acompanhar tudo sobre sua proteção veicular. Em caso de dúvidas, estamos à disposição!\n\nEquipe Praticcar 🚗`;

        // Template aprovado: troca_titularidade_aprovada
        // Vars: [primeiroNome, "MARCA MODELO PLACA"]
        const primeiroNomeNovo = (dadosNovoTitular.nome || '').split(' ')[0] || dadosNovoTitular.nome;
        const veiculoLabel = `${marcaVeiculo} ${modeloVeiculo} ${placaVeiculo}`.replace(/\s+/g, ' ').trim();
        const sendResp = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send-text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            telefone: telFmt,
            mensagem: mensagemBoasVindas,
            template_name: "troca_titularidade_aprovada_v2",
            template_params: [primeiroNomeNovo, veiculoLabel],
            referencia_tipo: "troca_titularidade",
            referencia_id: solicitacao_id,
          }),
        });
        const sendData = await sendResp.json();
        console.log(`[efetivar-troca] WhatsApp novo titular: ${sendData.success ? "enviado" : "falhou"}`, sendData.error || "");
      } else {
        console.log("[efetivar-troca] Novo titular sem telefone — notificação WhatsApp não enviada");
        await supabase.from("logs_auditoria").insert({
          acao: "troca_titularidade_notificacao_ignorada",
          modulo: "solicitacoes",
          descricao: `Novo titular ${dadosNovoTitular.nome} sem telefone cadastrado — notificação WhatsApp não enviada.`,
          dados_novos: { solicitacao_id, novo_associado_id: novoAssociadoId },
        });
      }
    } catch (whatsErr) {
      console.error("[efetivar-troca] Erro ao notificar novo titular (não bloqueante):", whatsErr);
    }

    // 15. Sincronização SGA (Hinova) — não bloqueia o retorno em caso de erro;
    // grava status na tabela solicitacoes_troca_titularidade para retry posterior.
    let sgaStatus: 'sincronizado' | 'pendente' | 'falha' | 'nao_aplicavel' = 'nao_aplicavel';
    let sgaErro: string | null = null;
    let sgaCodigoAssociadoNovo: number | null = null;
    let sgaCodigoVeiculoNovo: number | null = null;

    try {
      const codAntigoExistente = (await supabase
        .from('associados').select('codigo_hinova').eq('id', solicitacao.associado_id).maybeSingle()
      ).data?.codigo_hinova as number | null | undefined;

      const veiculoChassi = veiculoData?.chassi || null;
      const veiculoPlaca = veiculoData?.placa || null;

      // 15.1 Garantir/criar novo associado no SGA
      let codigoAssociadoNovo: number | null = null;
      try {
        const buscaNovo = await buscarAssociadoComVeiculosPorCpf(
          await getHinovaSession(supabase),
          cpfLimpo,
        );
        codigoAssociadoNovo = buscaNovo.codigo_associado;
      } catch (e) {
        if (!(e instanceof HinovaNotFoundError)) throw e;
      }

      if (!codigoAssociadoNovo) {
        const cadAss = await cadastrarAssociadoHinova(supabase, {
          nome: dadosNovoTitular.nome,
          cpf: cpfLimpo,
          email: dadosNovoTitular.email || undefined,
          telefone_celular: (dadosNovoTitular.telefone || '').replace(/\D/g, '') || undefined,
        });
        if (!cadAss.ok || !cadAss.codigo) {
          throw new Error(`SGA cadastrarAssociado falhou: ${cadAss.errors.join('; ') || cadAss.mensagem || cadAss.status}`);
        }
        codigoAssociadoNovo = cadAss.codigo;
      } else {
        // Atualiza dados do associado existente (telefone/email)
        await alterarAssociadoHinova(supabase, {
          codigo_associado: codigoAssociadoNovo,
          nome: dadosNovoTitular.nome,
          email: dadosNovoTitular.email || undefined,
          telefone_celular: (dadosNovoTitular.telefone || '').replace(/\D/g, '') || undefined,
        }).catch((e) => console.warn('[efetivar-troca][SGA] alterarAssociado:', e?.message || e));
      }
      sgaCodigoAssociadoNovo = codigoAssociadoNovo;

      // Persiste código no associado local
      await supabase.from('associados').update({
        codigo_hinova: codigoAssociadoNovo,
        sincronizado_hinova: true,
        sincronizado_hinova_em: new Date().toISOString(),
      }).eq('id', novoAssociadoId);

      // 15.2 Localizar codigo_veiculo atual no SGA pelo chassi (idempotência)
      let codigoVeiculoSga: number | null = null;
      let codigoAssociadoVeiculoAtual: number | null = null;
      if (veiculoChassi) {
        try {
          const found = await buscarVeiculoPorChassi(supabase, veiculoChassi);
          if (found.found) {
            codigoVeiculoSga = Number(found.found.codigo_veiculo) || null;
            codigoAssociadoVeiculoAtual = Number(found.found.codigo_associado) || null;
          }
        } catch (e) {
          console.warn('[efetivar-troca][SGA] buscarVeiculoPorChassi:', (e as Error).message);
        }
      }

      // 15.3 Se já vinculado ao novo titular → idempotência: nada a fazer
      const jaTransferido = codigoVeiculoSga && codigoAssociadoVeiculoAtual === codigoAssociadoNovo;

      if (!jaTransferido) {
        // 15.4 Cancelar veículo no titular antigo (se existir no SGA)
        if (codigoVeiculoSga) {
          const codSituacaoCancelado = await getConfiguracaoNumero(
            supabase, 'sga_codigo_situacao_veiculo_cancelado', 3,
          );
          const altSit = await alterarSituacaoVeiculoHinova(
            supabase, codigoVeiculoSga, codSituacaoCancelado,
          );
          if (!altSit.ok) {
            console.warn('[efetivar-troca][SGA] alterarSituacaoVeiculo (antigo) falhou:', altSit.errors, altSit.mensagem);
          }
        }

        // 15.5 Re-cadastrar veículo no novo titular
        const codigoGrupoProduto = await getConfiguracaoNumero(supabase, 'sga_codigo_grupo_produto_padrao', 0);
        const cadVeic = await cadastrarVeiculoHinova(supabase, {
          codigo_associado: codigoAssociadoNovo,
          placa: veiculoPlaca,
          chassi: veiculoChassi,
          renavam: veiculoData?.renavam || undefined,
          marca: veiculoData?.marca || undefined,
          modelo: veiculoData?.modelo || undefined,
          ano_fabricacao: veiculoData?.ano || undefined,
          ano_modelo: veiculoData?.ano || undefined,
          cor: veiculoData?.cor || undefined,
          valor_fipe: veiculoData?.valor_fipe || undefined,
          codigo_grupo_produto: codigoGrupoProduto || undefined,
        });
        if (!cadVeic.ok || !cadVeic.codigo) {
          throw new Error(`SGA cadastrarVeiculo (novo titular) falhou: ${cadVeic.errors.join('; ') || cadVeic.mensagem || cadVeic.status}`);
        }
        sgaCodigoVeiculoNovo = cadVeic.codigo;
      } else {
        sgaCodigoVeiculoNovo = codigoVeiculoSga;
      }

      // Persiste código no veículo local
      if (sgaCodigoVeiculoNovo) {
        await supabase.from('veiculos').update({
          codigo_hinova: sgaCodigoVeiculoNovo,
          sincronizado_hinova: true,
          sincronizado_hinova_em: new Date().toISOString(),
        }).eq('id', veiculoId);
      }

      // 15.6 Histórico de atendimento em ambos os associados
      const descSaida = `Troca de titularidade: veículo placa ${veiculoPlaca || '?'} transferido para ${dadosNovoTitular.nome} (CPF ${cpfLimpo}). Contrato ${novoContrato.numero}.`;
      const descEntrada = `Troca de titularidade: veículo placa ${veiculoPlaca || '?'} recebido de ${associadoAntigo?.nome || 'titular anterior'}. Contrato ${novoContrato.numero}.`;

      if (codAntigoExistente) {
        await cadastrarHistoricoAtendimentoHinova(supabase, {
          codigo_associado: Number(codAntigoExistente),
          descricao: descSaida,
        }).catch((e) => console.warn('[efetivar-troca][SGA] historico antigo:', e?.message || e));
      }
      await cadastrarHistoricoAtendimentoHinova(supabase, {
        codigo_associado: codigoAssociadoNovo,
        descricao: descEntrada,
      }).catch((e) => console.warn('[efetivar-troca][SGA] historico novo:', e?.message || e));

      sgaStatus = 'sincronizado';
      console.log('[efetivar-troca][SGA] ✅ Sincronização concluída');
    } catch (sgaErr) {
      sgaStatus = 'pendente';
      sgaErro = (sgaErr as Error)?.message || String(sgaErr);
      console.error('[efetivar-troca][SGA] ⚠️ Falha (não bloqueante):', sgaErro);

      // Enfileira retry
      await supabase.from('sga_sync_queue').insert({
        veiculo_id: veiculoId,
        associado_id: novoAssociadoId,
        status: 'pendente',
        etapa_parou: 'troca_titularidade',
        erro_ultimo: sgaErro,
        origem: 'troca_titularidade',
        codigo_associado_hinova: sgaCodigoAssociadoNovo,
        codigo_veiculo_hinova: sgaCodigoVeiculoNovo,
      }).then(({ error }) => {
        if (error) console.warn('[efetivar-troca][SGA] enqueue retry falhou:', error.message);
      });
    }

    // 16. Atualiza solicitacoes_troca_titularidade — marca como efetivada
    await supabase.from('solicitacoes_troca_titularidade').update({
      status: 'efetivada',
      efetivada_em: new Date().toISOString(),
      novo_associado_id: novoAssociadoId,
      sga_status: sgaStatus === 'nao_aplicavel' ? 'pendente' : sgaStatus,
      sga_erro: sgaErro,
      sga_codigo_associado_novo: sgaCodigoAssociadoNovo,
      sga_codigo_veiculo_novo: sgaCodigoVeiculoNovo,
      sga_sincronizado_em: sgaStatus === 'sincronizado' ? new Date().toISOString() : null,
    }).eq('id', solicitacao_id).then(({ error }) => {
      if (error) console.warn('[efetivar-troca] update solicitacoes_troca:', error.message);
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
