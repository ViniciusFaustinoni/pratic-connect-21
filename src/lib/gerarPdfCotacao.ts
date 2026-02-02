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
  dia_vencimento?: number | null; // Dia do vencimento (5, 10, 15, 20, 25, 30)
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
  // Campos expandidos para novo layout
  cotaPercentual?: number;
  cotaMinima?: number;
  cotaDesagio?: number;
  cotaMinimaDesagio?: number;
  adicionalMensal?: number;
  anoMinimo?: number;
  alertaDesagio?: string;
  coberturasRemovidas?: string[];
}

// Interface para cotação comparativa
export interface CotacaoComparativaParaPdf {
  numero: string | null;
  created_at: string;
  validade_dias: number | null;
  dia_vencimento?: number | null; // Dia do vencimento (5, 10, 15, 20, 25, 30)
  nome_solicitante?: string | null;
  telefone1_solicitante?: string | null;
  email_solicitante?: string | null;
  veiculo_marca: string | null;
  veiculo_modelo: string | null;
  veiculo_ano: number | null;
  veiculo_placa: string | null;
  valor_fipe: number | null;
  planosComparar: PlanoParaPdf[];
  // Dados do vendedor para botão WhatsApp
  vendedor?: {
    nome: string;
    whatsapp?: string | null;
  } | null;
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
  // Aumentado para evitar cortes prematuros
  return text.length > maxLength ? text.substring(0, maxLength - 1) + '…' : text;
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

  // Removido: Badge da cotação não é mais exibido no PDF

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
  doc.text(truncateText(cotacao.veiculo_marca, 26), col1ValueX, y);

  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.text('Modelo:', col2X, y);
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.text(truncateText(cotacao.veiculo_modelo, 30), col2ValueX, y);

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
  doc.text(formatCurrency(cotacao.valor_total_mensal), pageWidth - margin - 15, y + 18, { align: 'right' });
  
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('valor médio mensal', pageWidth - margin - 15, y + 28, { align: 'right' });

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

  // ============= VALORES (SIMPLIFICADO - SEM COMPOSIÇÃO INTERNA) =============
  checkPageBreak(80);
  
  const labelCol = margin + 5;
  const valueCol = pageWidth - margin - 5;

  // Card: VALOR MÉDIO MENSAL (destaque azul)
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

  // Taxa de adesão
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Taxa de Adesão (pagamento único)', labelCol, y);
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(cotacao.valor_adesao), valueCol, y, { align: 'right' });

  y += 12;

  // Primeiro pagamento (destaque verde) com dia de vencimento
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
  doc.setFillColor(premiumCard.r, premiumCard.g, premiumCard.b);
  doc.roundedRect(margin, y, contentWidth, 26, 3, 3, 'F');
  
  // Borda gradiente no topo
  drawGradientRect(doc, margin, y, contentWidth, 2, glowBlue, brandRed, 40);
  
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text('Será um prazer ter você como nosso associado.', pageWidth / 2, y + 10, { align: 'center' });
  doc.text('Estaremos aqui para o que precisar.', pageWidth / 2, y + 17, { align: 'center' });
  
  doc.setTextColor(glowBlue.r, glowBlue.g, glowBlue.b);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Conte com a Praticcar 💙❤️', pageWidth / 2, y + 24, { align: 'center' });

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

// ============= PDF COMPARATIVO PREMIUM MULTI-PÁGINAS =============

