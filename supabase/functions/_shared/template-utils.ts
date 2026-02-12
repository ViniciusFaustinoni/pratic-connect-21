// ============================================
// TEMPLATE UTILS - Substituição de Variáveis e Geração HTML
// ============================================

import {
  TermoAfiliacaoData,
  formatCPF,
  formatPhone,
  formatCEP,
  formatCurrency,
  formatDate,
  formatDateExtended,
  calcularCotaParticipacao,
  calcularPrimeiraMensalidade,
} from "./termo-afiliacao-utils.ts";

// ============= MAPEAMENTO DE VARIÁVEIS =============

/**
 * Cria o mapeamento de variáveis disponíveis com seus valores
 */
export function criarMapeamentoVariaveis(dados: TermoAfiliacaoData): Record<string, string> {
  const dataAtual = new Date().toISOString();
  const cotaParticipacao = calcularCotaParticipacao(dados.veiculo.valor_fipe, dados.plano.cota_participacao);
  const primeiraMensalidade = calcularPrimeiraMensalidade(dados.contrato.dia_vencimento);
  
  return {
    // Contrato
    'contrato.numero': dados.contrato.numero || '—',
    'contrato.data_inicio': formatDate(dados.contrato.data_inicio) || formatDate(dataAtual),
    'contrato.dia_vencimento': String(dados.contrato.dia_vencimento || 10),
    'contrato.valor_adesao': formatCurrency(dados.contrato.valor_adesao),
    'contrato.valor_mensal': formatCurrency(dados.contrato.valor_mensal),
    'contrato.forma_pagamento': dados.contrato.forma_pagamento || 'Boleto Bancário',
    'contrato.primeira_mensalidade': primeiraMensalidade,
    
    // Associado/Cliente
    'associado.nome': dados.cliente.nome || '—',
    'associado.cpf': formatCPF(dados.cliente.cpf) || '—',
    'associado.rg': dados.cliente.rg || '—',
    'associado.rg_orgao': dados.cliente.rg_orgao || '',
    'associado.data_nascimento': formatDate(dados.cliente.data_nascimento),
    'associado.email': dados.cliente.email || '—',
    'associado.telefone': formatPhone(dados.cliente.telefone),
    'associado.telefone_secundario': dados.cliente.telefone_secundario ? formatPhone(dados.cliente.telefone_secundario) : '—',
    'associado.logradouro': dados.cliente.logradouro || '—',
    'associado.numero': dados.cliente.numero || '—',
    'associado.complemento': dados.cliente.complemento || '',
    'associado.bairro': dados.cliente.bairro || '—',
    'associado.cidade': dados.cliente.cidade || '—',
    'associado.uf': dados.cliente.uf || '—',
    'associado.cep': formatCEP(dados.cliente.cep),
    'associado.estado_civil': dados.cliente.estado_civil || '—',
    'associado.profissao': dados.cliente.profissao || '—',
    'associado.endereco_completo': `${dados.cliente.logradouro || ''}, ${dados.cliente.numero || ''}${dados.cliente.complemento ? ', ' + dados.cliente.complemento : ''} - ${dados.cliente.bairro || ''} - ${dados.cliente.cidade || ''}/${dados.cliente.uf || ''} - CEP ${formatCEP(dados.cliente.cep)}`,
    
    // Veículo
    'veiculo.marca': dados.veiculo.marca || '—',
    'veiculo.modelo': dados.veiculo.modelo || '—',
    'veiculo.placa': dados.veiculo.placa || 'ZERO QUILÔMETRO',
    'veiculo.chassi': dados.veiculo.chassi || '—',
    'veiculo.renavam': dados.veiculo.renavam || '—',
    'veiculo.ano': String(dados.veiculo.ano || '—'),
    'veiculo.ano_fabricacao': String(dados.veiculo.ano_fabricacao || dados.veiculo.ano || '—'),
    'veiculo.cor': dados.veiculo.cor || '—',
    'veiculo.combustivel': dados.veiculo.combustivel || '—',
    'veiculo.categoria': dados.veiculo.categoria || 'Automóvel',
    'veiculo.tipo_uso': dados.veiculo.tipo_uso || 'Particular',
    'veiculo.codigo_fipe': dados.veiculo.codigo_fipe || '—',
    'veiculo.valor_fipe': formatCurrency(dados.veiculo.valor_fipe),
    'veiculo.alienado': dados.veiculo.alienado ? 'Sim' : 'Não',
    'veiculo.financeira': dados.veiculo.financeira || '—',
    'veiculo.procedencia': dados.veiculo.procedencia || 'Usado de particular',
    
    // Plano
    'plano.nome': dados.plano.nome || '—',
    'plano.tipo': dados.plano.tipo || dados.plano.linha || 'Normal',
    'plano.linha': dados.plano.linha || '—',
    'plano.coberturas': (dados.plano.coberturas || []).join(', ') || 'Roubo e Furto, Assistência 24 horas',
    'plano.cota_participacao': `${dados.plano.cota_participacao || 10}%`,
    'plano.cota_participacao_valor': formatCurrency(cotaParticipacao),
    'plano.cota_minima': formatCurrency(dados.plano.cota_minima || 3000),
    
    // Empresa
    'empresa.nome': dados.empresa.nome || 'ASSOCIAÇÃO DE BENEFÍCIOS PRATICCAR',
    'empresa.cnpj': dados.empresa.cnpj || '—',
    'empresa.logradouro': dados.empresa.logradouro || '—',
    'empresa.numero': dados.empresa.numero || '—',
    'empresa.bairro': dados.empresa.bairro || '—',
    'empresa.cidade': dados.empresa.cidade || '—',
    'empresa.uf': dados.empresa.uf || '—',
    'empresa.cep': dados.empresa.cep || '—',
    'empresa.endereco': `${dados.empresa.logradouro || ''}, ${dados.empresa.numero || ''} - ${dados.empresa.bairro || ''} - ${dados.empresa.cidade || ''}/${dados.empresa.uf || ''} - CEP ${dados.empresa.cep || ''}`,
    'empresa.lgpd_email': dados.empresa.lgpd_email || 'lgpd@praticcar.com.br',
    
    // Sistema
    'sistema.data_atual': formatDate(dataAtual),
    'sistema.data_extenso': formatDateExtended(dataAtual),
  };
}

