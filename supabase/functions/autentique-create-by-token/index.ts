import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTENTIQUE_API_URL = "https://api.autentique.com.br/v2/graphql";
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ContratoTemplateData {
  numero: string;
  clienteNome: string;
  clienteCpf: string;
  clienteEmail: string;
  clienteTelefone: string;
  planoNome: string;
  planoCodigo: string;
  planoDescricao: string;
  tipoUso: string;
  valorAdesao: number;
  valorMensal: number;
  diaVencimento: number;
  dataInicio: string;
  veiculoMarca?: string;
  veiculoModelo?: string;
  veiculoPlaca?: string;
  veiculoAno?: number;
  valorFipe?: number;
}

// ============= UTILIDADES =============

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR");
};

// ============= SEÇÕES COMUNS =============

const generateStyles = () => `
  <style>
    body {
      font-family: Arial, sans-serif;
      font-size: 12px;
      line-height: 1.6;
      color: #333;
      padding: 40px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #1e40af;
      padding-bottom: 20px;
    }
    .header h1 {
      font-size: 24px;
      margin: 0;
      color: #1e40af;
    }
    .header .plano-badge {
      display: inline-block;
      background-color: #1e40af;
      color: white;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 12px;
      margin-top: 8px;
    }
    .header p {
      margin: 5px 0;
      color: #666;
    }
    .section {
      margin-bottom: 25px;
    }
    .section h2 {
      font-size: 14px;
      color: #1e40af;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 5px;
      margin-bottom: 15px;
    }
    .field {
      margin-bottom: 8px;
    }
    .field-label {
      font-weight: bold;
      display: inline-block;
      width: 150px;
    }
    .values-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    .values-table th, .values-table td {
      border: 1px solid #e5e7eb;
      padding: 10px;
      text-align: left;
    }
    .values-table th {
      background-color: #f9fafb;
    }
    .coverage-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    .coverage-table td {
      border: 1px solid #e5e7eb;
      padding: 8px 12px;
    }
    .coverage-table tr:nth-child(even) {
      background-color: #f9fafb;
    }
    .coverage-check {
      color: #16a34a;
      font-weight: bold;
    }
    .coverage-x {
      color: #dc2626;
    }
    .terms {
      font-size: 10px;
      text-align: justify;
    }
    .terms h3 {
      font-size: 12px;
      margin-top: 15px;
    }
    .signature-area {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
    .signature-line {
      margin-top: 60px;
      border-top: 1px solid #333;
      width: 300px;
      text-align: center;
      padding-top: 5px;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 10px;
      color: #666;
    }
    .highlight-box {
      background-color: #eff6ff;
      border: 1px solid #1e40af;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
    }
  </style>
`;

const generateHeader = (data: ContratoTemplateData) => `
  <div class="header">
    <h1>CONTRATO DE ADESÃO</h1>
    <span class="plano-badge">${data.planoNome.toUpperCase()}</span>
    <p><strong>Nº ${data.numero}</strong></p>
    <p>Data de Emissão: ${formatDate(new Date().toISOString())}</p>
  </div>
`;

const generateDadosContratante = (data: ContratoTemplateData) => `
  <div class="section">
    <h2>1. DADOS DO CONTRATANTE</h2>
    <div class="field">
      <span class="field-label">Nome Completo:</span>
      ${data.clienteNome}
    </div>
    <div class="field">
      <span class="field-label">CPF:</span>
      ${data.clienteCpf || "Não informado"}
    </div>
    <div class="field">
      <span class="field-label">Email:</span>
      ${data.clienteEmail}
    </div>
    <div class="field">
      <span class="field-label">Telefone:</span>
      ${data.clienteTelefone || "Não informado"}
    </div>
  </div>
`;

const generateDadosVeiculo = (data: ContratoTemplateData) => {
  if (!data.veiculoMarca) return "";
  
  return `
    <div class="section">
      <h2>2. DADOS DO VEÍCULO</h2>
      <div class="field">
        <span class="field-label">Marca/Modelo:</span>
        ${data.veiculoMarca} ${data.veiculoModelo || ""}
      </div>
      <div class="field">
        <span class="field-label">Placa:</span>
        ${data.veiculoPlaca || "Não informado"}
      </div>
      <div class="field">
        <span class="field-label">Ano:</span>
        ${data.veiculoAno || "Não informado"}
      </div>
      ${data.valorFipe ? `
      <div class="field">
        <span class="field-label">Valor FIPE:</span>
        ${formatCurrency(data.valorFipe)}
      </div>
      ` : ""}
    </div>
  `;
};

