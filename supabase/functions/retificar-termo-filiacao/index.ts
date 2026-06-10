// ============================================
// EDGE FUNCTION: retificar-termo-filiacao
// Reemite o Termo de Filiação com dados corrigidos (versionado em
// public.contrato_retificacoes). NÃO toca em contratos.autentique_documento_id
// nem em contratos.pdf_assinado_url — o termo primário permanece arquivado.
// ============================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import {
  gerarPosicoesAssinatura,
  buscarPosicoesConfig,
  estimarPaginasHTML,
} from "../_shared/autentique-positions.ts";
import {
  generateTermoAfiliacao,
  generateSecaoRastreador,
} from "../_shared/termo-afiliacao-template.ts";
import { filterEligibleItems } from "../_shared/eligibility-filter.ts";
import {
  mapearDadosParaTemplate,
  buscarConfiguracoesEmpresa,
  buscarRegrasVenda,
  buscarRegrasDepreciacao,
} from "../_shared/termo-afiliacao-utils.ts";
import {
  substituirVariaveis,
  limparVariaveisNaoSubstituidas,
  generateStyles,
  generateHeader,
  generateFooter,
  markdownParaHTML,
  buscarEGerarAditivos,
  sanitizeSignatureBlocks,
  exigeRastreador,
  extrairCodigosBeneficios,
  gerarSecaoCoberturasInjetavel,
} from "../_shared/template-utils.ts";
import { insertAuditLog } from "../_shared/auditLog.ts";
import { aplicarSubstituicaoNoTemplateData } from "../_shared/substituicao-cascade.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTENTIQUE_API_URL = "https://api.autentique.com.br/v2/graphql";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Roles autorizadas a retificar termo
const ROLES_PERMITIDAS = new Set([
  "admin",
  "admin_master",
  "diretor",
  "desenvolvedor",
  "analista_cadastro",
]);

