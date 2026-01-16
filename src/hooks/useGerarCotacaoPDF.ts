import { useState } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { toast } from 'sonner';

// Dimensões A4
const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const MARGIN = 50;

// Cores da marca
const COR_PRIMARIA = { r: 0.1, g: 0.3, b: 0.6 }; // Azul
const COR_SECUNDARIA = { r: 0.2, g: 0.6, b: 0.3 }; // Verde

// Coberturas por plano
const COBERTURAS_POR_PLANO: Record<string, string[]> = {
  basico: [
    'Colisão',
    'Roubo e Furto',
    'Incêndio',
    'Assistência 24 horas',
  ],
  completo: [
    'Colisão',
    'Roubo e Furto',
    'Incêndio',
    'Proteção de Vidros',
    'Assistência 24 horas',
    'Carro Reserva (7 dias)',
  ],
  premium: [
    'Colisão',
    'Roubo e Furto',
    'Incêndio',
    'Proteção de Vidros',
    'Assistência 24 horas',
    'Carro Reserva (15 dias)',
    'App de Rastreamento',
    'Guincho Ilimitado',
  ],
};

// Valores por plano
const VALORES_PLANO: Record<string, { mensal: number; nome: string }> = {
  basico: { mensal: 189.90, nome: 'Plano Básico' },
  completo: { mensal: 249.90, nome: 'Plano Completo' },
  premium: { mensal: 299.90, nome: 'Plano Premium' },
};

interface DadosCotacao {
  // Cliente
  nome: string;
  telefone: string;
  email?: string;
  
  // Veículo
  marca: string;
  modelo: string;
  ano: number;
  placa?: string;
  
  // Plano
  plano: 'basico' | 'completo' | 'premium';
  valorExtra?: number; // Valor adicional do vendedor
  
  // Meta
  vendedor?: string;
  validadeDias?: number;
}