// Função auxiliar para desenhar rodapé compacto (páginas subsequentes)
const desenharRodapeCompacto = (
  doc: jsPDF,
  cotacao: CotacaoComparativaParaPdf,
  logoBase64: string | null,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  paginaAtual: number,
  totalPaginas: number,
  isUltimaPagina: boolean = false
) => {
  // Cor do WhatsApp
  const whatsappGreen = { r: 37, g: 211, b: 102 };
  
  // Verificar se deve exibir botão de WhatsApp (última página + vendedor com whatsapp)
  const vendedorWhatsapp = cotacao.vendedor?.whatsapp;
  const mostrarBotaoWhatsapp = isUltimaPagina && vendedorWhatsapp;
  
  // Ajustar Y do rodapé se tiver botão de WhatsApp
  const footerY = pageHeight - 20;
  
  // Botão de WhatsApp (se aplicável)
  if (mostrarBotaoWhatsapp) {
    const btnWidth = 80;
    const btnHeight = 14;
    const btnX = (pageWidth - btnWidth) / 2;
    const btnY = footerY - 22;
    
    // Limpar número de telefone (apenas dígitos)
    const numeroLimpo = vendedorWhatsapp.replace(/\D/g, '');
    const mensagem = encodeURIComponent(`Olá! Vi a cotação #${cotacao.numero || 'N/A'} e gostaria de mais informações.`);
    const whatsappUrl = `https://wa.me/55${numeroLimpo}?text=${mensagem}`;
    
    // Desenhar botão
    doc.setFillColor(whatsappGreen.r, whatsappGreen.g, whatsappGreen.b);
    doc.roundedRect(btnX, btnY, btnWidth, btnHeight, 3, 3, 'F');
    
    // Texto do botão
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const vendedorNome = cotacao.vendedor?.nome?.split(' ')[0] || 'Vendedor';
    doc.text(`💬 Falar com ${vendedorNome}`, pageWidth / 2, btnY + 9, { align: 'center' });
    
    // Adicionar link clicável
    doc.link(btnX, btnY, btnWidth, btnHeight, { url: whatsappUrl });
  }

  // Linha gradiente
  drawGradientRect(doc, margin, footerY - 4, pageWidth - margin * 2, 1.5, glowBlue, brandRed, 40);

  // Fundo do rodapé
  doc.setFillColor(premiumCard.r, premiumCard.g, premiumCard.b);
  doc.rect(0, footerY, pageWidth, 20, 'F');

  // Logo pequeno
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', margin, footerY + 2, 14, 14);
  }

  const footerTextX = logoBase64 ? margin + 18 : margin;

  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('PRATICCAR', footerTextX, footerY + 7);

  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.text('Proteção Veicular', footerTextX, footerY + 12);

  // Número da cotação e página
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(7);
  doc.text(`#${cotacao.numero || 'N/A'} | Página ${paginaAtual} de ${totalPaginas}`, pageWidth - margin, footerY + 10, { align: 'right' });
};

