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

const PRIMARY_COLOR = rgb(0.2, 0.4, 0.6);
const TEXT_COLOR = rgb(0.2, 0.2, 0.2);
const MUTED_COLOR = rgb(0.5, 0.5, 0.5);
const SUCCESS_COLOR = rgb(0.1, 0.6, 0.3);
const SECTION_BG = rgb(0.95, 0.95, 0.97);

// Image grid settings - reduced size to save memory
const IMG_WIDTH = 350;
const IMG_HEIGHT = 240;
const IMG_GAP = 15;
const COLS = 1;

// MEMORY OPTIMIZATION: Limit total photos to prevent memory overflow
// Note: Supabase Edge Functions have 150MB memory limit
// Each high-res photo can be 3-5MB, so we limit to ~12 photos max
const MAX_FOTOS_TOTAL = 12; // Maximum photos to include in the report
const MAX_BYTES_PER_IMAGE = 6 * 1024 * 1024; // Allow images up to 6MB (typical smartphone photo)

// Priority order for photos (most important first)
const PRIORITY_TIPOS = [
  'assinatura_cliente',
  'chassi',
  'motor',
  'etiqueta_motor',
  'placa',
  'odometro',
  'frente',
  'traseira',
  'lateral_esquerda',
  'lateral_direita',
  'diagonal_dianteira_esquerda',
  'diagonal_traseira_direita',
  'painel',
  'bancos_frente',
  'porta_malas',
  'pneus',
];

// Category configuration for inspection photos
const CATEGORIAS = [
  { id: 'identificacao', nome: 'Identificação e Motor', tipos: ['motor', 'odometro', 'chassi', 'etiqueta_motor', 'placa'] },
  { id: 'exterior', nome: 'Exterior 360°', tipos: ['frente', 'traseira', 'lateral_esquerda', 'lateral_direita', 'diagonal_dianteira_esquerda', 'diagonal_dianteira_direita', 'diagonal_traseira_esquerda', 'diagonal_traseira_direita'] },
  { id: 'interior', nome: 'Interior', tipos: ['painel', 'bancos_frente', 'bancos_traseiro', 'porta_malas'] },
  { id: 'detalhes', nome: 'Detalhes e Acessórios', tipos: ['pneus', 'rodas', 'retrovisores', 'farol_dianteiro', 'farol_traseiro', 'vidros', 'acessorios'] },
];

// Photo type labels for display
const TIPO_FOTO_LABELS: Record<string, string> = {
  motor: 'Motor',
  odometro: 'Hodômetro',
  chassi: 'Chassi',
  etiqueta_motor: 'Etiqueta do Motor',
  placa: 'Placa',
  frente: 'Frente',
  traseira: 'Traseira',
  lateral_esquerda: 'Lateral Esquerda',
  lateral_direita: 'Lateral Direita',
  diagonal_dianteira_esquerda: 'Diagonal Dianteira Esq.',
  diagonal_dianteira_direita: 'Diagonal Dianteira Dir.',
  diagonal_traseira_esquerda: 'Diagonal Traseira Esq.',
  diagonal_traseira_direita: 'Diagonal Traseira Dir.',
  painel: 'Painel',
  bancos_frente: 'Bancos Dianteiros',
  bancos_traseiro: 'Banco Traseiro',
  porta_malas: 'Porta-Malas',
  pneus: 'Pneus',
  rodas: 'Rodas',
  retrovisores: 'Retrovisores',
  farol_dianteiro: 'Farol Dianteiro',
  farol_traseiro: 'Farol Traseiro',
  vidros: 'Vidros',
  acessorios: 'Acessórios',
};