/**
 * Substitui todas as variáveis {{...}} no conteúdo
 */
export function substituirVariaveis(conteudo: string, dados: TermoAfiliacaoData): string {
  const mapeamento = criarMapeamentoVariaveis(dados);
  let resultado = conteudo;
  
  // Substituir todas as ocorrências de {{variavel}}
  for (const [chave, valor] of Object.entries(mapeamento)) {
    resultado = resultado.replace(
      new RegExp(`\\{\\{\\s*${chave.replace('.', '\\.')}\\s*\\}\\}`, 'gi'),
      valor || '—'
    );
  }
  
  return resultado;
}

// ============= ESTILOS CSS PADRÃO =============

export const generateStyles = (): string => `
<style>
  @page {
    size: A4;
    margin: 20mm;
  }
  
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    line-height: 1.15;
    color: #333333;
    background: #ffffff;
  }
  
  .page {
    max-width: 210mm;
    margin: 0 auto;
  }
  
  /* CABEÇALHO */
  .header {
    text-align: center;
    margin-bottom: 20pt;
    padding-bottom: 10pt;
    border-bottom: 2px solid #1e40af;
  }
  
  .header-logo {
    font-size: 18pt;
    font-weight: bold;
    color: #1e40af;
    margin-bottom: 6pt;
  }
  
  .header-empresa {
    font-size: 9pt;
    color: #666666;
    margin-bottom: 4pt;
  }
  
  .header-titulo {
    font-size: 16pt;
    font-weight: bold;
    color: #1e40af;
    margin-top: 12pt;
    margin-bottom: 4pt;
  }
  
  .header-numero {
    font-size: 11pt;
    font-weight: bold;
  }
  
  /* SEÇÕES */
  .section {
    margin-bottom: 16pt;
    page-break-inside: avoid;
  }
  
  .section-title {
    font-size: 12pt;
    font-weight: bold;
    color: #1e40af;
    margin-bottom: 10pt;
    padding-bottom: 4pt;
    border-bottom: 1px solid #e5e7eb;
  }
  
  .section-subtitle {
    font-size: 10pt;
    font-weight: bold;
    color: #374151;
    margin-top: 10pt;
    margin-bottom: 6pt;
  }
  
  /* CAMPOS */
  .field-row {
    display: flex;
    flex-wrap: wrap;
    margin-bottom: 6pt;
  }
  
  .field {
    margin-right: 20pt;
    margin-bottom: 4pt;
  }
  
  .field-label {
    font-weight: bold;
    display: inline;
  }
  
  .field-value {
    display: inline;
  }
  
  .field-full {
    width: 100%;
    margin-bottom: 6pt;
  }
  
  /* TABELAS */
  .table-valores {
    width: 100%;
    border-collapse: collapse;
    margin: 12pt 0;
    font-size: 10pt;
  }
  
  .table-valores td {
    padding: 8pt 10pt;
    border: 1px solid #d1d5db;
  }
  
  .table-valores td:first-child {
    background-color: #f9fafb;
    font-weight: normal;
    width: 60%;
  }
  
  .table-valores td:last-child {
    text-align: right;
    font-weight: bold;
  }
  
  .table-valores .header-row td {
    background-color: #1e40af;
    color: white;
    font-weight: bold;
    text-align: center;
  }
  
  /* COBERTURAS */
  .cobertura-list {
    margin: 10pt 0;
  }
  
  .cobertura-item {
    font-family: 'Courier New', monospace;
    font-size: 10pt;
    margin-bottom: 4pt;
    padding-left: 5pt;
  }
  
  .cobertura-check {
    color: #16a34a;
    font-weight: bold;
  }
  
  /* DECLARAÇÕES */
  .declaracao {
    margin-bottom: 12pt;
    text-align: justify;
  }
  
  .declaracao-titulo {
    font-weight: bold;
    margin-bottom: 4pt;
  }
  
  .declaracao-texto {
    font-size: 9pt;
    line-height: 1.4;
  }
  
  /* DESTAQUE */
  .highlight-box {
    background-color: #eff6ff;
    border: 1px solid #1e40af;
    border-radius: 4pt;
    padding: 10pt;
    margin: 10pt 0;
  }
  
  .nota-rodape {
    font-size: 8pt;
    color: #666666;
    font-style: italic;
    margin-top: 8pt;
  }
  
  /* ASSINATURA */
  .signature-area {
    margin-top: 40pt;
    padding-top: 20pt;
    border-top: 1px solid #e5e7eb;
    page-break-inside: avoid;
  }
  
  .signature-local-data {
    text-align: center;
    margin-bottom: 50pt;
    font-size: 10pt;
  }
  
  .signature-block {
    display: inline-block;
    width: 45%;
    text-align: center;
    vertical-align: top;
  }
  
  .signature-line {
    border-top: 1px solid #333333;
    width: 280px;
    margin: 0 auto;
    padding-top: 6pt;
    font-size: 9pt;
  }
  
  .signature-name {
    font-weight: bold;
    font-size: 10pt;
  }
  
  .signature-doc {
    font-size: 8pt;
    color: #666666;
  }
  
  .signature-role {
    font-size: 9pt;
    color: #374151;
  }
  
  /* RODAPÉ */
  .footer {
    margin-top: 30pt;
    text-align: center;
    font-size: 8pt;
    color: #666666;
    border-top: 1px solid #e5e7eb;
    padding-top: 10pt;
  }
  
  /* PÁGINA */
  .page-break {
    page-break-after: always;
  }
  
  /* MARKDOWN CONVERTED */
  h1, h2, h3, h4, h5, h6 {
    margin-top: 16pt;
    margin-bottom: 8pt;
  }
  
  h1 { font-size: 16pt; color: #1e40af; }
  h2 { font-size: 14pt; color: #1e40af; }
  h3 { font-size: 12pt; color: #374151; }
  
  p {
    margin-bottom: 8pt;
    text-align: justify;
  }
  
  ul, ol {
    margin-left: 20pt;
    margin-bottom: 8pt;
  }
  
  li {
    margin-bottom: 4pt;
  }
  
  strong, b {
    font-weight: bold;
  }
  
  em, i {
    font-style: italic;
  }
</style>
`;