// Função para desenhar página de capa (Página 1)
const desenharPaginaCapa = (
  doc: jsPDF,
  cotacao: CotacaoComparativaParaPdf,
  logoBase64: string | null,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  totalPaginas: number,
  isUltimaPagina: boolean = false
) => {
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // Background
  drawPageBackground(doc, pageWidth, pageHeight);

  // Header
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

  // Removido: Badge cotação não é mais exibido

  y = headerHeight + 6;

  // Barra de validade
  doc.setFillColor(premiumCard.r, premiumCard.g, premiumCard.b);
  doc.roundedRect(margin, y, contentWidth, 12, 3, 3, 'F');

  const dataValidade = new Date(cotacao.created_at);
  dataValidade.setDate(dataValidade.getDate() + (cotacao.validade_dias || 7));

  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(8);
  doc.text(`Emitido em: ${formatDate(cotacao.created_at)}`, margin + 5, y + 8);
  
  doc.setTextColor(warningYellow.r, warningYellow.g, warningYellow.b);
  doc.setFont('helvetica', 'bold');
  doc.text(`Válida até: ${formatDate(dataValidade.toISOString())}`, pageWidth - margin - 5, y + 8, { align: 'right' });

  y += 16;

  // Dados do solicitante e veículo
  doc.setFillColor(premiumCard.r, premiumCard.g, premiumCard.b);
  doc.roundedRect(margin, y, contentWidth, 28, 3, 3, 'F');

  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  
  doc.text('Cliente:', margin + 5, y + 9);
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.setFont('helvetica', 'bold');
  doc.text(cotacao.nome_solicitante || 'Não informado', margin + 25, y + 9);
  
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFont('helvetica', 'normal');
  doc.text('Telefone:', pageWidth / 2 + 10, y + 9);
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.text(formatPhone(cotacao.telefone1_solicitante), pageWidth / 2 + 32, y + 9);

  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFont('helvetica', 'normal');
  doc.text('Veículo:', margin + 5, y + 18);
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.setFont('helvetica', 'bold');
  doc.text(`${cotacao.veiculo_marca || ''} ${cotacao.veiculo_modelo || ''} ${cotacao.veiculo_ano || ''}`, margin + 28, y + 18);
  
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFont('helvetica', 'normal');
  doc.text('Placa:', pageWidth / 2 + 10, y + 18);
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.text(formatPlaca(cotacao.veiculo_placa), pageWidth / 2 + 28, y + 18);

  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFont('helvetica', 'normal');
  doc.text('Valor FIPE:', margin + 5, y + 26);
  doc.setTextColor(successGreen.r, successGreen.g, successGreen.b);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(cotacao.valor_fipe), margin + 32, y + 26);

  y += 34;

  // Título da seção de planos
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`${cotacao.planosComparar.length} OPÇÕES PARA SUA PROTEÇÃO`, pageWidth / 2, y, { align: 'center' });
  y += 4;
  drawGradientRect(doc, margin, y, contentWidth, 1.5, glowBlue, brandRed, 40);
  y += 10;

  // Cards resumidos dos planos - Máximo 3 por linha, centralizados
  const numPlanos = cotacao.planosComparar.length;
  const MAX_CARDS_POR_LINHA = 3;
  const cardGap = 6;
  const cardWidth = 60; // Largura aumentada para nomes maiores
  const cardHeight = 72; // Altura reduzida
  const planoRecomendadoIndex = numPlanos > 1 ? 1 : 0;

  cotacao.planosComparar.forEach((plano, index) => {
    // Calcular posição na grade
    const linhaAtual = Math.floor(index / MAX_CARDS_POR_LINHA);
    const posicaoNaLinha = index % MAX_CARDS_POR_LINHA;
    const planosNestaLinha = Math.min(
      MAX_CARDS_POR_LINHA, 
      numPlanos - (linhaAtual * MAX_CARDS_POR_LINHA)
    );
    
    // Largura total ocupada pelos cards nesta linha
    const larguraLinha = (cardWidth * planosNestaLinha) + (cardGap * (planosNestaLinha - 1));
    
    // Posição X inicial para centralizar
    const startX = (pageWidth - larguraLinha) / 2;
    
    // Posição X do card atual
    const cardX = startX + (cardWidth + cardGap) * posicaoNaLinha;
    
    // Posição Y baseada na linha
    const cardY = y + (cardHeight + cardGap) * linhaAtual;

    const isRecommended = index === planoRecomendadoIndex;

    // Card
    drawPremiumCard(doc, cardX, cardY, cardWidth, cardHeight, { 
      isRecommended, 
      hasGlow: true 
    });

    const centerX = cardX + cardWidth / 2;
    
    // Posições fixas para garantir alinhamento entre todos os cards
    const nomeY = cardY + 10;        // Nome do plano
    const valorY = cardY + 26;       // Valor mensal
    const mensalY = cardY + 32;      // "médio mensal"
    const fipeY = cardY + 42;        // Badge FIPE

    // Nome do plano - usando splitTextToSize para quebrar em múltiplas linhas
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    const nomeLines = doc.splitTextToSize(plano.nome.toUpperCase(), cardWidth - 8);
    const linesToShow = nomeLines.slice(0, 2); // Máximo 2 linhas
    linesToShow.forEach((line: string, lineIndex: number) => {
      doc.text(line, centerX, nomeY + (lineIndex * 5), { align: 'center' });
    });

    // Valor mensal
    doc.setTextColor(successGreen.r, successGreen.g, successGreen.b);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(plano.valorMensal), centerX, valorY, { align: 'center' });
    
    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.setFontSize(5);
    doc.setFont('helvetica', 'normal');
    doc.text('médio mensal', centerX, mensalY, { align: 'center' });

    // Badge FIPE - posição fixa para alinhamento horizontal entre todos os cards
    doc.setFillColor(glowBlue.r, glowBlue.g, glowBlue.b);
    doc.roundedRect(cardX + 6, fipeY - 3, cardWidth - 12, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(5);
    doc.setFont('helvetica', 'bold');
    doc.text(`${plano.coberturaFipe}% FIPE`, centerX, fipeY + 2, { align: 'center' });
  });

  // Calcular quantas linhas de cards foram usadas
  const numLinhas = Math.ceil(numPlanos / MAX_CARDS_POR_LINHA);
  y += (cardHeight + cardGap) * numLinhas + 4;

  // Tabela resumo de valores - Layout centralizado
  const tabelaWidth = Math.min(contentWidth, (cardWidth + cardGap) * Math.min(numPlanos, MAX_CARDS_POR_LINHA) + 40);
  const tabelaX = (pageWidth - tabelaWidth) / 2;
  
  doc.setFillColor(premiumCard.r, premiumCard.g, premiumCard.b);
  doc.roundedRect(tabelaX, y, tabelaWidth, 28, 3, 3, 'F');

  // Labels
  const labelWidth = 45;
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('ADESÃO', tabelaX + 5, y + 8);
  doc.text('MÉDIO MENSAL', tabelaX + 5, y + 15);
  doc.text('1º PAGAMENTO', tabelaX + 5, y + 22);

  // Valores por plano (max 3 por linha)
  const planosExibidos = cotacao.planosComparar.slice(0, MAX_CARDS_POR_LINHA);
  const valorWidth = (tabelaWidth - labelWidth) / planosExibidos.length;
  
  planosExibidos.forEach((plano, index) => {
    const valorX = tabelaX + labelWidth + valorWidth * index + valorWidth / 2;
    const primeiroPagamento = plano.valorAdesao; // Primeiro pagamento = apenas adesão

    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(formatCurrency(plano.valorAdesao), valorX, y + 8, { align: 'center' });
    doc.text(formatCurrency(plano.valorMensal), valorX, y + 15, { align: 'center' });
    
    doc.setTextColor(successGreen.r, successGreen.g, successGreen.b);
    doc.setFont('helvetica', 'bold');
    doc.text(formatCurrency(primeiroPagamento), valorX, y + 22, { align: 'center' });
  });

  // Se houver mais de 3 planos, adicionar segunda tabela
  if (numPlanos > MAX_CARDS_POR_LINHA) {
    y += 32;
    const planosRestantes = cotacao.planosComparar.slice(MAX_CARDS_POR_LINHA);
    const tabelaWidth2 = Math.min(contentWidth, (cardWidth + cardGap) * planosRestantes.length + 40);
    const tabelaX2 = (pageWidth - tabelaWidth2) / 2;
    
    doc.setFillColor(premiumCard.r, premiumCard.g, premiumCard.b);
    doc.roundedRect(tabelaX2, y, tabelaWidth2, 28, 3, 3, 'F');

    doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('ADESÃO', tabelaX2 + 5, y + 8);
    doc.text('MÉDIO MENSAL', tabelaX2 + 5, y + 15);
    doc.text('1º PAGAMENTO', tabelaX2 + 5, y + 22);

    const valorWidth2 = (tabelaWidth2 - labelWidth) / planosRestantes.length;
    
    planosRestantes.forEach((plano, index) => {
      const valorX = tabelaX2 + labelWidth + valorWidth2 * index + valorWidth2 / 2;
      const primeiroPagamento = plano.valorAdesao; // Primeiro pagamento = apenas adesão

      doc.setTextColor(textLight.r, textLight.g, textLight.b);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(formatCurrency(plano.valorAdesao), valorX, y + 8, { align: 'center' });
      doc.text(formatCurrency(plano.valorMensal), valorX, y + 15, { align: 'center' });
      
      doc.setTextColor(successGreen.r, successGreen.g, successGreen.b);
      doc.setFont('helvetica', 'bold');
      doc.text(formatCurrency(primeiroPagamento), valorX, y + 22, { align: 'center' });
    });
  }

  // Rodapé (se for única página, passa isUltimaPagina)
  desenharRodapeCompacto(doc, cotacao, logoBase64, pageWidth, pageHeight, margin, 1, totalPaginas, isUltimaPagina);
};

