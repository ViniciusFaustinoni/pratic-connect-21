import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Formato de moeda
export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Configuração de exportação
interface ExportConfig {
  titulo: string;
  subtitulo?: string;
  periodo: string;
  dados: Array<Record<string, any>>;
  colunas: { header: string; key: string; align?: 'left' | 'right' | 'center'; width?: number }[];
  totais?: Record<string, number>;
}

// Exportar para PDF
export function exportarRelatorioPDF(config: ExportConfig) {
  const doc = new jsPDF();
  const { titulo, subtitulo, periodo, dados, colunas, totais } = config;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const colWidth = (pageWidth - 2 * margin) / colunas.length;
  
  // Cabeçalho
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('SGA PRATIC - ASSOCIAÇÃO DE PROTEÇÃO VEICULAR', pageWidth / 2, 15, { align: 'center' });
  
  doc.setFontSize(14);
  doc.text(titulo.toUpperCase(), pageWidth / 2, 25, { align: 'center' });
  
  if (subtitulo) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(subtitulo, pageWidth / 2, 32, { align: 'center' });
  }
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Competência: ${periodo}`, pageWidth / 2, subtitulo ? 39 : 32, { align: 'center' });
  
  // Cabeçalho da tabela
  let y = subtitulo ? 50 : 45;
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y - 5, pageWidth - 2 * margin, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  
  colunas.forEach((col, i) => {
    const x = margin + (i * colWidth) + (col.align === 'right' ? colWidth - 2 : 2);
    doc.text(col.header, x, y, { align: col.align || 'left' });
  });
  
  // Dados
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  
  dados.forEach((row, rowIndex) => {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    
    // Linha alternada
    if (rowIndex % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y - 4, pageWidth - 2 * margin, 6, 'F');
    }
    
    colunas.forEach((col, i) => {
      const value = row[col.key] ?? '';
      const displayValue = typeof value === 'number' ? formatCurrency(value) : String(value);
      const x = margin + (i * colWidth) + (col.align === 'right' ? colWidth - 2 : 2);
      doc.text(displayValue.substring(0, 30), x, y, { align: col.align || 'left' });
    });
    
    y += 6;
  });
  
  // Totais
  if (totais) {
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(230, 230, 230);
    doc.rect(margin, y - 4, pageWidth - 2 * margin, 8, 'F');
    
    doc.text('TOTAIS', margin + 2, y);
    Object.entries(totais).forEach(([key, value], i) => {
      const colIndex = colunas.findIndex(c => c.key === key);
      if (colIndex >= 0) {
        const col = colunas[colIndex];
        const x = margin + (colIndex * colWidth) + (col.align === 'right' ? colWidth - 2 : 2);
        doc.text(formatCurrency(value), x, y, { align: col.align || 'left' });
      }
    });
  }
  
  // Rodapé
  const pageCount = doc.internal.pages.length - 1;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footerY = doc.internal.pageSize.getHeight() - 10;
    doc.text(
      `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
      margin,
      footerY
    );
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, footerY, { align: 'right' });
  }
  
  // Salvar
  const fileName = `${titulo.toLowerCase().replace(/ /g, '_')}_${periodo.replace(/ /g, '_')}.pdf`;
  doc.save(fileName);
  
  return fileName;
}

// Exportar para CSV
export function exportarRelatorioCSV(config: ExportConfig) {
  const { titulo, periodo, dados, colunas, totais } = config;
  
  // Cabeçalho
  const headers = colunas.map(c => c.header).join(';');
  
  // Dados
  const rows = dados.map(row => 
    colunas.map(col => {
      const value = row[col.key];
      if (typeof value === 'number') {
        return value.toFixed(2).replace('.', ',');
      }
      return String(value || '').replace(/;/g, ',');
    }).join(';')
  ).join('\n');
  
  // Totais
  let totaisRow = '';
  if (totais) {
    totaisRow = '\n' + colunas.map(col => {
      if (totais[col.key] !== undefined) {
        return totais[col.key].toFixed(2).replace('.', ',');
      }
      return col.key === colunas[0].key ? 'TOTAIS' : '';
    }).join(';');
  }
  
  // Montar CSV com BOM para Excel
  const BOM = '\uFEFF';
  const csv = BOM + `${headers}\n${rows}${totaisRow}`;
  
  // Download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${titulo.toLowerCase().replace(/ /g, '_')}_${periodo.replace(/ /g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  
  return a.download;
}

// Imprimir página
export function imprimirRelatorio() {
  window.print();
}
