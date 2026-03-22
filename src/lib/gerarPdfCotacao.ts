// PDF Premium - PRATICCAR
import { jsPDF, GState } from 'jspdf';
import { supabase } from '@/integrations/supabase/client';

// ============= Interface de configuração do PDF =============
export interface PdfConfig {
  cor_primaria: string;
  cor_secundaria: string;
  logo_url: string | null;
  nome_empresa: string;
  mensagem_encerramento: string;
  mostrar_validade: boolean;
  mostrar_dados_solicitante: boolean;
  mostrar_dados_veiculo: boolean;
  mostrar_mensagem_encerramento: boolean;
  mostrar_whatsapp_rodape: boolean;
}

// Buscar configuração do banco (retorna null se não houver registro)
async function carregarConfigPdf(): Promise<PdfConfig | null> {
  try {
    const { data } = await supabase
      .from('cotacao_pdf_config')
      .select('cor_primaria, cor_secundaria, logo_url, nome_empresa, mensagem_encerramento, mostrar_validade, mostrar_dados_solicitante, mostrar_dados_veiculo, mostrar_mensagem_encerramento, mostrar_whatsapp_rodape')
      .limit(1)
      .maybeSingle();
    return data as PdfConfig | null;
  } catch {
    console.warn('Erro ao carregar config do PDF, usando defaults');
    return null;
  }
}

// Converter hex para RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

export interface CotacaoParaPdf {
  numero: string | null;
  valor_fipe: number | null;
  valor_adesao: number | null;
  valor_total_mensal: number | null;
  valor_cota: number | null;
  taxa_administrativa: number | null;
  valor_rastreamento: number | null;
  valor_assistencia: number | null;
  veiculo_marca: string | null;
  veiculo_modelo: string | null;
  veiculo_ano: number | null;
  veiculo_placa: string | null;
  codigo_fipe: string | null;
  created_at: string;
  validade_dias: number | null;
  dia_vencimento?: number | null;
  nome_solicitante?: string | null;
  telefone1_solicitante?: string | null;
  email_solicitante?: string | null;
  leads?: {
    nome: string;
    telefone: string;
    email?: string | null;
  } | null;
  planos?: {
    nome: string;
    coberturas?: string[] | null;
  } | null;
}

export interface PlanoParaPdf {
  nome: string;
  valorMensal: number;
  valorAdesao: number;
  coberturas: string[];
  naoInclui: string[];
  coberturaFipe: number;
  cota: string;
  cotaPercentual?: number;
  cotaMinima?: number;
  cotaDesagio?: number;
  cotaMinimaDesagio?: number;
  adicionalMensal?: number;
  anoMinimo?: number;
  alertaDesagio?: string;
  coberturasRemovidas?: string[];
}

export interface CotacaoComparativaParaPdf {
  numero: string | null;
  created_at: string;
  validade_dias: number | null;
  dia_vencimento?: number | null;
  nome_solicitante?: string | null;
  telefone1_solicitante?: string | null;
  email_solicitante?: string | null;
  veiculo_marca: string | null;
  veiculo_modelo: string | null;
  veiculo_ano: number | null;
  veiculo_placa: string | null;
  valor_fipe: number | null;
  planosComparar: PlanoParaPdf[];
  vendedor?: {
    nome: string;
    whatsapp?: string | null;
  } | null;
}

// ============= PALETA DE CORES PREMIUM =============
const brandBlueDefault = { r: 20, g: 55, b: 110 };
const brandRedDefault = { r: 200, g: 30, b: 65 };

const bodyBg = { r: 30, g: 41, b: 59 };
const cardBg = { r: 30, g: 41, b: 59 };
const cardBorder = { r: 51, g: 65, b: 85 };
const sectionHeaderBg = { r: 51, g: 65, b: 85 };
const stripeBg = { r: 40, g: 52, b: 70 };
const glowBlue = { r: 59, g: 130, b: 246 };
const glowRed = { r: 239, g: 68, b: 68 };

const textWhite = { r: 255, g: 255, b: 255 };
const textDark = { r: 30, g: 41, b: 59 };
const textDarkMuted = { r: 100, g: 116, b: 139 };
const textMuted = { r: 148, g: 163, b: 184 };
const textLight = { r: 226, g: 232, b: 240 };
const successGreen = { r: 34, g: 197, b: 94 };
const warningYellow = { r: 234, g: 179, b: 8 };

const headerFooterBg = { r: 245, g: 247, b: 250 };

const SECTION_GAP = 8;
const INNER_GAP = 5;
const HEADER_HEIGHT = 12;
const LINE_HEIGHT = 7;

const truncateText = (text: string | null | undefined, maxLength: number): string => {
  if (!text) return '—';
  return text.length > maxLength ? text.substring(0, maxLength - 1) + '…' : text;
};

const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatPhone = (phone: string | null | undefined): string => {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatPlaca = (placa: string | null | undefined): string => {
  if (!placa) return '—';
  const clean = placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length === 7) {
    return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  }
  return placa.toUpperCase();
};

const FOOTER_HEIGHT = 45;

const loadImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    console.warn('Não foi possível carregar a imagem:', url);
    return null;
  }
};

const loadImageWithDimensions = async (url: string): Promise<{ base64: string; naturalWidth: number; naturalHeight: number } | null> => {
  const base64 = await loadImageAsBase64(url);
  if (!base64) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ base64, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = base64;
  });
};

const drawGradientRect = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  fromColor: { r: number; g: number; b: number },
  toColor: { r: number; g: number; b: number },
  steps: number = 30
) => {
  const stepWidth = width / steps;
  for (let i = 0; i < steps; i++) {
    const progress = i / steps;
    const r = Math.round(fromColor.r + (toColor.r - fromColor.r) * progress);
    const g = Math.round(fromColor.g + (toColor.g - fromColor.g) * progress);
    const b = Math.round(fromColor.b + (toColor.b - fromColor.b) * progress);
    doc.setFillColor(r, g, b);
    doc.rect(x + stepWidth * i, y, stepWidth + 1, height, 'F');
  }
};

