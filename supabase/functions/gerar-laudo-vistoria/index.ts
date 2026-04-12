import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import QRCode from "https://esm.sh/qrcode@1.5.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Layout constants
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

// Colors
const HEADER_BG = rgb(0.11, 0.29, 0.53);       // Dark blue header
const PRIMARY_COLOR = rgb(0.11, 0.29, 0.53);
const TEXT_COLOR = rgb(0.2, 0.2, 0.2);
const MUTED_COLOR = rgb(0.45, 0.45, 0.45);
const SUCCESS_COLOR = rgb(0.1, 0.6, 0.3);
const CARD_BG = rgb(0.96, 0.97, 0.98);
const CARD_BORDER = rgb(0.82, 0.84, 0.87);
const SECTION_ICON_ASSOCIADO = rgb(0.2, 0.55, 0.85);
const SECTION_ICON_VEICULO = rgb(0.85, 0.55, 0.1);
const SECTION_ICON_VISTORIA = rgb(0.55, 0.2, 0.7);
const SEPARATOR_COLOR = rgb(0.88, 0.88, 0.88);
const WHITE = rgb(1, 1, 1);

// Image grid settings - 2 columns
const IMG_WIDTH = 160;
const IMG_HEIGHT = 115;
const IMG_GAP = 10;
const COLS = 3;

// Memory limits
const MAX_FOTOS_TOTAL = 50;
const MAX_BYTES_PER_IMAGE = 6 * 1024 * 1024;

// Priority order for photos
const PRIORITY_TIPOS = [
  'assinatura_cliente',
  'chassi', 'motor', 'etiqueta_motor', 'placa', 'odometro',
  'frente', 'traseira', 'lateral_esquerda', 'lateral_direita',
  'diagonal_dianteira_esquerda', 'diagonal_traseira_direita',
  'painel', 'bancos_frente', 'porta_malas', 'pneus',
  'diagonal_dianteira_direita', 'diagonal_traseira_esquerda',
  'rodas', 'retrovisores',
];

const CATEGORIAS = [
  { id: 'identificacao', nome: 'Identificação e Motor', tipos: ['motor', 'odometro', 'chassi', 'etiqueta_motor', 'placa'] },
  { id: 'exterior', nome: 'Exterior 360°', tipos: ['frente', 'traseira', 'lateral_esquerda', 'lateral_direita', 'diagonal_dianteira_esquerda', 'diagonal_dianteira_direita', 'diagonal_traseira_esquerda', 'diagonal_traseira_direita'] },
  { id: 'interior', nome: 'Interior', tipos: ['painel', 'bancos_frente', 'bancos_traseiro', 'porta_malas'] },
  { id: 'detalhes', nome: 'Detalhes e Acessórios', tipos: ['pneus', 'rodas', 'retrovisores', 'farol_dianteiro', 'farol_traseiro', 'vidros', 'acessorios'] },
];

const TIPO_FOTO_LABELS: Record<string, string> = {
  motor: 'Motor', odometro: 'Hodômetro', chassi: 'Chassi',
  etiqueta_motor: 'Etiqueta do Motor', placa: 'Placa',
  frente: 'Frente', traseira: 'Traseira',
  lateral_esquerda: 'Lateral Esquerda', lateral_direita: 'Lateral Direita',
  diagonal_dianteira_esquerda: 'Diagonal Diant. Esq.',
  diagonal_dianteira_direita: 'Diagonal Diant. Dir.',
  diagonal_traseira_esquerda: 'Diagonal Tras. Esq.',
  diagonal_traseira_direita: 'Diagonal Tras. Dir.',
  painel: 'Painel', bancos_frente: 'Bancos Dianteiros',
  bancos_traseiro: 'Banco Traseiro', porta_malas: 'Porta-Malas',
  pneus: 'Pneus', rodas: 'Rodas', retrovisores: 'Retrovisores',
  farol_dianteiro: 'Farol Dianteiro', farol_traseiro: 'Farol Traseiro',
  vidros: 'Vidros', acessorios: 'Acessórios',
};