// ============= CABEÇALHO =============

export function generateHeader(dados: TermoAfiliacaoData): string {
  return `
<div class="header">
  <div class="header-logo">ABP PRATICCAR</div>
  <div class="header-empresa">
    ASSOCIAÇÃO DE BENEFÍCIOS PRATICCAR<br>
    CNPJ: ${dados.empresa.cnpj}<br>
    ${dados.empresa.logradouro}, ${dados.empresa.numero} - ${dados.empresa.bairro}<br>
    ${dados.empresa.cidade}/${dados.empresa.uf} - CEP ${dados.empresa.cep}
  </div>
  <div class="header-titulo">TERMO DE AFILIAÇÃO AO PROGRAMA DE SOCORRO MÚTUO</div>
  <div class="header-numero">Nº ${dados.contrato.numero}</div>
</div>
`;
}

// ============= RODAPÉ =============

export function generateFooter(dados: TermoAfiliacaoData): string {
  return `
<div class="footer">
  ABP PraticCar | Termo de Afiliação Nº ${dados.contrato.numero}
</div>
`;
}

// ============= SEÇÃO ASSINATURA =============

export function generateSecaoAssinatura(dados: TermoAfiliacaoData): string {
  const localAssinatura = `${dados.cliente.cidade}/${dados.cliente.uf}`;
  const dataAssinatura = formatDateExtended(new Date().toISOString());
  
  return `
<div class="signature-area">
  <h2 class="section-title">ASSINATURA</h2>
  
  <p class="signature-local-data">
    ${localAssinatura}, ${dataAssinatura}
  </p>
  
  <div style="text-align: center;">
    <div class="signature-block">
      <div class="signature-line">
        <p class="signature-name">${dados.cliente.nome}</p>
        <p class="signature-doc">CPF: ${formatCPF(dados.cliente.cpf)}</p>
        <p class="signature-role">ASSOCIADO</p>
      </div>
    </div>
    
    <div class="signature-block" style="margin-left: 40pt;">
      <div class="signature-line">
        <p class="signature-name">ASSOCIAÇÃO DE BENEFÍCIOS PRATICCAR</p>
        <p class="signature-doc">CNPJ: ${dados.empresa.cnpj}</p>
        <p class="signature-role">ABP PRATICCAR</p>
      </div>
    </div>
  </div>
</div>
`;
}

