// PDF Premium - PRATICCAR
import { jsPDF, GState } from 'jspdf';

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
  // Dados diretos da cotação (prioridade)
  nome_solicitante?: string | null;
  telefone1_solicitante?: string | null;
  email_solicitante?: string | null;
  // Relacionamentos (fallback)
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

// Interface para plano no PDF comparativo
export interface PlanoParaPdf {
  nome: string;
  valorMensal: number;
  valorAdesao: number;
  coberturas: string[];
  naoInclui: string[];
  coberturaFipe: number;
  cota: string;
}

// Interface para cotação comparativa
export interface CotacaoComparativaParaPdf {
  numero: string | null;
  created_at: string;
  validade_dias: number | null;
  nome_solicitante?: string | null;
  telefone1_solicitante?: string | null;
  email_solicitante?: string | null;
  veiculo_marca: string | null;
  veiculo_modelo: string | null;
  veiculo_ano: number | null;
  veiculo_placa: string | null;
  valor_fipe: number | null;
  planosComparar: PlanoParaPdf[];
}

// ============= PALETA DE CORES PREMIUM =============
// Cores principais PRATIC
const brandBlue = { r: 20, g: 55, b: 110 };       // Azul escuro PRATIC
const brandRed = { r: 200, g: 30, b: 65 };        // Vermelho PRATIC

// Cores Premium (tema escuro inspirado na área do cliente)
const premiumDark = { r: 15, g: 23, b: 42 };      // slate-900
const premiumCard = { r: 30, g: 41, b: 59 };      // slate-800
const premiumCardLight = { r: 51, g: 65, b: 85 }; // slate-700
const glowBlue = { r: 59, g: 130, b: 246 };       // blue-500
const glowRed = { r: 239, g: 68, b: 68 };         // red-500

// Cores de texto e UI
const textWhite = { r: 255, g: 255, b: 255 };
const textMuted = { r: 148, g: 163, b: 184 };     // slate-400
const textLight = { r: 226, g: 232, b: 240 };     // slate-200
const successGreen = { r: 34, g: 197, b: 94 };    // green-500
const warningYellow = { r: 234, g: 179, b: 8 };   // yellow-500

// ============= CONSTANTES DE ESPAÇAMENTO (REDUZIDAS) =============
const SECTION_GAP = 8;       // Espaço entre seções principais (era 12)
const INNER_GAP = 5;         // Espaço interno entre elementos (era 8)
const HEADER_HEIGHT = 12;    // Altura do header de seção
const LINE_HEIGHT = 7;       // Altura de linha de texto (era 8)

// ============= FUNÇÃO DE TRUNCAMENTO =============
const truncateText = (text: string | null | undefined, maxLength: number): string => {
  if (!text) return '—';
  return text.length > maxLength ? text.substring(0, maxLength - 2) + '...' : text;
};

// ============= Funções auxiliares =============

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

// Coberturas padrão caso o plano não tenha
const COBERTURAS_PADRAO = [
  'Proteção contra Roubo e Furto',
  'Proteção contra Colisão',
  'Proteção contra Perda Total',
  'Proteção contra Incêndio',
  'Assistência 24 horas',
  'App de Rastreamento',
];

// Altura reservada para rodapé
const FOOTER_HEIGHT = 45;

// ============= Funções para carregar imagens =============

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

// ============= Função para desenhar gradiente =============

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

// ============= Função para desenhar indicador de check (círculo verde) - CORRIGIDO =============

const drawCheckIndicator = (doc: jsPDF, x: number, y: number) => {
  doc.setFillColor(successGreen.r, successGreen.g, successGreen.b);
  // Alinhado ao centro vertical do texto (y é o baseline do texto)
  doc.circle(x, y - 2, 1.5, 'F');
};

// ============= Função para desenhar card premium escuro =============

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

  // Fundo do card (slate-900)
  doc.setFillColor(premiumDark.r, premiumDark.g, premiumDark.b);
  doc.roundedRect(x, y, width, height, 4, 4, 'F');

  // Efeito de "glow" com borda mais grossa para recomendado
  if (isRecommended || hasGlow) {
    const glowColor = isRecommended ? glowRed : glowBlue;
    doc.setDrawColor(glowColor.r, glowColor.g, glowColor.b);
    doc.setLineWidth(2);
    doc.roundedRect(x, y, width, height, 4, 4, 'S');
  } else {
    const border = borderColor || premiumCardLight;
    doc.setDrawColor(border.r, border.g, border.b);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, width, height, 4, 4, 'S');
  }
};

