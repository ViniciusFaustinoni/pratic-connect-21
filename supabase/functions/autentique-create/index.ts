import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AUTENTIQUE_API_URL = "https://api.autentique.com.br/v2/graphql";
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ContratoRequest {
  contratoId: string;
  clienteNome: string;
  clienteEmail: string;
  clienteCpf?: string;
  clienteTelefone?: string;
}

interface TemplateData {
  associado: Record<string, string>;
  veiculo: Record<string, string>;
  contrato: Record<string, string>;
  plano: Record<string, string>;
  empresa: Record<string, string>;
  sistema: Record<string, string>;
  [key: string]: Record<string, string>;
}

// ============= UTILIDADES =============

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
};

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return new Date().toLocaleDateString("pt-BR");
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR");
};

const formatCPF = (cpf: string | null | undefined): string => {
  if (!cpf) return "";
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

const formatPhone = (phone: string | null | undefined): string => {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return phone;
};

// ============= PROCESSAMENTO DE TEMPLATE =============

/**
 * Substitui variáveis {{grupo.campo}} no template pelos dados reais
 */
function processarVariaveis(conteudo: string, dados: TemplateData): string {
  return conteudo.replace(/\{\{(\w+)\.(\w+)\}\}/g, (match, grupo, campo) => {
    const valor = dados[grupo]?.[campo];
    return valor !== undefined && valor !== null ? String(valor) : "";
  });
}

/**
 * Converte Markdown simples para HTML
 */
function markdownToHtml(markdown: string): string {
  let html = markdown;
  
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');
  
  // Tables - processamento básico
  const lines = html.split('\n');
  let inTable = false;
  let tableHtml = '';
  const result: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableHtml = '<table class="values-table">';
      }
      
      // Check if separator row
      if (line.match(/^\|[\s\-|]+\|$/)) {
        continue; // Skip separator
      }
      
      const cells = line.split('|').filter(c => c.trim());
      const isHeader = i === 0 || (i > 0 && lines[i - 1]?.trim().startsWith('|') === false);
      
      tableHtml += '<tr>';
      cells.forEach((cell, idx) => {
        if (isHeader && idx < 2) {
          tableHtml += `<th>${cell.trim()}</th>`;
        } else {
          tableHtml += `<td>${cell.trim()}</td>`;
        }
      });
      tableHtml += '</tr>';
    } else {
      if (inTable) {
        tableHtml += '</table>';
        result.push(tableHtml);
        tableHtml = '';
        inTable = false;
      }
      
      // Lists
      if (line.startsWith('- ')) {
        result.push(`<li>${line.substring(2)}</li>`);
      } else if (line === '') {
        result.push('<br>');
      } else {
        result.push(`<p>${line}</p>`);
      }
    }
  }
  
  if (inTable) {
    tableHtml += '</table>';
    result.push(tableHtml);
  }
  
  return result.join('\n');
}

/**
 * Envolve o HTML com estilos para o PDF
 */