interface CamposAssociado {
  nome?: string;
  rg?: string | null;
  data_nascimento?: string | null;
  estado_civil?: string | null;
  profissao?: string | null;
  email?: string | null;
  telefone?: string | null;
  telefone_secundario?: string | null;
  cnh_numero?: string | null;
  cnh_validade?: string | null;
  cnh_categoria?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

interface CamposVeiculo {
  marca?: string | null;
  modelo?: string | null;
  ano_fabricacao?: number | null;
  ano_modelo?: number | null;
  cor?: string | null;
  placa?: string | null;
  chassi?: string | null;
  renavam?: string | null;
  combustivel?: string | null;
  cambio?: string | null;
  valor_fipe?: number | null;
  codigo_fipe?: string | null;
  tipo_placa?: string | null;
}

interface CamposContrato {
  dia_vencimento?: number | null;
  veiculo_categoria?: string | null;
}

interface Payload {
  contrato_id: string;
  motivo: string;
  associado?: CamposAssociado;
  veiculo?: CamposVeiculo;
  contrato?: CamposContrato;
}

function pickDiffs<T extends Record<string, unknown>>(
  prev: Record<string, unknown> | null | undefined,
  next: T | undefined,
): Partial<T> {
  if (!next) return {};
  const diff: Record<string, unknown> = {};
  for (const k of Object.keys(next)) {
    const novo = (next as any)[k];
    if (novo === undefined) continue;
    const anterior = prev?.[k];
    // string vazia trata como null
    const norm = (v: unknown) => (v === "" ? null : v);
    if (norm(novo) !== norm(anterior)) diff[k] = novo;
  }
  return diff as Partial<T>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const autentiqueApiKey = Deno.env.get("AUTENTIQUE_API_KEY");
    if (!autentiqueApiKey) throw new Error("AUTENTIQUE_API_KEY não configurada");

    // Cliente com o JWT do usuário, para identificar quem chama
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseAsUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabaseAsUser.auth.getUser();
    const callerUserId = userData?.user?.id;
    if (!callerUserId) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Validar role
    const { data: rolesRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUserId);
    const roles = (rolesRows || []).map((r: any) => r.role as string);
    if (!roles.some((r) => ROLES_PERMITIDAS.has(r))) {
      return new Response(JSON.stringify({ error: "Sem permissão", roles }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Profile id do caller
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("id, nome")
      .eq("user_id", callerUserId)
      .maybeSingle();

    const body = (await req.json()) as Payload;
    if (!body?.contrato_id || !body?.motivo || body.motivo.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: "contrato_id e motivo (mín. 10 chars) são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Snapshot anterior
    const { data: contratoAtual, error: contratoErr } = await supabase
      .from("contratos")
      .select("*, planos(*), associados:associados!fk_contratos_associado(*)")
      .eq("id", body.contrato_id)
      .single();
    if (contratoErr || !contratoAtual) {
      return new Response(
        JSON.stringify({ error: `Contrato não encontrado: ${contratoErr?.message || "—"}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const associadoAtual = contratoAtual.associados;
    let veiculoAtual: any = null;
    if (contratoAtual.veiculo_id) {
      const { data: v } = await supabase.from("veiculos").select("*")
        .eq("id", contratoAtual.veiculo_id).maybeSingle();
      veiculoAtual = v;
    }

    // Diffs
    const diffAssoc = pickDiffs(associadoAtual, body.associado);
    const diffVeic = pickDiffs(veiculoAtual, body.veiculo);
    const diffContrato = pickDiffs(contratoAtual, body.contrato);
    const camposAlterados = [
      ...Object.keys(diffAssoc).map((k) => `associado.${k}`),
      ...Object.keys(diffVeic).map((k) => `veiculo.${k}`),
      ...Object.keys(diffContrato).map((k) => `contrato.${k}`),
    ];

    const snapshotAnterior = {
      associado: associadoAtual,
      veiculo: veiculoAtual,
      contrato: {
        id: contratoAtual.id,
        numero: contratoAtual.numero,
        dia_vencimento: contratoAtual.dia_vencimento,
        veiculo_categoria: contratoAtual.veiculo_categoria,
        valor_mensal: contratoAtual.valor_mensal,
      },
    };

    // Aplicar updates
    if (Object.keys(diffAssoc).length && associadoAtual?.id) {
      const { error } = await supabase
        .from("associados")
        .update({ ...diffAssoc, updated_at: new Date().toISOString() })
        .eq("id", associadoAtual.id);
      if (error) throw new Error(`Falha ao atualizar associado: ${error.message}`);
    }
    if (Object.keys(diffVeic).length && veiculoAtual?.id) {
      const { error } = await supabase
        .from("veiculos")
        .update({ ...diffVeic, updated_at: new Date().toISOString() })
        .eq("id", veiculoAtual.id);
      if (error) throw new Error(`Falha ao atualizar veículo: ${error.message}`);
    }
    if (Object.keys(diffContrato).length) {
      const { error } = await supabase
        .from("contratos")
        .update({ ...diffContrato, updated_at: new Date().toISOString() })
        .eq("id", contratoAtual.id);
      if (error) throw new Error(`Falha ao atualizar contrato: ${error.message}`);
    }

    // Re-ler com snapshot pós-update
    const { data: contratoNovo } = await supabase
      .from("contratos")
      .select("*, planos(*), associados:associados!fk_contratos_associado(*)")
      .eq("id", body.contrato_id)
      .single();
    let veiculoNovo: any = null;
    if (contratoNovo?.veiculo_id) {
      const { data } = await supabase.from("veiculos").select("*")
        .eq("id", contratoNovo.veiculo_id).maybeSingle();
      veiculoNovo = data;
    }

    const snapshotNovo = {
      associado: contratoNovo!.associados,
      veiculo: veiculoNovo,
      contrato: {
        id: contratoNovo!.id,
        numero: contratoNovo!.numero,
        dia_vencimento: contratoNovo!.dia_vencimento,
        veiculo_categoria: contratoNovo!.veiculo_categoria,
        valor_mensal: contratoNovo!.valor_mensal,
      },
    };

    // Inserir linha de retificação (versão calc. via trigger)
    const { data: retificacao, error: retErr } = await supabase
      .from("contrato_retificacoes")
      .insert({
        contrato_id: contratoNovo!.id,
        associado_id: contratoNovo!.associado_id,
        motivo: body.motivo.trim(),
        snapshot_anterior: snapshotAnterior,
        snapshot_novo: snapshotNovo,
        campos_alterados: camposAlterados,
        criado_por: profileRow?.id ?? null,
        status: "rascunho",
        versao: 0, // trigger calcula
      })
      .select("id, versao")
      .single();
    if (retErr || !retificacao) throw new Error(`Falha ao registrar retificação: ${retErr?.message}`);

    // ====== Gerar HTML do termo retificado ======
    const empresaConfig = await buscarConfiguracoesEmpresa(supabase);
    const [{ regras: regrasVenda }, regrasDepreciacao] = await Promise.all([
      buscarRegrasVenda(supabase),
      buscarRegrasDepreciacao(supabase),
    ]);
    const { data: cfgRast } = await supabase
      .from("configuracoes")
      .select("chave, valor")
      .in("chave", ["operacional_fipe_minimo_rastreador", "operacional_fipe_minimo_rastreador_moto"]);
    const cfgMap: Record<string, string> = {};
    for (const r of cfgRast || []) cfgMap[r.chave] = r.valor;
    const configRastreador = {
      fipeMinCarro: Number(cfgMap["operacional_fipe_minimo_rastreador"]) || 30000,
      fipeMinMoto: Number(cfgMap["operacional_fipe_minimo_rastreador_moto"]) || 9000,
    };

    let cotacaoFallback: any = null;
    if (contratoNovo!.cotacao_id) {
      const { data } = await supabase.from("cotacoes")
        .select("combustivel, veiculo_combustivel, codigo_fipe, valor_fipe, veiculo_chassi, veiculo_renavam, veiculo_cor, veiculo_marca, veiculo_modelo, veiculo_ano_fabricacao, veiculo_ano_modelo, veiculo_cambio, veiculo_motor, veiculo_categoria, veiculo_procedencia, veiculo_alienado, veiculo_financeira, veiculo_blindado, uso_aplicativo")
        .eq("id", contratoNovo!.cotacao_id).maybeSingle();
      cotacaoFallback = data;
    }

    const templateData = mapearDadosParaTemplate(
      contratoNovo,
      contratoNovo!.planos,
      empresaConfig,
      null,
      contratoNovo!.associados,
      profileRow?.nome ?? null,
      veiculoNovo,
      cotacaoFallback,
    );
    templateData.configRastreador = configRastreador;
    templateData.regrasDepreciacao = regrasDepreciacao;
    if (regrasVenda) templateData.regrasVenda = regrasVenda;

    // Cascade de substituição (placa anterior / modelo / FIPE) — reexecuta SEMPRE
    // a partir das fontes vivas, nunca reusa payload antigo da retificação anterior.
    await aplicarSubstituicaoNoTemplateData(supabase, contratoNovo, templateData, '[retificar-termo-filiacao]');


    // Coberturas/benefícios elegíveis
    const planoId = contratoNovo!.planos?.id || contratoNovo!.plano_id;
    if (planoId) {
      try {
        const [{ data: cobs }, { data: bens }] = await Promise.all([
          supabase.from("planos_coberturas")
            .select("cobertura_id, valor_limite, carencia_dias, franquia_percentual, coberturas:cobertura_id(id, nome, descricao)")
            .eq("plano_id", planoId),
          supabase.from("planos_beneficios")
            .select("benefit_id, custom_value, benefits:benefit_id(id, name, description)")
            .eq("plano_id", planoId),
        ]);
        const params = {
          valor_fipe: contratoNovo!.veiculo_valor_fipe || contratoNovo!.valor_fipe,
          regiao: contratoNovo!.regiao || contratoNovo!.cliente_uf,
          combustivel: contratoNovo!.veiculo_combustivel,
          tipo_placa: veiculoNovo?.flag_placa_vermelha ? "vermelha" : "normal",
          tipo_uso: contratoNovo!.uso_aplicativo ? "aplicativo" : "particular",
        };
        const { coberturas: cobEl, beneficios: benEl } = await filterEligibleItems(
          supabase, cobs || [], bens || [], params,
          (cobs || []).map((c: any) => c.cobertura_id).filter(Boolean),
          (bens || []).map((b: any) => b.benefit_id).filter(Boolean),
          planoId,
        );
        if (cobEl.length) {
          templateData.plano.coberturas_detalhadas = cobEl.map((pc: any) => ({
            nome: pc.coberturas?.nome || "",
            descricao: pc.coberturas?.descricao || "",
            valor_personalizado: pc.valor_limite ? `R$ ${Number(pc.valor_limite).toLocaleString("pt-BR")}` : "",
            carencia_dias: pc.carencia_dias,
            franquia_percentual: pc.franquia_percentual,
          }));
        }
        if (benEl.length) {
          templateData.plano.beneficios_detalhados = benEl.map((pb: any) => ({
            nome: pb.benefits?.name || "",
            descricao: pb.benefits?.description || "",
            valor_personalizado: pb.custom_value || "",
          }));
        }
      } catch (e) { console.warn("[retificar-termo] coberturas/benefícios:", e); }
    }

    // Buscar template do plano ou default
    let templateDB: any = null;
    const planoTemplateId = contratoNovo!.planos?.template_contrato_id;
    if (planoTemplateId) {
      const { data: tpl } = await supabase.from("documento_templates")
        .select("id, codigo, nome, conteudo").eq("id", planoTemplateId).eq("ativo", true).single();
      templateDB = tpl;
    }
    if (!templateDB) {
      const { data: tpls } = await supabase.from("documento_templates")
        .select("id, codigo, nome, conteudo")
        .eq("is_default_autentique", true).eq("ativo", true)
        .order("updated_at", { ascending: false }).limit(1);
      templateDB = tpls?.[0] || null;
    }

    let contratoHTML: string;
    if (templateDB?.conteudo) {
      let conteudo = substituirVariaveis(templateDB.conteudo, templateData);
      conteudo = markdownParaHTML(conteudo);
      conteudo = sanitizeSignatureBlocks(conteudo);
      const adicionais = extrairCodigosBeneficios(templateData);
      const aditivosHTML = await buscarEGerarAditivos(supabase, templateData.veiculo, templateData, {
        beneficios_codigos: adicionais, configRastreador,
      });
      const rastResult = exigeRastreador(templateData.veiculo, configRastreador);
      const rastreadorHTML = rastResult.exige ? generateSecaoRastreador(templateData) : "";
      let cobInj = "";
      const jaTem = conteudo.includes("COBERTURAS E BENEF") || conteudo.includes("plan-details") || conteudo.includes("tabela_coberturas");
      if (!jaTem) cobInj = gerarSecaoCoberturasInjetavel(templateData);
      contratoHTML = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Retificação Termo Filiação - ${contratoNovo!.numero}</title>${generateStyles()}</head><body><div class="page">${generateHeader(templateData)}<div style="background:#fff8e1;border:1px solid #fbbf24;padding:8px 12px;margin:8px 0;border-radius:4px;font-size:11px"><strong>RETIFICAÇÃO Nº ${retificacao.versao}</strong> — Este termo substitui o anteriormente assinado por correção de dados.<br><strong>Motivo:</strong> ${body.motivo.trim().replace(/</g, "&lt;")}</div>${conteudo}${cobInj}${aditivosHTML}${rastreadorHTML}${generateFooter(templateData)}</div></body></html>`;
    } else {
      contratoHTML = generateTermoAfiliacao(templateData);
    }
    contratoHTML = sanitizeSignatureBlocks(contratoHTML);
    contratoHTML = limparVariaveisNaoSubstituidas(contratoHTML);

    // ====== Enviar ao Autentique ======
    const posConfig = await buscarPosicoesConfig(supabase);
    posConfig.totalPaginas = estimarPaginasHTML(contratoHTML);

    const signerName = contratoNovo!.associados?.nome || contratoNovo!.cliente_nome;
    const signerEmail = contratoNovo!.associados?.email || contratoNovo!.cliente_email;
    if (!signerEmail) throw new Error("Associado sem e-mail para assinatura");

    const cpfRaw = (contratoNovo!.associados?.cpf || contratoNovo!.cliente_cpf || "").replace(/\D/g, "");
    const signerObj: any = {
      name: signerName || undefined,
      email: signerEmail,
      action: "SIGN",
      delivery_method: "DELIVERY_METHOD_EMAIL",
      positions: gerarPosicoesAssinatura(posConfig),
      security_verifications: [{ type: "PF_FACIAL" }],
    };
    if (cpfRaw.length === 11) signerObj.configs = { cpf: cpfRaw };

    const mutation = `
      mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
        createDocument(document: $document, signers: $signers, file: $file) {
          id name created_at
          signatures { public_id name email link { short_link } }
        }
      }`;
    const operations = {
      query: mutation,
      variables: {
        document: { name: `Retificação Termo Filiação ${contratoNovo!.numero} v${retificacao.versao}`, new_signature_style: true },
        signers: [signerObj],
        file: null,
      },
    };
    const map = { "0": ["variables.file"] };
    const fd = new FormData();
    fd.append("operations", JSON.stringify(operations));
    fd.append("map", JSON.stringify(map));
    fd.append("0", new Blob([contratoHTML], { type: "text/html" }),
      `retificacao-${contratoNovo!.numero}-v${retificacao.versao}.html`);

    const autResp = await fetch(AUTENTIQUE_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${autentiqueApiKey}` },
      body: fd,
    });
    const autData = await autResp.json();
    if (autData.errors) {
      await supabase.from("contrato_retificacoes")
        .update({ status: "erro", erro_mensagem: JSON.stringify(autData.errors).slice(0, 1000) })
        .eq("id", retificacao.id);
      throw new Error(`Autentique: ${JSON.stringify(autData.errors)}`);
    }
    const doc = autData.data?.createDocument;
    if (!doc) throw new Error("Documento não criado no Autentique");

    const shortLink = doc.signatures?.[0]?.link?.short_link || null;
    const signerPublicId = doc.signatures?.[0]?.public_id || null;

    await supabase.from("contrato_retificacoes").update({
      status: "enviado",
      autentique_documento_id: doc.id,
      autentique_signer_public_id: signerPublicId,
      autentique_short_link: shortLink,
      autentique_url: shortLink ? `https://assina.ae/${shortLink}` : null,
      enviado_em: new Date().toISOString(),
    }).eq("id", retificacao.id);

    await insertAuditLog(supabase, {
      usuario_id: callerUserId,
      usuario_nome: profileRow?.nome ?? null,
      acao: "atualizar",
      modulo: "associados",
      tabela: "contrato_retificacoes",
      registro_id: retificacao.id,
      descricao: `Retificação v${retificacao.versao} do Termo de Filiação — contrato ${contratoNovo!.numero}. Motivo: ${body.motivo.trim()}. Campos: ${camposAlterados.join(", ") || "—"}`,
      dados_anteriores: snapshotAnterior,
      dados_novos: snapshotNovo,
    });

    return new Response(JSON.stringify({
      success: true,
      retificacao_id: retificacao.id,
      versao: retificacao.versao,
      autentique_documento_id: doc.id,
      short_link: shortLink,
      campos_alterados: camposAlterados,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[retificar-termo-filiacao] erro:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