const drawCheckIndicator = (doc: jsPDF, x: number, y: number) => {
  doc.setFillColor(successGreen.r, successGreen.g, successGreen.b);
  doc.circle(x, y - 2, 1.5, 'F');
};

const drawPremiumCard = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    isRecommended?: boolean;
    borderColor?: { r: number; g: number; b: number };
    hasGlow?: boolean;
  } = {}
) => {
  const { isRecommended = false, borderColor, hasGlow = false } = options;

  doc.setFillColor(cardBg.r, cardBg.g, cardBg.b);
  doc.roundedRect(x, y, width, height, 4, 4, 'F');

  if (isRecommended || hasGlow) {
    const glowColor = isRecommended ? glowRed : glowBlue;
    doc.setDrawColor(glowColor.r, glowColor.g, glowColor.b);
    doc.setLineWidth(1.5);
    doc.roundedRect(x, y, width, height, 4, 4, 'S');
  } else {
    const border = borderColor || cardBorder;
    doc.setDrawColor(border.r, border.g, border.b);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, width, height, 4, 4, 'S');
  }
};

const drawPremiumSectionHeader = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  corSecundaria: { r: number; g: number; b: number } = brandRedDefault
) => {
  doc.setFillColor(sectionHeaderBg.r, sectionHeaderBg.g, sectionHeaderBg.b);
  doc.roundedRect(x, y, width, HEADER_HEIGHT, 2, 2, 'F');

  doc.setFillColor(glowBlue.r, glowBlue.g, glowBlue.b);
  doc.rect(x + 5, y + 3.5, 4, 5, 'F');

  doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(title, x + 13, y + 8);

  drawGradientRect(doc, x, y + HEADER_HEIGHT, width, 1, glowBlue, corSecundaria, 20);
};

const drawPageBackground = (
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number
) => {
  doc.setFillColor(bodyBg.r, bodyBg.g, bodyBg.b);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
};

// ============= Helper to split company name for header/footer =============
function splitNomeEmpresa(nomeEmpresa: string): { linha1: string; linha2: string } {
  // Try to split at first space after a word, for display as two lines
  const parts = nomeEmpresa.split(' ');
  if (parts.length <= 1) return { linha1: nomeEmpresa, linha2: '' };
  // First word as main title, rest as subtitle
  return { linha1: parts[0], linha2: parts.slice(1).join(' ') };
}

// ============= Geração do PDF Premium =============