// ============= Função para desenhar seção com header premium =============

const drawPremiumSectionHeader = (
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string
) => {
  // Fundo do header da seção
  doc.setFillColor(premiumCard.r, premiumCard.g, premiumCard.b);
  doc.roundedRect(x, y, width, HEADER_HEIGHT, 2, 2, 'F');

  // Pequeno indicador visual (retângulo azul)
  doc.setFillColor(glowBlue.r, glowBlue.g, glowBlue.b);
  doc.rect(x + 5, y + 3.5, 4, 5, 'F');

  // Texto do título
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(title, x + 13, y + 8);

  // Linha inferior com gradiente azul-vermelho
  drawGradientRect(doc, x, y + HEADER_HEIGHT, width, 1, glowBlue, brandRed, 20);
};

// ============= Função para desenhar background de página com marca d'água =============

const drawPageBackground = (
  doc: jsPDF,
  pageWidth: number,
  pageHeight: number
) => {
  // Fundo escuro premium
  doc.setFillColor(premiumDark.r, premiumDark.g, premiumDark.b);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
};

// ============= Geração do PDF Premium =============

export async function gerarPdfCotacao(cotacao: CotacaoParaPdf): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // Carregar imagens
  const [logoBase64, vehicleBase64] = await Promise.all([
    loadImageAsBase64('/pratic-logo.png'),
    loadImageAsBase64('/vehicle-silhouette.png'),
  ]);

  // Função auxiliar para verificar se precisa nova página (com background persistente)
  const checkPageBreak = (requiredSpace: number) => {
    if (y + requiredSpace > pageHeight - FOOTER_HEIGHT) {
      doc.addPage();
      
      // Desenhar background e marca d'água na nova página
      drawPageBackground(doc, pageWidth, pageHeight);
      
      // Header compacto para páginas subsequentes
      drawGradientRect(doc, 0, 0, pageWidth, 20, brandBlue, brandRed);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('PRATICCAR - Cotação de Proteção', pageWidth / 2, 13, { align: 'center' });
      
      y = margin + 25;
    }
  };

  // ============= BACKGROUND PREMIUM (primeira página) =============
  drawPageBackground(doc, pageWidth, pageHeight);

  // ============= HEADER PREMIUM COM GRADIENTE =============
  const headerHeight = 55;
  
  drawGradientRect(doc, 0, 0, pageWidth, headerHeight, brandBlue, { r: 30, g: 70, b: 130 });
  drawGradientRect(doc, 0, headerHeight - 3, pageWidth, 3, glowBlue, brandRed, 60);

  // Logo no header
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, 8, 40, 40);
  }

  // Texto do header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  const titleX = logoBase64 ? margin + 48 : margin;
  doc.text('PRATICCAR', titleX, 26);

  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Proteção Veicular', titleX, 36);

  // Badge da cotação (canto direito)
  const cotacaoNumero = cotacao.numero || 'N/A';
  doc.setFillColor(premiumCard.r, premiumCard.g, premiumCard.b);
  doc.roundedRect(pageWidth - margin - 50, 12, 50, 16, 3, 3, 'F');
  doc.setDrawColor(glowBlue.r, glowBlue.g, glowBlue.b);
  doc.setLineWidth(0.5);
  doc.roundedRect(pageWidth - margin - 50, 12, 50, 16, 3, 3, 'S');
  
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(7);
  doc.text('COTAÇÃO', pageWidth - margin - 25, 18, { align: 'center' });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`#${cotacaoNumero}`, pageWidth - margin - 25, 25, { align: 'center' });

  y = headerHeight + SECTION_GAP;

  // ============= BARRA DE VALIDADE =============
  doc.setFillColor(premiumCard.r, premiumCard.g, premiumCard.b);
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

  // ============= DADOS DO SOLICITANTE =============
  drawPremiumSectionHeader(doc, margin, y, contentWidth, 'DADOS DO SOLICITANTE');
  y += HEADER_HEIGHT + INNER_GAP;

  // Priorizar dados diretos da cotação, fallback para lead
  const clienteNome = cotacao.nome_solicitante || cotacao.leads?.nome || 'Não informado';
  const clienteTelefone = cotacao.telefone1_solicitante || cotacao.leads?.telefone || '';
  const clienteEmail = cotacao.email_solicitante || cotacao.leads?.email || '';

  // Colunas para melhor alinhamento - largura aumentada
  const labelWidth = 22;
  const col1X = margin;
  const col1ValueX = margin + labelWidth;
  const col2X = margin + (contentWidth / 2) + 5;
  const col2ValueX = col2X + labelWidth;

  // Linha 1: Nome completo (usa linha inteira)
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Nome:', col1X, y);
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.setFont('helvetica', 'bold');
  doc.text(truncateText(clienteNome, 55), col1ValueX, y);

  y += LINE_HEIGHT;

  // Linha 2: Telefone e Email
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

  // ============= DADOS DO VEÍCULO =============
  drawPremiumSectionHeader(doc, margin, y, contentWidth, 'DADOS DO VEÍCULO');
  y += HEADER_HEIGHT + INNER_GAP;

  // Linha 1: Marca e Modelo
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Marca:', col1X, y);
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.text(truncateText(cotacao.veiculo_marca, 22), col1ValueX, y);

  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.text('Modelo:', col2X, y);
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.text(truncateText(cotacao.veiculo_modelo, 25), col2ValueX, y);

  y += LINE_HEIGHT;

  // Linha 2: Ano, Placa e Valor FIPE (código FIPE removido)
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

  // ============= CARD DO PLANO (Premium Destacado) =============
  const planoNome = cotacao.planos?.nome || 'Plano Selecionado';
  const cardHeight = 42;

  // Card escuro com borda brilhante
  drawPremiumCard(doc, margin, y, contentWidth, cardHeight, { 
    isRecommended: true, 
    hasGlow: true 
  });

  // Nome do plano (truncado para evitar overflow)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(truncateText(planoNome.toUpperCase(), 32), margin + 15, y + 16);

  // Badge "Selecionado" - centralizado abaixo do nome
  const badgeWidth = 50;
  doc.setFillColor(successGreen.r, successGreen.g, successGreen.b);
  doc.roundedRect(margin + 15, y + 22, badgeWidth, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('SELECIONADO', margin + 15 + badgeWidth / 2, y + 30, { align: 'center' });

  // Valor mensal (destaque grande) - alinhado à direita
  doc.setTextColor(successGreen.r, successGreen.g, successGreen.b);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(cotacao.valor_total_mensal), pageWidth - margin - 15, y + 20, { align: 'right' });
  
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('/mês', pageWidth - margin - 15, y + 32, { align: 'right' });

  y += cardHeight + INNER_GAP;

  // ============= COBERTURAS DO PLANO =============
  checkPageBreak(80);
  drawPremiumSectionHeader(doc, margin, y, contentWidth, 'COBERTURAS INCLUÍDAS');
  y += HEADER_HEIGHT + INNER_GAP;

  // Usar coberturas do plano se disponíveis, senão usar padrão
  const coberturas = (cotacao.planos?.coberturas && cotacao.planos.coberturas.length > 0)
    ? cotacao.planos.coberturas
    : COBERTURAS_PADRAO;

  // Exibir em 2 colunas - posições fixas para evitar sobreposição
  const coberturasCol1 = coberturas.slice(0, Math.ceil(coberturas.length / 2));
  const coberturasCol2 = coberturas.slice(Math.ceil(coberturas.length / 2));

  const startY = y;
  const coberturaLineHeight = 8; // Altura de cada linha de cobertura
  const cobCol1X = margin;
  const cobCol2X = margin + (contentWidth / 2) + 8;
  const colWidth = (contentWidth / 2) - 8;
  
  // Desenhar coberturas com alinhamento correto
  coberturasCol1.forEach((cobertura, index) => {
    const lineTop = startY + (index * coberturaLineHeight);
    const textY = lineTop + coberturaLineHeight / 2 + 2; // Centralizado verticalmente
    
    // Fundo alternado sutil - alinhado com a linha
    if (index % 2 === 0) {
      doc.setFillColor(premiumCard.r, premiumCard.g, premiumCard.b);
      doc.rect(cobCol1X, lineTop, colWidth, coberturaLineHeight, 'F');
    }
    
    // Indicador de check e texto no mesmo baseline
    drawCheckIndicator(doc, cobCol1X + 5, textY);
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(truncateText(cobertura, 30), cobCol1X + 12, textY);
  });

  coberturasCol2.forEach((cobertura, index) => {
    const lineTop = startY + (index * coberturaLineHeight);
    const textY = lineTop + coberturaLineHeight / 2 + 2; // Centralizado verticalmente
    
    if (index % 2 === 0) {
      doc.setFillColor(premiumCard.r, premiumCard.g, premiumCard.b);
      doc.rect(cobCol2X - 4, lineTop, colWidth + 4, coberturaLineHeight, 'F');
    }
    
    drawCheckIndicator(doc, cobCol2X + 2, textY);
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(truncateText(cobertura, 30), cobCol2X + 9, textY);
  });

  y = startY + Math.max(coberturasCol1.length, coberturasCol2.length) * coberturaLineHeight + SECTION_GAP;

  // ============= COMPOSIÇÃO DO VALOR =============
  checkPageBreak(100);
  drawPremiumSectionHeader(doc, margin, y, contentWidth, 'COMPOSIÇÃO DO VALOR');
  y += HEADER_HEIGHT + INNER_GAP;

  const labelCol = margin + 5;
  const valueCol = pageWidth - margin - 5;
  const valorLineHeight = 8; // Reduzido de 9

  const valores = [
    { label: 'Cota Base (mensalidade)', valor: cotacao.valor_cota },
    { label: 'Taxa Administrativa', valor: cotacao.taxa_administrativa },
    { label: 'Rastreamento', valor: cotacao.valor_rastreamento },
    { label: 'Assistência 24h', valor: cotacao.valor_assistencia },
  ];

  valores.forEach(({ label, valor }, index) => {
    // Fundo alternado
    if (index % 2 === 0) {
      doc.setFillColor(premiumCard.r, premiumCard.g, premiumCard.b);
      doc.rect(margin, y - 2, contentWidth, valorLineHeight, 'F');
    }
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(label, labelCol, y + 3);
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.text(formatCurrency(valor), valueCol, y + 3, { align: 'right' });
    y += valorLineHeight;
  });

  // Linha separadora com gradiente
  y += 2;
  drawGradientRect(doc, margin, y, contentWidth, 1, glowBlue, brandRed, 40);
  y += 6;

  // Total mensal (card destacado)
  doc.setFillColor(brandBlue.r, brandBlue.g, brandBlue.b);
  doc.roundedRect(margin, y - 2, contentWidth, 14, 3, 3, 'F');
  doc.setDrawColor(glowBlue.r, glowBlue.g, glowBlue.b);
  doc.setLineWidth(1);
  doc.roundedRect(margin, y - 2, contentWidth, 14, 3, 3, 'S');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('MENSALIDADE TOTAL', labelCol, y + 6);
  doc.setFontSize(13);
  doc.text(formatCurrency(cotacao.valor_total_mensal), valueCol, y + 6, { align: 'right' });

  y += 18;

  // Taxa de adesão
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Taxa de Adesão (pagamento único)', labelCol, y);
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(cotacao.valor_adesao), valueCol, y, { align: 'right' });

  y += 10;

  // Primeiro pagamento (destaque verde)
  const primeiroPagamento = (cotacao.valor_adesao || 0) + (cotacao.valor_total_mensal || 0);
  doc.setFillColor(successGreen.r, successGreen.g, successGreen.b);
  doc.roundedRect(margin, y - 3, contentWidth, 16, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PRIMEIRO PAGAMENTO', labelCol, y + 6);
  doc.setFontSize(14);
  doc.text(formatCurrency(primeiroPagamento), valueCol, y + 6, { align: 'right' });

  // ============= RODAPÉ PREMIUM =============
  const footerY = pageHeight - 30;

  // Linha gradiente superior do rodapé
  drawGradientRect(doc, margin, footerY - 6, contentWidth, 2, glowBlue, brandRed, 50);

  // Fundo do rodapé
  doc.setFillColor(premiumCard.r, premiumCard.g, premiumCard.b);
  doc.rect(0, footerY, pageWidth, 30, 'F');

  // Logo pequeno no rodapé
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, footerY + 2, 18, 18);
  }

  const footerTextX = logoBase64 ? margin + 24 : margin;

  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('PRATICCAR', footerTextX, footerY + 8);
  
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Proteção Veicular', footerTextX, footerY + 14);

  doc.setFontSize(7);
  const footerDate = `Gerado em: ${formatDate(new Date().toISOString())} | Validade: ${cotacao.validade_dias || 7} dias`;
  doc.text(footerDate, footerTextX, footerY + 20);

  // Disclaimer (canto direito)
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(6);
  const disclaimer = 'Esta cotação não tem valor contratual';
  doc.text(disclaimer, pageWidth - margin, footerY + 10, { align: 'right' });
  doc.text('e está sujeita a análise.', pageWidth - margin, footerY + 15, { align: 'right' });

  // ============= DOWNLOAD =============
  const numeroLimpo = (cotacao.numero || 'PRATICCAR').replace(/[^a-zA-Z0-9-]/g, '');
  const fileName = `cotacao-${numeroLimpo}.pdf`;
  doc.save(fileName);
}

