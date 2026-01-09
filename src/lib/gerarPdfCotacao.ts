import { jsPDF } from 'jspdf';
import type { Tables } from '@/integrations/supabase/types';

interface CotacaoParaPdf {
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
  codigo_fipe: string | null;
  created_at: string;
  validade_dias: number | null;
  leads?: Tables<'leads'> | null;
  planos?: Tables<'planos'> | null;
}

const formatCurrency = (value: number | null | undefined): string => {
  if (!value) return 'R$ 0,00';
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
  return phone;
};

const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const COBERTURAS_POR_PLANO: Record<string, string[]> = {
  'proteção básica': [
    'Proteção contra roubo/furto',
    'Proteção contra colisão',
    'Proteção contra incêndio',
    'Assistência 24h (100km)',
  ],
  'proteção total': [
    'Proteção contra roubo/furto',
    'Proteção contra colisão',
    'Proteção contra incêndio',
    'Assistência 24h (200km)',
    'Proteção de vidros',
    'App de rastreamento',
    'Carro reserva (7 dias)',
  ],
  'proteção premium': [
    'Proteção contra roubo/furto',
    'Proteção contra colisão',
    'Proteção contra incêndio',
    'Assistência 24h Premium (ilimitada)',
    'Proteção de vidros',
    'App de rastreamento',
    'Carro reserva (15 dias)',
    'Proteção para terceiros até R$ 50.000',
    'Desconto em rede credenciada',
  ],
};