const generateValoresContrato = (data: ContratoTemplateData) => `
  <div class="section">
    <h2>3. VALORES DO CONTRATO</h2>
    <table class="values-table">
      <tr>
        <th>Descrição</th>
        <th>Valor</th>
      </tr>
      <tr>
        <td>Plano</td>
        <td>${data.planoNome}</td>
      </tr>
      <tr>
        <td>Taxa de Adesão</td>
        <td>${formatCurrency(data.valorAdesao)}</td>
      </tr>
      <tr>
        <td>Mensalidade</td>
        <td>${formatCurrency(data.valorMensal)}</td>
      </tr>
      <tr>
        <td>Dia de Vencimento</td>
        <td>Todo dia ${data.diaVencimento}</td>
      </tr>
      <tr>
        <td>Data de Início</td>
        <td>${formatDate(data.dataInicio)}</td>
      </tr>
    </table>
  </div>
`;

const generateAssinatura = (data: ContratoTemplateData) => `
  <div class="signature-area">
    <p>Ao assinar eletronicamente este documento, o CONTRATANTE declara estar ciente e de acordo com todas as condições estabelecidas neste contrato, incluindo as coberturas, carências e exclusões do plano ${data.planoNome}.</p>
    
    <div class="signature-line">
      ${data.clienteNome}<br>
      <small>Contratante</small>
    </div>
  </div>
`;

const generateFooter = () => `
  <div class="footer">
    <p>Documento gerado eletronicamente e assinado digitalmente via plataforma Autentique.</p>
    <p>Este contrato tem validade jurídica conforme Lei nº 14.063/2020.</p>
  </div>
`;

// ============= TEMPLATE PADRÃO =============

const generateCoberturasDefault = (data: ContratoTemplateData) => `
  <div class="section">
    <h2>4. COBERTURAS CONTRATADAS - ${data.planoNome.toUpperCase()}</h2>
    <table class="coverage-table">
      <tr>
        <td><span class="coverage-check">✓</span> Roubo e Furto</td>
        <td>100% Tabela FIPE</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Assistência 24h</td>
        <td>Guincho conforme plano</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Rastreamento Veicular</td>
        <td>Monitoramento 24h</td>
      </tr>
    </table>
    
    <div class="highlight-box">
      <strong>Franquia:</strong> Conforme condições do plano contratado<br>
      <strong>Carência:</strong> Conforme condições do plano contratado
    </div>
  </div>
`;

const generateTermosGerais = (data: ContratoTemplateData) => `
  <div class="section terms">
    <h2>5. TERMOS E CONDIÇÕES GERAIS</h2>
    
    <h3>5.1. Objeto do Contrato</h3>
    <p>O presente contrato tem por objeto a prestação de serviços de proteção veicular para o veículo descrito neste instrumento, conforme as coberturas do plano ${data.planoNome}.</p>
    
    <h3>5.2. Obrigações do Contratante</h3>
    <p>O CONTRATANTE se compromete a: manter os pagamentos em dia; permitir a instalação do rastreador; comunicar imediatamente qualquer sinistro; não utilizar o veículo para fins ilícitos.</p>
    
    <h3>5.3. Carência</h3>
    <p>O período de carência começa a contar a partir da data de instalação do equipamento rastreador no veículo.</p>
    
    <h3>5.4. Exclusões</h3>
    <p>Não estão cobertas: participação em competições; uso do veículo por pessoa não habilitada; embriaguez ou uso de substâncias; desgaste natural; danos estéticos.</p>
    
    <h3>5.5. Vigência</h3>
    <p>Este contrato tem vigência de 12 (doze) meses, renovável automaticamente por igual período.</p>
    
    <h3>5.6. Rescisão</h3>
    <p>Qualquer das partes pode rescindir o contrato mediante aviso prévio de 30 dias. A inadimplência por mais de 30 dias autoriza a suspensão imediata das coberturas.</p>
    
    <h3>5.7. Foro</h3>
    <p>Fica eleito o foro da comarca onde se localiza a sede da CONTRATADA para dirimir quaisquer questões oriundas deste contrato.</p>
  </div>
`;