// Função para desenhar página de detalhes de um plano
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
  totalPaginas: number
) => {
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // Background
  drawPageBackground(doc, pageWidth, pageHeight);

  // Header compacto
  const headerHeight = 38;
  drawGradientRect(doc, 0, 0, pageWidth, headerHeight, brandBlue, { r: 30, g: 70, b: 130 });
  drawGradientRect(doc, 0, headerHeight - 2, pageWidth, 2, glowBlue, brandRed, 60);

  // Badge plano X de Y
  doc.setFillColor(premiumCard.r, premiumCard.g, premiumCard.b);
  doc.roundedRect(margin, 8, 55, 12, 2, 2, 'F');
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text(`PLANO ${numeroPlano} DE ${totalPlanos}`, margin + 27.5, 16, { align: 'center' });

  // Nome do plano
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(truncateText(plano.nome.toUpperCase(), 28), margin + 65, 18);

  // Removido: Código da cotação não é mais exibido

  // Dados do veículo resumido
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.setFontSize(8);
  doc.text(`${cotacao.veiculo_marca} ${cotacao.veiculo_modelo} ${cotacao.veiculo_ano}`, pageWidth - margin, 20, { align: 'right' });
  doc.setTextColor(successGreen.r, successGreen.g, successGreen.b);
  doc.text(formatCurrency(cotacao.valor_fipe), pageWidth - margin, 28, { align: 'right' });

  y = headerHeight + 8;

  // Card principal do plano - NOVO LAYOUT
  const valorCardHeight = 85;
  drawPremiumCard(doc, margin, y, contentWidth, valorCardHeight, { isRecommended: true, hasGlow: true });

  let cardY = y + 10;

  // Linha 1: Nome do plano + Badge adicional mensal
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(truncateText(plano.nome.toUpperCase(), 26), margin + 10, cardY);

  // Badge adicional mensal (se existir)
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

  // Linha 2: Tags horizontais (100% FIPE + > ANO)
  let tagX = margin + 10;
  
  // Tag cobertura FIPE
  const fipeText = `${plano.coberturaFipe}% FIPE`;
  const fipeWidth = fipeText.length * 3 + 12;
  doc.setFillColor(glowBlue.r, glowBlue.g, glowBlue.b);
  doc.roundedRect(tagX, cardY - 4, fipeWidth, 11, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(fipeText, tagX + fipeWidth / 2, cardY + 3, { align: 'center' });
  tagX += fipeWidth + 6;

  // Tag ano mínimo (se existir)
  if (plano.anoMinimo) {
    const anoText = `> ${plano.anoMinimo}`;
    const anoWidth = anoText.length * 3.5 + 10;
    doc.setFillColor(premiumCardLight.r, premiumCardLight.g, premiumCardLight.b);
    doc.roundedRect(tagX, cardY - 4, anoWidth, 11, 2, 2, 'F');
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.setFontSize(8);
    doc.text(anoText, tagX + anoWidth / 2, cardY + 3, { align: 'center' });
  }

  cardY += 18;

  // Linha 3: Cota Passeio
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

  // Linha 4: Com Deságio (verde, se existir)
  if (plano.cotaDesagio && plano.cotaMinimaDesagio) {
    doc.setTextColor(successGreen.r, successGreen.g, successGreen.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Com Deságio: ${plano.cotaDesagio}% (mín ${formatCurrency(plano.cotaMinimaDesagio)})`, margin + 10, cardY);
    cardY += 12;
  }

  // Valor mensal grande - lado direito do card
  doc.setTextColor(successGreen.r, successGreen.g, successGreen.b);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(plano.valorMensal), pageWidth - margin - 10, y + 32, { align: 'right' });
  
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('/mês', pageWidth - margin - 10, y + 44, { align: 'right' });

  y += valorCardHeight + 8;

  // Card de Alerta de Deságio (amarelo, se existir)
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

  // Seção de coberturas
  drawPremiumSectionHeader(doc, margin, y, contentWidth, 'COBERTURAS INCLUÍDAS');
  y += HEADER_HEIGHT + 6;

  // Coberturas em 2 colunas
  const coberturas = plano.coberturas;
  const coberturasCol1 = coberturas.slice(0, Math.ceil(coberturas.length / 2));
  const coberturasCol2 = coberturas.slice(Math.ceil(coberturas.length / 2));
  const coberturaLineHeight = 9;
  const col1X = margin;
  const col2X = margin + contentWidth / 2 + 4;
  const colWidth = contentWidth / 2 - 4;

  const startCobY = y;
  coberturasCol1.forEach((cobertura, index) => {
    const lineY = startCobY + index * coberturaLineHeight;
    const textY = lineY + 6;
    
    if (index % 2 === 0) {
      doc.setFillColor(premiumCard.r, premiumCard.g, premiumCard.b);
      doc.rect(col1X, lineY, colWidth, coberturaLineHeight, 'F');
    }
    
    drawCheckIndicator(doc, col1X + 6, textY);
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(truncateText(cobertura, 32), col1X + 14, textY);
  });

  coberturasCol2.forEach((cobertura, index) => {
    const lineY = startCobY + index * coberturaLineHeight;
    const textY = lineY + 6;
    
    if (index % 2 === 0) {
      doc.setFillColor(premiumCard.r, premiumCard.g, premiumCard.b);
      doc.rect(col2X, lineY, colWidth, coberturaLineHeight, 'F');
    }
    
    drawCheckIndicator(doc, col2X + 6, textY);
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(truncateText(cobertura, 32), col2X + 14, textY);
  });

  y = startCobY + Math.max(coberturasCol1.length, coberturasCol2.length) * coberturaLineHeight + 10;

  // Seção: Não inclui (se houver)
  if (plano.naoInclui && plano.naoInclui.length > 0) {
    drawPremiumSectionHeader(doc, margin, y, contentWidth, 'NÃO INCLUI NESTE PLANO');
    y += HEADER_HEIGHT + 6;

    const naoIncluiCol1 = plano.naoInclui.slice(0, Math.ceil(plano.naoInclui.length / 2));
    const naoIncluiCol2 = plano.naoInclui.slice(Math.ceil(plano.naoInclui.length / 2));
    
    const startNaoY = y;
    naoIncluiCol1.forEach((item, index) => {
      const lineY = startNaoY + index * coberturaLineHeight;
      const textY = lineY + 6;
      
      if (index % 2 === 0) {
        doc.setFillColor(30, 30, 40);
        doc.rect(col1X, lineY, colWidth, coberturaLineHeight, 'F');
      }
      
      // X vermelho
      doc.setTextColor(glowRed.r, glowRed.g, glowRed.b);
      doc.setFontSize(9);
      doc.text('✗', col1X + 6, textY);
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.setFont('helvetica', 'normal');
      doc.text(truncateText(item, 32), col1X + 14, textY);
    });

    naoIncluiCol2.forEach((item, index) => {
      const lineY = startNaoY + index * coberturaLineHeight;
      const textY = lineY + 6;
      
      if (index % 2 === 0) {
        doc.setFillColor(30, 30, 40);
        doc.rect(col2X, lineY, colWidth, coberturaLineHeight, 'F');
      }
      
      doc.setTextColor(glowRed.r, glowRed.g, glowRed.b);
      doc.setFontSize(9);
      doc.text('✗', col2X + 6, textY);
      doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
      doc.setFont('helvetica', 'normal');
      doc.text(truncateText(item, 32), col2X + 14, textY);
    });

    y = startNaoY + Math.max(naoIncluiCol1.length, naoIncluiCol2.length) * coberturaLineHeight + 10;
  }

  // ============= VALORES (SIMPLIFICADO - SEM COMPOSIÇÃO INTERNA) =============
  const labelCol = margin + 8;
  const valueCol = pageWidth - margin - 8;

  // Card: VALOR MÉDIO MENSAL (destaque azul)
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

  // Taxa de adesão
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Taxa de Adesão (pagamento único)', labelCol, y);
  doc.setTextColor(textLight.r, textLight.g, textLight.b);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(plano.valorAdesao), valueCol, y, { align: 'right' });
  y += 14;

  // Card: PRIMEIRO PAGAMENTO (destaque verde)
  const primeiroPagamento = plano.valorAdesao + plano.valorMensal;
  doc.setFillColor(successGreen.r, successGreen.g, successGreen.b);
  doc.roundedRect(margin, y, contentWidth, 22, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PRIMEIRO PAGAMENTO', labelCol, y + 14);
  doc.setFontSize(18);
  doc.text(formatCurrency(primeiroPagamento), valueCol, y + 14, { align: 'right' });

  // Rodapé
  desenharRodapeCompacto(doc, cotacao, logoBase64, pageWidth, pageHeight, margin, paginaAtual, totalPaginas);
};

// Função para desenhar página comparativa (última página)
const desenharPaginaComparativa = (
  doc: jsPDF,
  cotacao: CotacaoComparativaParaPdf,
  logoBase64: string | null,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  paginaAtual: number,
  totalPaginas: number
) => {
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // Background
  drawPageBackground(doc, pageWidth, pageHeight);

  // Header
  const headerHeight = 32;
  drawGradientRect(doc, 0, 0, pageWidth, headerHeight, brandBlue, { r: 30, g: 70, b: 130 });
  drawGradientRect(doc, 0, headerHeight - 2, pageWidth, 2, glowBlue, brandRed, 60);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('TABELA COMPARATIVA DE COBERTURAS', pageWidth / 2, 20, { align: 'center' });

  y = headerHeight + 8;

  // Configurar colunas
  const numPlanos = cotacao.planosComparar.length;
  const labelColWidth = 65;
  const planoColWidth = (contentWidth - labelColWidth) / numPlanos;

  // Header da tabela
  doc.setFillColor(premiumCard.r, premiumCard.g, premiumCard.b);
  doc.rect(margin, y, contentWidth, 16, 'F');
  
  doc.setTextColor(textMuted.r, textMuted.g, textMuted.b);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('COBERTURA', margin + 5, y + 10);

  cotacao.planosComparar.forEach((plano, index) => {
    const colX = margin + labelColWidth + (planoColWidth * index) + planoColWidth / 2;
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    
    // Quebrar nome se muito longo
    const nomeLinhas = plano.nome.length > 14 
      ? [plano.nome.substring(0, 14), plano.nome.substring(14, 28)]
      : [plano.nome];
    nomeLinhas.forEach((linha, i) => {
      doc.text(linha.toUpperCase(), colX, y + 6 + (i * 5), { align: 'center' });
    });
  });

  y += 18;

  // Coletar todas as coberturas únicas
  const todasCoberturas = new Set<string>();
  cotacao.planosComparar.forEach(plano => {
    plano.coberturas.forEach(c => todasCoberturas.add(c));
  });

  const coberturasArray = Array.from(todasCoberturas);
  const rowHeight = 8;

  coberturasArray.forEach((cobertura, index) => {
    // Verificar se precisa de nova página
    if (y + rowHeight > pageHeight - 50) {
      // Para simplificar, vamos apenas limitar o número de linhas
      return;
    }

    // Fundo alternado
    if (index % 2 === 0) {
      doc.setFillColor(30, 41, 59);
      doc.rect(margin, y, contentWidth, rowHeight, 'F');
    }
    
    // Nome da cobertura
    doc.setTextColor(textLight.r, textLight.g, textLight.b);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(truncateText(cobertura, 38), margin + 5, y + 5);
    
    // Check ou traço para cada plano
    cotacao.planosComparar.forEach((plano, planoIndex) => {
      const colX = margin + labelColWidth + (planoColWidth * planoIndex) + planoColWidth / 2;
      const temCobertura = plano.coberturas.some(c => 
        c.toLowerCase() === cobertura.toLowerCase()
      );
      
      if (temCobertura) {
        doc.setTextColor(successGreen.r, successGreen.g, successGreen.b);
        doc.setFontSize(10);
        doc.text('✓', colX, y + 5.5, { align: 'center' });
      } else {
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.text('—', colX, y + 5, { align: 'center' });
      }
    });
    
    y += rowHeight;
  });

  y += 6;

  // Linha separadora
  drawGradientRect(doc, margin, y, contentWidth, 1.5, glowBlue, brandRed, 40);
  y += 8;

  // Linhas de valores
  const linhasValores = [
    { label: 'VALOR MÉDIO MENSAL', key: 'valorMensal', highlight: false },
    { label: 'TAXA DE ADESÃO', key: 'valorAdesao', highlight: false },
    { label: '1º PAGAMENTO', key: 'primeiroPagamento', highlight: true },
  ];

  linhasValores.forEach((linha, index) => {
    const isHighlight = linha.highlight;
    
    if (isHighlight) {
      doc.setFillColor(successGreen.r, successGreen.g, successGreen.b);
    } else if (index % 2 === 0) {
      doc.setFillColor(premiumCard.r, premiumCard.g, premiumCard.b);
    } else {
      doc.setFillColor(premiumDark.r, premiumDark.g, premiumDark.b);
    }
    doc.rect(margin, y, contentWidth, 12, 'F');
    
    doc.setTextColor(isHighlight ? 255 : textLight.r, isHighlight ? 255 : textLight.g, isHighlight ? 255 : textLight.b);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(linha.label, margin + 5, y + 8);
    
    cotacao.planosComparar.forEach((plano, planoIndex) => {
      const colX = margin + labelColWidth + (planoColWidth * planoIndex) + planoColWidth / 2;
      let valor: number;
      
      if (linha.key === 'primeiroPagamento') {
        valor = plano.valorAdesao + plano.valorMensal;
      } else {
        valor = plano[linha.key as keyof PlanoParaPdf] as number;
      }
      
      doc.setFontSize(isHighlight ? 11 : 9);
      doc.text(formatCurrency(valor), colX, y + 8, { align: 'center' });
    });
    
    y += 12;
  });

  // Rodapé (esta é a última página, então passa true)
  desenharRodapeCompacto(doc, cotacao, logoBase64, pageWidth, pageHeight, margin, paginaAtual, totalPaginas, true);
};

export async function gerarPdfCotacaoComparativa(cotacao: CotacaoComparativaParaPdf): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // Carregar logo
  const logoBase64 = await loadImageAsBase64('/pratic-logo.png');

  const numPlanos = cotacao.planosComparar.length;
  
  // PDF simplificado: apenas 2 páginas
  // 1 capa com cards + 1 tabela comparativa (se > 1 plano)
  const totalPaginas = numPlanos > 1 ? 2 : 1;

  // ============= PÁGINA 1: CAPA COM CARDS DOS PLANOS =============
  // Se só tem 1 plano, esta é a última página
  const isCapaUltimaPagina = numPlanos <= 1;
  desenharPaginaCapa(doc, cotacao, logoBase64, pageWidth, pageHeight, margin, totalPaginas, isCapaUltimaPagina);

  // ============= PÁGINA 2: TABELA COMPARATIVA (se mais de 1 plano) =============
  if (numPlanos > 1) {
    doc.addPage();
    desenharPaginaComparativa(
      doc, 
      cotacao, 
      logoBase64, 
      pageWidth, 
      pageHeight, 
      margin,
      2,
      totalPaginas
    );
  }

  // ============= DOWNLOAD =============
  const numeroLimpo = (cotacao.numero || 'PRATICCAR').replace(/[^a-zA-Z0-9-]/g, '');
  doc.save(`cotacao-comparativa-${numeroLimpo}.pdf`);
}