export async function gerarPdfCotacao(cotacao: CotacaoParaPdf): Promise<void> {
  const config = await carregarConfigPdf();
  
  const brandBlue = config ? hexToRgb(config.cor_primaria) : brandBlueDefault;
  const brandRed = config ? hexToRgb(config.cor_secundaria) : brandRedDefault;
  const nomeEmpresa = config?.nome_empresa || 'PRATICCAR Proteção Veicular';
  const { linha1: empresaNome, linha2: empresaSubtitulo } = splitNomeEmpresa(nomeEmpresa);
  const mensagemEncerramento = config?.mensagem_encerramento || 'Será um prazer ter você como nosso associado. Estaremos aqui para o que precisar.';
  const logoPath = config?.logo_url || '/logos/logo-full-light.png';

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // Carregar imagens
  const [logoData, vehicleBase64] = await Promise.all([
    loadImageWithDimensions(logoPath),
    loadImageAsBase64('/vehicle-silhouette.png'),
  ]);
  const logoBase64 = logoData?.base64 || null;
  const logoAspect = logoData ? logoData.naturalWidth / logoData.naturalHeight : 1;

  const checkPageBreak = (requiredSpace: number) => {
    if (y + requiredSpace > pageHeight - FOOTER_HEIGHT) {
      doc.addPage();
      drawPageBackground(doc, pageWidth, pageHeight);
      doc.setFillColor(headerFooterBg.r, headerFooterBg.g, headerFooterBg.b);
      doc.rect(0, 0, pageWidth, 20, 'F');
      drawGradientRect(doc, 0, 17, pageWidth, 3, glowBlue, brandRed, 60);
      doc.setTextColor(textDark.r, textDark.g, textDark.b);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`${empresaNome} - Cotação de Proteção`, pageWidth / 2, 13, { align: 'center' });
      y = margin + 25;
    }
  };

  // ============= BACKGROUND PREMIUM (primeira página) =============
  drawPageBackground(doc, pageWidth, pageHeight);

  // ============= HEADER PREMIUM COM GRADIENTE =============
  const headerHeight = 55;
  
  doc.setFillColor(headerFooterBg.r, headerFooterBg.g, headerFooterBg.b);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');
  drawGradientRect(doc, 0, headerHeight - 3, pageWidth, 3, glowBlue, brandRed, 60);

  const logoHeaderHeight = 35;
  const logoHeaderWidth = logoHeaderHeight * logoAspect;
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, 10, logoHeaderWidth, logoHeaderHeight);
  }

  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  const titleX = logoBase64 ? margin + logoHeaderWidth + 6 : margin;
  doc.text(empresaNome, titleX, 26);

  doc.setTextColor(textDarkMuted.r, textDarkMuted.g, textDarkMuted.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(empresaSubtitulo, titleX, 36);

  y = headerHeight + SECTION_GAP;

  // ============= BARRA DE VALIDADE =============
  if (config?.mostrar_validade !== false) {
    doc.setFillColor(sectionHeaderBg.r, sectionHeaderBg.g, sectionHeaderBg.b);
    doc.roundedRect(margin, y, contentWidth, 14, 3, 3, 'F');

    const dataValidade = new Date(cotacao.created_at);
    dataValidade.setDate(dataValidade.getDate() + (cotacao.validade_dias || 7));
    
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Emitido em: ${formatDate(cotacao.created_at)}`, margin + 8, y + 9);
    
    doc.setTextColor(warningYellow.r, warningYellow.g, warningYellow.b);
    doc.setFont('helvetica', 'bold');
    doc.text(`Válida até: ${formatDate(dataValidade.toISOString())}`, pageWidth - margin - 8, y + 9, { align: 'right' });

    y += 14 + SECTION_GAP;
  }

  // ============= DADOS DO SOLICITANTE =============
  if (config?.mostrar_dados_solicitante !== false) {
    drawPremiumSectionHeader(doc, margin, y, contentWidth, 'DADOS DO SOLICITANTE', brandRed);
    y += HEADER_HEIGHT + INNER_GAP;

    const clienteNome = cotacao.nome_solicitante || cotacao.leads?.nome || 'Não informado';
    const clienteTelefone = cotacao.telefone1_solicitante || cotacao.leads?.telefone || '';
    const clienteEmail = cotacao.email_solicitante || cotacao.leads?.email || '';

    const labelWidth = 22;
    const col1X = margin;
    const col1ValueX = margin + labelWidth;
    const col2X = margin + (contentWidth / 2) + 5;
    const col2ValueX = col2X + labelWidth;

    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Nome:', col1X, y);
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.setFont('helvetica', 'bold');
    doc.text(truncateText(clienteNome, 55), col1ValueX, y);

    y += LINE_HEIGHT;

    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.setFont('helvetica', 'normal');
    doc.text('Telefone:', col1X, y);
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.text(formatPhone(clienteTelefone), col1ValueX, y);

    if (clienteEmail) {
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.text('E-mail:', col2X, y);
      doc.setTextColor(textLight.r, textLight.g, textLight.b);
      doc.text(truncateText(clienteEmail, 30), col2ValueX, y);
    }

    y += SECTION_GAP;
  }

  // ============= DADOS DO VEÍCULO =============
  if (config?.mostrar_dados_veiculo !== false) {
    drawPremiumSectionHeader(doc, margin, y, contentWidth, 'DADOS DO VEÍCULO', brandRed);
    y += HEADER_HEIGHT + INNER_GAP;

    const labelWidth = 22;
    const col1X = margin;
    const col1ValueX = margin + labelWidth;
    const col2X = margin + (contentWidth / 2) + 5;
    const col2ValueX = col2X + labelWidth;

    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Marca:', col1X, y);
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.text(truncateText(cotacao.veiculo_marca, 26), col1ValueX, y);

    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('Modelo:', col2X, y);
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.text(truncateText(cotacao.veiculo_modelo, 30), col2ValueX, y);

    y += LINE_HEIGHT;

    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('Ano:', col1X, y);
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.text(cotacao.veiculo_ano?.toString() || '—', col1ValueX, y);

    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('Placa:', col1X + 40, y);
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.text(formatPlaca(cotacao.veiculo_placa), col1X + 55, y);

    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.text('Valor FIPE:', col2X, y);
    doc.setTextColor(successGreen.r, successGreen.g, successGreen.b);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(cotacao.valor_fipe), col2ValueX, y);

    y += SECTION_GAP;
  }

  // ============= CARD DO PLANO (Premium Destacado) =============
  const planoNome = cotacao.planos?.nome || 'Plano Selecionado';
  const cardHeight = 42;

  drawPremiumCard(doc, margin, y, contentWidth, cardHeight, { 
    isRecommended: true, 
    hasGlow: true 
  });

  doc.setTextColor(textWhite.r, textWhite.g, textWhite.b);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(truncateText(planoNome.toUpperCase(), 32), margin + 15, y + 16);

  const badgeWidth = 50;
  doc.setFillColor(successGreen.r, successGreen.g, successGreen.b);
  doc.roundedRect(margin + 15, y + 22, badgeWidth, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('SELECIONADO', margin + 15 + badgeWidth / 2, y + 30, { align: 'center' });

  doc.setTextColor(successGreen.r, successGreen.g, successGreen.b);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(cotacao.valor_total_mensal), pageWidth - margin - 15, y + 18, { align: 'right' });
  
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('valor médio mensal', pageWidth - margin - 15, y + 28, { align: 'right' });

  y += cardHeight + INNER_GAP;

  // ============= COBERTURAS DO PLANO =============
  checkPageBreak(80);
  drawPremiumSectionHeader(doc, margin, y, contentWidth, 'COBERTURAS INCLUÍDAS', brandRed);
  y += HEADER_HEIGHT + INNER_GAP;

  const coberturas = cotacao.planos?.coberturas || [];

  const coberturasCol1 = coberturas.slice(0, Math.ceil(coberturas.length / 2));
  const coberturasCol2 = coberturas.slice(Math.ceil(coberturas.length / 2));

  const startY = y;
  const coberturaLineHeight = 8;
  const cobCol1X = margin;
  const cobCol2X = margin + (contentWidth / 2) + 8;
  const colWidth = (contentWidth / 2) - 8;
  
  coberturasCol1.forEach((cobertura, index) => {
    const lineTop = startY + (index * coberturaLineHeight);
    const textY = lineTop + coberturaLineHeight / 2 + 2;
    
    if (index % 2 === 0) {
      doc.setFillColor(stripeBg.r, stripeBg.g, stripeBg.b);
      doc.rect(cobCol1X, lineTop, colWidth, coberturaLineHeight, 'F');
    }
    
    drawCheckIndicator(doc, cobCol1X + 5, textY);
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(cobertura, cobCol1X + 12, textY);
  });

  coberturasCol2.forEach((cobertura, index) => {
    const lineTop = startY + (index * coberturaLineHeight);
    const textY = lineTop + coberturaLineHeight / 2 + 2;
    
    if (index % 2 === 0) {
      doc.setFillColor(stripeBg.r, stripeBg.g, stripeBg.b);
      doc.rect(cobCol2X - 4, lineTop, colWidth + 4, coberturaLineHeight, 'F');
    }
    
    drawCheckIndicator(doc, cobCol2X + 2, textY);
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(cobertura, cobCol2X + 9, textY);
  });

  y = startY + Math.max(coberturasCol1.length, coberturasCol2.length) * coberturaLineHeight + SECTION_GAP;

  // ============= VALORES =============
  checkPageBreak(80);
  
  const labelCol = margin + 5;
  const valueCol = pageWidth - margin - 5;

  doc.setFillColor(brandBlue.r, brandBlue.g, brandBlue.b);
  doc.roundedRect(margin, y, contentWidth, 18, 3, 3, 'F');
  doc.setDrawColor(glowBlue.r, glowBlue.g, glowBlue.b);
  doc.setLineWidth(1);
  doc.roundedRect(margin, y, contentWidth, 18, 3, 3, 'S');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('VALOR MÉDIO MENSAL', labelCol, y + 11);
  doc.setFontSize(14);
  doc.text(formatCurrency(cotacao.valor_total_mensal), valueCol, y + 11, { align: 'right' });

  y += 24;

  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Taxa de Adesão (pagamento único)', labelCol, y);
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(cotacao.valor_adesao), valueCol, y, { align: 'right' });

  y += 12;

  const primeiroPagamento = (cotacao.valor_adesao || 0) + (cotacao.valor_total_mensal || 0);
  const diaVencimento = cotacao.dia_vencimento || 10;
  
  doc.setFillColor(successGreen.r, successGreen.g, successGreen.b);
  doc.roundedRect(margin, y, contentWidth, 24, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PRIMEIRO PAGAMENTO', labelCol, y + 10);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Vencimento: dia ${diaVencimento}`, labelCol, y + 18);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(primeiroPagamento), valueCol, y + 14, { align: 'right' });

  y += 30;

  // ============= MENSAGEM INSTITUCIONAL =============
  if (config?.mostrar_mensagem_encerramento !== false) {
    doc.setFillColor(sectionHeaderBg.r, sectionHeaderBg.g, sectionHeaderBg.b);
    doc.roundedRect(margin, y, contentWidth, 26, 3, 3, 'F');
    
    drawGradientRect(doc, margin, y, contentWidth, 2, glowBlue, brandRed, 40);
    
    // Split mensagem into lines
    const mensagemLines = doc.splitTextToSize(mensagemEncerramento, contentWidth - 20);
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    const line1 = mensagemLines[0] || '';
    const line2 = mensagemLines[1] || '';
    doc.text(line1, pageWidth / 2, y + 10, { align: 'center' });
    if (line2) doc.text(line2, pageWidth / 2, y + 17, { align: 'center' });
    
    doc.setTextColor(glowBlue.r, glowBlue.g, glowBlue.b);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Conte com a ${empresaNome} 💙❤️`, pageWidth / 2, y + 24, { align: 'center' });
  }

  // ============= RODAPÉ PREMIUM =============
  const footerY = pageHeight - 30;

  drawGradientRect(doc, margin, footerY - 6, contentWidth, 2, glowBlue, brandRed, 50);

  doc.setFillColor(headerFooterBg.r, headerFooterBg.g, headerFooterBg.b);
  doc.rect(0, footerY, pageWidth, 30, 'F');

  const logoFooterHeight = 14;
  const logoFooterWidth = logoFooterHeight * logoAspect;
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, footerY + 4, logoFooterWidth, logoFooterHeight);
  }

  const footerTextX = logoBase64 ? margin + logoFooterWidth + 4 : margin;

  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(empresaNome, footerTextX, footerY + 8);
  
  doc.setTextColor(textDarkMuted.r, textDarkMuted.g, textDarkMuted.b);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(empresaSubtitulo, footerTextX, footerY + 14);

  doc.setFontSize(7);
  const footerDate = `Gerado em: ${formatDate(new Date().toISOString())} | Validade: ${cotacao.validade_dias || 7} dias`;
  doc.text(footerDate, footerTextX, footerY + 20);

  doc.setTextColor(textDarkMuted.r, textDarkMuted.g, textDarkMuted.b);
  doc.setFontSize(6);
  const disclaimer = 'Esta cotação não tem valor contratual';
  doc.text(disclaimer, pageWidth - margin, footerY + 10, { align: 'right' });
  doc.text('e está sujeita a análise.', pageWidth - margin, footerY + 15, { align: 'right' });

  // ============= PÁGINA: COMPARATIVO DE COBERTURAS =============
  const planoSimples: PlanoParaPdf = {
    nome: cotacao.planos?.nome || 'Plano',
    valorMensal: cotacao.valor_total_mensal || 0,
    valorAdesao: cotacao.valor_adesao || 0,
    coberturas: cotacao.planos?.coberturas || [],
    naoInclui: [],
    coberturaFipe: 100,
    cota: '',
  };

  const dadosVeiculoComparativo = {
    veiculo_marca: cotacao.veiculo_marca,
    veiculo_modelo: cotacao.veiculo_modelo,
    veiculo_ano: cotacao.veiculo_ano,
    valor_fipe: cotacao.valor_fipe,
  };

  if (planoSimples.coberturas.length > 0) {
    doc.addPage();
    desenharPaginaComparativoCoberturas(
      doc, dadosVeiculoComparativo, [planoSimples], logoBase64, pageWidth, pageHeight, margin, 2, 2, logoAspect, config
    );
  }

  // ============= DOWNLOAD =============
  const numeroLimpo = (cotacao.numero || 'PRATICCAR').replace(/[^a-zA-Z0-9-]/g, '');
  const fileName = `cotacao-${numeroLimpo}.pdf`;
  doc.save(fileName);
}

// ============= PDF COMPARATIVO PREMIUM MULTI-PÁGINAS =============

const desenharRodapeCompacto = (
  doc: jsPDF,
  cotacao: CotacaoComparativaParaPdf,
  logoBase64: string | null,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  paginaAtual: number,
  totalPaginas: number,
  isUltimaPagina: boolean = false,
  logoAspect: number = 1,
  config: PdfConfig | null = null
) => {
  const brandRed = config ? hexToRgb(config.cor_secundaria) : brandRedDefault;
  const nomeEmpresa = config?.nome_empresa || 'PRATICCAR Proteção Veicular';
  const { linha1: empresaNome, linha2: empresaSubtitulo } = splitNomeEmpresa(nomeEmpresa);

  const whatsappGreen = { r: 37, g: 211, b: 102 };
  
  const vendedorWhatsapp = cotacao.vendedor?.whatsapp;
  const mostrarBotaoWhatsapp = isUltimaPagina && vendedorWhatsapp && (config?.mostrar_whatsapp_rodape !== false);
  
  const footerY = pageHeight - 20;
  
  if (mostrarBotaoWhatsapp) {
    const btnWidth = 80;
    const btnHeight = 14;
    const btnX = (pageWidth - btnWidth) / 2;
    const btnY = footerY - 22;
    
    const numeroLimpo = vendedorWhatsapp.replace(/\D/g, '');
    const mensagem = encodeURIComponent(`Olá! Vi a cotação #${cotacao.numero || 'N/A'} e gostaria de mais informações.`);
    const whatsappUrl = `https://wa.me/55${numeroLimpo}?text=${mensagem}`;
    
    doc.setFillColor(whatsappGreen.r, whatsappGreen.g, whatsappGreen.b);
    doc.roundedRect(btnX, btnY, btnWidth, btnHeight, 3, 3, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const vendedorNome = cotacao.vendedor?.nome?.split(' ')[0] || 'Vendedor';
    doc.text(`💬 Falar com ${vendedorNome}`, pageWidth / 2, btnY + 9, { align: 'center' });
    
    doc.link(btnX, btnY, btnWidth, btnHeight, { url: whatsappUrl });
  }

  drawGradientRect(doc, margin, footerY - 4, pageWidth - margin * 2, 1.5, glowBlue, brandRed, 40);

  doc.setFillColor(headerFooterBg.r, headerFooterBg.g, headerFooterBg.b);
  doc.rect(0, footerY, pageWidth, 20, 'F');

  const logoSmallHeight = 12;
  const logoSmallWidth = logoSmallHeight * (logoBase64 ? logoAspect : 1);
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, footerY + 3, logoSmallWidth, logoSmallHeight);
  }

  const footerTextX = logoBase64 ? margin + logoSmallWidth + 4 : margin;

  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(empresaNome, footerTextX, footerY + 7);

  doc.setTextColor(textDarkMuted.r, textDarkMuted.g, textDarkMuted.b);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text(empresaSubtitulo, footerTextX, footerY + 12);

  doc.setTextColor(textDarkMuted.r, textDarkMuted.g, textDarkMuted.b);
  doc.setFontSize(7);
  doc.text(`#${cotacao.numero || 'N/A'} | Página ${paginaAtual} de ${totalPaginas}`, pageWidth - margin, footerY + 10, { align: 'right' });
};

