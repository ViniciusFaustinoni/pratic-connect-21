import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { gerarPosicoesAssinatura, buscarPosicoesConfig } from "../_shared/autentique-positions.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import {
  substituirVariaveisEvento,
  generateStyles,
  markdownParaHTML,
} from "../_shared/template-utils.ts";
import { buscarConfiguracoesEmpresa } from "../_shared/termo-afiliacao-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTENTIQUE_API_URL = "https://api.autentique.com.br/v2/graphql";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const autentiqueApiKey = Deno.env.get("AUTENTIQUE_API_KEY");
    if (!autentiqueApiKey) throw new Error("AUTENTIQUE_API_KEY não configurada");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { associado_id, motivo, contrato_id } = await req.json();

    if (!associado_id) throw new Error("associado_id é obrigatório");

    console.log("[autentique-cancelamento-create] Gerando termo para associado:", associado_id);

    // Buscar associado
    const { data: associado, error: assocError } = await supabase
      .from("associados")
      .select("*")
      .eq("id", associado_id)
      .single();

    if (assocError || !associado) throw new Error("Associado não encontrado");

    // Buscar veículo ativo
    const { data: veiculo } = await supabase
      .from("veiculos")
      .select("*")
      .eq("associado_id", associado_id)
      .eq("status", "ativo")
      .limit(1)
      .maybeSingle();

    // Buscar contrato
    let contrato = null;
    if (contrato_id) {
      const { data } = await supabase.from("contratos").select("*").eq("id", contrato_id).maybeSingle();
      contrato = data;
    }
    if (!contrato) {
      const { data } = await supabase
        .from("contratos")
        .select("*")
        .eq("associado_id", associado_id)
        .in("status", ["ativo", "assinado"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      contrato = data;
    }

    // Buscar configs empresa
    const empresa = await buscarConfiguracoesEmpresa(supabase);

    // Buscar template do banco
    const { data: docType } = await supabase
      .from("document_types")
      .select("id")
      .eq("code", "termo_cancelamento")
      .single();

    let templateConteudo: string | null = null;
    if (docType) {
      const { data: template } = await supabase
        .from("documento_templates")
        .select("conteudo")
        .eq("document_type_id", docType.id)
        .eq("is_default", true)
        .eq("ativo", true)
        .maybeSingle();
      templateConteudo = template?.conteudo || null;
    }

    // Montar variáveis
    const formatCPF = (cpf: string) => cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") || "—";
    const formatPhone = (t: string) => t || "—";
    const formatDate = (d: string) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
    const formatCurrency = (v: number) => v ? `R$ ${v.toFixed(2).replace(".", ",")}` : "R$ 0,00";
    const dataAtual = new Date();

    const variaveis: Record<string, string> = {
      "associado.nome": associado.nome || "—",
      "associado.cpf": formatCPF(associado.cpf),
      "associado.telefone": formatPhone(associado.telefone),
      "associado.whatsapp": formatPhone(associado.whatsapp || associado.telefone),
      "associado.email": associado.email || "—",
      "associado.endereco_completo": `${associado.logradouro || ""}, ${associado.numero || ""} - ${associado.bairro || ""} - ${associado.cidade || ""}/${associado.uf || ""}`,
      "veiculo.placa": veiculo?.placa || "—",
      "veiculo.marca": veiculo?.marca || "—",
      "veiculo.modelo": veiculo?.modelo || "—",
      "veiculo.ano": String(veiculo?.ano_modelo || veiculo?.ano || "—"),
      "veiculo.cor": veiculo?.cor || "—",
      "veiculo.chassi": veiculo?.chassi || "—",
      "veiculo.renavam": veiculo?.renavam || "—",
      "contrato.numero": contrato?.numero || "—",
      "contrato.data_inicio": formatDate(contrato?.data_inicio || contrato?.created_at),
      "contrato.valor_mensal": formatCurrency(contrato?.valor_mensal || 0),
      "cancelamento.motivo": motivo || "Solicitação do associado",
      "cancelamento.data": formatDate(dataAtual.toISOString()),
      "empresa.nome": empresa.nome || "ASSOCIAÇÃO DE BENEFÍCIOS PRATICCAR",
      "empresa.cnpj": empresa.cnpj || "—",
      "empresa.endereco": `${empresa.logradouro || ""}, ${empresa.numero || ""} - ${empresa.bairro || ""} - ${empresa.cidade || ""}/${empresa.uf || ""}`,
      "sistema.data_atual": formatDate(dataAtual.toISOString()),
      "sistema.data_extenso": dataAtual.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }),
    };

    // Gerar HTML
    let htmlContent: string;

    if (templateConteudo) {
      console.log("[autentique-cancelamento-create] Usando template do banco");
      const conteudoPreenchido = substituirVariaveisEvento(templateConteudo, variaveis);
      const conteudoHTML = markdownParaHTML(conteudoPreenchido);

      htmlContent = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Termo de Cancelamento</title>${generateStyles()}</head><body><div class="page">
<div class="header">
  <div class="header-gradient"></div>
  <div class="header-logo-area"><img src="https://pratic-connect-21.lovable.app/logos/logo-full-light.png" alt="Logo" onerror="this.style.display='none'" /></div>
  <div class="header-empresa">${variaveis["empresa.nome"]}<br>CNPJ: ${variaveis["empresa.cnpj"]} | ${variaveis["empresa.endereco"]}</div>
  <div class="header-titulo">TERMO DE CANCELAMENTO DE FILIAÇÃO</div>
</div>
${conteudoHTML}
<div class="signature-area">
  <h2 class="section-title">ASSINATURA</h2>
  <br><br>
  <p class="signature-local-data">${associado.cidade || ""}/${associado.uf || ""}, ${variaveis["sistema.data_extenso"]}</p>
</div>
<div class="footer">ABP PraticCar | Termo de Cancelamento</div>
</div></body></html>`;
    } else {
      console.log("[autentique-cancelamento-create] Usando template hardcoded");
      htmlContent = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Termo de Cancelamento</title>${generateStyles()}</head><body><div class="page">
<div class="header">
  <div class="header-gradient"></div>
  <div class="header-logo-area"><img src="https://pratic-connect-21.lovable.app/logos/logo-full-light.png" alt="Logo" onerror="this.style.display='none'" /></div>
  <div class="header-empresa">${variaveis["empresa.nome"]}<br>CNPJ: ${variaveis["empresa.cnpj"]} | ${variaveis["empresa.endereco"]}</div>
  <div class="header-titulo">TERMO DE CANCELAMENTO DE FILIAÇÃO</div>
</div>
<div class="section">
  <h2 class="section-title">DADOS DO ASSOCIADO</h2>
  <table class="fields-grid">
    <tr><td><span class="field-label">NOME</span><br><span class="field-value">${variaveis["associado.nome"]}</span></td><td><span class="field-label">CPF</span><br><span class="field-value">${variaveis["associado.cpf"]}</span></td></tr>
    <tr><td><span class="field-label">TELEFONE</span><br><span class="field-value">${variaveis["associado.telefone"]}</span></td><td><span class="field-label">EMAIL</span><br><span class="field-value">${variaveis["associado.email"]}</span></td></tr>
    <tr><td colspan="2"><span class="field-label">ENDEREÇO</span><br><span class="field-value">${variaveis["associado.endereco_completo"]}</span></td></tr>
  </table>
</div>
<div class="section">
  <h2 class="section-title">DADOS DO VEÍCULO</h2>
  <table class="fields-grid">
    <tr><td><span class="field-label">MARCA/MODELO</span><br><span class="field-value">${variaveis["veiculo.marca"]} ${variaveis["veiculo.modelo"]}</span></td><td><span class="field-label">PLACA</span><br><span class="field-value">${variaveis["veiculo.placa"]}</span></td></tr>
    <tr><td><span class="field-label">ANO</span><br><span class="field-value">${variaveis["veiculo.ano"]}</span></td><td><span class="field-label">COR</span><br><span class="field-value">${variaveis["veiculo.cor"]}</span></td></tr>
    <tr><td><span class="field-label">CHASSI</span><br><span class="field-value">${variaveis["veiculo.chassi"]}</span></td><td><span class="field-label">RENAVAM</span><br><span class="field-value">${variaveis["veiculo.renavam"]}</span></td></tr>
  </table>
</div>
<div class="section">
  <h2 class="section-title">DADOS DO CONTRATO</h2>
  <table class="fields-grid">
    <tr><td><span class="field-label">Nº CONTRATO</span><br><span class="field-value">${variaveis["contrato.numero"]}</span></td><td><span class="field-label">INÍCIO</span><br><span class="field-value">${variaveis["contrato.data_inicio"]}</span></td><td><span class="field-label">MENSALIDADE</span><br><span class="field-value">${variaveis["contrato.valor_mensal"]}</span></td></tr>
  </table>
</div>
<div class="section">
  <h2 class="section-title">CANCELAMENTO</h2>
  <p><strong>Motivo:</strong> ${variaveis["cancelamento.motivo"]}</p>
  <p><strong>Data da solicitação:</strong> ${variaveis["cancelamento.data"]}</p>
  <br>
  <p>Pelo presente termo, o associado acima qualificado solicita o <strong>CANCELAMENTO</strong> de sua filiação ao programa de proteção veicular da ${variaveis["empresa.nome"]}, declarando estar ciente de que:</p>
  <ul>
    <li>O cancelamento será efetivado após a conclusão de todos os procedimentos necessários;</li>
    <li>A retirada do equipamento rastreador do veículo é obrigatória;</li>
    <li>Eventuais débitos pendentes deverão ser quitados;</li>
    <li>Após a efetivação do cancelamento, o veículo deixará de contar com a proteção da associação.</li>
  </ul>
</div>
<div class="signature-area">
  <h2 class="section-title">ASSINATURA</h2>
  <br><br>
  <p class="signature-local-data">${associado.cidade || ""}/${associado.uf || ""}, ${variaveis["sistema.data_extenso"]}</p>
</div>
<div class="footer">ABP PraticCar | Termo de Cancelamento</div>
</div></body></html>`;
    }

    // Enviar para Autentique
    const mutation = `mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
      createDocument(document: $document, signers: $signers, file: $file) {
        id name signatures { public_id name email link { short_link } }
      }
    }`;

    const documentName = `Termo de Cancelamento - ${associado.nome}`;
    const operations = {
      query: mutation,
      variables: {
        document: { name: documentName },
        signers: [{
          name: associado.nome,
          email: associado.email,
          action: "SIGN",
          configs: {
            cpf: (associado.cpf || '').replace(/\D/g, ''),
          },
          positions: gerarPosicoesAssinatura(await buscarPosicoesConfig(supabase)),
        }],
        file: null,
      },
    };

    const formData = new FormData();
    formData.append("operations", JSON.stringify(operations));
    formData.append("map", JSON.stringify({ "0": ["variables.file"] }));
    formData.append("0", new Blob([htmlContent], { type: "text/html" }), `termo-cancelamento-${associado.cpf}.html`);

    const autentiqueResponse = await fetch(AUTENTIQUE_API_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${autentiqueApiKey}` },
      body: formData,
    });

    const autentiqueData = await autentiqueResponse.json();
    console.log("[autentique-cancelamento-create] Resposta Autentique:", JSON.stringify(autentiqueData));

    if (autentiqueData.errors) throw new Error(`Erro Autentique: ${JSON.stringify(autentiqueData.errors)}`);

    const document = autentiqueData.data?.createDocument;
    if (!document) throw new Error("Documento não criado no Autentique");

    const signatureLink = document.signatures?.[0]?.link?.short_link;

    // Salvar no contrato se existir
    if (contrato) {
      await supabase.from("contratos").update({
        autentique_cancelamento_id: document.id,
        autentique_cancelamento_url: signatureLink,
      }).eq("id", contrato.id);
    }

    // Registrar histórico
    await supabase.from("associados_historico").insert({
      associado_id,
      tipo: "documento_enviado",
      descricao: `Termo de Cancelamento enviado para assinatura via Autentique`,
      metadata: { autentique_id: document.id, link: signatureLink, motivo },
    });

    console.log("[autentique-cancelamento-create] ✓ Termo criado:", document.id);

    return new Response(JSON.stringify({
      success: true,
      documentId: document.id,
      signatureLink,
      message: "Termo de Cancelamento enviado para assinatura",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("[autentique-cancelamento-create] Erro:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