// ============= PDF COMPARATIVO PREMIUM =============

export async function gerarPdfCotacaoComparativa(cotacao: CotacaoComparativaParaPdf): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // Carregar imagens
  const [logoBase64, vehicleBase64] = await Promise.all([
    loadImageAsBase64('/pratic-logo.png'),
    loadImageAsBase64('/vehicle-silhouette.png'),
  ]);

  // ============= BACKGROUND PREMIUM ESCURO =============
  drawPageBackground(doc, pageWidth, pageHeight);

  // ============= HEADER PREMIUM =============
  const headerHeight = 50;
  drawGradientRect(doc, 0, 0, pageWidth, headerHeight, brandBlue, { r: 30, g: 70, b: 130 });
  drawGradientRect(doc, 0, headerHeight - 3, pageWidth, 3, glowBlue, brandRed, 60);

  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, 6, 36, 36);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  const titleX = logoBase64 ? margin + 44 : margin;
  doc.text('PRATICCAR', titleX, 20);

  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Proteção Veicular', titleX, 30);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPARATIVO DE PLANOS', titleX, 42);

  // Badge cotação
  doc.setFillColor(premiumCard.r, premiumCard.g, premiumCard.b);
  doc.roundedRect(pageWidth - margin - 45, 10, 45, 14, 3, 3, 'F');
  doc.setDrawColor(glowBlue.r, glowBlue.g, glowBlue.b);
  doc.setLineWidth(0.5);
  doc.roundedRect(pageWidth - margin - 45, 10, 45, 14, 3, 3, 'S');
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(6);
  doc.text('COTAÇÃO', pageWidth - margin - 22, 16, { align: 'center' });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`#${cotacao.numero || 'N/A'}`, pageWidth - margin - 22, 22, { align: 'center' });

  y = headerHeight + 6;

  // ============= BARRA DE VALIDADE =============
  doc.setFillColor(premiumCard.r, premiumCard.g, premiumCard.b);
  doc.roundedRect(margin, y, contentWidth, 12, 3, 3, 'F');

  const dataValidade = new Date(cotacao.created_at);
  dataValidade.setDate(dataValidade.getDate() + (cotacao.validade_dias || 7));
  
  doc.setTextColor(warningYellow.r, warningYellow.g, warningYellow.b);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`Válida até: ${formatDate(dataValidade.toISOString())}`, pageWidth - margin - 5, y + 8, { align: 'right' });

  y += 14;

  // ============= DADOS DO SOLICITANTE E VEÍCULO (compacto) =============
  doc.setFillColor(premiumCard.r, premiumCard.g, premiumCard.b);
  doc.roundedRect(margin, y, contentWidth, 20, 3, 3, 'F');

  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  
  // Linha 1: Solicitante
  doc.text('Cliente:', margin + 5, y + 7);
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.setFont('helvetica', 'bold');
  doc.text(cotacao.nome_solicitante || 'Não informado', margin + 25, y + 7);
  
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFont('helvetica', 'normal');
  doc.text('Tel:', pageWidth / 2 + 10, y + 7);
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.text(formatPhone(cotacao.telefone1_solicitante), pageWidth / 2 + 22, y + 7);

  // Linha 2: Veículo
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFont('helvetica', 'normal');
  doc.text('Veículo:', margin + 5, y + 15);
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.setFont('helvetica', 'bold');
  doc.text(`${cotacao.veiculo_marca || ''} ${cotacao.veiculo_modelo || ''} ${cotacao.veiculo_ano || ''}`, margin + 28, y + 15);
  
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFont('helvetica', 'normal');
  doc.text('FIPE:', pageWidth / 2 + 10, y + 15);
  doc.setTextColor(successGreen.r, successGreen.g, successGreen.b);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(cotacao.valor_fipe), pageWidth / 2 + 24, y + 15);

  y += 24;

  // ============= TÍTULO DA SEÇÃO DE PLANOS =============
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('ESCOLHA O PLANO IDEAL PARA SUA PROTEÇÃO', pageWidth / 2, y, { align: 'center' });
  y += 3;
  drawGradientRect(doc, margin, y, contentWidth, 1, glowBlue, brandRed, 40);
  y += 6;

  // ============= CARDS DOS PLANOS =============
  const numPlanos = cotacao.planosComparar.length;
  const cardGap = 6;
  
  // Layout responsivo: plano único = card grande centralizado
  const isSinglePlan = numPlanos === 1;
  const cardWidth = isSinglePlan 
    ? contentWidth * 0.65 // Card maior para plano único
    : (contentWidth - (cardGap * (numPlanos - 1))) / numPlanos;
  const cardHeight = isSinglePlan ? 110 : 85; // Card mais alto para mostrar mais coberturas
  const startX = isSinglePlan 
    ? margin + (contentWidth - cardWidth) / 2 // Centralizado
    : margin;

  // Determinar qual plano é recomendado (o do meio ou premium, ou o único)
  const planoRecomendadoIndex = numPlanos > 1 ? 1 : 0;

  cotacao.planosComparar.forEach((plano, index) => {
    const cardX = isSinglePlan 
      ? startX 
      : margin + (cardWidth + cardGap) * index;
    const isRecommended = index === planoRecomendadoIndex;

    // Card premium
    drawPremiumCard(doc, cardX, y, cardWidth, cardHeight, { 
      isRecommended: true, // Plano único sempre destacado
      hasGlow: true 
    });

    const centerX = cardX + cardWidth / 2;
    let cardY = y + 8;

    // Badge de recomendado/selecionado
    if (isRecommended || isSinglePlan) {
      doc.setFillColor(brandRed.r, brandRed.g, brandRed.b);
      const badgeText = isSinglePlan ? 'PLANO SELECIONADO' : 'RECOMENDADO';
      const badgeWidth = isSinglePlan ? cardWidth - 16 : cardWidth - 8;
      doc.roundedRect(cardX + (cardWidth - badgeWidth) / 2, cardY - 4, badgeWidth, 10, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(isSinglePlan ? 8 : 6);
      doc.setFont('helvetica', 'bold');
      doc.text(badgeText, centerX, cardY + 2, { align: 'center' });
      cardY += 12;
    }

    // Nome do plano
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(isSinglePlan ? 14 : (isRecommended ? 12 : 10));
    doc.setFont('helvetica', 'bold');
    doc.text(plano.nome.toUpperCase(), centerX, cardY, { align: 'center' });
    cardY += isSinglePlan ? 12 : (isRecommended ? 10 : 8);

    // Valor mensal (destaque)
    doc.setTextColor(successGreen.r, successGreen.g, successGreen.b);
    doc.setFontSize(isSinglePlan ? 22 : (isRecommended ? 18 : 14));
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(plano.valorMensal), centerX, cardY, { align: 'center' });
    cardY += 5;
    
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('/mês', centerX, cardY, { align: 'center' });
    cardY += 8;

    // Info rápida
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.setFontSize(7);
    doc.text(`${plano.coberturaFipe}% FIPE`, centerX, cardY, { align: 'center' });
    cardY += 8;

    // Linha divisória
    doc.setDrawColor(premiumCardLight.r, premiumCardLight.g, premiumCardLight.b);
    doc.setLineWidth(0.3);
    doc.line(cardX + 8, cardY, cardX + cardWidth - 8, cardY);
    cardY += 6;

    // Coberturas - mais coberturas para plano único
    const maxCoberturas = isSinglePlan ? 6 : 4;
    const coberturaMaxLen = isSinglePlan ? 35 : 18;
    doc.setFontSize(isSinglePlan ? 7 : 6);
    
    // Para plano único, usar 2 colunas de coberturas
    if (isSinglePlan && plano.coberturas.length > 3) {
      const coberturasCol1 = plano.coberturas.slice(0, Math.ceil(Math.min(plano.coberturas.length, maxCoberturas) / 2));
      const coberturasCol2 = plano.coberturas.slice(Math.ceil(Math.min(plano.coberturas.length, maxCoberturas) / 2), maxCoberturas);
      const colWidth = (cardWidth - 20) / 2;
      
      coberturasCol1.forEach((cobertura, i) => {
        drawCheckIndicator(doc, cardX + 10, cardY + (i * 6));
        doc.setTextColor(textLight.r, textLight.g, textLight.b);
        const cobText = cobertura.length > 16 ? cobertura.substring(0, 14) + '...' : cobertura;
        doc.text(cobText, cardX + 16, cardY + (i * 6));
      });
      
      coberturasCol2.forEach((cobertura, i) => {
        drawCheckIndicator(doc, cardX + colWidth + 10, cardY + (i * 6));
        doc.setTextColor(textLight.r, textLight.g, textLight.b);
        const cobText = cobertura.length > 16 ? cobertura.substring(0, 14) + '...' : cobertura;
        doc.text(cobText, cardX + colWidth + 16, cardY + (i * 6));
      });
    } else {
      plano.coberturas.slice(0, maxCoberturas).forEach(cobertura => {
        drawCheckIndicator(doc, cardX + 8, cardY);
        doc.setTextColor(textLight.r, textLight.g, textLight.b);
        const cobText = cobertura.length > coberturaMaxLen ? cobertura.substring(0, coberturaMaxLen - 2) + '...' : cobertura;
        doc.text(cobText, cardX + 14, cardY);
        cardY += 5;
      });
    }
  });

  y += cardHeight + 6;

  // ============= TABELA COMPARATIVA DE VALORES =============
  doc.setFillColor(premiumCard.r, premiumCard.g, premiumCard.b);
  doc.roundedRect(margin, y, contentWidth, 26, 3, 3, 'F');

  // Header da tabela
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR ADESÃO', margin + 5, y + 9);
  doc.text('1º PAGAMENTO', margin + 5, y + 20);

  // Valores por plano
  cotacao.planosComparar.forEach((plano, index) => {
    const cardX = isSinglePlan 
      ? startX 
      : margin + (cardWidth + cardGap) * index;
    const centerX = cardX + cardWidth / 2;
    const primeiroPagamento = plano.valorAdesao + plano.valorMensal;

    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.setFontSize(isSinglePlan ? 11 : 9);
    doc.setFont('helvetica', 'normal');
    doc.text(formatCurrency(plano.valorAdesao), centerX, y + 9, { align: 'center' });
    
    doc.setTextColor(successGreen.r, successGreen.g, successGreen.b);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(primeiroPagamento), centerX, y + 20, { align: 'center' });
  });

  // ============= RODAPÉ PREMIUM =============
  const footerY = pageHeight - 25;

  drawGradientRect(doc, margin, footerY - 6, contentWidth, 2, glowBlue, brandRed, 50);

  doc.setFillColor(premiumCard.r, premiumCard.g, premiumCard.b);
  doc.rect(0, footerY, pageWidth, 25, 'F');

  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, footerY + 2, 16, 16);
  }

  const footerTextX = logoBase64 ? margin + 22 : margin;

  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('PRATICCAR', footerTextX, footerY + 8);
  
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('Proteção Veicular', footerTextX, footerY + 14);
  doc.text(`Gerado em: ${formatDate(new Date().toISOString())}`, footerTextX, footerY + 20);

  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(6);
  doc.text('Esta cotação não tem valor contratual e está sujeita a análise.', pageWidth - margin, footerY + 12, { align: 'right' });

  // ============= DOWNLOAD =============
  const numeroLimpo = (cotacao.numero || 'PRATICCAR').replace(/[^a-zA-Z0-9-]/g, '');
  const fileName = `cotacao-comparativa-${numeroLimpo}.pdf`;
  doc.save(fileName);
}