const desenharCardPlanoExpandido = (
  doc: jsPDF,
  plano: PlanoParaPdf,
  x: number,
  y: number,
  width: number,
  index: number,
  isRecommended: boolean = false,
  compact: boolean = false
): number => {
  const padding = 6;
  const lineHeight = compact ? 5.5 : 7;
  const maxCoberturas = plano.coberturas.length;
  const coberturaFontSize = compact ? 7 : 9;
  const maxChars = compact 
    ? Math.floor((width - padding * 2 - 8) / 1.6) 
    : Math.floor((width - padding * 2 - 8) / 1.8);
  
  const numCoberturas = Math.min(plano.coberturas.length, maxCoberturas);
  const cardHeight = 
    24 +
    28 +
    (numCoberturas * lineHeight) +
    (plano.coberturas.length > maxCoberturas ? 10 : 0) +
    18;
  
  drawPremiumCard(doc, x, y, width, cardHeight, { 
    isRecommended, 
    hasGlow: true 
  });
  
  let currentY = y + 6;
  
  doc.setFillColor(glowBlue.r, glowBlue.g, glowBlue.b);
  doc.roundedRect(x + 3, currentY - 2, width - 6, 16, 2, 2, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  
  const nomeLines = doc.splitTextToSize(plano.nome.toUpperCase(), width - 12);
  const lineToShow = nomeLines[0];
  doc.text(lineToShow, x + width / 2, currentY + 9, { align: 'center' });
  
  currentY += 28;
  
  doc.setTextColor(successGreen.r, successGreen.g, successGreen.b);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(plano.valorMensal), x + width / 2, currentY, { align: 'center' });
  currentY += 5;
  
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('/mês', x + width / 2, currentY, { align: 'center' });
  currentY += 10;
  
  const coberturasExibir = plano.coberturas.slice(0, maxCoberturas);
  coberturasExibir.forEach((cobertura) => {
    doc.setFillColor(successGreen.r, successGreen.g, successGreen.b);
    doc.circle(x + padding + 3, currentY - 1.5, 1.5, 'F');
    
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.setFontSize(coberturaFontSize);
    doc.setFont('helvetica', 'normal');
    doc.text(truncateText(cobertura, maxChars), x + padding + 8, currentY);
    
    currentY += lineHeight;
  });
  
  currentY += 4;
  
  doc.setDrawColor(cardBorder.r, cardBorder.g, cardBorder.b);
  doc.line(x + padding, currentY - 4, x + width - padding, currentY - 4);
  
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Filiação:', x + padding, currentY);
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(plano.valorAdesao), x + width - padding, currentY, { align: 'right' });
  
  return cardHeight;
};