function wrapWithStyles(html: string): string {
  const styles = `
  <style>
    body {
      font-family: Arial, sans-serif;
      font-size: 12px;
      line-height: 1.6;
      color: #333;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      font-size: 24px;
      color: #1e40af;
      text-align: center;
      margin-bottom: 5px;
    }
    h2 {
      font-size: 16px;
      color: #1e40af;
      border-bottom: 2px solid #1e40af;
      padding-bottom: 5px;
      margin-top: 25px;
      margin-bottom: 15px;
    }
    h3 {
      font-size: 13px;
      color: #374151;
      margin-top: 15px;
      margin-bottom: 10px;
    }
    p {
      margin: 8px 0;
      text-align: justify;
    }
    hr {
      border: none;
      border-top: 1px solid #e5e7eb;
      margin: 20px 0;
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
      background-color: #f3f4f6;
      font-weight: bold;
    }
    .values-table tr:nth-child(even) {
      background-color: #f9fafb;
    }
    ul, ol {
      margin: 10px 0;
      padding-left: 25px;
    }
    li {
      margin: 5px 0;
    }
    strong {
      font-weight: bold;
    }
    .highlight-box {
      background-color: #eff6ff;
      border: 1px solid #1e40af;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
    }
    .signature-area {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 10px;
      color: #666;
    }
  </style>
  `;
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  ${styles}
</head>
<body>
  ${html}
</body>
</html>
  `;
}

/**
 * Processa um template do banco de dados
 */
function processarTemplateDB(conteudo: string, dados: TemplateData): string {
  // 1. Substituir variáveis
  const comVariaveis = processarVariaveis(conteudo, dados);
  
  // 2. Converter Markdown para HTML
  const htmlContent = markdownToHtml(comVariaveis);
  
  // 3. Envolver com estilos
  return wrapWithStyles(htmlContent);
}

// ============= TEMPLATES HARDCODED (FALLBACK) =============

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

const generateCoberturasDefault = () => `
  <div class="section">
    <h2>4. COBERTURAS CONTRATADAS</h2>
    <table class="coverage-table">
      <tr>
        <td><span class="coverage-check">✓</span> Roubo e Furto</td>
        <td>100% Tabela FIPE</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Assistência 24h</td>
        <td>Guincho até 100km</td>
      </tr>
      <tr>
        <td><span class="coverage-check">✓</span> Rastreamento Veicular</td>
        <td>Monitoramento 24h</td>
      </tr>
    </table>
    
    <div class="highlight-box">
      <strong>Franquia:</strong> Conforme tabela do plano contratado<br>
      <strong>Carência:</strong> 90 dias após instalação do rastreador
    </div>
  </div>
`;

const generateTermosDefault = () => `
  <div class="section terms">
    <h2>5. TERMOS E CONDIÇÕES GERAIS</h2>
    
    <h3>5.1 Objeto do Contrato</h3>
    <p>O presente contrato tem por objeto a prestação de serviços de proteção veicular, incluindo rastreamento, assistência 24 horas e coberturas conforme plano contratado.</p>
    
    <h3>5.2 Obrigações do Contratante</h3>
    <p>O CONTRATANTE se compromete a: (a) Manter os dados cadastrais atualizados; (b) Efetuar o pagamento das mensalidades até a data de vencimento; (c) Manter o dispositivo de rastreamento em perfeito funcionamento; (d) Comunicar imediatamente qualquer sinistro.</p>
    
    <h3>5.3 Carência</h3>
    <p>O período de carência para acionamento de coberturas é de 90 (noventa) dias a partir da instalação do rastreador no veículo.</p>
    
    <h3>5.4 Vigência e Rescisão</h3>
    <p>O contrato tem vigência de 12 (doze) meses, renovável automaticamente. A rescisão pode ser solicitada a qualquer momento, mediante aviso prévio de 30 dias.</p>
    
    <h3>5.5 Foro</h3>
    <p>Fica eleito o foro da comarca da sede da CONTRATADA para dirimir quaisquer controvérsias oriundas deste contrato.</p>
  </div>
`;

function generateTemplateFallback(data: ContratoTemplateData): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  ${generateStyles()}
</head>
<body>
  ${generateHeader(data)}
  ${generateDadosContratante(data)}
  ${generateDadosVeiculo(data)}
  ${generateValoresContrato(data)}
  ${generateCoberturasDefault()}
  ${generateTermosDefault()}
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

  try {
    const autentiqueApiKey = Deno.env.get("AUTENTIQUE_API_KEY");
    if (!autentiqueApiKey) {
      throw new Error("AUTENTIQUE_API_KEY não configurada");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Aceita ambos: contratoId ou contrato_id (compatibilidade com frontend)
    const body = await req.json();
    const contratoId = body.contratoId || body.contrato_id;
    const { clienteNome, clienteEmail, clienteCpf, clienteTelefone } = body;
    
    if (!contratoId) {
      throw new Error("contratoId ou contrato_id é obrigatório");
    }

    console.log("[autentique-create] Criando documento para contrato:", contratoId);

    // Buscar dados do contrato com plano e lead
    // Usando sintaxe explícita para resolver ambiguidade entre contratos/associados
    // (existem 2 FKs: contratos.associado_id -> associados.id E associados.contrato_id -> contratos.id)
    const { data: contrato, error: contratoError } = await supabase
      .from("contratos")
      .select(`
        *,
        planos (*),
        leads (*),
        associados:associados!fk_contratos_associado(*)
      `)
      .eq("id", contratoId)
      .single();

    if (contratoError || !contrato) {
      throw new Error(`Contrato não encontrado: ${contratoError?.message}`);
    }

    // PROTEÇÃO CONTRA DUPLICIDADE: Verificar se já existe documento Autentique para este contrato
    if (contrato.autentique_documento_id) {
      console.log(`[autentique-create] Contrato já possui documento Autentique: ${contrato.autentique_documento_id}`);
      
      return new Response(
        JSON.stringify({
          success: true,
          documentId: contrato.autentique_documento_id,
          signatureLink: contrato.autentique_url,
          message: "Documento existente retornado - contrato já foi enviado para assinatura",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[autentique-create] Nenhum documento existente, criando novo para contrato ${contratoId}`);

    // ============= BUSCAR TEMPLATE DO BANCO =============
    console.log("[autentique-create] Buscando template de contrato no banco...");
    
    const { data: templateDb, error: templateError } = await supabase
      .from("documento_templates")
      .select("*")
      .eq("codigo", "CONTRATO_ADESAO_V1")
      .eq("ativo", true)
      .single();

    let contratoHTML: string;
    let templateUsed: string;

    // Dados do associado (pode vir do lead ou do associado vinculado)
    const associado = contrato.associados || contrato.leads;
    
    // Montar endereço completo
    const montarEndereco = (obj: any): string => {
      if (!obj) return "";
      const partes = [
        obj.logradouro,
        obj.numero,
        obj.complemento,
        obj.bairro,
        obj.cidade,
        obj.uf,
        obj.cep
      ].filter(Boolean);
      return partes.join(", ");
    };

    // Buscar dados da empresa (configurações)
    const { data: empresaConfig } = await supabase
      .from("configuracoes")
      .select("*")
      .eq("chave", "empresa")
      .single();
    
    const empresa = empresaConfig?.valor || {};

    if (templateDb && !templateError) {
      console.log(`[autentique-create] Template encontrado: ${templateDb.nome} (v${templateDb.versao})`);
      templateUsed = `DB: ${templateDb.codigo} v${templateDb.versao}`;
      
      // Preparar dados para substituição de variáveis
      const dadosTemplate: TemplateData = {
        associado: {
          nome: clienteNome || contrato.cliente_nome || associado?.nome || "",
          cpf: formatCPF(clienteCpf || contrato.cliente_cpf || associado?.cpf),
          email: clienteEmail || contrato.cliente_email || associado?.email || "",
          telefone: formatPhone(clienteTelefone || contrato.cliente_telefone || associado?.telefone),
          whatsapp: formatPhone(associado?.whatsapp || associado?.telefone || ""),
          endereco_completo: montarEndereco(associado),
          logradouro: associado?.logradouro || "",
          numero: associado?.numero || "",
          complemento: associado?.complemento || "",
          bairro: associado?.bairro || "",
          cidade: associado?.cidade || "",
          uf: associado?.uf || "",
          cep: associado?.cep || "",
          rg: associado?.rg || "",
          data_nascimento: formatDate(associado?.data_nascimento),
        },
        veiculo: {
          marca: contrato.leads?.veiculo_marca || "",
          modelo: contrato.leads?.veiculo_modelo || "",
          placa: contrato.leads?.veiculo_placa || "",
          ano: String(contrato.leads?.veiculo_ano || ""),
          cor: contrato.leads?.veiculo_cor || "",
          chassi: contrato.leads?.veiculo_chassi || "",
          renavam: contrato.leads?.veiculo_renavam || "",
          valor_fipe: formatCurrency(contrato.leads?.veiculo_fipe),
          combustivel: contrato.leads?.veiculo_combustivel || "",
        },
        contrato: {
          numero: contrato.numero || "",
          valor_adesao: formatCurrency(contrato.valor_adesao),
          valor_mensal: formatCurrency(contrato.valor_mensal),
          dia_vencimento: String(contrato.dia_vencimento || 10),
          data_inicio: formatDate(contrato.data_inicio),
          data_fim: formatDate(contrato.data_fim),
          status: contrato.status || "",
        },
        plano: {
          nome: contrato.planos?.nome || "Plano Padrão",
          codigo: contrato.planos?.codigo || "",
          descricao: contrato.planos?.descricao || "",
          tipo_uso: contrato.planos?.tipo_uso || "particular",
          franquia: contrato.planos?.franquia || "Conforme tabela do plano",
          carencia: contrato.planos?.carencia || "90 dias após instalação",
          coberturas_html: contrato.planos?.coberturas_html || generateCoberturasDefault(),
        },
        empresa: {
          nome: empresa.nome || "Associação de Proteção Veicular",
          cnpj: empresa.cnpj || "",
          endereco_completo: montarEndereco(empresa),
          logradouro: empresa.logradouro || "",
          numero: empresa.numero || "",
          complemento: empresa.complemento || "",
          bairro: empresa.bairro || "",
          cidade: empresa.cidade || "",
          uf: empresa.uf || "",
          cep: empresa.cep || "",
          telefone: formatPhone(empresa.telefone),
          email: empresa.email || "",
          site: empresa.site || "",
        },
        sistema: {
          data_atual: formatDate(new Date().toISOString()),
          hora_atual: new Date().toLocaleTimeString("pt-BR"),
          ano_atual: String(new Date().getFullYear()),
        },
      };
      
      // Processar template do banco
      contratoHTML = processarTemplateDB(templateDb.conteudo, dadosTemplate);
    } else {
      // Fallback para template hardcoded
      console.log("[autentique-create] Template não encontrado no banco, usando fallback hardcoded");
      templateUsed = "Fallback (hardcoded)";
      
      const templateData: ContratoTemplateData = {
        numero: contrato.numero,
        clienteNome: clienteNome || contrato.cliente_nome || contrato.leads?.nome || "Cliente",
        clienteCpf: clienteCpf || contrato.cliente_cpf || contrato.leads?.cpf || "",
        clienteEmail: clienteEmail || contrato.cliente_email || contrato.leads?.email || "",
        clienteTelefone: clienteTelefone || contrato.cliente_telefone || contrato.leads?.telefone || "",
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
      
      contratoHTML = generateTemplateFallback(templateData);
    }

    console.log(`[autentique-create] Template usado: ${templateUsed}`);
    console.log(`[autentique-create] HTML gerado: ${contratoHTML.length} bytes`);

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

    // PRIORIZAR campos cliente_* do contrato (preenchidos quando não há lead)
    const signerName = clienteNome || contrato.cliente_nome || contrato.leads?.nome || contrato.associados?.nome;
    const signerEmail = clienteEmail || contrato.cliente_email || contrato.leads?.email || contrato.associados?.email;
    const documentName = `Contrato ${contrato.numero} - ${signerName || 'Cliente'} - ${contrato.planos?.nome || 'Plano'}`;
    
    console.log("[autentique-create] Dados do signatário:", { signerName, signerEmail });
    
    // Validar que temos dados mínimos do signatário
    if (!signerEmail && !signerName) {
      throw new Error("Dados do signatário não encontrados. Preencha nome e email do cliente no contrato.");
    }
    
    // Preparar operations JSON (com file: null como placeholder)
    const operations = {
      query: mutation,
      variables: {
        document: {
          name: documentName,
        },
        signers: [
          {
            name: signerName || undefined,
            email: signerEmail,
            action: "SIGN",
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
        file: null,
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

    console.log("[autentique-create] Enviando para Autentique via multipart/form-data...");
    console.log("[autentique-create] Document name:", documentName);
    console.log("[autentique-create] Signer email:", signerEmail);

    const autentiqueResponse = await fetch(AUTENTIQUE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${autentiqueApiKey}`,
      },
      body: formData,
    });

    const autentiqueData = await autentiqueResponse.json();
    
    console.log("[autentique-create] Resposta Autentique:", JSON.stringify(autentiqueData, null, 2));

    if (autentiqueData.errors) {
      throw new Error(`Erro Autentique: ${JSON.stringify(autentiqueData.errors)}`);
    }

    const document = autentiqueData.data?.createDocument;
    if (!document) {
      throw new Error("Documento não foi criado no Autentique");
    }

    // Obter link de assinatura
    const signatureLink = document.signatures?.[0]?.link?.short_link;

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
      .eq("id", contratoId);

    if (updateError) {
      console.error("[autentique-create] Erro ao atualizar contrato:", updateError);
    }

    // Registrar no histórico do contrato
    await supabase.from("contratos_historico").insert({
      contrato_id: contratoId,
      evento: "enviado_assinatura",
      descricao: `Contrato enviado para assinatura via Autentique`,
      dados: { 
        autentique_id: document.id, 
        link: signatureLink,
        template_usado: templateUsed
      },
    });

    // Registrar no histórico do lead
    if (contrato.lead_id) {
      await supabase.from("leads_historico").insert({
        lead_id: contrato.lead_id,
        acao: "contrato_enviado",
        descricao: `Contrato ${contrato.numero} (${contrato.planos?.nome}) enviado para assinatura via Autentique`,
        etapa_anterior: "contrato_enviado",
        etapa_nova: "contrato_enviado",
      });

      // Atualizar etapa do lead
      await supabase
        .from("leads")
        .update({ etapa: "contrato_enviado" })
        .eq("id", contrato.lead_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        documentId: document.id,
        signatureLink,
        templateUsed,
        message: "Contrato enviado para assinatura com sucesso",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[autentique-create] Erro:", error);
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
