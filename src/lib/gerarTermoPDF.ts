import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Gera PDF a partir de um elemento HTML
 */
export async function gerarTermoPDF(elementId: string): Promise<Blob> {
  const elemento = document.getElementById(elementId);
  
  if (!elemento) {
    throw new Error('Elemento do termo não encontrado');
  }
  
  // Garantir que o elemento esteja visível temporariamente
  const originalPosition = elemento.style.position;
  const originalLeft = elemento.style.left;
  const originalTop = elemento.style.top;
  const originalVisibility = elemento.style.visibility;
  
  elemento.style.position = 'absolute';
  elemento.style.left = '-9999px';
  elemento.style.top = '0';
  elemento.style.visibility = 'visible';
  
  try {
    const canvas = await html2canvas(elemento, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: elemento.scrollWidth,
      height: elemento.scrollHeight,
    });
    
    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);
    
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    let heightLeft = imgHeight;
    let position = margin;
    let page = 1;
    
    // Adicionar primeira página
    pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - margin * 2);
    
    // Adicionar páginas adicionais se necessário
    while (heightLeft > 0) {
      position = -(pageHeight - margin * 2) * page + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - margin * 2);
      page++;
    }
    
    return pdf.output('blob');
  } finally {
    // Restaurar estilos originais
    elemento.style.position = originalPosition;
    elemento.style.left = originalLeft;
    elemento.style.top = originalTop;
    elemento.style.visibility = originalVisibility;
  }
}

/**
 * Faz download de um blob como arquivo
 */
export function downloadPDF(blob: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Gera e baixa o PDF diretamente
 */
export async function gerarEBaixarTermoPDF(elementId: string, nomeArquivo: string): Promise<void> {
  const blob = await gerarTermoPDF(elementId);
  downloadPDF(blob, nomeArquivo);
}