function selectPriorityPhotos(fotos: any[]): any[] {
  const sorted = [...fotos].sort((a, b) => {
    const priorityA = PRIORITY_TIPOS.findIndex(t => a.tipo?.toLowerCase().includes(t));
    const priorityB = PRIORITY_TIPOS.findIndex(t => b.tipo?.toLowerCase().includes(t));
    return (priorityA === -1 ? 999 : priorityA) - (priorityB === -1 ? 999 : priorityB);
  });
  return sorted.slice(0, MAX_FOTOS_TOTAL);
}

async function fetchAndEmbedImage(
  pdfDoc: PDFDocument, url: string
): Promise<{ image: any; skipped: boolean; reason?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) return { image: null, skipped: true, reason: 'fetch failed' };
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_BYTES_PER_IMAGE)
      return { image: null, skipped: true, reason: 'too large' };
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES_PER_IMAGE)
      return { image: null, skipped: true, reason: 'too large' };
    const bytes = new Uint8Array(arrayBuffer);
    let image;
    try { image = await pdfDoc.embedJpg(bytes); }
    catch { try { image = await pdfDoc.embedPng(bytes); } catch { return { image: null, skipped: true, reason: 'embed failed' }; } }
    return { image, skipped: false };
  } catch (err) {
    console.warn('Error fetching image:', url, err);
    return { image: null, skipped: true, reason: 'error' };
  }
}

// --- Drawing helpers ---

function drawCard(page: any, x: number, y: number, w: number, h: number) {
  // Background
  page.drawRectangle({ x, y: y - h, width: w, height: h, color: CARD_BG });
  // Border
  page.drawRectangle({ x, y: y - h, width: w, height: h, borderColor: CARD_BORDER, borderWidth: 0.75 });
}

function drawSectionTitle(page: any, text: string, x: number, y: number, iconColor: any, fontBold: any) {
  // Colored icon square
  page.drawRectangle({ x, y: y - 10, width: 12, height: 12, color: iconColor });
  page.drawText(text, { x: x + 18, y: y - 9, size: 11, font: fontBold, color: PRIMARY_COLOR });
}

function drawLabelValue(page: any, label: string, value: string, x: number, y: number, fontBold: any, font: any, fontSize = 9) {
  page.drawText(label, { x, y, size: fontSize, font: fontBold, color: TEXT_COLOR });
  const labelWidth = fontBold.widthOfTextAtSize(label, fontSize);
  page.drawText(value, { x: x + labelWidth + 3, y, size: fontSize, font, color: TEXT_COLOR });
}

