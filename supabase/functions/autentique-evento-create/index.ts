// ============================================
// EDGE FUNCTION: autentique-evento-create
// Cria documento Autentique para Termo de Entrada de Evento (sinistro aprovado)
// ============================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { gerarPosicoesAssinatura, buscarPosicoesConfig } from "../_shared/autentique-positions.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import {
  substituirVariaveisEvento,
  generateStyles,
  generateHeader,
  generateFooter,
  markdownParaHTML,
  buscarEGerarAditivos,
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
    const sinistroId = body.sinistro_id || body.sinistroId;

    if (!sinistroId) {
      throw new Error("sinistro_id é obrigatório");
    }

    console.log("[autentique-evento-create] Criando termo para sinistro:", sinistroId);

    // 1. Buscar sinistro com associado e veículo
    const { data: sinistro, error: sinistroError } = await supabase
      .from("sinistros")
      .select(`
        *,
        associado:associados(
          id, nome, cpf, rg, telefone, whatsapp, email,
          logradouro, numero, complemento, bairro, cidade, uf, cep,
          estado_civil, profissao, data_nascimento, telefone_secundario
        ),
        veiculo:veiculos(
          id, placa, marca, modelo, ano_modelo, cor, chassi, renavam,
          valor_fipe, codigo_fipe, combustivel
        )
      `)
      .eq("id", sinistroId)
      .single();

    if (sinistroError || !sinistro) {
      throw new Error(`Sinistro não encontrado: ${sinistroError?.message}`);
    }

    // Proteção contra duplicidade
    if (sinistro.autentique_documento_id) {
      console.log(`[autentique-evento-create] Sinistro já possui documento Autentique: ${sinistro.autentique_documento_id}`);
      return new Response(
        JSON.stringify({
          success: true,
          documentId: sinistro.autentique_documento_id,
          signatureLink: sinistro.autentique_url,
          message: "Documento existente retornado",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!sinistro.associado) {
      throw new Error("Sinistro não possui associado vinculado");
    }

    // 2. Buscar template do tipo termo_entrada_evento
    const { data: docType } = await supabase
      .from("document_types")
      .select("id")
      .eq("code", "termo_entrada_evento")
      .single();

    let templateConteudo: string | null = null;
    let templateNome = "fallback";

    // Priorizar template marcado com is_default_evento
    const { data: templateEvento } = await supabase
      .from("documento_templates")
      .select("id, codigo, nome, conteudo")
      .eq("is_default_evento", true)
      .eq("ativo", true)
      .maybeSingle();

    if (templateEvento?.conteudo) {
      templateConteudo = templateEvento.conteudo;
      templateNome = templateEvento.nome;
      console.log(`[autentique-evento-create] Usando template evento: ${templateNome}`);
    } else if (docType) {
      // Fallback: buscar por document_type_id + is_default
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
        console.log(`[autentique-evento-create] Usando template fallback: ${templateNome}`);
      }
    }

    // 3. Buscar config empresa
    const empresaConfig = await buscarConfiguracoesEmpresa(supabase);

    // 4. Criar mapeamento de variáveis do evento
    const dataAtual = new Date().toISOString();
    const associado = sinistro.associado;
    const veiculo = sinistro.veiculo;

    const variaveis: Record<string, string> = {
      // Evento/Sinistro
      'evento.protocolo': sinistro.protocolo || '—',
      'evento.tipo': sinistro.tipo || '—',
      'evento.data_ocorrencia': formatDate(sinistro.data_ocorrencia),
      'evento.local': sinistro.local_ocorrencia || '—',
      'evento.cidade': sinistro.cidade_ocorrencia || '—',
      'evento.estado': sinistro.estado_ocorrencia || '—',
      'evento.descricao': sinistro.descricao || '—',
      'evento.parecer': sinistro.parecer || '—',
      'evento.valor_aprovado': formatCurrency(sinistro.valor_indenizacao),
      'evento.valor_fipe': formatCurrency(sinistro.valor_fipe),
      'evento.valor_participacao': formatCurrency(sinistro.valor_participacao),
      'evento.tipo_dano': sinistro.tipo_dano === 'perda_total' ? 'Perda Total' : sinistro.tipo_dano === 'parcial' ? 'Dano Parcial' : '—',
      'evento.bo_numero': sinistro.bo_numero || '—',
      'evento.status': sinistro.status || '—',

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
      'veiculo.codigo_fipe': veiculo?.codigo_fipe || '—',

      // Empresa
      'empresa.nome': empresaConfig.nome || 'ASSOCIAÇÃO DE BENEFÍCIOS PRATICCAR',
      'empresa.razao_social': empresaConfig.razao_social || empresaConfig.nome || '',
      'empresa.cnpj': empresaConfig.cnpj || '—',
      'empresa.logradouro': empresaConfig.logradouro || '—',
      'empresa.numero': empresaConfig.numero || '—',
      'empresa.bairro': empresaConfig.bairro || '—',
      'empresa.cidade': empresaConfig.cidade || '—',
      'empresa.uf': empresaConfig.uf || '—',
      'empresa.cep': empresaConfig.cep || '—',
      'empresa.endereco': `${empresaConfig.logradouro || ''}, ${empresaConfig.numero || ''} - ${empresaConfig.bairro || ''} - ${empresaConfig.cidade || ''}/${empresaConfig.uf || ''} - CEP ${empresaConfig.cep || ''}`,

      // Sistema
      'sistema.data_atual': formatDate(dataAtual),
      'sistema.data_extenso': formatDateExtended(dataAtual),
      'sistema.hora_atual': new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    // 5. Gerar HTML
    let htmlContent: string;

    if (templateConteudo) {
      // Substituir variáveis no template
      let conteudoPreenchido = templateConteudo;
      for (const [chave, valor] of Object.entries(variaveis)) {
        conteudoPreenchido = conteudoPreenchido.replace(
          new RegExp(`\\{\\{\\s*${chave.replace('.', '\\.')}\\s*\\}\\}`, 'gi'),
          valor || '—'
        );
      }
      const conteudoHTML = markdownParaHTML(conteudoPreenchido);

      // Montar dados fake de header (reusa a mesma interface)
      const headerData = {
        cliente: { nome: associado.nome, cpf: associado.cpf, email: associado.email, telefone: associado.telefone, logradouro: associado.logradouro || '', numero: associado.numero || '', bairro: associado.bairro || '', cidade: associado.cidade || '', uf: associado.uf || '', cep: associado.cep || '' },
        veiculo: { placa: veiculo?.placa || '', marca: veiculo?.marca || '', modelo: veiculo?.modelo || '', ano: veiculo?.ano_modelo || 0, valor_fipe: veiculo?.valor_fipe || 0 },
        plano: { nome: '—', coberturas: [] },
        contrato: { numero: sinistro.protocolo, valor_adesao: 0, valor_mensal: 0, dia_vencimento: 0 },
        empresa: empresaConfig,
      };

      htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Termo de Entrada de Evento - ${sinistro.protocolo}</title>
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
      <div class="header-titulo">TERMO DE ENTRADA DE EVENTO</div>
      <div class="header-numero">Protocolo Nº ${sinistro.protocolo}</div>
    </div>
    ${conteudoHTML}
    <div class="signature-area">
      <h2 class="section-title">ASSINATURA</h2>
      <br><br>
      <p class="signature-local-data">${associado.cidade || ''}/${associado.uf || ''}, ${formatDateExtended(dataAtual)}</p>
    </div>
    <div class="footer">
      ABP PraticCar | Termo de Entrada de Evento - Protocolo ${sinistro.protocolo}
    </div>
  </div>
</body>
</html>`;
    } else {
      // Fallback: gerar HTML básico
      htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Termo de Entrada de Evento - ${sinistro.protocolo}</title>
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
        CNPJ: ${empresaConfig.cnpj}
      </div>
      <div class="header-titulo">TERMO DE ENTRADA DE EVENTO</div>
      <div class="header-numero">Protocolo Nº ${sinistro.protocolo}</div>
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
      <h2 class="section-title">DADOS DO EVENTO</h2>
      <table class="fields-grid">
        <tr>
          <td><span class="field-label">Protocolo</span><span class="field-value">${sinistro.protocolo}</span></td>
          <td><span class="field-label">Tipo</span><span class="field-value">${sinistro.tipo}</span></td>
          <td><span class="field-label">Data</span><span class="field-value">${formatDate(sinistro.data_ocorrencia)}</span></td>
        </tr>
        <tr>
          <td colspan="3"><span class="field-label">Local</span><span class="field-value">${sinistro.local_ocorrencia || '—'}</span></td>
        </tr>
        <tr>
          <td><span class="field-label">Valor Aprovado</span><span class="field-value">${formatCurrency(sinistro.valor_indenizacao)}</span></td>
          <td><span class="field-label">Tipo de Dano</span><span class="field-value">${sinistro.tipo_dano === 'perda_total' ? 'Perda Total' : 'Dano Parcial'}</span></td>
          <td><span class="field-label">B.O.</span><span class="field-value">${sinistro.bo_numero || '—'}</span></td>
        </tr>
      </table>
    </div>

    <div class="section">
      <h2 class="section-title">PARECER</h2>
      <p>${sinistro.parecer || '—'}</p>
    </div>

    <div class="section">
      <p>Eu, <strong>${associado.nome}</strong>, portador(a) do CPF nº <strong>${formatCPF(associado.cpf)}</strong>, declaro estar ciente e de acordo com o parecer emitido referente ao evento protocolo <strong>${sinistro.protocolo}</strong>, autorizando a entrada do veículo de placa <strong>${veiculo?.placa || '—'}</strong> para o devido reparo/indenização conforme as condições estabelecidas pela associação.</p>
    </div>

    <div class="signature-area">
      <h2 class="section-title">ASSINATURA</h2>
      <br><br>
      <p class="signature-local-data">${associado.cidade || ''}/${associado.uf || ''}, ${formatDateExtended(dataAtual)}</p>
    </div>

    <div class="footer">
      ABP PraticCar | Termo de Entrada de Evento - Protocolo ${sinistro.protocolo}
    </div>
  </div>
</body>
</html>`;
    }

    // 5.1 Buscar e injetar aditivos aplicáveis
    const aditivosHtml = await buscarEGerarAditivos(
      supabase,
      veiculo || {},
      variaveis,
      { tipo_evento: sinistro.tipo }
    );

    if (aditivosHtml) {
      console.log(`[autentique-evento-create] Aditivos injetados no documento`);
      htmlContent = htmlContent.replace('</body>', `${aditivosHtml}\n</body>`);
    }

    console.log(`[autentique-evento-create] HTML gerado: ${htmlContent.length} bytes, template: ${templateNome}`);

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
    const documentName = `Termo de Entrada de Evento ${sinistro.protocolo} - ${signerName}`;

    if (!signerEmail) {
      throw new Error("Associado não possui email cadastrado para assinatura");
    }

    const cpfRaw = (associado.cpf || '').replace(/\D/g, '');
    const cpfOk = cpfRaw.length === 11 && !/^(\d)\1{10}$/.test(cpfRaw) && (() => {
      for (let t = 9; t < 11; t++) { let d = 0; for (let c = 0; c < t; c++) d += parseInt(cpfRaw[c]) * ((t+1)-c); d = ((10*d)%11)%10; if (parseInt(cpfRaw[t]) !== d) return false; } return true;
    })();
    console.log(`[autentique-evento-create] CPF: ${cpfRaw} (válido: ${cpfOk})`);
    const signerObj: any = { name: signerName, email: signerEmail, action: "SIGN", positions: gerarPosicoesAssinatura(await buscarPosicoesConfig(supabase)) };
    if (cpfOk) signerObj.configs = { cpf: cpfRaw };

    const operations = {
      query: mutation,
      variables: {
        document: { name: documentName },
        signers: [signerObj],
        file: null,
      },
    };

    const formData = new FormData();
    formData.append("operations", JSON.stringify(operations));
    formData.append("map", JSON.stringify({ "0": ["variables.file"] }));
    formData.append("0", new Blob([htmlContent], { type: "text/html" }), `termo-evento-${sinistro.protocolo}.html`);

    console.log("[autentique-evento-create] Enviando para Autentique...");

    const autentiqueResponse = await fetch(AUTENTIQUE_API_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${autentiqueApiKey}` },
      body: formData,
    });

    const autentiqueData = await autentiqueResponse.json();
    console.log("[autentique-evento-create] Resposta:", JSON.stringify(autentiqueData, null, 2));

    if (autentiqueData.errors) {
      throw new Error(`Erro Autentique: ${JSON.stringify(autentiqueData.errors)}`);
    }

    const document = autentiqueData.data?.createDocument;
    if (!document) {
      throw new Error("Documento não foi criado no Autentique");
    }

    const signatureLink = document.signatures?.[0]?.link?.short_link;

    // 7. Atualizar sinistro
    await supabase
      .from("sinistros")
      .update({
        autentique_documento_id: document.id,
        autentique_url: signatureLink,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sinistroId);

    // 8. Registrar histórico
    await supabase.from("sinistro_historico").insert({
      sinistro_id: sinistroId,
      status_anterior: sinistro.status,
      status_novo: sinistro.status,
      observacao: `Termo de Entrada de Evento enviado para assinatura via Autentique`,
    });

    // Enviar link de assinatura via WhatsApp (fire-and-forget)
    try {
      const telefoneWpp = associado.whatsapp || associado.telefone;
      if (signatureLink && telefoneWpp) {
        const linkCode = signatureLink.replace('https://assina.ae/', '');
        const nomeDoc = `Termo de Entrada de Evento ${sinistro.protocolo}`;
        await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send-text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
          body: JSON.stringify({ telefone: telefoneWpp, template_name: 'assinatura_documento_v2', params: [associado.nome, nomeDoc], button_params: [linkCode] }),
        });
        console.log('[autentique-evento-create] WhatsApp assinatura enviado para', telefoneWpp);
      }
    } catch (whatsErr) {
      console.error('[autentique-evento-create] Erro ao enviar WhatsApp assinatura (não-fatal):', whatsErr);
    }

    console.log("[autentique-evento-create] ✓ Documento criado e sinistro atualizado");

    return new Response(
      JSON.stringify({
        success: true,
        documentId: document.id,
        signatureLink,
        message: "Termo de Entrada de Evento enviado para assinatura",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[autentique-evento-create] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