// Function to prioritize and limit photos
function selectPriorityPhotos(fotos: any[]): any[] {
  // Sort by priority
  const sorted = [...fotos].sort((a, b) => {
    const priorityA = PRIORITY_TIPOS.findIndex(t => a.tipo?.toLowerCase().includes(t));
    const priorityB = PRIORITY_TIPOS.findIndex(t => b.tipo?.toLowerCase().includes(t));
    
    // If not in priority list, put at end
    const indexA = priorityA === -1 ? 999 : priorityA;
    const indexB = priorityB === -1 ? 999 : priorityB;
    
    return indexA - indexB;
  });
  
  // Return limited set
  return sorted.slice(0, MAX_FOTOS_TOTAL);
}

// Function to safely fetch and embed image with memory limits
async function fetchAndEmbedImage(
  pdfDoc: PDFDocument, 
  url: string
): Promise<{ image: any; skipped: boolean; reason?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return { image: null, skipped: true, reason: 'fetch failed' };
    }
    
    // Check content-length header to avoid downloading huge files
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_BYTES_PER_IMAGE) {
      console.warn(`Image too large (${contentLength} bytes), skipping: ${url}`);
      return { image: null, skipped: true, reason: 'too large' };
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    // Double-check actual size
    if (arrayBuffer.byteLength > MAX_BYTES_PER_IMAGE) {
      console.warn(`Image too large after download (${arrayBuffer.byteLength} bytes), skipping`);
      return { image: null, skipped: true, reason: 'too large' };
    }
    
    const bytes = new Uint8Array(arrayBuffer);
    
    let image;
    try {
      image = await pdfDoc.embedJpg(bytes);
    } catch {
      try {
        image = await pdfDoc.embedPng(bytes);
      } catch {
        return { image: null, skipped: true, reason: 'embed failed' };
      }
    }
    
    return { image, skipped: false };
  } catch (err) {
    console.warn('Error fetching image:', url, err);
    return { image: null, skipped: true, reason: 'error' };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { vistoriaId, associadoId, veiculoId, contratoId, cotacaoId: inputCotacaoId, placa } = await req.json();

    if (!vistoriaId || !associadoId || !veiculoId) {
      return new Response(
        JSON.stringify({ error: 'vistoriaId, associadoId e veiculoId são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[LAUDO] Iniciando geração para vistoria: ${vistoriaId}`);
    console.log(`[LAUDO] Memory optimization: MAX_FOTOS=${MAX_FOTOS_TOTAL}, MAX_BYTES=${MAX_BYTES_PER_IMAGE}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar cotacao_id do contrato se não foi fornecido
    let cotacaoId = inputCotacaoId || null;
    if (!cotacaoId && contratoId) {
      const { data: contratoData } = await supabase
        .from('contratos')
        .select('cotacao_id')
        .eq('id', contratoId)
        .single();
      cotacaoId = contratoData?.cotacao_id || null;
      console.log(`[LAUDO] CotacaoId recuperado do contrato: ${cotacaoId}`);
    }

    // Fetch vistoria with related data
    const { data: vistoria, error: vistoriaError } = await supabase
      .from('vistorias')
      .select(`
        id,
        protocolo,
        created_at,
        km_atual,
        observacoes,
        status,
        video_360_url,
        endereco_logradouro,
        endereco_numero,
        endereco_bairro,
        endereco_cidade,
        endereco_estado,
        associados:associado_id (
          id, nome, cpf, logradouro, numero, bairro, cidade, uf
        ),
        veiculos:veiculo_id (
          id, marca, modelo, ano_fabricacao, ano_modelo, cor, placa, chassi
        ),
        vistoriador:vistoriador_id (
          id, nome
        )
      `)
      .eq('id', vistoriaId)
      .single();

    if (vistoriaError || !vistoria) {
      console.error('[LAUDO] Erro ao buscar vistoria:', vistoriaError);
      return new Response(
        JSON.stringify({ error: 'Vistoria não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch photos
    const { data: fotos } = await supabase
      .from('vistoria_fotos')
      .select('tipo, arquivo_url, visivel_cliente')
      .eq('vistoria_id', vistoriaId)
      .neq('visivel_cliente', false); // Exclude hidden photos (tracker location)

    console.log(`[LAUDO] Total de fotos encontradas: ${fotos?.length || 0}`);

    const associado = vistoria.associados as any;
    const veiculo = vistoria.veiculos as any;
    const vistoriador = vistoria.vistoriador as any;

    // Format address
    const enderecoVistoria = [
      vistoria.endereco_logradouro,
      vistoria.endereco_numero,
      vistoria.endereco_bairro,
      vistoria.endereco_cidade,
      vistoria.endereco_estado
    ].filter(Boolean).join(', ') || 'Não informado';

    const enderecoAssociado = associado ? [
      associado.logradouro,
      associado.numero,
      associado.bairro,
      associado.cidade,
      associado.uf
    ].filter(Boolean).join(', ') : 'Não informado';

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Helper function to add a new page with header
    const addPage = () => {
      const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      return page;
    };

    // Helper function to draw text with wrapping
    const drawWrappedText = (page: any, text: string, x: number, y: number, maxWidth: number, fontSize: number, lineHeight: number, fontToUse: any = font) => {
      const words = text.split(' ');
      let currentLine = '';
      let currentY = y;

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const textWidth = fontToUse.widthOfTextAtSize(testLine, fontSize);

        if (textWidth > maxWidth && currentLine) {
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

    // First page
    let page = addPage();
    let y = PAGE_HEIGHT - MARGIN;

    // Header
    page.drawText('LAUDO DE VISTORIA VEICULAR', {
      x: MARGIN,
      y: y - 20,
      size: 18,
      font: fontBold,
      color: PRIMARY_COLOR,
    });

    page.drawText('PRATICCAR Proteção Veicular', {
      x: PAGE_WIDTH - MARGIN - 150,
      y: y - 20,
      size: 10,
      font: font,
      color: MUTED_COLOR,
    });

    y -= 50;

    // Protocol and date info
    const protocolo = vistoria.protocolo || `VIST-${vistoriaId.slice(0, 8).toUpperCase()}`;
    const dataVistoria = new Date(vistoria.created_at);
    const dataFormatada = dataVistoria.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    page.drawRectangle({
      x: MARGIN,
      y: y - 30,
      width: CONTENT_WIDTH,
      height: 30,
      color: SECTION_BG,
    });

    page.drawText(`Protocolo: ${protocolo}`, {
      x: MARGIN + 10,
      y: y - 20,
      size: 10,
      font: fontBold,
      color: TEXT_COLOR,
    });

    page.drawText(`Data: ${dataFormatada}`, {
      x: PAGE_WIDTH - MARGIN - 150,
      y: y - 20,
      size: 10,
      font: font,
      color: TEXT_COLOR,
    });

    y -= 50;

    // Associated data section
    page.drawText('DADOS DO ASSOCIADO', {
      x: MARGIN,
      y,
      size: 12,
      font: fontBold,
      color: PRIMARY_COLOR,
    });

    y -= 20;

    page.drawText(`Nome: ${associado?.nome || 'Não informado'}`, {
      x: MARGIN,
      y,
      size: 10,
      font,
      color: TEXT_COLOR,
    });

    const cpfFormatado = associado?.cpf
      ? associado.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      : '';

    page.drawText(`CPF: ${cpfFormatado}`, {
      x: PAGE_WIDTH - MARGIN - 150,
      y,
      size: 10,
      font,
      color: TEXT_COLOR,
    });

    y -= 18;

    page.drawText(`Endereço: ${enderecoAssociado}`, {
      x: MARGIN,
      y,
      size: 9,
      font,
      color: MUTED_COLOR,
    });

    y -= 30;

    // Vehicle data section
    page.drawText('DADOS DO VEÍCULO', {
      x: MARGIN,
      y,
      size: 12,
      font: fontBold,
      color: PRIMARY_COLOR,
    });

    y -= 20;

    const marcaModelo = [veiculo?.marca, veiculo?.modelo].filter(Boolean).join(' ') || 'Não informado';
    const ano = veiculo?.ano_fabricacao && veiculo?.ano_modelo
      ? `${veiculo.ano_fabricacao}/${veiculo.ano_modelo}`
      : veiculo?.ano_modelo || '';

    page.drawText(`Marca/Modelo: ${marcaModelo}`, { x: MARGIN, y, size: 10, font, color: TEXT_COLOR });
    page.drawText(`Ano: ${ano}`, { x: MARGIN + 250, y, size: 10, font, color: TEXT_COLOR });
    page.drawText(`Cor: ${veiculo?.cor || ''}`, { x: MARGIN + 380, y, size: 10, font, color: TEXT_COLOR });

    y -= 18;

    page.drawText(`Placa: ${veiculo?.placa || placa || ''}`, { x: MARGIN, y, size: 10, font, color: TEXT_COLOR });
    page.drawText(`Chassi: ${veiculo?.chassi || ''}`, { x: MARGIN + 150, y, size: 10, font, color: TEXT_COLOR });

    y -= 18;

    const hodometro = vistoria.km_atual ? `${vistoria.km_atual.toLocaleString('pt-BR')} km` : 'Não informado';
    page.drawText(`Hodômetro: ${hodometro}`, { x: MARGIN, y, size: 10, font, color: TEXT_COLOR });

    y -= 30;

    // Vistoria info section
    page.drawText('INFORMAÇÕES DA VISTORIA', {
      x: MARGIN,
      y,
      size: 12,
      font: fontBold,
      color: PRIMARY_COLOR,
    });

    y -= 20;

    page.drawText(`Vistoriador: ${vistoriador?.nome || 'Não informado'}`, { x: MARGIN, y, size: 10, font, color: TEXT_COLOR });

    y -= 18;

    page.drawText(`Local: ${enderecoVistoria}`, { x: MARGIN, y, size: 9, font, color: MUTED_COLOR });

    y -= 25;

    // Status badge - só exibe se aprovado
    const status = vistoria.status || 'aprovada';
    if (status === 'aprovada' || status === 'aprovada_com_ressalvas') {
      const statusText = status === 'aprovada' ? 'APROVADO' : 'APROVADO COM RESSALVAS';
      const badgeWidth = fontBold.widthOfTextAtSize(statusText, 14) + 30;

      page.drawRectangle({
        x: MARGIN,
        y: y - 5,
        width: badgeWidth,
        height: 25,
        color: SUCCESS_COLOR,
      });

      page.drawText(statusText, {
        x: MARGIN + 15,
        y: y + 3,
        size: 14,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
    }

    y -= 50;

    // Observations section (if any)
    if (vistoria.observacoes) {
      page.drawText('OBSERVAÇÕES', {
        x: MARGIN,
        y,
        size: 12,
        font: fontBold,
        color: PRIMARY_COLOR,
      });

      y -= 18;
      y = drawWrappedText(page, vistoria.observacoes, MARGIN, y, CONTENT_WIDTH, 9, 12);
      y -= 20;
    }

    // Video 360° section with QR Code (if available)
    if (vistoria.video_360_url) {
      console.log(`[LAUDO] Incluindo vídeo 360° no laudo: ${vistoria.video_360_url}`);
      
      // Check if we need a new page for the video section
      if (y < 200) {
        page = addPage();
        y = PAGE_HEIGHT - MARGIN - 30;
      }

      page.drawText('VÍDEO 360° DO VEÍCULO', {
        x: MARGIN,
        y,
        size: 12,
        font: fontBold,
        color: PRIMARY_COLOR,
      });

      y -= 20;

      page.drawText('Escaneie o QR Code ou acesse o link para visualizar o vídeo 360° do veículo:', {
        x: MARGIN,
        y,
        size: 9,
        font,
        color: TEXT_COLOR,
      });

      y -= 25;

      try {
        // Generate QR Code as data URL
        const qrDataUrl = await QRCode.toDataURL(vistoria.video_360_url, { 
          width: 150,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });

        // Convert base64 to Uint8Array
        const base64Data = qrDataUrl.split(',')[1];
        const binaryString = atob(base64Data);
        const qrBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          qrBytes[i] = binaryString.charCodeAt(i);
        }

        // Embed QR Code image in PDF
        const qrImage = await pdfDoc.embedPng(qrBytes);
        const qrSize = 100;

        page.drawImage(qrImage, {
          x: MARGIN,
          y: y - qrSize,
          width: qrSize,
          height: qrSize,
        });

        // Add label below QR Code
        page.drawText('Escaneie com seu celular', {
          x: MARGIN,
          y: y - qrSize - 15,
          size: 8,
          font,
          color: MUTED_COLOR,
        });

        // Add clickable link text next to QR Code
        page.drawText('Link direto:', {
          x: MARGIN + qrSize + 20,
          y: y - 20,
          size: 9,
          font,
          color: TEXT_COLOR,
        });

        // Draw the link in blue (indicating it's a link)
        const videoUrl = vistoria.video_360_url;
        const maxLinkWidth = CONTENT_WIDTH - qrSize - 40;
        const displayUrl = videoUrl.length > 60 ? videoUrl.substring(0, 57) + '...' : videoUrl;
        
        page.drawText(displayUrl, {
          x: MARGIN + qrSize + 20,
          y: y - 35,
          size: 8,
          font,
          color: rgb(0, 0.4, 0.8), // Blue color for link
        });

        y = y - qrSize - 40;
        console.log(`[LAUDO] QR Code do vídeo 360° adicionado com sucesso`);
      } catch (qrError) {
        console.error('[LAUDO] Erro ao gerar QR Code:', qrError);
        
        // Fallback: just show the link without QR Code
        page.drawText('Link para o vídeo:', {
          x: MARGIN,
          y,
          size: 9,
          font,
          color: TEXT_COLOR,
        });

        y -= 15;

        page.drawText(vistoria.video_360_url, {
          x: MARGIN,
          y,
          size: 8,
          font,
          color: rgb(0, 0.4, 0.8),
        });

        y -= 30;
      }
    }

    // Photos section - with memory optimization
    const fotosValidas = (fotos || []).filter(f => f.arquivo_url);
    
    // Apply priority selection to limit total photos
    const fotosSelecionadas = selectPriorityPhotos(fotosValidas);
    console.log(`[LAUDO] Fotos selecionadas após priorização: ${fotosSelecionadas.length} de ${fotosValidas.length}`);
    
    // Separar assinatura das outras fotos
    const fotosAssinatura = fotosSelecionadas.filter(f => 
      f.tipo === 'assinatura_cliente' || f.tipo?.toLowerCase().includes('assinatura')
    );
    const fotosOutrasSemAssinatura = fotosSelecionadas.filter(f => 
      f.tipo !== 'assinatura_cliente' && !f.tipo?.toLowerCase().includes('assinatura')
    );

    let fotosProcessadas = 0;
    let fotosSkipped = 0;

    // Desenhar assinatura primeiro se existir
    if (fotosAssinatura.length > 0) {
      if (y < 350) {
        page = addPage();
        y = PAGE_HEIGHT - MARGIN - 30;
      }

      page.drawText('ASSINATURA DO CLIENTE', {
        x: MARGIN,
        y,
        size: 11,
        font: fontBold,
        color: PRIMARY_COLOR,
      });

      y -= 20;

      let col = 0;
      let rowY = y;

      for (const foto of fotosAssinatura) {
        if (rowY - IMG_HEIGHT - 20 < MARGIN) {
          page = addPage();
          rowY = PAGE_HEIGHT - MARGIN - 30;
          y = rowY;
          col = 0;
        }

        const x = MARGIN + col * (IMG_WIDTH + IMG_GAP);

        const { image, skipped, reason } = await fetchAndEmbedImage(pdfDoc, foto.arquivo_url);
        
        if (skipped) {
          console.warn(`[LAUDO] Assinatura skipped: ${reason}`);
          fotosSkipped++;
        } else if (image) {
          fotosProcessadas++;
          const aspectRatio = image.width / image.height;
          let drawWidth = IMG_WIDTH;
          let drawHeight = IMG_WIDTH / aspectRatio;

          if (drawHeight > IMG_HEIGHT) {
            drawHeight = IMG_HEIGHT;
            drawWidth = IMG_HEIGHT * aspectRatio;
          }

          page.drawRectangle({
            x,
            y: rowY - IMG_HEIGHT,
            width: IMG_WIDTH,
            height: IMG_HEIGHT,
            color: rgb(0.97, 0.97, 0.97),
            borderColor: rgb(0.9, 0.9, 0.9),
            borderWidth: 1,
          });

          const offsetX = (IMG_WIDTH - drawWidth) / 2;
          const offsetY = (IMG_HEIGHT - drawHeight) / 2;

          page.drawImage(image, {
            x: x + offsetX,
            y: rowY - IMG_HEIGHT + offsetY,
            width: drawWidth,
            height: drawHeight,
          });
        }

        page.drawText('Assinatura do Cliente', {
          x,
          y: rowY - IMG_HEIGHT - 12,
          size: 8,
          font,
          color: MUTED_COLOR,
        });

        col++;
        if (col >= COLS) {
          col = 0;
          rowY -= IMG_HEIGHT + 30;
        }
      }

      if (col > 0) {
        rowY -= IMG_HEIGHT + 30;
      }

      y = rowY - 20;
    }

    if (fotosOutrasSemAssinatura.length > 0) {
      // Group photos by category
      for (const categoria of CATEGORIAS) {
        const fotosDaCategoria = fotosOutrasSemAssinatura.filter(f => 
          categoria.tipos.some(t => f.tipo?.toLowerCase().includes(t))
        );

        if (fotosDaCategoria.length === 0) continue;

        // Check if we need a new page
        if (y < 200) {
          page = addPage();
          y = PAGE_HEIGHT - MARGIN - 30;
        }

        // Category header
        page.drawText(categoria.nome.toUpperCase(), {
          x: MARGIN,
          y,
          size: 11,
          font: fontBold,
          color: PRIMARY_COLOR,
        });

        page.drawText(`(${fotosDaCategoria.length} fotos)`, {
          x: MARGIN + fontBold.widthOfTextAtSize(categoria.nome.toUpperCase(), 11) + 10,
          y,
          size: 9,
          font,
          color: MUTED_COLOR,
        });

        y -= 20;

        // Draw photos in grid
        let col = 0;
        let rowY = y;

        for (const foto of fotosDaCategoria) {
          // Check if we need a new page
          if (rowY - IMG_HEIGHT - 20 < MARGIN) {
            page = addPage();
            rowY = PAGE_HEIGHT - MARGIN - 30;
            y = rowY;
            col = 0;
          }

          const x = MARGIN + col * (IMG_WIDTH + IMG_GAP);

          const { image, skipped, reason } = await fetchAndEmbedImage(pdfDoc, foto.arquivo_url);
          
          if (skipped) {
            console.warn(`[LAUDO] Foto skipped (${foto.tipo}): ${reason}`);
            fotosSkipped++;
          } else if (image) {
            fotosProcessadas++;
            // Calculate aspect ratio
            const aspectRatio = image.width / image.height;
            let drawWidth = IMG_WIDTH;
            let drawHeight = IMG_WIDTH / aspectRatio;

            if (drawHeight > IMG_HEIGHT) {
              drawHeight = IMG_HEIGHT;
              drawWidth = IMG_HEIGHT * aspectRatio;
            }

            // Draw image placeholder background
            page.drawRectangle({
              x,
              y: rowY - IMG_HEIGHT,
              width: IMG_WIDTH,
              height: IMG_HEIGHT,
              color: rgb(0.97, 0.97, 0.97),
              borderColor: rgb(0.9, 0.9, 0.9),
              borderWidth: 1,
            });

            // Center image in placeholder
            const offsetX = (IMG_WIDTH - drawWidth) / 2;
            const offsetY = (IMG_HEIGHT - drawHeight) / 2;

            page.drawImage(image, {
              x: x + offsetX,
              y: rowY - IMG_HEIGHT + offsetY,
              width: drawWidth,
              height: drawHeight,
            });
          }

          // Draw label
          const label = TIPO_FOTO_LABELS[foto.tipo] || foto.tipo || 'Foto';
          page.drawText(label, {
            x,
            y: rowY - IMG_HEIGHT - 12,
            size: 8,
            font,
            color: MUTED_COLOR,
          });

          col++;
          if (col >= COLS) {
            col = 0;
            rowY -= IMG_HEIGHT + 30;
          }
        }

        // Move to next row if not at start of row
        if (col > 0) {
          rowY -= IMG_HEIGHT + 30;
        }

        y = rowY - 20;
      }

      // Handle uncategorized photos (excluindo assinatura já exibida)
      const categoriaTipos = CATEGORIAS.flatMap(c => c.tipos);
      const fotosOutras = fotosOutrasSemAssinatura.filter(f => 
        !categoriaTipos.some(t => f.tipo?.toLowerCase().includes(t))
      );

      if (fotosOutras.length > 0) {
        if (y < 200) {
          page = addPage();
          y = PAGE_HEIGHT - MARGIN - 30;
        }

        page.drawText('OUTRAS FOTOS', {
          x: MARGIN,
          y,
          size: 11,
          font: fontBold,
          color: PRIMARY_COLOR,
        });

        y -= 20;

        let col = 0;
        let rowY = y;

        for (const foto of fotosOutras) {
          if (rowY - IMG_HEIGHT - 20 < MARGIN) {
            page = addPage();
            rowY = PAGE_HEIGHT - MARGIN - 30;
            y = rowY;
            col = 0;
          }

          const x = MARGIN + col * (IMG_WIDTH + IMG_GAP);

          const { image, skipped, reason } = await fetchAndEmbedImage(pdfDoc, foto.arquivo_url);
          
          if (skipped) {
            console.warn(`[LAUDO] Foto outras skipped: ${reason}`);
            fotosSkipped++;
          } else if (image) {
            fotosProcessadas++;
            const aspectRatio = image.width / image.height;
            let drawWidth = IMG_WIDTH;
            let drawHeight = IMG_WIDTH / aspectRatio;

            if (drawHeight > IMG_HEIGHT) {
              drawHeight = IMG_HEIGHT;
              drawWidth = IMG_HEIGHT * aspectRatio;
            }

            page.drawRectangle({
              x,
              y: rowY - IMG_HEIGHT,
              width: IMG_WIDTH,
              height: IMG_HEIGHT,
              color: rgb(0.97, 0.97, 0.97),
              borderColor: rgb(0.9, 0.9, 0.9),
              borderWidth: 1,
            });

            const offsetX = (IMG_WIDTH - drawWidth) / 2;
            const offsetY = (IMG_HEIGHT - drawHeight) / 2;

            page.drawImage(image, {
              x: x + offsetX,
              y: rowY - IMG_HEIGHT + offsetY,
              width: drawWidth,
              height: drawHeight,
            });
          }

          const label = TIPO_FOTO_LABELS[foto.tipo] || foto.tipo || 'Foto';
          page.drawText(label, {
            x,
            y: rowY - IMG_HEIGHT - 12,
            size: 8,
            font,
            color: MUTED_COLOR,
          });

          col++;
          if (col >= COLS) {
            col = 0;
            rowY -= IMG_HEIGHT + 30;
          }
        }
      }
    }

    console.log(`[LAUDO] Fotos processadas: ${fotosProcessadas}, skipped: ${fotosSkipped}`);

    // Add footer to all pages
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;
    const dataGeracao = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    for (let i = 0; i < totalPages; i++) {
      const p = pages[i];
      p.drawText(`Documento gerado em ${dataGeracao}`, {
        x: MARGIN,
        y: 20,
        size: 8,
        font,
        color: MUTED_COLOR,
      });
      p.drawText(`Página ${i + 1} de ${totalPages}`, {
        x: PAGE_WIDTH - MARGIN - 60,
        y: 20,
        size: 8,
        font,
        color: MUTED_COLOR,
      });
    }

    // Save PDF
    console.log(`[LAUDO] Salvando PDF com ${totalPages} páginas...`);
    const pdfBytes = await pdfDoc.save();
    const placaFormatada = (veiculo?.placa || placa || 'SEMPLACA').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const nomeArquivo = `Laudo_Vistoria_${placaFormatada}_${Date.now()}.pdf`;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(`laudos/${associadoId}/${nomeArquivo}`, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('[LAUDO] Erro ao fazer upload do PDF:', uploadError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar o PDF' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('documentos')
      .getPublicUrl(`laudos/${associadoId}/${nomeArquivo}`);

    const arquivoUrl = publicUrlData.publicUrl;

    console.log('[LAUDO] PDF gerado e salvo:', arquivoUrl);

    // NOVO: Deletar laudo anterior se existir (evita duplicidade)
    const { data: laudoExistente } = await supabase
      .from('documentos')
      .select('id, arquivo_url')
      .eq('associado_id', associadoId)
      .eq('veiculo_id', veiculoId)
      .eq('tipo', 'laudo_vistoria')
      .maybeSingle();

    if (laudoExistente) {
      console.log('[LAUDO] Laudo anterior encontrado, será substituído:', laudoExistente.id);
      
      // Deletar arquivo antigo do storage (se for diferente do novo)
      if (laudoExistente.arquivo_url && laudoExistente.arquivo_url !== arquivoUrl) {
        const pathMatch = laudoExistente.arquivo_url.match(/\/documentos\/(.+)$/);
        if (pathMatch) {
          await supabase.storage.from('documentos').remove([pathMatch[1]]);
        }
      }
      
      // Deletar registro antigo
      await supabase
        .from('documentos')
        .delete()
        .eq('id', laudoExistente.id);
    }

    // Insert into documentos table (for cadastro analyst view)
    const { error: docError } = await supabase
      .from('documentos')
      .insert({
        associado_id: associadoId,
        veiculo_id: veiculoId,
        tipo: 'laudo_vistoria',
        arquivo_url: arquivoUrl,
        nome_arquivo: nomeArquivo,
        status: 'aprovado',
      });

    if (docError) {
      console.error('[LAUDO] Erro ao inserir documento:', docError);
    }

    // Also insert into contratos_documentos if contratoId or cotacaoId provided (compatibility)
    if (contratoId || cotacaoId) {
      const { error: contratoDocError } = await supabase
        .from('contratos_documentos')
        .insert({
          contrato_id: contratoId || null,
          cotacao_id: cotacaoId || null,
          tipo: 'laudo_vistoria',
          arquivo_url: arquivoUrl,
          arquivo_nome: nomeArquivo,
          status: 'pendente',
        });

      if (contratoDocError) {
        console.warn('[LAUDO] Erro ao inserir documento do contrato (não crítico):', contratoDocError);
      } else {
        console.log(`[LAUDO] Laudo inserido em contratos_documentos: contrato=${contratoId}, cotacao=${cotacaoId}`);
      }
    }

    console.log(`[LAUDO] Geração concluída com sucesso!`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        url: arquivoUrl,
        nomeArquivo,
        stats: {
          fotosTotal: fotosValidas.length,
          fotosSelecionadas: fotosSelecionadas.length,
          fotosProcessadas,
          fotosSkipped,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Erro interno ao gerar laudo';
    console.error('[LAUDO] Erro ao gerar laudo:', error);
    return new Response(
      JSON.stringify({ error: errMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
