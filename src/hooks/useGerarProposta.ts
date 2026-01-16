import { useState } from 'react';
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import { DadosProposta, ConfiguracaoPDF } from '@/types/proposta';
import { toast } from 'sonner';

// Configurações padrão
const CONFIG_PADRAO: ConfiguracaoPDF = {
  corPrimaria: { r: 0.1, g: 0.3, b: 0.6 },
  corSecundaria: { r: 0.2, g: 0.6, b: 0.3 },
  mostrarLogo: true,
  mostrarQRCode: false,
};

// Dimensões A4 em pontos
const A4_WIDTH = 595;
const A4_HEIGHT = 842;

// Margens
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const MARGIN_BOTTOM = 50;

export function useGerarProposta() {
  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState(0);

  const formatarMoeda = (valor: number): string => {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatarData = (data: string): string => {
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const desenharCabecalho = async (
    page: PDFPage,
    fontBold: PDFFont,
    fontRegular: PDFFont,
    config: ConfiguracaoPDF
  ) => {
    const { corPrimaria } = config;
    
    page.drawRectangle({
      x: 0,
      y: A4_HEIGHT - 100,
      width: A4_WIDTH,
      height: 100,
      color: rgb(corPrimaria!.r, corPrimaria!.g, corPrimaria!.b),
    });

    page.drawText('PRATICCAR', {
      x: MARGIN_LEFT,
      y: A4_HEIGHT - 50,
      size: 28,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page.drawText('Associação de Proteção Veicular', {
      x: MARGIN_LEFT,
      y: A4_HEIGHT - 75,
      size: 12,
      font: fontRegular,
      color: rgb(1, 1, 1),
    });

    page.drawText('PROPOSTA COMERCIAL', {
      x: A4_WIDTH - MARGIN_RIGHT - 180,
      y: A4_HEIGHT - 60,
      size: 16,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
  };

  const desenharSecao = (
    page: PDFPage,
    titulo: string,
    yStart: number,
    fontBold: PDFFont,
    config: ConfiguracaoPDF
  ): number => {
    const { corPrimaria } = config;

    page.drawRectangle({
      x: MARGIN_LEFT,
      y: yStart,
      width: 4,
      height: 20,
      color: rgb(corPrimaria!.r, corPrimaria!.g, corPrimaria!.b),
    });

    page.drawText(titulo, {
      x: MARGIN_LEFT + 12,
      y: yStart + 5,
      size: 14,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    });

    return yStart - 10;
  };

  const desenharCampo = (
    page: PDFPage,
    label: string,
    valor: string,
    x: number,
    y: number,
    fontRegular: PDFFont,
    fontBold: PDFFont,
    larguraLabel: number = 100
  ) => {
    page.drawText(label, {
      x,
      y,
      size: 10,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    });

    page.drawText(valor, {
      x: x + larguraLabel,
      y,
      size: 10,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
  };

  const desenharTabelaValores = (
    page: PDFPage,
    dados: DadosProposta,
    yStart: number,
    fontRegular: PDFFont,
    fontBold: PDFFont,
    config: ConfiguracaoPDF
  ): number => {
    const { corPrimaria, corSecundaria } = config;
    const tableWidth = A4_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
    const colWidth = tableWidth / 3;
    let y = yStart;

    page.drawRectangle({
      x: MARGIN_LEFT,
      y: y - 5,
      width: tableWidth,
      height: 25,
      color: rgb(0.95, 0.95, 0.95),
    });

    page.drawText('Descrição', { x: MARGIN_LEFT + 10, y: y + 2, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
    page.drawText('Valor', { x: MARGIN_LEFT + colWidth * 2 + 10, y: y + 2, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) });

    y -= 30;

    page.drawText('Taxa de Adesão', { x: MARGIN_LEFT + 10, y, size: 10, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(formatarMoeda(dados.plano.valorAdesao), { x: MARGIN_LEFT + colWidth * 2 + 10, y, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
    
    y -= 20;

    page.drawText('Mensalidade', { x: MARGIN_LEFT + 10, y, size: 10, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(formatarMoeda(dados.plano.valorMensal), { x: MARGIN_LEFT + colWidth * 2 + 10, y, size: 10, font: fontBold, color: rgb(0.2, 0.2, 0.2) });

    y -= 20;

    if (dados.plano.valorExtra && dados.plano.valorExtra > 0) {
      page.drawText('Adicional acordado', { x: MARGIN_LEFT + 10, y, size: 10, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
      page.drawText(formatarMoeda(dados.plano.valorExtra), { x: MARGIN_LEFT + colWidth * 2 + 10, y, size: 10, font: fontBold, color: rgb(corSecundaria!.r, corSecundaria!.g, corSecundaria!.b) });
      y -= 20;
    }

    page.drawLine({
      start: { x: MARGIN_LEFT, y: y + 5 },
      end: { x: MARGIN_LEFT + tableWidth, y: y + 5 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    y -= 5;

    const totalMensal = dados.plano.valorMensal + (dados.plano.valorExtra || 0);
    
    page.drawRectangle({
      x: MARGIN_LEFT,
      y: y - 10,
      width: tableWidth,
      height: 30,
      color: rgb(corPrimaria!.r, corPrimaria!.g, corPrimaria!.b),
    });

    page.drawText('TOTAL MENSAL:', { x: MARGIN_LEFT + 10, y: y, size: 12, font: fontBold, color: rgb(1, 1, 1) });
    page.drawText(formatarMoeda(totalMensal), { x: MARGIN_LEFT + colWidth * 2 + 10, y: y, size: 14, font: fontBold, color: rgb(1, 1, 1) });

    return y - 40;
  };

  const desenharRodape = (
    page: PDFPage,
    dados: DadosProposta,
    fontRegular: PDFFont,
    config: ConfiguracaoPDF
  ) => {
    const { corPrimaria } = config;

    page.drawLine({
      start: { x: MARGIN_LEFT, y: MARGIN_BOTTOM + 40 },
      end: { x: A4_WIDTH - MARGIN_RIGHT, y: MARGIN_BOTTOM + 40 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });

    page.drawText(`Proposta nº ${dados.cotacao.numero}`, {
      x: MARGIN_LEFT,
      y: MARGIN_BOTTOM + 25,
      size: 8,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    });

    page.drawText(`Válida até: ${formatarData(dados.cotacao.dataValidade)}`, {
      x: MARGIN_LEFT,
      y: MARGIN_BOTTOM + 12,
      size: 8,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    });

    page.drawText(`Vendedor: ${dados.cotacao.vendedor}`, {
      x: A4_WIDTH - MARGIN_RIGHT - 150,
      y: MARGIN_BOTTOM + 25,
      size: 8,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    });

    page.drawText('PRATICCAR - Proteção Veicular', {
      x: A4_WIDTH - MARGIN_RIGHT - 150,
      y: MARGIN_BOTTOM + 12,
      size: 8,
      font: fontRegular,
      color: rgb(corPrimaria!.r, corPrimaria!.g, corPrimaria!.b),
    });
  };

  const gerarPropostaDoZero = async (
    dados: DadosProposta,
    config: ConfiguracaoPDF = CONFIG_PADRAO
  ): Promise<Uint8Array> => {
    const mergedConfig = { ...CONFIG_PADRAO, ...config };

    const pdfDoc = await PDFDocument.create();
    setProgresso(10);

    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
    setProgresso(20);

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    setProgresso(30);

    await desenharCabecalho(page, fontBold, fontRegular, mergedConfig);
    setProgresso(40);

    let yPosition = A4_HEIGHT - 130;

    // DADOS DO CLIENTE
    yPosition = desenharSecao(page, 'DADOS DO CLIENTE', yPosition, fontBold, mergedConfig);
    yPosition -= 25;

    desenharCampo(page, 'Nome:', dados.cliente.nome, MARGIN_LEFT, yPosition, fontRegular, fontBold);
    desenharCampo(page, 'CPF:', dados.cliente.cpf, MARGIN_LEFT + 280, yPosition, fontRegular, fontBold, 40);
    yPosition -= 18;

    desenharCampo(page, 'Telefone:', dados.cliente.telefone, MARGIN_LEFT, yPosition, fontRegular, fontBold, 60);
    desenharCampo(page, 'E-mail:', dados.cliente.email || '-', MARGIN_LEFT + 200, yPosition, fontRegular, fontBold, 50);
    yPosition -= 18;

    if (dados.cliente.cidade) {
      desenharCampo(page, 'Cidade/UF:', `${dados.cliente.cidade}/${dados.cliente.estado}`, MARGIN_LEFT, yPosition, fontRegular, fontBold, 70);
    }
    setProgresso(50);

    yPosition -= 35;

    // DADOS DO VEÍCULO
    yPosition = desenharSecao(page, 'DADOS DO VEÍCULO', yPosition, fontBold, mergedConfig);
    yPosition -= 25;

    desenharCampo(page, 'Veículo:', `${dados.veiculo.marca} ${dados.veiculo.modelo}`, MARGIN_LEFT, yPosition, fontRegular, fontBold, 55);
    desenharCampo(page, 'Ano:', String(dados.veiculo.ano), MARGIN_LEFT + 280, yPosition, fontRegular, fontBold, 35);
    yPosition -= 18;

    desenharCampo(page, 'Placa:', dados.veiculo.placa, MARGIN_LEFT, yPosition, fontRegular, fontBold, 55);
    desenharCampo(page, 'Valor FIPE:', formatarMoeda(dados.veiculo.valorFipe), MARGIN_LEFT + 150, yPosition, fontRegular, fontBold, 70);
    setProgresso(60);

    yPosition -= 35;

    // PLANO SELECIONADO
    yPosition = desenharSecao(page, `PLANO ${dados.plano.nome.toUpperCase()}`, yPosition, fontBold, mergedConfig);
    yPosition -= 25;

    page.drawText('Coberturas incluídas:', {
      x: MARGIN_LEFT,
      y: yPosition,
      size: 10,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    });
    yPosition -= 15;

    for (const cobertura of dados.plano.coberturas) {
      page.drawText(`✓ ${cobertura}`, {
        x: MARGIN_LEFT + 10,
        y: yPosition,
        size: 10,
        font: fontRegular,
        color: rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 15;
    }
    setProgresso(70);

    yPosition -= 20;

    // VALORES
    yPosition = desenharSecao(page, 'VALORES', yPosition, fontBold, mergedConfig);
    yPosition -= 30;

    yPosition = desenharTabelaValores(page, dados, yPosition, fontRegular, fontBold, mergedConfig);
    setProgresso(80);

    // OBSERVAÇÕES
    if (dados.cotacao.observacoes) {
      yPosition -= 10;
      yPosition = desenharSecao(page, 'OBSERVAÇÕES', yPosition, fontBold, mergedConfig);
      yPosition -= 25;

      page.drawText(dados.cotacao.observacoes, {
        x: MARGIN_LEFT,
        y: yPosition,
        size: 9,
        font: fontRegular,
        color: rgb(0.3, 0.3, 0.3),
        maxWidth: A4_WIDTH - MARGIN_LEFT - MARGIN_RIGHT,
      });
    }

    desenharRodape(page, dados, fontRegular, mergedConfig);
    setProgresso(90);

    const pdfBytes = await pdfDoc.save();
    setProgresso(100);

    return pdfBytes;
  };

  const baixarPDF = (pdfBytes: Uint8Array, nomeArquivo: string = 'proposta.pdf') => {
    const arrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  const abrirPDF = (pdfBytes: Uint8Array) => {
    const arrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const converterParaBase64 = (pdfBytes: Uint8Array): string => {
    let binary = '';
    const bytes = new Uint8Array(pdfBytes);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const gerarProposta = async (
    dados: DadosProposta,
    opcoes: {
      modo?: 'baixar' | 'abrir' | 'bytes';
      config?: ConfiguracaoPDF;
      nomeArquivo?: string;
    } = {}
  ): Promise<Uint8Array | void> => {
    const { modo = 'baixar', config, nomeArquivo } = opcoes;

    try {
      setGerando(true);
      setProgresso(0);

      const pdfBytes = await gerarPropostaDoZero(dados, config);

      const arquivo = nomeArquivo || `proposta-${dados.cotacao.numero}-${dados.cliente.nome.split(' ')[0].toLowerCase()}.pdf`;

      switch (modo) {
        case 'baixar':
          baixarPDF(pdfBytes, arquivo);
          toast.success('Proposta gerada com sucesso!');
          break;
        case 'abrir':
          abrirPDF(pdfBytes);
          break;
        case 'bytes':
          return pdfBytes;
      }
    } catch (error) {
      console.error('Erro ao gerar proposta:', error);
      toast.error('Erro ao gerar proposta. Tente novamente.');
      throw error;
    } finally {
      setGerando(false);
      setProgresso(0);
    }
  };

  return {
    gerarProposta,
    baixarPDF,
    abrirPDF,
    converterParaBase64,
    gerando,
    progresso,
  };
}