// ============= MARKDOWN PARA HTML =============

/**
 * Converte markdown básico para HTML
 */
export function markdownParaHTML(markdown: string): string {
  let html = markdown;
  
  // Headers
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="section-title">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Bold e Italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // Listas não ordenadas
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
  
  // Listas ordenadas
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  
  // Parágrafos
  html = html.replace(/^([^<\n].+)$/gm, '<p>$1</p>');
  
  // Limpar linhas vazias duplicadas
  html = html.replace(/\n{3,}/g, '\n\n');
  
  // Envolver em div de seção
  html = `<div class="section">${html}</div>`;
  
  return html;
}

// ============= VERIFICAÇÕES CONDICIONAIS =============

/**
 * Verifica se é veículo zero km
 */
export function ehVeiculoZeroKm(veiculo: any): boolean {
  return (
    !veiculo.placa || 
    veiculo.placa === '' || 
    veiculo.placa.startsWith('000') ||
    veiculo.procedencia === 'Novo (zero km)'
  );
}

/**
 * Verifica se rastreador é obrigatório
 */
export function exigeRastreador(veiculo: any): { exige: boolean; motivo: string | null } {
  if (veiculo.combustivel?.toLowerCase() === 'diesel') {
    return { exige: true, motivo: 'Veículo a diesel' };
  }
  
  const valorFipe = veiculo.valor_fipe || 0;
  const categoria = (veiculo.categoria || '').toLowerCase();
  const isMoto = categoria.includes('moto') || categoria.includes('ciclomotor');
  
  if (isMoto && valorFipe > 9000) {
    return { exige: true, motivo: `Valor FIPE acima de R$ 9.000` };
  }
  
  if (!isMoto && valorFipe > 20000) {
    return { exige: true, motivo: `Valor FIPE acima de R$ 20.000` };
  }
  
  return { exige: false, motivo: null };
}