function drawSeparator(page: any, y: number) {
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.5,
    color: SEPARATOR_COLOR,
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    let { vistoriaId, associadoId, veiculoId, contratoId, cotacaoId: inputCotacaoId, placa, servicoId } = body;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Fallback: resolver IDs a partir do servicoId ──
    if (servicoId && (!vistoriaId || !associadoId || !veiculoId)) {
      console.log(`[LAUDO] Resolvendo IDs a partir do servicoId: ${servicoId}`);
      const { data: servico } = await supabase
        .from('servicos')
        .select('associado_id, veiculo_id, contrato_id, instalacao_origem_id')
        .eq('id', servicoId)
        .single();

      if (servico) {
        associadoId = associadoId || servico.associado_id;
        veiculoId = veiculoId || servico.veiculo_id;
        contratoId = contratoId || servico.contrato_id;

        // Buscar a vistoria mais recente do veículo
        if (!vistoriaId && veiculoId) {
          const { data: vistoriaRecente } = await supabase
            .from('vistorias')
            .select('id')
            .eq('veiculo_id', veiculoId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          vistoriaId = vistoriaRecente?.id || null;
        }
      }
    }

    // ── Fallback: resolver a partir de instalacao_id ──
    if (body.instalacaoId && (!vistoriaId || !associadoId || !veiculoId)) {
      console.log(`[LAUDO] Resolvendo IDs a partir de instalacaoId: ${body.instalacaoId}`);
      const { data: instalacao } = await supabase
        .from('instalacoes')
        .select('associado_id, veiculo_id, contrato_id')
        .eq('id', body.instalacaoId)
        .single();

      if (instalacao) {
        associadoId = associadoId || instalacao.associado_id;
        veiculoId = veiculoId || instalacao.veiculo_id;
        contratoId = contratoId || instalacao.contrato_id;

        if (!vistoriaId && veiculoId) {
          const { data: vistoriaRecente } = await supabase
            .from('vistorias')
            .select('id')
            .eq('veiculo_id', veiculoId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          vistoriaId = vistoriaRecente?.id || null;
        }
      }
    }

    if (!vistoriaId || !associadoId || !veiculoId) {
      console.error(`[LAUDO] Parâmetros insuficientes. vistoriaId=${vistoriaId}, associadoId=${associadoId}, veiculoId=${veiculoId}`);
      return new Response(
        JSON.stringify({ error: 'Não foi possível resolver vistoriaId, associadoId e veiculoId. Envie esses campos ou servicoId/instalacaoId.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[LAUDO] Iniciando geração para vistoria: ${vistoriaId}, associado: ${associadoId}, veículo: ${veiculoId}`);

    let cotacaoId = inputCotacaoId || null;
    if (!cotacaoId && contratoId) {
      const { data: contratoData } = await supabase.from('contratos').select('cotacao_id').eq('id', contratoId).single();
      cotacaoId = contratoData?.cotacao_id || null;
    }

    const { data: vistoria, error: vistoriaError } = await supabase
      .from('vistorias')
      .select(`
        id, protocolo, created_at, km_atual, observacoes, status, video_360_url,
        endereco_logradouro, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado,
        associados:associado_id ( id, nome, cpf, logradouro, numero, bairro, cidade, uf ),
        veiculos:veiculo_id ( id, marca, modelo, ano_fabricacao, ano_modelo, cor, placa, chassi ),
        vistoriador:vistoriador_id ( id, nome )
      `)
      .eq('id', vistoriaId)
      .single();

    if (vistoriaError || !vistoria) {
      return new Response(JSON.stringify({ error: 'Vistoria não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: fotos } = await supabase.from('vistoria_fotos')
      .select('tipo, arquivo_url, visivel_cliente')
      .eq('vistoria_id', vistoriaId)
      .neq('visivel_cliente', false);

    console.log(`[LAUDO] Fotos encontradas: ${fotos?.length || 0}`);

    const associado = vistoria.associados as any;
    const veiculo = vistoria.veiculos as any;
    const vistoriador = vistoria.vistoriador as any;

    const enderecoVistoria = [vistoria.endereco_logradouro, vistoria.endereco_numero, vistoria.endereco_bairro, vistoria.endereco_cidade, vistoria.endereco_estado].filter(Boolean).join(', ') || 'Não informado';
    const enderecoAssociado = associado ? [associado.logradouro, associado.numero, associado.bairro, associado.cidade, associado.uf].filter(Boolean).join(', ') : 'Não informado';

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const addPage = () => pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    const drawWrappedText = (page: any, text: string, x: number, y: number, maxWidth: number, fontSize: number, lineHeight: number, fontToUse: any = font) => {
      const words = text.split(' ');
      let currentLine = '';
      let currentY = y;
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (fontToUse.widthOfTextAtSize(testLine, fontSize) > maxWidth && currentLine) {
          page.drawText(currentLine, { x, y: currentY, size: fontSize, font: fontToUse, color: TEXT_COLOR });
          currentY -= lineHeight;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        page.drawText(currentLine, { x, y: currentY, size: fontSize, font: fontToUse, color: TEXT_COLOR });
        currentY -= lineHeight;
      }
      return currentY;
    };

    // ========== PAGE 1: HEADER + DATA ==========
    let page = addPage();
    let y = PAGE_HEIGHT - MARGIN;

    const protocolo = vistoria.protocolo || `VIST-${vistoriaId.slice(0, 8).toUpperCase()}`;
    const dataVistoria = new Date(vistoria.created_at);
    const dataFormatada = dataVistoria.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    // ── Blue header banner ──
    const bannerH = 80;
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - bannerH, width: PAGE_WIDTH, height: bannerH, color: HEADER_BG });

    page.drawText('LAUDO DE VISTORIA VEICULAR', {
      x: MARGIN, y: PAGE_HEIGHT - 30, size: 18, font: fontBold, color: WHITE,
    });
    page.drawText('PRATICCAR Proteção Veicular', {
      x: MARGIN, y: PAGE_HEIGHT - 48, size: 10, font, color: rgb(0.75, 0.82, 0.92),
    });

    // Right side: protocol, date, vistoriador
    const rightX = PAGE_WIDTH - MARGIN;
    const protText = `Protocolo: ${protocolo}`;
    page.drawText(protText, {
      x: rightX - fontBold.widthOfTextAtSize(protText, 9), y: PAGE_HEIGHT - 28, size: 9, font: fontBold, color: WHITE,
    });
    const dataText = `Data: ${dataFormatada}`;
    page.drawText(dataText, {
      x: rightX - font.widthOfTextAtSize(dataText, 8), y: PAGE_HEIGHT - 42, size: 8, font, color: rgb(0.75, 0.82, 0.92),
    });
    const vistoriadorNome = vistoriador?.nome || 'Não informado';
    const vistText = `Vistoriador: ${vistoriadorNome}`;
    page.drawText(vistText, {
      x: rightX - font.widthOfTextAtSize(vistText, 8), y: PAGE_HEIGHT - 55, size: 8, font, color: rgb(0.75, 0.82, 0.92),
    });

    y = PAGE_HEIGHT - bannerH - 20;

    // ── Card: Dados do Associado ──
    const cardPadding = 12;
    const col1X = MARGIN + cardPadding;
    const col2X = MARGIN + CONTENT_WIDTH / 2 + 10;

    const cardAssocH = 65;
    drawCard(page, MARGIN, y, CONTENT_WIDTH, cardAssocH);
    drawSectionTitle(page, 'DADOS DO ASSOCIADO', MARGIN + cardPadding, y - 5, SECTION_ICON_ASSOCIADO, fontBold);

    const cpfFormatado = associado?.cpf ? associado.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '';
    drawLabelValue(page, 'Nome: ', associado?.nome || 'Não informado', col1X, y - 28, fontBold, font);
    drawLabelValue(page, 'CPF: ', cpfFormatado, col2X, y - 28, fontBold, font);
    drawLabelValue(page, 'Endereço: ', enderecoAssociado.length > 70 ? enderecoAssociado.substring(0, 67) + '...' : enderecoAssociado, col1X, y - 44, fontBold, font);

    y -= cardAssocH + 12;

    // ── Card: Dados do Veículo ──
    const marcaModelo = [veiculo?.marca, veiculo?.modelo].filter(Boolean).join(' ') || 'Não informado';
    const ano = veiculo?.ano_fabricacao && veiculo?.ano_modelo ? `${veiculo.ano_fabricacao}/${veiculo.ano_modelo}` : veiculo?.ano_modelo || '';
    const hodometro = vistoria.km_atual ? `${vistoria.km_atual.toLocaleString('pt-BR')} km` : 'Não informado';

    const cardVeicH = 80;
    drawCard(page, MARGIN, y, CONTENT_WIDTH, cardVeicH);
    drawSectionTitle(page, 'DADOS DO VEÍCULO', MARGIN + cardPadding, y - 5, SECTION_ICON_VEICULO, fontBold);

    drawLabelValue(page, 'Marca/Modelo: ', marcaModelo.length > 40 ? marcaModelo.substring(0, 37) + '...' : marcaModelo, col1X, y - 28, fontBold, font);
    drawLabelValue(page, 'Ano: ', ano, col2X, y - 28, fontBold, font);
    drawLabelValue(page, 'Placa: ', veiculo?.placa || placa || '', col1X, y - 44, fontBold, font);
    drawLabelValue(page, 'Cor: ', veiculo?.cor || '', col2X, y - 44, fontBold, font);
    drawLabelValue(page, 'Chassi: ', veiculo?.chassi || '', col1X, y - 60, fontBold, font);
    drawLabelValue(page, 'Hodômetro: ', hodometro, col2X, y - 60, fontBold, font);

    y -= cardVeicH + 12;

    // ── Card: Informações da Vistoria ──
    const cardVistH = 50;
    drawCard(page, MARGIN, y, CONTENT_WIDTH, cardVistH);
    drawSectionTitle(page, 'INFORMAÇÕES DA VISTORIA', MARGIN + cardPadding, y - 5, SECTION_ICON_VISTORIA, fontBold);

    drawLabelValue(page, 'Local: ', enderecoVistoria.length > 80 ? enderecoVistoria.substring(0, 77) + '...' : enderecoVistoria, col1X, y - 30, fontBold, font);

    y -= cardVistH + 15;

    // ── Status badge ──
    const status = vistoria.status || 'aprovada';
    if (status === 'aprovada' || status === 'aprovada_com_ressalvas') {
      const statusText = status === 'aprovada' ? 'APROVADO' : 'APROVADO COM RESSALVAS';
      const badgeWidth = fontBold.widthOfTextAtSize(statusText, 13) + 30;
      const badgeH = 26;
      // Rounded feel via rect
      page.drawRectangle({ x: MARGIN, y: y - badgeH + 8, width: badgeWidth, height: badgeH, color: SUCCESS_COLOR });
      page.drawText(statusText, { x: MARGIN + 15, y: y - 10, size: 13, font: fontBold, color: WHITE });
      y -= badgeH + 15;
    }

    drawSeparator(page, y);
    y -= 15;

    // ── Observations ──
    if (vistoria.observacoes) {
      page.drawText('OBSERVAÇÕES', { x: MARGIN, y, size: 11, font: fontBold, color: PRIMARY_COLOR });
      y -= 16;
      y = drawWrappedText(page, vistoria.observacoes, MARGIN, y, CONTENT_WIDTH, 9, 12);
      y -= 10;
      drawSeparator(page, y);
      y -= 15;
    }

    // ── Video 360° QR ──
    if (vistoria.video_360_url) {
      if (y < 200) { page = addPage(); y = PAGE_HEIGHT - MARGIN - 30; }
      page.drawText('VÍDEO 360° DO VEÍCULO', { x: MARGIN, y, size: 11, font: fontBold, color: PRIMARY_COLOR });
      y -= 18;
      page.drawText('Escaneie o QR Code ou acesse o link para visualizar o vídeo 360°:', { x: MARGIN, y, size: 9, font, color: TEXT_COLOR });
      y -= 20;
      try {
        const qrDataUrl = await QRCode.toDataURL(vistoria.video_360_url, { width: 150, margin: 1 });
        const base64Data = qrDataUrl.split(',')[1];
        const binaryString = atob(base64Data);
        const qrBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) qrBytes[i] = binaryString.charCodeAt(i);
        const qrImage = await pdfDoc.embedPng(qrBytes);
        const qrSize = 90;
        page.drawImage(qrImage, { x: MARGIN, y: y - qrSize, width: qrSize, height: qrSize });
        page.drawText('Escaneie com seu celular', { x: MARGIN, y: y - qrSize - 12, size: 7, font, color: MUTED_COLOR });
        page.drawText('Link direto:', { x: MARGIN + qrSize + 15, y: y - 15, size: 9, font, color: TEXT_COLOR });
        const displayUrl = vistoria.video_360_url.length > 60 ? vistoria.video_360_url.substring(0, 57) + '...' : vistoria.video_360_url;
        page.drawText(displayUrl, { x: MARGIN + qrSize + 15, y: y - 30, size: 8, font, color: rgb(0, 0.4, 0.8) });
        y = y - qrSize - 30;
      } catch {
        page.drawText(vistoria.video_360_url, { x: MARGIN, y, size: 8, font, color: rgb(0, 0.4, 0.8) });
        y -= 25;
      }
      drawSeparator(page, y);
      y -= 15;
    }

    // ========== PHOTOS SECTION ==========
    const fotosValidas = (fotos || []).filter(f => f.arquivo_url);
    const fotosSelecionadas = selectPriorityPhotos(fotosValidas);
    console.log(`[LAUDO] Fotos selecionadas: ${fotosSelecionadas.length} de ${fotosValidas.length}`);

    const fotosAssinatura = fotosSelecionadas.filter(f => f.tipo === 'assinatura_cliente' || f.tipo?.toLowerCase().includes('assinatura'));
    const fotosOutrasSemAssinatura = fotosSelecionadas.filter(f => f.tipo !== 'assinatura_cliente' && !f.tipo?.toLowerCase().includes('assinatura'));

    let fotosProcessadas = 0;
    let fotosSkipped = 0;

    // Helper to draw a photo in the grid
    const drawPhoto = async (foto: any, page: any, x: number, rowY: number) => {
      const { image, skipped, reason } = await fetchAndEmbedImage(pdfDoc, foto.arquivo_url);
      if (skipped) { fotosSkipped++; return; }
      if (!image) return;
      fotosProcessadas++;
      const aspectRatio = image.width / image.height;
      let drawWidth = IMG_WIDTH;
      let drawHeight = IMG_WIDTH / aspectRatio;
      if (drawHeight > IMG_HEIGHT) { drawHeight = IMG_HEIGHT; drawWidth = IMG_HEIGHT * aspectRatio; }
      // Background
      page.drawRectangle({ x, y: rowY - IMG_HEIGHT, width: IMG_WIDTH, height: IMG_HEIGHT, color: rgb(0.97, 0.97, 0.97), borderColor: rgb(0.88, 0.88, 0.88), borderWidth: 0.75 });
      const offsetX = (IMG_WIDTH - drawWidth) / 2;
      const offsetY = (IMG_HEIGHT - drawHeight) / 2;
      page.drawImage(image, { x: x + offsetX, y: rowY - IMG_HEIGHT + offsetY, width: drawWidth, height: drawHeight });
    };

    // Signature section
    if (fotosAssinatura.length > 0) {
      if (y < 300) { page = addPage(); y = PAGE_HEIGHT - MARGIN - 30; }
      page.drawText('ASSINATURA DO CLIENTE', { x: MARGIN, y, size: 11, font: fontBold, color: PRIMARY_COLOR });
      y -= 20;
      for (const foto of fotosAssinatura) {
        if (y - IMG_HEIGHT - 20 < MARGIN) { page = addPage(); y = PAGE_HEIGHT - MARGIN - 30; }
        await drawPhoto(foto, page, MARGIN, y);
        page.drawText('Assinatura do Cliente', { x: MARGIN, y: y - IMG_HEIGHT - 12, size: 8, font, color: MUTED_COLOR });
        y -= IMG_HEIGHT + 30;
      }
      drawSeparator(page, y);
      y -= 15;
    }

    // Category photos in 2-col grid
    if (fotosOutrasSemAssinatura.length > 0) {
      for (const categoria of CATEGORIAS) {
        const fotosDaCategoria = fotosOutrasSemAssinatura.filter(f => categoria.tipos.some(t => f.tipo?.toLowerCase().includes(t)));
        if (fotosDaCategoria.length === 0) continue;

        if (y < 220) { page = addPage(); y = PAGE_HEIGHT - MARGIN - 30; }

        // Category header with count
        page.drawText(categoria.nome.toUpperCase(), { x: MARGIN, y, size: 11, font: fontBold, color: PRIMARY_COLOR });
        page.drawText(`(${fotosDaCategoria.length} fotos)`, {
          x: MARGIN + fontBold.widthOfTextAtSize(categoria.nome.toUpperCase(), 11) + 8,
          y, size: 9, font, color: MUTED_COLOR,
        });
        y -= 20;

        let col = 0;
        let rowY = y;

        for (const foto of fotosDaCategoria) {
          if (rowY - IMG_HEIGHT - 20 < MARGIN) {
            page = addPage();
            rowY = PAGE_HEIGHT - MARGIN - 30;
            y = rowY;
            col = 0;
          }
          const x = MARGIN + col * (IMG_WIDTH + IMG_GAP);
          await drawPhoto(foto, page, x, rowY);
          const label = TIPO_FOTO_LABELS[foto.tipo] || foto.tipo || 'Foto';
          page.drawText(label, { x, y: rowY - IMG_HEIGHT - 12, size: 8, font, color: MUTED_COLOR });

          col++;
          if (col >= COLS) { col = 0; rowY -= IMG_HEIGHT + 30; }
        }
        if (col > 0) rowY -= IMG_HEIGHT + 30;
        y = rowY - 10;
      }

      // Uncategorized photos
      const categoriaTipos = CATEGORIAS.flatMap(c => c.tipos);
      const fotosOutras = fotosOutrasSemAssinatura.filter(f => !categoriaTipos.some(t => f.tipo?.toLowerCase().includes(t)));

      if (fotosOutras.length > 0) {
        if (y < 220) { page = addPage(); y = PAGE_HEIGHT - MARGIN - 30; }
        page.drawText('OUTRAS FOTOS', { x: MARGIN, y, size: 11, font: fontBold, color: PRIMARY_COLOR });
        y -= 20;
        let col = 0;
        let rowY = y;
        for (const foto of fotosOutras) {
          if (rowY - IMG_HEIGHT - 20 < MARGIN) { page = addPage(); rowY = PAGE_HEIGHT - MARGIN - 30; y = rowY; col = 0; }
          const x = MARGIN + col * (IMG_WIDTH + IMG_GAP);
          await drawPhoto(foto, page, x, rowY);
          const label = TIPO_FOTO_LABELS[foto.tipo] || foto.tipo || 'Foto';
          page.drawText(label, { x, y: rowY - IMG_HEIGHT - 12, size: 8, font, color: MUTED_COLOR });
          col++;
          if (col >= COLS) { col = 0; rowY -= IMG_HEIGHT + 30; }
        }
      }
    }

    console.log(`[LAUDO] Fotos processadas: ${fotosProcessadas}, skipped: ${fotosSkipped}`);

    // Footer on all pages
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;
    const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    for (let i = 0; i < totalPages; i++) {
      const p = pages[i];
      // Footer line
      p.drawLine({ start: { x: MARGIN, y: 32 }, end: { x: PAGE_WIDTH - MARGIN, y: 32 }, thickness: 0.5, color: SEPARATOR_COLOR });
      p.drawText(`Documento gerado em ${dataGeracao}`, { x: MARGIN, y: 18, size: 7, font, color: MUTED_COLOR });
      p.drawText(`Página ${i + 1} de ${totalPages}`, { x: PAGE_WIDTH - MARGIN - 55, y: 18, size: 7, font, color: MUTED_COLOR });
    }

    // Save PDF
    console.log(`[LAUDO] Salvando PDF com ${totalPages} páginas...`);
    const pdfBytes = await pdfDoc.save();
    const placaFormatada = (veiculo?.placa || placa || 'SEMPLACA').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const nomeArquivo = `Laudo_Vistoria_${placaFormatada}_${Date.now()}.pdf`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(`laudos/${associadoId}/${nomeArquivo}`, pdfBytes, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      console.error('[LAUDO] Upload error:', uploadError);
      return new Response(JSON.stringify({ error: 'Erro ao salvar o PDF' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: publicUrlData } = supabase.storage.from('documentos').getPublicUrl(`laudos/${associadoId}/${nomeArquivo}`);
    const arquivoUrl = publicUrlData.publicUrl;
    console.log('[LAUDO] PDF gerado:', arquivoUrl);

    // Delete previous report if exists
    const { data: laudoExistente } = await supabase.from('documentos')
      .select('id, arquivo_url').eq('associado_id', associadoId).eq('veiculo_id', veiculoId).eq('tipo', 'laudo_vistoria').maybeSingle();

    if (laudoExistente) {
      if (laudoExistente.arquivo_url && laudoExistente.arquivo_url !== arquivoUrl) {
        const pathMatch = laudoExistente.arquivo_url.match(/\/documentos\/(.+)$/);
        if (pathMatch) await supabase.storage.from('documentos').remove([pathMatch[1]]);
      }
      await supabase.from('documentos').delete().eq('id', laudoExistente.id);
    }

    const { error: docError } = await supabase.from('documentos').insert({
      associado_id: associadoId, veiculo_id: veiculoId, tipo: 'laudo_vistoria',
      arquivo_url: arquivoUrl, nome_arquivo: nomeArquivo, status: 'aprovado',
    });
    if (docError) console.error('[LAUDO] Doc insert error:', docError);

    if (contratoId || cotacaoId) {
      const { error: contratoDocError } = await supabase.from('contratos_documentos').insert({
        contrato_id: contratoId || null, cotacao_id: cotacaoId || null,
        tipo: 'laudo_vistoria', arquivo_url: arquivoUrl, arquivo_nome: nomeArquivo, status: 'pendente',
      });
      if (contratoDocError) console.warn('[LAUDO] contratos_documentos error:', contratoDocError);
    }

    console.log(`[LAUDO] Concluído!`);

    return new Response(
      JSON.stringify({ success: true, url: arquivoUrl, nomeArquivo, stats: { fotosTotal: fotosValidas.length, fotosSelecionadas: fotosSelecionadas.length, fotosProcessadas, fotosSkipped } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Erro interno ao gerar laudo';
    console.error('[LAUDO] Erro:', error);
    return new Response(JSON.stringify({ error: errMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