const desenharPaginaCapa = (
  doc: jsPDF,
  cotacao: CotacaoComparativaParaPdf,
  logoBase64: string | null,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  totalPaginas: number,
  isUltimaPagina: boolean = false,
  logoAspect: number = 1,
  config: PdfConfig | null = null
) => {
  const brandRed = config ? hexToRgb(config.cor_secundaria) : brandRedDefault;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  drawPageBackground(doc, pageWidth, pageHeight);

  const headerHeight = 45;
  doc.setFillColor(headerFooterBg.r, headerFooterBg.g, headerFooterBg.b);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');
  drawGradientRect(doc, 0, headerHeight - 3, pageWidth, 3, glowBlue, brandRed, 60);

  const logoCapaHeight = 28;
  const logoCapaWidth = logoCapaHeight * logoAspect;
  if (logoBase64) {
    const logoX = (pageWidth - logoCapaWidth) / 2;
    doc.addImage(logoBase64, 'PNG', logoX, 7, logoCapaWidth, logoCapaHeight);
  }

  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPARATIVO DE PLANOS', pageWidth / 2, 38, { align: 'center' });

  y = headerHeight + 5;

  // Barra de validade compacta
  if (config?.mostrar_validade !== false) {
    doc.setFillColor(sectionHeaderBg.r, sectionHeaderBg.g, sectionHeaderBg.b);
    doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'F');

    const dataValidade = new Date(cotacao.created_at);
    dataValidade.setDate(dataValidade.getDate() + (cotacao.validade_dias || 7));

    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.setFontSize(7);
    doc.text(`Emitido em: ${formatDate(cotacao.created_at)}`, margin + 4, y + 7);
    
    doc.setTextColor(warningYellow.r, warningYellow.g, warningYellow.b);
    doc.setFont('helvetica', 'bold');
    doc.text(`Válida até: ${formatDate(dataValidade.toISOString())}`, pageWidth - margin - 4, y + 7, { align: 'right' });

    y += 14;
  }

  // Dados do solicitante e veículo compactos
  if (config?.mostrar_dados_solicitante !== false || config?.mostrar_dados_veiculo !== false) {
    const showSolicitante = config?.mostrar_dados_solicitante !== false;
    const showVeiculo = config?.mostrar_dados_veiculo !== false;
    const boxHeight = (showSolicitante && showVeiculo) ? 22 : 12;

    doc.setFillColor(sectionHeaderBg.r, sectionHeaderBg.g, sectionHeaderBg.b);
    doc.roundedRect(margin, y, contentWidth, boxHeight, 2, 2, 'F');

    if (showSolicitante) {
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      
      doc.text('Cliente:', margin + 4, y + 7);
      doc.setTextColor(textLight.r, textLight.g, textLight.b);
      doc.setFont('helvetica', 'bold');
      doc.text(truncateText(cotacao.nome_solicitante, 30) || 'Não informado', margin + 22, y + 7);
      
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.setFont('helvetica', 'normal');
      doc.text('Tel:', pageWidth / 2 + 5, y + 7);
      doc.setTextColor(textLight.r, textLight.g, textLight.b);
      doc.text(formatPhone(cotacao.telefone1_solicitante), pageWidth / 2 + 16, y + 7);
    }

    if (showVeiculo) {
      const veiculoLineY = showSolicitante ? y + 15 : y + 7;
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.setFont('helvetica', 'normal');
      doc.text('Veículo:', margin + 4, veiculoLineY);
      doc.setTextColor(textLight.r, textLight.g, textLight.b);
      doc.setFont('helvetica', 'bold');
      doc.text(truncateText(`${cotacao.veiculo_marca || ''} ${cotacao.veiculo_modelo || ''} ${cotacao.veiculo_ano || ''}`, 35), margin + 22, veiculoLineY);
      
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.setFont('helvetica', 'normal');
      doc.text('FIPE:', pageWidth / 2 + 5, veiculoLineY);
      doc.setTextColor(successGreen.r, successGreen.g, successGreen.b);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(cotacao.valor_fipe), pageWidth / 2 + 18, veiculoLineY);
    }

    y += boxHeight + 6;
  }

  // Título da seção de planos
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`${cotacao.planosComparar.length} OPÇÕES PARA SUA PROTEÇÃO`, pageWidth / 2, y, { align: 'center' });
  y += 3;
  drawGradientRect(doc, margin, y, contentWidth, 1.5, glowBlue, brandRed, 40);
  y += 8;

  // Cards expandidos dos planos
  const numPlanos = cotacao.planosComparar.length;
  const cardGap = 6;
  const planoRecomendadoIndex = numPlanos > 1 ? 0 : -1;

  if (numPlanos === 1) {
    const cardWidth = contentWidth * 0.6;
    const cardX = (pageWidth - cardWidth) / 2;
    desenharCardPlanoExpandido(doc, cotacao.planosComparar[0], cardX, y, cardWidth, 0, true);
    
  } else if (numPlanos === 2) {
    const cardWidth = (contentWidth - cardGap) / 2;
    cotacao.planosComparar.forEach((plano, index) => {
      const cardX = margin + (cardWidth + cardGap) * index;
      desenharCardPlanoExpandido(doc, plano, cardX, y, cardWidth, index, index === planoRecomendadoIndex);
    });
    
  } else {
    const cardsPerRow = 3;
    const cardWidth = (contentWidth - (cardGap * (cardsPerRow - 1))) / cardsPerRow;
    
    cotacao.planosComparar.forEach((plano, index) => {
      const row = Math.floor(index / cardsPerRow);
      const col = index % cardsPerRow;
      
      const startIndex = row * cardsPerRow;
      const cardsNestaLinha = Math.min(cardsPerRow, numPlanos - startIndex);
      const larguraLinha = (cardWidth * cardsNestaLinha) + (cardGap * (cardsNestaLinha - 1));
      const startX = (pageWidth - larguraLinha) / 2;
      
      const cardX = startX + (cardWidth + cardGap) * col;
      
      const compactLineHeight = 5.5;
      const maxCoberturas = Math.max(...cotacao.planosComparar.map(p => p.coberturas.length));
      const estimatedCardHeight = 24 + 28 + (maxCoberturas * compactLineHeight) + 18;
      const cardY = y + row * (estimatedCardHeight + cardGap);
      
      desenharCardPlanoExpandido(doc, plano, cardX, cardY, cardWidth, index, index === planoRecomendadoIndex, true);
    });
  }

  desenharRodapeCompacto(doc, cotacao, logoBase64, pageWidth, pageHeight, margin, 1, totalPaginas, isUltimaPagina, logoAspect, config);
};

