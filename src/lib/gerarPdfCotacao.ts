import { jsPDF } from 'jspdf';

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

// ============= Geração do PDF =============

export function gerarPdfCotacao(cotacao: CotacaoParaPdf): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  // Cores do tema
  const primaryColor = { r: 37, g: 99, b: 235 }; // blue-600
  const successColor = { r: 22, g: 163, b: 74 }; // green-600
  const grayLight = { r: 243, g: 244, b: 246 }; // gray-100
  const grayText = { r: 107, g: 114, b: 128 }; // gray-500

  // ============= HEADER =============
  doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  const title = 'PRATICCAR';
  const titleWidth = doc.getTextWidth(title);
  doc.text(title, (pageWidth - titleWidth) / 2, 20);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const subtitle = 'Proteção Veicular';
  const subtitleWidth = doc.getTextWidth(subtitle);
  doc.text(subtitle, (pageWidth - subtitleWidth) / 2, 30);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const docTitle = 'COTAÇÃO DE PROTEÇÃO';
  const docTitleWidth = doc.getTextWidth(docTitle);
  doc.text(docTitle, (pageWidth - docTitleWidth) / 2, 40);

  y = 55;

  // ============= BARRA DE INFORMAÇÕES =============
  doc.setFillColor(grayLight.r, grayLight.g, grayLight.b);
  doc.rect(margin, y, contentWidth, 14, 'F');
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Cotação: ${cotacao.numero || 'N/A'}`, margin + 5, y + 9);
  
  const dataValidade = new Date(cotacao.created_at);
  dataValidade.setDate(dataValidade.getDate() + (cotacao.validade_dias || 7));
  doc.setFont('helvetica', 'normal');
  const validadeText = `Válida até: ${formatDate(dataValidade.toISOString())}`;
  const validadeWidth = doc.getTextWidth(validadeText);
  doc.text(validadeText, pageWidth - margin - validadeWidth - 5, y + 9);
  
  y += 24;

  // ============= DADOS DO SOLICITANTE =============
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.text('DADOS DO SOLICITANTE', margin, y);
  
  y += 3;
  doc.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  
  y += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  
  // Priorizar dados diretos da cotação, fallback para lead
  const clienteNome = cotacao.nome_solicitante || cotacao.leads?.nome || 'Não informado';
  const clienteTelefone = cotacao.telefone1_solicitante || cotacao.leads?.telefone || '';
  const clienteEmail = cotacao.email_solicitante || cotacao.leads?.email || '';

  doc.setFont('helvetica', 'bold');
  doc.text('Nome:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(clienteNome, margin + 25, y);
  
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Telefone:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(formatPhone(clienteTelefone), margin + 25, y);
  
  if (clienteEmail) {
    doc.setFont('helvetica', 'bold');
    doc.text('E-mail:', pageWidth / 2, y);
    doc.setFont('helvetica', 'normal');
    doc.text(clienteEmail, pageWidth / 2 + 20, y);
  }
  
  y += 15;

  // ============= DADOS DO VEÍCULO =============
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.text('DADOS DO VEÍCULO', margin, y);
  
  y += 3;
  doc.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.line(margin, y, pageWidth - margin, y);
  
  y += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);

  const col1 = margin;
  const col2 = pageWidth / 2;
  
  // Linha 1: Marca e Modelo
  doc.setFont('helvetica', 'bold');
  doc.text('Marca:', col1, y);
  doc.setFont('helvetica', 'normal');
  doc.text(cotacao.veiculo_marca || '—', col1 + 22, y);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Modelo:', col2, y);
  doc.setFont('helvetica', 'normal');
  doc.text(cotacao.veiculo_modelo || '—', col2 + 22, y);
  
  y += 7;
  
  // Linha 2: Ano e Placa
  doc.setFont('helvetica', 'bold');
  doc.text('Ano:', col1, y);
  doc.setFont('helvetica', 'normal');
  doc.text(cotacao.veiculo_ano?.toString() || '—', col1 + 22, y);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Placa:', col2, y);
  doc.setFont('helvetica', 'normal');
  doc.text(formatPlaca(cotacao.veiculo_placa), col2 + 22, y);
  
  y += 7;
  
  // Linha 3: Código FIPE e Valor FIPE
  doc.setFont('helvetica', 'bold');
  doc.text('Código FIPE:', col1, y);
  doc.setFont('helvetica', 'normal');
  doc.text(cotacao.codigo_fipe || '—', col1 + 35, y);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Valor FIPE:', col2, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(successColor.r, successColor.g, successColor.b);
  doc.text(formatCurrency(cotacao.valor_fipe), col2 + 30, y);
  doc.setTextColor(0, 0, 0);
  
  y += 18;

  // ============= PLANO SELECIONADO (Card destacado) =============
  const planoNome = cotacao.planos?.nome || 'Plano Selecionado';
  
  // Box do plano com borda
  doc.setFillColor(240, 249, 255); // blue-50
  doc.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.setLineWidth(1);
  doc.roundedRect(margin, y, contentWidth, 28, 4, 4, 'FD');
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.text(planoNome.toUpperCase(), margin + 10, y + 12);
  
  doc.setFontSize(18);
  doc.setTextColor(successColor.r, successColor.g, successColor.b);
  const valorMensalText = `${formatCurrency(cotacao.valor_total_mensal)}/mês`;
  const valorWidth = doc.getTextWidth(valorMensalText);
  doc.text(valorMensalText, pageWidth - margin - valorWidth - 10, y + 18);
  
  y += 38;

  // ============= COBERTURAS DO PLANO =============
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.text('COBERTURAS INCLUÍDAS', margin, y);
  
  y += 3;
  doc.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  
  y += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  // Usar coberturas do plano se disponíveis, senão usar padrão
  const coberturas = (cotacao.planos?.coberturas && cotacao.planos.coberturas.length > 0) 
    ? cotacao.planos.coberturas 
    : COBERTURAS_PADRAO;
  
  // Exibir em 2 colunas
  const coberturasCol1 = coberturas.slice(0, Math.ceil(coberturas.length / 2));
  const coberturasCol2 = coberturas.slice(Math.ceil(coberturas.length / 2));
  
  const startY = y;
  coberturasCol1.forEach((cobertura, index) => {
    doc.setTextColor(successColor.r, successColor.g, successColor.b);
    doc.text('✓', margin, startY + (index * 5));
    doc.setTextColor(0, 0, 0);
    doc.text(cobertura, margin + 6, startY + (index * 5));
  });
  
  coberturasCol2.forEach((cobertura, index) => {
    doc.setTextColor(successColor.r, successColor.g, successColor.b);
    doc.text('✓', col2, startY + (index * 5));
    doc.setTextColor(0, 0, 0);
    doc.text(cobertura, col2 + 6, startY + (index * 5));
  });
  
  y = startY + Math.max(coberturasCol1.length, coberturasCol2.length) * 5 + 12;

  // ============= COMPOSIÇÃO DO VALOR =============
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.text('COMPOSIÇÃO DO VALOR', margin, y);
  
  y += 3;
  doc.setDrawColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.line(margin, y, pageWidth - margin, y);
  
  y += 10;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  
  const labelCol = margin + 5;
  const valueCol = pageWidth - margin - 40;
  
  const valores = [
    { label: 'Cota Base (mensalidade)', valor: cotacao.valor_cota },
    { label: 'Taxa Administrativa', valor: cotacao.taxa_administrativa },
    { label: 'Rastreamento', valor: cotacao.valor_rastreamento },
    { label: 'Assistência 24h', valor: cotacao.valor_assistencia },
  ];
  
  valores.forEach(({ label, valor }) => {
    doc.setFont('helvetica', 'normal');
    doc.text(label, labelCol, y);
    doc.text(formatCurrency(valor), valueCol, y, { align: 'right' });
    y += 7;
  });
  
  // Linha separadora
  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Total mensal (destaque)
  doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
  doc.rect(margin, y - 5, contentWidth, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('MENSALIDADE TOTAL', labelCol, y + 3);
  doc.text(formatCurrency(cotacao.valor_total_mensal), valueCol, y + 3, { align: 'right' });
  
  y += 18;
  doc.setTextColor(0, 0, 0);

  // Taxa de adesão
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Taxa de Adesão (pagamento único)', labelCol, y);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(cotacao.valor_adesao), valueCol, y, { align: 'right' });
  
  y += 12;

  // Primeiro pagamento
  const primeiroPagamento = (cotacao.valor_adesao || 0) + (cotacao.valor_total_mensal || 0);
  doc.setFillColor(successColor.r, successColor.g, successColor.b);
  doc.rect(margin, y - 5, contentWidth, 16, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('PRIMEIRO PAGAMENTO', labelCol, y + 4);
  doc.text(formatCurrency(primeiroPagamento), valueCol, y + 4, { align: 'right' });

  // ============= RODAPÉ =============
  const footerY = pageHeight - 30;
  
  doc.setDrawColor(grayLight.r, grayLight.g, grayLight.b);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
  
  doc.setTextColor(grayText.r, grayText.g, grayText.b);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const footerTitle = 'PRATICCAR - Proteção Veicular';
  const footerTitleWidth = doc.getTextWidth(footerTitle);
  doc.text(footerTitle, (pageWidth - footerTitleWidth) / 2, footerY);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const footerDate = `Gerado em: ${formatDate(new Date().toISOString())} | Validade: ${cotacao.validade_dias || 7} dias`;
  const footerDateWidth = doc.getTextWidth(footerDate);
  doc.text(footerDate, (pageWidth - footerDateWidth) / 2, footerY + 6);
  
  const disclaimer = 'Esta cotação não tem valor contratual e está sujeita a análise.';
  const disclaimerWidth = doc.getTextWidth(disclaimer);
  doc.text(disclaimer, (pageWidth - disclaimerWidth) / 2, footerY + 12);

  // ============= DOWNLOAD =============
  const numeroLimpo = (cotacao.numero || 'PRATICCAR').replace(/[^a-zA-Z0-9-]/g, '');
  const fileName = `cotacao-${numeroLimpo}.pdf`;
  doc.save(fileName);
}