// ============= ADITIVOS DINÂMICOS =============

interface RegraAditivo {
  tipo: string;
  ativo: boolean;
  valor_config?: string;
}

interface TermoAditivo {
  id: string;
  nome: string;
  conteudo_html: string | null;
  regras: RegraAditivo[];
  ordem: number;
}

function avaliarRegraEdge(regra: RegraAditivo, veiculo: any, fipeLimite: number): boolean {
  if (!regra.ativo) return false;

  switch (regra.tipo) {
    case 'veiculo_0km':
      return ehVeiculoZeroKm(veiculo);
    
    case 'veiculo_blindado': {
      const obs = (veiculo.observacoes || '').toLowerCase();
      return obs.includes('blindad') || obs.includes('blindagem');
    }
    
    case 'fipe_acima_de':
      return (veiculo.valor_fipe || 0) >= fipeLimite;
    
    default:
      return false;
  }
}

/**
 * Busca aditivos ativos do banco, avalia regras contra dados do veículo,
 * e retorna o HTML concatenado dos aditivos aplicáveis (com variáveis substituídas).
 */
export async function buscarEGerarAditivos(
  supabase: any,
  dadosVeiculo: any,
  dadosTemplate: any
): Promise<string> {
  // 1. Buscar aditivos ativos ordenados
  const { data: aditivos, error: aditivosError } = await supabase
    .from('termos_aditivos')
    .select('id, nome, conteudo_html, regras, ordem')
    .eq('ativo', true)
    .order('ordem', { ascending: true });

  if (aditivosError || !aditivos || aditivos.length === 0) {
    console.log('[template-utils] Nenhum aditivo ativo encontrado:', aditivosError?.message);
    return '';
  }

  // 2. Buscar limite FIPE das configurações
  const { data: configData } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('chave', 'aditivo_fipe_limite')
    .maybeSingle();

  const fipeLimite = configData ? Number(configData.valor) : 100000;

  // 3. Avaliar regras e filtrar aditivos aplicáveis
  const aditivosAplicaveis: TermoAditivo[] = [];

  for (const aditivo of aditivos) {
    const regras = (aditivo.regras || []) as RegraAditivo[];
    
    // Se não tem regras, não anexa automaticamente
    if (regras.length === 0) continue;
    
    const algumaRegraBate = regras.some(r => avaliarRegraEdge(r, dadosVeiculo, fipeLimite));
    if (algumaRegraBate) {
      aditivosAplicaveis.push(aditivo);
    }
  }

  if (aditivosAplicaveis.length === 0) {
    console.log('[template-utils] Nenhum aditivo aplicável para este veículo');
    return '';
  }

  console.log(`[template-utils] ${aditivosAplicaveis.length} aditivo(s) aplicável(is):`, 
    aditivosAplicaveis.map(a => a.nome).join(', '));

  // 4. Gerar HTML dos aditivos aplicáveis
  let htmlFinal = '';

  for (const aditivo of aditivosAplicaveis) {
    let conteudo = aditivo.conteudo_html || '';
    
    // Substituir variáveis no conteúdo do aditivo
    if (conteudo && dadosTemplate) {
      conteudo = substituirVariaveis(conteudo, dadosTemplate);
    }

    htmlFinal += `
<div class="section page-break" style="margin-top: 30pt; border: 2px solid #1e40af; padding: 15pt; border-radius: 4pt;">
  <h2 class="section-title" style="color: #1e40af;">
    ${aditivo.nome}
  </h2>
  <p style="text-align: center; font-size: 9pt; color: #666; margin-bottom: 15pt;">
    (Anexo ao Termo de Afiliação)
  </p>
  ${conteudo}
  <div style="margin-top: 40pt; text-align: center;">
    <p>Local: _________________ Data: ____/____/____</p>
    <div style="margin-top: 30pt;">
      <p>_________________________________________</p>
      <p style="font-size: 9pt;">Assinatura do Associado</p>
    </div>
  </div>
</div>
`;
  }

  return htmlFinal;
}
