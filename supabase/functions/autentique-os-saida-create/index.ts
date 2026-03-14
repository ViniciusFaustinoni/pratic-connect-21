// ============================================
// EDGE FUNCTION: autentique-os-saida-create
// Cria documento Autentique para Termo de Saída de Veículo (conclusão de OS)
// ============================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { gerarPosicoesAssinatura, buscarPosicoesConfig } from "../_shared/autentique-positions.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import {
  generateStyles,
  markdownParaHTML,
  substituirVariaveisEvento,
} from "../_shared/template-utils.ts";
import { buscarConfiguracoesEmpresa, formatCPF, formatPhone, formatCEP, formatCurrency, formatDate, formatDateExtended } from "../_shared/termo-afiliacao-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTENTIQUE_API_URL = "https://api.autentique.com.br/v2/graphql";
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const autentiqueApiKey = Deno.env.get("AUTENTIQUE_API_KEY");
    if (!autentiqueApiKey) {
      throw new Error("AUTENTIQUE_API_KEY não configurada");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const ordemServicoId = body.ordem_servico_id || body.ordemServicoId;

    if (!ordemServicoId) {
      throw new Error("ordem_servico_id é obrigatório");
    }

    console.log("[autentique-os-saida-create] Criando termo para OS:", ordemServicoId);

    // 1. Buscar OS com associado, veículo e oficina
    const { data: os, error: osError } = await supabase
      .from("ordens_servico")
      .select(`
        *,
        associado:associados(
          id, nome, cpf, rg, telefone, whatsapp, email,
          logradouro, numero, complemento, bairro, cidade, uf, cep
        ),
        veiculo:veiculos(
          id, placa, marca, modelo, ano_modelo, cor, chassi, renavam,
          valor_fipe, codigo_fipe
        ),
        oficina:oficinas(
          id, nome_fantasia, razao_social, cnpj, telefone, whatsapp,
          logradouro, numero, bairro, cidade, estado, cep
        ),
        sinistro:sinistros(id, protocolo, tipo, status)
      `)
      .eq("id", ordemServicoId)
      .single();

    if (osError || !os) {
      throw new Error(`Ordem de serviço não encontrada: ${osError?.message}`);
    }

    // Proteção contra duplicidade
    if (os.autentique_documento_id) {
      console.log(`[autentique-os-saida-create] OS já possui documento Autentique: ${os.autentique_documento_id}`);
      return new Response(
        JSON.stringify({
          success: true,
          documentId: os.autentique_documento_id,
          signatureLink: os.autentique_url,
          message: "Documento existente retornado",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!os.associado) {
      throw new Error("OS não possui associado vinculado");
    }

    // 2. Buscar template do tipo termo_saida_veiculo
    const { data: docType } = await supabase
      .from("document_types")
      .select("id")
      .eq("code", "termo_saida_veiculo")
      .single();

    let templateConteudo: string | null = null;
    let templateNome = "fallback";

    // Priorizar template marcado como default para saída
    const { data: templateSaida } = await supabase
      .from("documento_templates")
      .select("id, codigo, nome, conteudo")
      .eq("is_default_saida", true)
      .eq("ativo", true)
      .maybeSingle();

    if (templateSaida?.conteudo) {
      templateConteudo = templateSaida.conteudo;
      templateNome = templateSaida.nome;
      console.log(`[autentique-os-saida-create] Usando template is_default_saida: ${templateNome}`);
    } else if (docType) {
      const { data: templateDB } = await supabase
        .from("documento_templates")
        .select("id, codigo, nome, conteudo")
        .eq("document_type_id", docType.id)
        .eq("is_default", true)
        .eq("ativo", true)
        .maybeSingle();

      if (templateDB?.conteudo) {
        templateConteudo = templateDB.conteudo;
        templateNome = templateDB.nome;
        console.log(`[autentique-os-saida-create] Usando template por document_type: ${templateNome}`);
      }
    }

    // 3. Buscar config empresa
    const empresaConfig = await buscarConfiguracoesEmpresa(supabase);

    // 4. Criar mapeamento de variáveis
    const dataAtual = new Date().toISOString();
    const associado = os.associado;
    const veiculo = os.veiculo;
    const oficina = os.oficina;
    const sinistro = os.sinistro;

    const oficinaNome = oficina?.nome_fantasia || oficina?.razao_social || '—';
    const oficinaEndereco = oficina ? `${oficina.logradouro || ''}, ${oficina.numero || ''} - ${oficina.bairro || ''} - ${oficina.cidade || ''}/${oficina.estado || ''}` : '—';

    const variaveis: Record<string, string> = {
      // OS
      'os.numero': os.numero || '—',
      'os.data_entrada': formatDate(os.data_entrada),
      'os.data_conclusao': formatDate(os.data_conclusao || dataAtual),
      'os.data_previsao': formatDate(os.data_previsao),
      'os.valor_orcamento': formatCurrency(os.valor_orcamento),
      'os.valor_aprovado': formatCurrency(os.valor_aprovado),
      'os.observacoes': os.observacoes || '—',

      // Oficina
      'oficina.nome': oficinaNome,
      'oficina.cnpj': oficina?.cnpj || '—',
      'oficina.telefone': formatPhone(oficina?.telefone),
      'oficina.whatsapp': formatPhone(oficina?.whatsapp || oficina?.telefone),
      'oficina.endereco': oficinaEndereco,

      // Evento (sinistro vinculado, se houver)
      'evento.protocolo': sinistro?.protocolo || '—',
      'evento.tipo': sinistro?.tipo || '—',

      // Associado
      'associado.nome': associado.nome || '—',
      'associado.cpf': formatCPF(associado.cpf),
      'associado.rg': associado.rg || '—',
      'associado.email': associado.email || '—',
      'associado.telefone': formatPhone(associado.telefone),
      'associado.whatsapp': formatPhone(associado.whatsapp || associado.telefone),
      'associado.logradouro': associado.logradouro || '—',
      'associado.numero': associado.numero || '—',
      'associado.complemento': associado.complemento || '',
      'associado.bairro': associado.bairro || '—',
      'associado.cidade': associado.cidade || '—',
      'associado.uf': associado.uf || '—',
      'associado.cep': formatCEP(associado.cep),
      'associado.endereco_completo': `${associado.logradouro || ''}, ${associado.numero || ''}${associado.complemento ? ', ' + associado.complemento : ''} - ${associado.bairro || ''} - ${associado.cidade || ''}/${associado.uf || ''} - CEP ${formatCEP(associado.cep)}`,

      // Veículo
      'veiculo.placa': veiculo?.placa || '—',
      'veiculo.marca': veiculo?.marca || '—',
      'veiculo.modelo': veiculo?.modelo || '—',
      'veiculo.ano': String(veiculo?.ano_modelo || '—'),
      'veiculo.cor': veiculo?.cor || '—',
      'veiculo.chassi': veiculo?.chassi || '—',
      'veiculo.renavam': veiculo?.renavam || '—',
      'veiculo.valor_fipe': formatCurrency(veiculo?.valor_fipe),

      // Empresa
      'empresa.nome': empresaConfig.nome || 'ASSOCIAÇÃO DE BENEFÍCIOS PRATICCAR',
      'empresa.razao_social': empresaConfig.razao_social || empresaConfig.nome || '',
      'empresa.cnpj': empresaConfig.cnpj || '—',
      'empresa.endereco': `${empresaConfig.logradouro || ''}, ${empresaConfig.numero || ''} - ${empresaConfig.bairro || ''} - ${empresaConfig.cidade || ''}/${empresaConfig.uf || ''} - CEP ${empresaConfig.cep || ''}`,

      // Sistema
      'sistema.data_atual': formatDate(dataAtual),
      'sistema.data_extenso': formatDateExtended(dataAtual),
      'sistema.hora_atual': new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    // 5. Gerar HTML
    let htmlContent: string;

    if (templateConteudo) {
      const conteudoPreenchido = substituirVariaveisEvento(templateConteudo, variaveis);
      const conteudoHTML = markdownParaHTML(conteudoPreenchido);

      htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Termo de Saída de Veículo - OS ${os.numero}</title>
  ${generateStyles()}
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-gradient"></div>
      <div class="header-logo-area">
        <img src="https://pratic-connect-21.lovable.app/logos/logo-full-light.png" alt="Logo PraticCar" onerror="this.style.display='none'" />
      </div>
      <div class="header-empresa">
        ${empresaConfig.razao_social || empresaConfig.nome || 'ASSOCIAÇÃO DE BENEFÍCIOS PRATICCAR'}<br>
        CNPJ: ${empresaConfig.cnpj} | ${empresaConfig.logradouro}, ${empresaConfig.numero} - ${empresaConfig.bairro} - ${empresaConfig.cidade}/${empresaConfig.uf} - CEP ${empresaConfig.cep}
      </div>
      <div class="header-titulo">TERMO DE SAÍDA DE VEÍCULO</div>
      <div class="header-numero">Ordem de Serviço Nº ${os.numero}</div>
    </div>
    ${conteudoHTML}
    <div class="signature-area">
      <h2 class="section-title">ASSINATURA</h2>
      <br><br>
      <p class="signature-local-data">${associado.cidade || ''}/${associado.uf || ''}, ${formatDateExtended(dataAtual)}</p>
    </div>
    <div class="footer">
      ABP PraticCar | Termo de Saída de Veículo - OS ${os.numero}
    </div>
  </div>
</body>
</html>`;
    } else {
      // Fallback HTML
      htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Termo de Saída de Veículo - OS ${os.numero}</title>
  ${generateStyles()}
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-gradient"></div>
      <div class="header-logo-area">
        <img src="https://pratic-connect-21.lovable.app/images/logo-praticcar.jpg" alt="Logo PraticCar" onerror="this.style.display='none'" />
      </div>
      <div class="header-empresa">
        ${empresaConfig.razao_social || empresaConfig.nome || 'ASSOCIAÇÃO DE BENEFÍCIOS PRATICCAR'}<br>
        CNPJ: ${empresaConfig.cnpj}
      </div>
      <div class="header-titulo">TERMO DE SAÍDA DE VEÍCULO</div>
      <div class="header-numero">Ordem de Serviço Nº ${os.numero}</div>
    </div>

    <div class="section">
      <h2 class="section-title">DADOS DO ASSOCIADO</h2>
      <table class="fields-grid">
        <tr>
          <td><span class="field-label">Nome</span><span class="field-value">${associado.nome}</span></td>
          <td><span class="field-label">CPF</span><span class="field-value">${formatCPF(associado.cpf)}</span></td>
        </tr>
        <tr>
          <td><span class="field-label">Telefone</span><span class="field-value">${formatPhone(associado.telefone)}</span></td>
          <td><span class="field-label">Email</span><span class="field-value">${associado.email || '—'}</span></td>
        </tr>
      </table>
    </div>

    <div class="section">
      <h2 class="section-title">DADOS DO VEÍCULO</h2>
      <table class="fields-grid">
        <tr>
          <td><span class="field-label">Placa</span><span class="field-value">${veiculo?.placa || '—'}</span></td>
          <td><span class="field-label">Marca/Modelo</span><span class="field-value">${veiculo?.marca || ''} ${veiculo?.modelo || ''}</span></td>
          <td><span class="field-label">Ano</span><span class="field-value">${veiculo?.ano_modelo || '—'}</span></td>
        </tr>
        <tr>
          <td><span class="field-label">Cor</span><span class="field-value">${veiculo?.cor || '—'}</span></td>
          <td><span class="field-label">Chassi</span><span class="field-value">${veiculo?.chassi || '—'}</span></td>
          <td><span class="field-label">Valor FIPE</span><span class="field-value">${formatCurrency(veiculo?.valor_fipe)}</span></td>
        </tr>
      </table>
    </div>

    <div class="section">
      <h2 class="section-title">DADOS DA OFICINA</h2>
      <table class="fields-grid">
        <tr>
          <td><span class="field-label">Nome</span><span class="field-value">${oficinaNome}</span></td>
          <td><span class="field-label">CNPJ</span><span class="field-value">${oficina?.cnpj || '—'}</span></td>
        </tr>
        <tr>
          <td colspan="2"><span class="field-label">Endereço</span><span class="field-value">${oficinaEndereco}</span></td>
        </tr>
      </table>
    </div>

    <div class="section">
      <h2 class="section-title">DADOS DA ORDEM DE SERVIÇO</h2>
      <table class="fields-grid">
        <tr>
          <td><span class="field-label">Número OS</span><span class="field-value">${os.numero}</span></td>
          <td><span class="field-label">Data Entrada</span><span class="field-value">${formatDate(os.data_entrada)}</span></td>
          <td><span class="field-label">Data Conclusão</span><span class="field-value">${formatDate(os.data_conclusao || dataAtual)}</span></td>
        </tr>
        <tr>
          <td><span class="field-label">Valor Orçamento</span><span class="field-value">${formatCurrency(os.valor_orcamento)}</span></td>
          <td><span class="field-label">Valor Aprovado</span><span class="field-value">${formatCurrency(os.valor_aprovado)}</span></td>
          <td><span class="field-label">Evento</span><span class="field-value">${sinistro?.protocolo || '—'}</span></td>
        </tr>
      </table>
    </div>

    <div class="section">
      <p>Eu, <strong>${associado.nome}</strong>, portador(a) do CPF nº <strong>${formatCPF(associado.cpf)}</strong>, declaro que recebi o veículo de placa <strong>${veiculo?.placa || '—'}</strong>, marca/modelo <strong>${veiculo?.marca || ''} ${veiculo?.modelo || ''}</strong>, em perfeitas condições de reparo, conforme a Ordem de Serviço nº <strong>${os.numero}</strong>, realizada na oficina <strong>${oficinaNome}</strong>.</p>
      <p>Declaro que o veículo foi inspecionado e que estou de acordo com os serviços executados, não havendo nenhuma pendência a ser resolvida.</p>
    </div>

    <div class="signature-area">
      <h2 class="section-title">ASSINATURA</h2>
      <br><br>
      <p class="signature-local-data">${associado.cidade || ''}/${associado.uf || ''}, ${formatDateExtended(dataAtual)}</p>
    </div>

    <div class="footer">
      ABP PraticCar | Termo de Saída de Veículo - OS ${os.numero}
    </div>
  </div>
</body>
</html>`;
    }

    console.log(`[autentique-os-saida-create] HTML gerado: ${htmlContent.length} bytes, template: ${templateNome}`);

    // 6. Enviar para Autentique
    const mutation = `
      mutation CreateDocumentMutation(
        $document: DocumentInput!
        $signers: [SignerInput!]!
        $file: Upload!
      ) {
        createDocument(
          document: $document
          signers: $signers
          file: $file
        ) {
          id
          name
          signatures {
            public_id
            name
            email
            link { short_link }
          }
        }
      }
    `;

    const signerName = associado.nome;
    const signerEmail = associado.email;
    const documentName = `Termo de Saída de Veículo OS ${os.numero} - ${signerName}`;

    if (!signerEmail) {
      throw new Error("Associado não possui email cadastrado para assinatura");
    }

    const operations = {
      query: mutation,
      variables: {
        document: { name: documentName },
        signers: [{
          name: signerName,
          email: signerEmail,
          action: "SIGN",
          positions: gerarPosicoesAssinatura(await buscarPosicoesConfig(supabase)),
        }],
        file: null,
      },
    };

    const formData = new FormData();
    formData.append("operations", JSON.stringify(operations));
    formData.append("map", JSON.stringify({ "0": ["variables.file"] }));
    formData.append("0", new Blob([htmlContent], { type: "text/html" }), `termo-saida-os-${os.numero}.html`);

    console.log("[autentique-os-saida-create] Enviando para Autentique...");

    const autentiqueResponse = await fetch(AUTENTIQUE_API_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${autentiqueApiKey}` },
      body: formData,
    });

    const autentiqueData = await autentiqueResponse.json();
    console.log("[autentique-os-saida-create] Resposta Autentique:", JSON.stringify(autentiqueData, null, 2));

    if (autentiqueData.errors) {
      throw new Error(`Erro Autentique: ${JSON.stringify(autentiqueData.errors)}`);
    }

    const doc = autentiqueData.data?.createDocument;
    if (!doc) {
      throw new Error("Documento não retornado pela Autentique");
    }

    const signatureLink = doc.signatures?.[0]?.link?.short_link || null;

    console.log(`[autentique-os-saida-create] ✓ Documento criado: ${doc.id}, link: ${signatureLink}`);

    // 7. Atualizar OS com dados do Autentique
    await supabase
      .from("ordens_servico")
      .update({
        autentique_documento_id: doc.id,
        autentique_url: signatureLink,
        updated_at: new Date().toISOString(),
      })
      .eq("id", os.id);

    // 8. Registrar histórico
    await supabase.from("ordens_servico_historico").insert({
      ordem_servico_id: os.id,
      status_novo: os.status,
      observacao: `Termo de Saída de Veículo enviado para assinatura via Autentique`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        documentId: doc.id,
        signatureLink,
        message: "Termo enviado para assinatura",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[autentique-os-saida-create] ERRO:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