const desenharPaginaDetalhesPlano = (
  doc: jsPDF,
  cotacao: CotacaoComparativaParaPdf,
  plano: PlanoParaPdf,
  numeroPlano: number,
  totalPlanos: number,
  logoBase64: string | null,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  paginaAtual: number,
  totalPaginas: number,
  logoAspect: number = 1,
  config: PdfConfig | null = null
) => {
  const brandBlue = config ? hexToRgb(config.cor_primaria) : brandBlueDefault;
  const brandRed = config ? hexToRgb(config.cor_secundaria) : brandRedDefault;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  drawPageBackground(doc, pageWidth, pageHeight);

  const headerHeight = 38;
  doc.setFillColor(headerFooterBg.r, headerFooterBg.g, headerFooterBg.b);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');
  drawGradientRect(doc, 0, headerHeight - 2, pageWidth, 2, glowBlue, brandRed, 60);

  doc.setFillColor(sectionHeaderBg.r, sectionHeaderBg.g, sectionHeaderBg.b);
  doc.roundedRect(margin, 8, 55, 12, 2, 2, 'F');
  doc.setTextColor(textDarkMuted.r, textDarkMuted.g, textDarkMuted.b);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(`PLANO ${numeroPlano} DE ${totalPlanos}`, margin + 27.5, 16, { align: 'center' });

  doc.setTextColor(textDark.r, textDark.g, textDark.b);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(truncateText(plano.nome.toUpperCase(), 28), margin + 65, 18);

  doc.setTextColor(textDarkMuted.r, textDarkMuted.g, textDarkMuted.b);
  doc.setFontSize(8);
  doc.text(`${cotacao.veiculo_marca} ${cotacao.veiculo_modelo} ${cotacao.veiculo_ano}`, pageWidth - margin, 20, { align: 'right' });
  doc.setTextColor(successGreen.r, successGreen.g, successGreen.b);
  doc.text(formatCurrency(cotacao.valor_fipe), pageWidth - margin, 28, { align: 'right' });

  y = headerHeight + 8;

  const valorCardHeight = 85;
  drawPremiumCard(doc, margin, y, contentWidth, valorCardHeight, { isRecommended: true, hasGlow: true });

  let cardY = y + 10;

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(truncateText(plano.nome.toUpperCase(), 26), margin + 10, cardY);

  if (plano.adicionalMensal && plano.adicionalMensal > 0) {
    const adicionalText = `+${formatCurrency(plano.adicionalMensal)}/mês`;
    const adicionalWidth = adicionalText.length * 3.5 + 10;
    doc.setFillColor(successGreen.r, successGreen.g, successGreen.b);
    doc.roundedRect(pageWidth - margin - adicionalWidth - 10, cardY - 6, adicionalWidth, 12, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(adicionalText, pageWidth - margin - adicionalWidth / 2 - 10, cardY, { align: 'center' });
  }

  cardY += 12;

  let tagX = margin + 10;
  
  const fipeText = `${plano.coberturaFipe}% FIPE`;
  const fipeWidth = fipeText.length * 3 + 12;
  doc.setFillColor(glowBlue.r, glowBlue.g, glowBlue.b);
  doc.roundedRect(tagX, cardY - 4, fipeWidth, 11, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(fipeText, tagX + fipeWidth / 2, cardY + 3, { align: 'center' });
  tagX += fipeWidth + 6;

  if (plano.anoMinimo) {
    const anoText = `> ${plano.anoMinimo}`;
    const anoWidth = anoText.length * 3.5 + 10;
    doc.setFillColor(sectionHeaderBg.r, sectionHeaderBg.g, sectionHeaderBg.b);
    doc.roundedRect(tagX, cardY - 4, anoWidth, 11, 2, 2, 'F');
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.setFontSize(8);
    doc.text(anoText, tagX + anoWidth / 2, cardY + 3, { align: 'center' });
  }

  cardY += 18;

  if (plano.cotaPercentual && plano.cotaMinima) {
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Cota Passeio:', margin + 10, cardY);
    
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`${plano.cotaPercentual}% (mín ${formatCurrency(plano.cotaMinima)})`, margin + 45, cardY);
    cardY += 12;
  }

  if (plano.cotaDesagio && plano.cotaMinimaDesagio) {
    doc.setTextColor(successGreen.r, successGreen.g, successGreen.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Com Deságio: ${plano.cotaDesagio}% (mín ${formatCurrency(plano.cotaMinimaDesagio)})`, margin + 10, cardY);
    cardY += 12;
  }

  doc.setTextColor(successGreen.r, successGreen.g, successGreen.b);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(plano.valorMensal), pageWidth - margin - 10, y + 32, { align: 'right' });
  
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('/mês', pageWidth - margin - 10, y + 44, { align: 'right' });

  y += valorCardHeight + 8;

  if (plano.alertaDesagio) {
    const alertaHeight = 18;
    doc.setFillColor(warningYellow.r, warningYellow.g, warningYellow.b);
    doc.roundedRect(margin, y, contentWidth, alertaHeight, 3, 3, 'F');
    
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('⚠', margin + 10, y + 11);
    doc.text(truncateText(plano.alertaDesagio, 70), margin + 22, y + 11);
    
    y += alertaHeight + 8;
  }

  drawPremiumSectionHeader(doc, margin, y, contentWidth, 'COBERTURAS INCLUÍDAS', brandRed);
  y += HEADER_HEIGHT + 6;

  const coberturasPlano = plano.coberturas;
  const coberturasCol1 = coberturasPlano.slice(0, Math.ceil(coberturasPlano.length / 2));
  const coberturasCol2 = coberturasPlano.slice(Math.ceil(coberturasPlano.length / 2));
  const coberturaLineHeight = 9;
  const col1X = margin;
  const col2X = margin + contentWidth / 2 + 4;
  const colWidthVal = contentWidth / 2 - 4;

  const startCobY = y;
  coberturasCol1.forEach((cobertura, index) => {
    const lineY = startCobY + index * coberturaLineHeight;
    const textY = lineY + 6;
    
    if (index % 2 === 0) {
      doc.setFillColor(stripeBg.r, stripeBg.g, stripeBg.b);
      doc.rect(col1X, lineY, colWidthVal, coberturaLineHeight, 'F');
    }
    
    drawCheckIndicator(doc, col1X + 6, textY);
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(truncateText(cobertura, 45), col1X + 14, textY);
  });

  coberturasCol2.forEach((cobertura, index) => {
    const lineY = startCobY + index * coberturaLineHeight;
    const textY = lineY + 6;
    
    if (index % 2 === 0) {
      doc.setFillColor(stripeBg.r, stripeBg.g, stripeBg.b);
      doc.rect(col2X, lineY, colWidthVal, coberturaLineHeight, 'F');
    }
    
    drawCheckIndicator(doc, col2X + 6, textY);
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(truncateText(cobertura, 45), col2X + 14, textY);
  });

  y = startCobY + Math.max(coberturasCol1.length, coberturasCol2.length) * coberturaLineHeight + 10;

  if (plano.naoInclui && plano.naoInclui.length > 0) {
    drawPremiumSectionHeader(doc, margin, y, contentWidth, 'NÃO INCLUI NESTE PLANO', brandRed);
    y += HEADER_HEIGHT + 6;

    const naoIncluiCol1 = plano.naoInclui.slice(0, Math.ceil(plano.naoInclui.length / 2));
    const naoIncluiCol2 = plano.naoInclui.slice(Math.ceil(plano.naoInclui.length / 2));
    
    const startNaoY = y;
    naoIncluiCol1.forEach((item, index) => {
      const lineY = startNaoY + index * coberturaLineHeight;
      const textY = lineY + 6;
      
      if (index % 2 === 0) {
        doc.setFillColor(stripeBg.r, stripeBg.g, stripeBg.b);
        doc.rect(col1X, lineY, colWidthVal, coberturaLineHeight, 'F');
      }
      
      doc.setTextColor(glowRed.r, glowRed.g, glowRed.b);
      doc.setFontSize(9);
      doc.text('✗', col1X + 6, textY);
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.setFont('helvetica', 'normal');
      doc.text(truncateText(item, 45), col1X + 14, textY);
    });

    naoIncluiCol2.forEach((item, index) => {
      const lineY = startNaoY + index * coberturaLineHeight;
      const textY = lineY + 6;
      
      if (index % 2 === 0) {
        doc.setFillColor(stripeBg.r, stripeBg.g, stripeBg.b);
        doc.rect(col2X, lineY, colWidthVal, coberturaLineHeight, 'F');
      }
      
      doc.setTextColor(glowRed.r, glowRed.g, glowRed.b);
      doc.setFontSize(9);
      doc.text('✗', col2X + 6, textY);
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.setFont('helvetica', 'normal');
      doc.text(truncateText(item, 45), col2X + 14, textY);
    });

    y = startNaoY + Math.max(naoIncluiCol1.length, naoIncluiCol2.length) * coberturaLineHeight + 10;
  }

  // ============= VALORES =============
  const labelCol = margin + 8;
  const valueCol = pageWidth - margin - 8;

  doc.setFillColor(brandBlue.r, brandBlue.g, brandBlue.b);
  doc.roundedRect(margin, y, contentWidth, 20, 3, 3, 'F');
  doc.setDrawColor(glowBlue.r, glowBlue.g, glowBlue.b);
  doc.setLineWidth(1);
  doc.roundedRect(margin, y, contentWidth, 20, 3, 3, 'S');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('VALOR MÉDIO MENSAL', labelCol, y + 13);
  doc.setFontSize(16);
  doc.text(formatCurrency(plano.valorMensal), valueCol, y + 13, { align: 'right' });
  y += 26;

  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Taxa de Adesão (pagamento único)', labelCol, y);
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(plano.valorAdesao), valueCol, y, { align: 'right' });
  y += 14;

  const primeiroPagamento = plano.valorAdesao + plano.valorMensal;
  doc.setFillColor(successGreen.r, successGreen.g, successGreen.b);
  doc.roundedRect(margin, y, contentWidth, 22, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PRIMEIRO PAGAMENTO', labelCol, y + 14);
  doc.setFontSize(18);
  doc.text(formatCurrency(primeiroPagamento), valueCol, y + 14, { align: 'right' });

  desenharRodapeCompacto(doc, cotacao, logoBase64, pageWidth, pageHeight, margin, paginaAtual, totalPaginas, false, logoAspect, config);
};


export async function gerarPdfCotacaoComparativa(cotacao: CotacaoComparativaParaPdf, configOverride?: PdfConfig | null): Promise<void> {
  const config = configOverride !== undefined ? configOverride : await carregarConfigPdf();
  const logoPath = config?.logo_url || '/logos/logo-full-light.png';

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  const logoData = await loadImageWithDimensions(logoPath);
  const logoBase64 = logoData?.base64 || null;
  const logoAspect = logoData ? logoData.naturalWidth / logoData.naturalHeight : 1;

  const numPlanos = cotacao.planosComparar.length;
  
  const totalPaginas = 2; // Capa + comparativo de coberturas

  // ============= PÁGINA 1: CAPA COM CARDS DOS PLANOS =============
  desenharPaginaCapa(doc, cotacao, logoBase64, pageWidth, pageHeight, margin, totalPaginas, false, logoAspect, config);

  // ============= PÁGINA FINAL: COMPARATIVO DE COBERTURAS =============
  const dadosVeiculoComparativo = {
    veiculo_marca: cotacao.veiculo_marca,
    veiculo_modelo: cotacao.veiculo_modelo,
    veiculo_ano: cotacao.veiculo_ano,
    valor_fipe: cotacao.valor_fipe,
  };

  doc.addPage();
  desenharPaginaComparativoCoberturas(
    doc, dadosVeiculoComparativo, cotacao.planosComparar, logoBase64, pageWidth, pageHeight, margin, 2, totalPaginas, logoAspect, config
  );

  // ============= DOWNLOAD =============
  const nomeArquivo = configOverride !== undefined ? 'preview-cotacao' : `cotacao-comparativa-${(cotacao.numero || 'PRATICCAR').replace(/[^a-zA-Z0-9-]/g, '')}`;
  doc.save(`${nomeArquivo}.pdf`);
}