export function useGerarCotacaoPDF() {
  const [gerando, setGerando] = useState(false);

  // Formatar moeda
  const formatarMoeda = (valor: number): string => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Função principal de geração
  const gerarPDF = async (dados: DadosCotacao): Promise<Uint8Array> => {
    // Criar documento
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

    // Carregar fontes
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let y = A4_HEIGHT - MARGIN;

    // ===== CABEÇALHO =====
    // Fundo do cabeçalho
    page.drawRectangle({
      x: 0,
      y: A4_HEIGHT - 120,
      width: A4_WIDTH,
      height: 120,
      color: rgb(COR_PRIMARIA.r, COR_PRIMARIA.g, COR_PRIMARIA.b),
    });

    // Nome da empresa
    page.drawText('PRATICCAR', {
      x: MARGIN,
      y: A4_HEIGHT - 55,
      size: 32,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    // Subtítulo
    page.drawText('COTAÇÃO DE PROTEÇÃO VEICULAR', {
      x: MARGIN,
      y: A4_HEIGHT - 85,
      size: 14,
      font: fontRegular,
      color: rgb(1, 1, 1),
    });

    y = A4_HEIGHT - 150;

    // ===== DADOS DO CLIENTE =====
    // Título da seção
    page.drawText('DADOS DO CLIENTE', {
      x: MARGIN,
      y,
      size: 12,
      font: fontBold,
      color: rgb(COR_PRIMARIA.r, COR_PRIMARIA.g, COR_PRIMARIA.b),
    });

    y -= 8;

    // Linha decorativa
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: A4_WIDTH - MARGIN, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    y -= 25;

    // Nome
    page.drawText('Nome:', { x: MARGIN, y, size: 10, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
    page.drawText(dados.nome, { x: MARGIN + 80, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

    y -= 18;

    // Telefone
    page.drawText('Telefone:', { x: MARGIN, y, size: 10, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
    page.drawText(dados.telefone, { x: MARGIN + 80, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

    y -= 18;

    // Email (se houver)
    if (dados.email) {
      page.drawText('E-mail:', { x: MARGIN, y, size: 10, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
      page.drawText(dados.email, { x: MARGIN + 80, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      y -= 18;
    }

    y -= 20;

    // ===== VEÍCULO =====
    page.drawText('VEÍCULO', {
      x: MARGIN,
      y,
      size: 12,
      font: fontBold,
      color: rgb(COR_PRIMARIA.r, COR_PRIMARIA.g, COR_PRIMARIA.b),
    });

    y -= 8;

    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: A4_WIDTH - MARGIN, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    y -= 25;

    // Marca/Modelo/Ano
    const veiculoDescricao = `${dados.marca} ${dados.modelo} ${dados.ano}`;
    page.drawText(veiculoDescricao, {
      x: MARGIN,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    y -= 18;

    // Placa (se houver)
    if (dados.placa) {
      page.drawText('Placa:', { x: MARGIN, y, size: 10, font: fontRegular, color: rgb(0.5, 0.5, 0.5) });
      page.drawText(dados.placa, { x: MARGIN + 80, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      y -= 18;
    }

    y -= 30;

    // ===== CARD DO PLANO (DESTAQUE) =====
    const planoInfo = VALORES_PLANO[dados.plano];
    const valorTotal = planoInfo.mensal + (dados.valorExtra || 0);

    // Fundo do card
    const cardY = y - 80;
    page.drawRectangle({
      x: MARGIN,
      y: cardY,
      width: A4_WIDTH - (MARGIN * 2),
      height: 100,
      color: rgb(0.95, 0.97, 1),
      borderColor: rgb(COR_PRIMARIA.r, COR_PRIMARIA.g, COR_PRIMARIA.b),
      borderWidth: 2,
    });

    // Nome do plano
    const nomePlano = planoInfo.nome.toUpperCase();
    const nomePlanoWidth = fontBold.widthOfTextAtSize(nomePlano, 18);
    page.drawText(nomePlano, {
      x: (A4_WIDTH - nomePlanoWidth) / 2,
      y: cardY + 70,
      size: 18,
      font: fontBold,
      color: rgb(COR_PRIMARIA.r, COR_PRIMARIA.g, COR_PRIMARIA.b),
    });

    // Valor
    const valorFormatado = formatarMoeda(valorTotal);
    const valorWidth = fontBold.widthOfTextAtSize(valorFormatado, 28);
    page.drawText(valorFormatado, {
      x: (A4_WIDTH - valorWidth) / 2,
      y: cardY + 38,
      size: 28,
      font: fontBold,
      color: rgb(COR_SECUNDARIA.r, COR_SECUNDARIA.g, COR_SECUNDARIA.b),
    });

    // Texto "valor médio mensal"
    const textoMensal = 'valor médio mensal';
    const textoMensalWidth = fontRegular.widthOfTextAtSize(textoMensal, 11);
    page.drawText(textoMensal, {
      x: (A4_WIDTH - textoMensalWidth) / 2,
      y: cardY + 18,
      size: 11,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    });

    y = cardY - 30;

    // ===== COBERTURAS =====
    page.drawText('COBERTURAS INCLUÍDAS', {
      x: MARGIN,
      y,
      size: 12,
      font: fontBold,
      color: rgb(COR_PRIMARIA.r, COR_PRIMARIA.g, COR_PRIMARIA.b),
    });

    y -= 8;

    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: A4_WIDTH - MARGIN, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    y -= 25;

    // Listar coberturas do plano selecionado
    const coberturas = COBERTURAS_POR_PLANO[dados.plano] || [];
    
    // Grid de 2 colunas
    const colWidth = (A4_WIDTH - MARGIN * 2) / 2;
    
    coberturas.forEach((cobertura, index) => {
      const col = index % 2;
      const x = MARGIN + (col * colWidth);
      
      // Check verde
      page.drawText('✓', {
        x,
        y,
        size: 12,
        font: fontBold,
        color: rgb(COR_SECUNDARIA.r, COR_SECUNDARIA.g, COR_SECUNDARIA.b),
      });
      
      // Nome da cobertura
      page.drawText(cobertura, {
        x: x + 18,
        y,
        size: 11,
        font: fontRegular,
        color: rgb(0.2, 0.2, 0.2),
      });

      // Nova linha a cada 2 itens
      if (col === 1) {
        y -= 20;
      }
    });

    // Ajustar se terminou em coluna ímpar
    if (coberturas.length % 2 !== 0) {
      y -= 20;
    }

    y -= 30;

    // ===== RODAPÉ =====
    const validadeDias = dados.validadeDias || 7;
    const dataAtual = new Date().toLocaleDateString('pt-BR');

    // Linha separadora
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: A4_WIDTH - MARGIN, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    y -= 20;

    // Validade
    page.drawText(`Cotação válida por ${validadeDias} dias`, {
      x: MARGIN,
      y,
      size: 9,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Data
    page.drawText(`Gerada em: ${dataAtual}`, {
      x: MARGIN,
      y: y - 14,
      size: 9,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Vendedor (lado direito)
    if (dados.vendedor) {
      page.drawText(`Vendedor: ${dados.vendedor}`, {
        x: A4_WIDTH - MARGIN - fontRegular.widthOfTextAtSize(`Vendedor: ${dados.vendedor}`, 9),
        y,
        size: 9,
        font: fontRegular,
        color: rgb(0.5, 0.5, 0.5),
      });
    }

    // Nome da empresa
    page.drawText('PRATICCAR - Proteção Veicular', {
      x: A4_WIDTH - MARGIN - fontRegular.widthOfTextAtSize('PRATICCAR - Proteção Veicular', 9),
      y: y - 14,
      size: 9,
      font: fontBold,
      color: rgb(COR_PRIMARIA.r, COR_PRIMARIA.g, COR_PRIMARIA.b),
    });

    // Salvar PDF
    return await pdfDoc.save();
  };

  // Função para baixar PDF
  const baixarPDF = (pdfBytes: Uint8Array, nomeCliente: string) => {
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const nomeArquivo = `cotacao-${nomeCliente.split(' ')[0].toLowerCase()}-${Date.now()}.pdf`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  // Função para abrir em nova aba
  const abrirPDF = (pdfBytes: Uint8Array) => {
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  // Função principal exposta
  const gerarCotacao = async (
    dados: DadosCotacao,
    modo: 'baixar' | 'abrir' | 'bytes' = 'baixar'
  ): Promise<Uint8Array | void> => {
    try {
      setGerando(true);
      const pdfBytes = await gerarPDF(dados);

      switch (modo) {
        case 'baixar':
          baixarPDF(pdfBytes, dados.nome);
          toast.success('Cotação gerada com sucesso!');
          break;
        case 'abrir':
          abrirPDF(pdfBytes);
          break;
        case 'bytes':
          return pdfBytes;
      }
    } catch (error) {
      console.error('Erro ao gerar cotação:', error);
      toast.error('Erro ao gerar cotação. Tente novamente.');
      throw error;
    } finally {
      setGerando(false);
    }
  };

  return {
    gerarCotacao,
    gerando,
  };
}