export function gerarPdfCotacao(cotacao: CotacaoParaPdf): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Helper para centralizar texto
  const centerText = (text: string, yPos: number, fontSize: number = 12) => {
    doc.setFontSize(fontSize);
    const textWidth = doc.getTextWidth(text);
    doc.text(text, (pageWidth - textWidth) / 2, yPos);
  };

  // Helper para linha
  const drawLine = (yPos: number) => {
    doc.setDrawColor(200, 200, 200);
    doc.line(20, yPos, pageWidth - 20, yPos);
  };

  // HEADER
  doc.setFillColor(59, 130, 246); // Primary blue
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  centerText('SGA PRATIC', 15, 24);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  centerText('Proteção Veicular', 25, 12);
  
  doc.setFontSize(10);
  centerText('PROPOSTA DE ADESÃO', 35, 10);

  // Reset text color
  doc.setTextColor(0, 0, 0);
  y = 55;

  // NÚMERO DA COTAÇÃO
  doc.setFillColor(245, 245, 245);
  doc.rect(20, y - 5, pageWidth - 40, 15, 'F');
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Cotação: ${cotacao.numero || 'N/A'}`, 25, y + 4);
  
  const dataValidade = new Date(cotacao.created_at);
  dataValidade.setDate(dataValidade.getDate() + (cotacao.validade_dias || 7));
  doc.setFont('helvetica', 'normal');
  doc.text(`Válida até: ${formatDate(dataValidade.toISOString())}`, pageWidth - 70, y + 4);
  
  y += 25;

  // DADOS DO CLIENTE
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text('DADOS DO CLIENTE', 20, y);
  doc.setTextColor(0, 0, 0);
  y += 8;
  drawLine(y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const clienteNome = cotacao.leads?.nome || 'Cliente não informado';
  const clienteTelefone = formatPhone(cotacao.leads?.telefone);
  const clienteEmail = cotacao.leads?.email || '—';

  doc.text(`Nome: ${clienteNome}`, 20, y);
  y += 6;
  doc.text(`Telefone: ${clienteTelefone}`, 20, y);
  doc.text(`E-mail: ${clienteEmail}`, pageWidth / 2, y);
  y += 15;

  // DADOS DO VEÍCULO
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text('DADOS DO VEÍCULO', 20, y);
  doc.setTextColor(0, 0, 0);
  y += 8;
  drawLine(y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  doc.text(`Marca: ${cotacao.veiculo_marca || '—'}`, 20, y);
  doc.text(`Modelo: ${cotacao.veiculo_modelo || '—'}`, pageWidth / 2, y);
  y += 6;
  doc.text(`Ano: ${cotacao.veiculo_ano || '—'}`, 20, y);
  doc.text(`Código FIPE: ${cotacao.codigo_fipe || '—'}`, pageWidth / 2, y);
  y += 6;
  
  doc.setFont('helvetica', 'bold');
  doc.text(`Valor FIPE: ${formatCurrency(cotacao.valor_fipe)}`, 20, y);
  doc.setFont('helvetica', 'normal');
  y += 15;

  // PLANO SELECIONADO
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text('PLANO SELECIONADO', 20, y);
  doc.setTextColor(0, 0, 0);
  y += 8;
  drawLine(y);
  y += 10;

  const planoNome = cotacao.planos?.nome || 'Plano';
  
  // Box do plano
  doc.setFillColor(240, 249, 255);
  doc.setDrawColor(59, 130, 246);
  doc.roundedRect(20, y - 5, pageWidth - 40, 25, 3, 3, 'FD');
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text(planoNome.toUpperCase(), 25, y + 7);
  
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(`${formatCurrency(cotacao.valor_total_mensal)}/mês`, pageWidth - 60, y + 7);
  
  y += 30;

  // COBERTURAS
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Coberturas incluídas:', 20, y);
  y += 8;

  const coberturas = COBERTURAS_POR_PLANO[planoNome.toLowerCase()] || COBERTURAS_POR_PLANO['proteção básica'];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  
  coberturas.forEach((cobertura) => {
    doc.text(`✓ ${cobertura}`, 25, y);
    y += 5;
  });
  
  y += 10;

  // VALORES
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(59, 130, 246);
  doc.text('DETALHAMENTO DE VALORES', 20, y);
  doc.setTextColor(0, 0, 0);
  y += 8;
  drawLine(y);
  y += 10;

  doc.setFontSize(10);
  const col1 = 25;
  const col2 = pageWidth - 60;

  const valores = [
    ['Valor da Cota (mensalidade base)', formatCurrency(cotacao.valor_cota)],
    ['Taxa Administrativa', formatCurrency(cotacao.taxa_administrativa)],
    ['Rastreamento', formatCurrency(cotacao.valor_rastreamento)],
    ['Assistência 24h', formatCurrency(cotacao.valor_assistencia)],
  ];

  valores.forEach(([label, valor]) => {
    doc.setFont('helvetica', 'normal');
    doc.text(label, col1, y);
    doc.text(valor, col2, y);
    y += 6;
  });

  // Linha separadora
  y += 2;
  drawLine(y);
  y += 8;

  // Total mensal
  doc.setFillColor(59, 130, 246);
  doc.rect(20, y - 5, pageWidth - 40, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('MENSALIDADE TOTAL', col1, y + 2);
  doc.text(formatCurrency(cotacao.valor_total_mensal), col2, y + 2);
  
  y += 15;
  doc.setTextColor(0, 0, 0);

  // Taxa de adesão
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Taxa de Adesão (pagamento único)', col1, y);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(cotacao.valor_adesao), col2, y);
  
  y += 12;

  // Primeiro pagamento
  const primeiroPagamento = (cotacao.valor_adesao || 0) + (cotacao.valor_total_mensal || 0);
  doc.setFillColor(34, 197, 94);
  doc.rect(20, y - 5, pageWidth - 40, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text('PRIMEIRO PAGAMENTO', col1, y + 3);
  doc.text(formatCurrency(primeiroPagamento), col2, y + 3);

  // RODAPÉ
  const footerY = doc.internal.pageSize.getHeight() - 25;
  doc.setTextColor(128, 128, 128);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  
  centerText('SGA PRATIC - Proteção Veicular', footerY, 8);
  centerText(`Documento gerado em ${formatDate(new Date().toISOString())}`, footerY + 5, 8);
  centerText('Esta proposta não tem valor contratual. Sujeita a análise.', footerY + 10, 8);

  // Download
  const fileName = `Cotacao_${cotacao.numero || 'SGA'}_${cotacao.leads?.nome?.split(' ')[0] || 'Cliente'}.pdf`;
  doc.save(fileName);
}