function generateTemplateDefault(data: ContratoTemplateData): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Contrato de Adesão - ${data.numero}</title>
      ${generateStyles()}
    </head>
    <body>
      ${generateHeader(data)}
      ${generateDadosContratante(data)}
      ${generateDadosVeiculo(data)}
      ${generateValoresContrato(data)}
      ${generateCoberturasDefault(data)}
      ${generateTermosGerais(data)}
      ${generateAssinatura(data)}
      ${generateFooter()}
    </body>
    </html>
  `;
}

// ============= HANDLER PRINCIPAL =============

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Timing instrumentation
  const timings: Record<string, number | string> = {};
  const t0 = Date.now();

  try {
    const { contratoToken } = await req.json();

    if (!contratoToken) {
      console.error('[autentique-create-by-token] Token não fornecido');
      return new Response(
        JSON.stringify({ success: false, error: 'Token não fornecido', errorCode: 'TOKEN_MISSING' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar formato UUID antes de fazer query no banco
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(contratoToken)) {
      console.error('[autentique-create-by-token] Token com formato inválido:', contratoToken.substring(0, 20) + '...');
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido', errorCode: 'TOKEN_INVALID' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('[autentique-create-by-token] Processando token:', contratoToken.substring(0, 8) + '...');

    const autentiqueApiKey = Deno.env.get("AUTENTIQUE_API_KEY");
    if (!autentiqueApiKey) {
      throw new Error("AUTENTIQUE_API_KEY não configurada");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar contrato por link_token com embeds explícitos (evita erro de relacionamento ambíguo)
    const { data: contrato, error: contratoError } = await supabase
      .from("contratos")
      .select(`
        *,
        planos:plano_id (*),
        leads:lead_id (id, nome, email, telefone, cpf, veiculo_marca, veiculo_modelo, veiculo_placa, veiculo_ano, veiculo_fipe),
        associados:associado_id (id, nome, email, telefone, cpf)
      `)
      .eq("link_token", contratoToken)
      .single();

    timings.fetchContrato = Date.now() - t0;

    if (contratoError) {
      console.error('[autentique-create-by-token] Erro ao buscar contrato:', contratoError.message, contratoError.details);
      // Verificar se é erro de formato UUID
      if (contratoError.message?.includes('invalid input syntax for type uuid')) {
        return new Response(
          JSON.stringify({ success: false, error: 'Token inválido', errorCode: 'TOKEN_INVALID' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar contrato', errorCode: 'DATABASE_ERROR' }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!contrato) {
      console.error('[autentique-create-by-token] Contrato não encontrado para o token');
      return new Response(
        JSON.stringify({ success: false, error: 'Contrato não encontrado. O link pode ter expirado.', errorCode: 'CONTRACT_NOT_FOUND' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('[autentique-create-by-token] Contrato encontrado:', contrato.numero);
    console.log('[autentique-create-by-token] adesao_paga:', contrato.adesao_paga);
    console.log('[autentique-create-by-token] autentique_url:', contrato.autentique_url);

    // Validar regras de negócio
    if (!contrato.adesao_paga) {
      console.warn('[autentique-create-by-token] Adesão ainda não foi paga');
      return new Response(
        JSON.stringify({ success: false, error: 'Aguardando confirmação do pagamento', errorCode: 'PAYMENT_PENDING' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Se já existe autentique_url, retornar o link existente (evita duplicação)
    if (contrato.autentique_url) {
      console.log('[autentique-create-by-token] Link já existe, retornando:', contrato.autentique_url);
      return new Response(
        JSON.stringify({ 
          success: true, 
          signatureLink: contrato.autentique_url,
          message: 'Link já existe',
          timingsMs: timings
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obter dados do cliente (associado tem prioridade, depois lead)
    const cliente = contrato.associados || contrato.leads;
    const clienteNome = cliente?.nome || 'Cliente';
    const clienteEmail = cliente?.email || '';
    const clienteCpf = cliente?.cpf || '';
    const clienteTelefone = cliente?.telefone || '';

    if (!clienteEmail) {
      throw new Error('Email do cliente não encontrado');
    }

    // Preparar dados do template
    const templateData: ContratoTemplateData = {
      numero: contrato.numero,
      clienteNome,
      clienteCpf,
      clienteEmail,
      clienteTelefone,
      planoNome: contrato.planos?.nome || "Plano Padrão",
      planoCodigo: contrato.planos?.codigo || "",
      planoDescricao: contrato.planos?.descricao || "",
      tipoUso: contrato.planos?.tipo_uso || "particular",
      valorAdesao: contrato.valor_adesao,
      valorMensal: contrato.valor_mensal,
      diaVencimento: contrato.dia_vencimento || 10,
      dataInicio: contrato.data_inicio,
      veiculoMarca: contrato.leads?.veiculo_marca,
      veiculoModelo: contrato.leads?.veiculo_modelo,
      veiculoPlaca: contrato.leads?.veiculo_placa,
      veiculoAno: contrato.leads?.veiculo_ano,
      valorFipe: contrato.leads?.veiculo_fipe,
    };

    // Gerar HTML do contrato
    const contratoHTML = generateTemplateDefault(templateData);

    console.log('[autentique-create-by-token] HTML gerado, tamanho:', contratoHTML.length, 'bytes');

    // Criar documento no Autentique via GraphQL Multipart Request Spec
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
          refusable
          sortable
          created_at
          signatures {
            public_id
            name
            email
            created_at
            action { name }
            link { short_link }
            user { id name email }
          }
        }
      }
    `;

    timings.generateHtml = Date.now() - t0 - (timings.fetchContrato || 0);
    
    const documentName = `Contrato ${contrato.numero} - ${clienteNome} - ${contrato.planos?.nome || 'Plano'}`;
    
    // Preparar operations JSON (com file: null como placeholder)
    // Usando delivery_method: "DELIVERY_METHOD_LINK" para tentar obter o short_link direto
    const operations = {
      query: mutation,
      variables: {
        document: {
          name: documentName,
        },
        signers: [
          {
            name: clienteNome,
            email: clienteEmail,
            action: "SIGN",
            delivery_method: "DELIVERY_METHOD_LINK", // Força geração de link na criação
            positions: [
              {
                x: "65.0",
                y: "80.0",
                z: "1",
                element: "SIGNATURE",
              },
            ],
          },
        ],
        file: null, // Placeholder - será mapeado pelo FormData
      },
    };

    // Map indica onde o arquivo será injetado
    const map = {
      "0": ["variables.file"],
    };

    // Criar FormData seguindo GraphQL Multipart Request Spec
    const formData = new FormData();
    formData.append("operations", JSON.stringify(operations));
    formData.append("map", JSON.stringify(map));
    
    // Criar Blob do HTML e anexar ao FormData
    const htmlBlob = new Blob([contratoHTML], { type: "text/html" });
    formData.append("0", htmlBlob, `contrato-${contrato.numero}.html`);

    console.log("[autentique-create-by-token] Enviando para Autentique via multipart/form-data...");
    console.log("[autentique-create-by-token] Document name:", documentName);
    console.log("[autentique-create-by-token] Signer name:", clienteNome);
    console.log("[autentique-create-by-token] Signer email:", clienteEmail);

    const autentiqueResponse = await fetch(AUTENTIQUE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${autentiqueApiKey}`,
        // NÃO definir Content-Type - FormData define automaticamente com boundary
      },
      body: formData,
    });

    const autentiqueData = await autentiqueResponse.json();
    
    timings.createDocument = Date.now() - t0 - (timings.fetchContrato || 0) - (timings.generateHtml || 0);
    
    console.log("[autentique-create-by-token] Resposta Autentique:", JSON.stringify(autentiqueData, null, 2));

    // Tratamento de erros específicos do Autentique
    if (autentiqueData.errors) {
      const errorMsg = autentiqueData.errors[0]?.message || 'unknown_error';
      console.error("[autentique-create-by-token] Erro do Autentique:", errorMsg);
      
      // Mapear códigos de erro conhecidos
      let errorCode = 'AUTENTIQUE_ERROR';
      let userMessage = 'Erro no serviço de assinatura. Tente novamente.';
      
      if (errorMsg === 'unavailable_credits' || errorMsg.includes('credits')) {
        errorCode = 'UNAVAILABLE_CREDITS';
        userMessage = 'Serviço de assinatura indisponível no momento. Nossa equipe foi notificada.';
      } else if (errorMsg === 'unauthorized' || errorMsg.includes('token') || errorMsg.includes('auth')) {
        errorCode = 'AUTENTIQUE_UNAUTHORIZED';
        userMessage = 'Configuração do serviço de assinatura inválida. Contate o suporte.';
      } else if (autentiqueData.validation) {
        errorCode = 'AUTENTIQUE_VALIDATION';
        userMessage = 'Dados incompletos para assinatura. Contate o vendedor.';
      }
      
      // Registrar erro no histórico do contrato
      await supabase.from('contratos_historico').insert({
        contrato_id: contrato.id,
        tipo: 'erro_autentique',
        descricao: `Erro ao criar documento: ${errorCode}`,
        dados: { error_code: errorCode, raw: autentiqueData }
      });
      
      // Retornar erro tratado (HTTP 200 com success: false)
      return new Response(JSON.stringify({
        success: false,
        error: userMessage,
        error_code: errorCode,
        timings
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      });
    }

    const document = autentiqueData.data?.createDocument;
    if (!document) {
      throw new Error("Documento não foi criado no Autentique");
    }

    console.log("[autentique-create-by-token] Documento criado com ID:", document.id);

    // Encontrar a assinatura do cliente (action = SIGN)
    const signerSignature = document.signatures?.find(
      (sig: any) => sig.action?.name === "SIGN"
    );

    if (!signerSignature || !signerSignature.public_id) {
      console.error("[autentique-create-by-token] Assinatura não encontrada:", document.signatures);
      throw new Error("Assinatura do cliente não encontrada no documento");
    }

    console.log("[autentique-create-by-token] Public ID da assinatura:", signerSignature.public_id);

    // Tentar obter o link diretamente da resposta do createDocument (otimização)
    let signatureLink = signerSignature.link?.short_link;
    
    if (signatureLink) {
      console.log("[autentique-create-by-token] Link obtido diretamente do createDocument:", signatureLink);
      timings.getLinkMethod = 'direct';
    } else {
      // Fallback: chamar createLinkToSignature se o link não veio na resposta inicial
      console.log("[autentique-create-by-token] Link não veio na resposta, chamando createLinkToSignature...");
      
      const linkMutation = `
        mutation {
          createLinkToSignature(public_id: "${signerSignature.public_id}") {
            short_link
          }
        }
      `;

      const linkResponse = await fetch(AUTENTIQUE_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${autentiqueApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: linkMutation }),
      });

      const linkData = await linkResponse.json();
      
      timings.createLinkToSignature = Date.now() - t0 - (timings.fetchContrato || 0) - (timings.generateHtml || 0) - (timings.createDocument || 0);
      
      console.log("[autentique-create-by-token] Resposta createLinkToSignature:", JSON.stringify(linkData, null, 2));

      if (linkData.errors) {
        console.error("[autentique-create-by-token] Erro ao obter link:", linkData.errors);
        throw new Error(`Erro ao obter link de assinatura: ${JSON.stringify(linkData.errors)}`);
      }

      signatureLink = linkData.data?.createLinkToSignature?.short_link;
      timings.getLinkMethod = 'createLinkToSignature';
    }

    if (!signatureLink) {
      throw new Error("Link de assinatura não foi retornado pelo Autentique");
    }

    console.log("[autentique-create-by-token] Link de assinatura obtido:", signatureLink);

    // Atualizar contrato com dados do Autentique
    const { error: updateError } = await supabase
      .from("contratos")
      .update({
        autentique_documento_id: document.id,
        autentique_url: signatureLink,
        autentique_status: "pending",
        status: "pendente_assinatura",
        data_envio: new Date().toISOString(),
      })
      .eq("id", contrato.id);

    if (updateError) {
      console.error("[autentique-create-by-token] Erro ao atualizar contrato:", updateError);
      throw new Error(`Erro ao atualizar contrato: ${updateError.message}`);
    }

    // Registrar no histórico do contrato
    await supabase.from("contratos_historico").insert({
      contrato_id: contrato.id,
      evento: "enviado_assinatura",
      descricao: `Contrato enviado para assinatura via link público`,
      dados: { 
        autentique_id: document.id, 
        link: signatureLink 
      },
    });

    // Registrar no histórico do lead se existir
    if (contrato.lead_id) {
      await supabase.from("leads_historico").insert({
        lead_id: contrato.lead_id,
        acao: "contrato_enviado",
        descricao: `Contrato ${contrato.numero} (${contrato.planos?.nome}) enviado para assinatura via link público`,
        etapa_anterior: "contrato_enviado",
        etapa_nova: "contrato_enviado",
      });

      // Atualizar etapa do lead
      await supabase
        .from("leads")
        .update({ etapa: "contrato_enviado" })
        .eq("id", contrato.lead_id);
    }

    timings.updateDb = Date.now() - t0 - Number(timings.fetchContrato || 0) - Number(timings.generateHtml || 0) - Number(timings.createDocument || 0) - Number(timings.createLinkToSignature || 0);
    timings.total = Date.now() - t0;
    
    console.log("[autentique-create-by-token] Sucesso! Documento criado:", document.id);
    console.log("[autentique-create-by-token] Timings (ms):", JSON.stringify(timings));

    return new Response(
      JSON.stringify({
        success: true,
        documentId: document.id,
        signatureLink,
        message: "Contrato enviado para assinatura com sucesso",
        timingsMs: timings,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[autentique-create-by-token] Erro:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
