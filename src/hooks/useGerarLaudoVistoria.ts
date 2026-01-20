import { useState } from 'react';
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont, PDFImage } from 'pdf-lib';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CATEGORIAS_VISTORIA_COMPLETA, FOTOS_VISTORIA_COMPLETA, VistoriaFotoConfig } from '@/data/vistoriaConfigCompleta';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Tipos para os dados do laudo
interface DadosLaudo {
  protocolo: string;
  dataVistoria: string;
  local: string;
  vistoriador: {
    nome: string;
  };
  associado: {
    nome: string;
    cpf: string;
    endereco: string;
  };
  veiculo: {
    marca: string;
    modelo: string;
    ano: string;
    cor: string;
    placa: string;
    chassi: string;
    hodometro: number;
  };
  fotos: Array<{
    tipo: string;
    url: string;
  }>;
  observacoes?: string;
}

// Constantes de layout
const PAGE_WIDTH = 595.28; // A4 width in points
const PAGE_HEIGHT = 841.89; // A4 height in points
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

const HEADER_BG = rgb(0.1, 0.1, 0.15);
const SECTION_BG = rgb(0.95, 0.95, 0.97);
const PRIMARY_COLOR = rgb(0.2, 0.4, 0.6);
const TEXT_COLOR = rgb(0.2, 0.2, 0.2);
const MUTED_COLOR = rgb(0.5, 0.5, 0.5);

// Tamanhos de imagem no grid
const IMG_WIDTH = 165;
const IMG_HEIGHT = 110;
const IMG_GAP = 10;
const COLS = 3;

export function useGerarLaudoVistoria() {
  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState(0);

  // Buscar dados completos da vistoria
  const buscarDadosLaudo = async (vistoriaId: string): Promise<DadosLaudo | null> => {
    // Buscar vistoria com joins
    const { data: vistoria, error } = await supabase
      .from('vistorias')
      .select(`
        id,
        protocolo,
        created_at,
        km_atual,
        observacoes,
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
          id, name
        )
      `)
      .eq('id', vistoriaId)
      .single();

    if (error || !vistoria) {
      console.error('Erro ao buscar dados da vistoria:', error);
      return null;
    }

    // Buscar fotos
    const { data: fotos } = await supabase
      .from('vistoria_fotos')
      .select('tipo, arquivo_url, visivel_cliente')
      .eq('vistoria_id', vistoriaId);

    // Formatar endereço da vistoria
    const enderecoVistoria = [
      vistoria.endereco_logradouro,
      vistoria.endereco_numero,
      vistoria.endereco_bairro,
      vistoria.endereco_cidade,
      vistoria.endereco_estado
    ].filter(Boolean).join(', ') || 'Não informado';

    // Formatar endereço do associado
    const associado = vistoria.associados as any;
    const enderecoAssociado = associado ? [
      associado.logradouro,
      associado.numero,
      associado.bairro,
      associado.cidade,
      associado.uf
    ].filter(Boolean).join(', ') : '';

    const veiculo = vistoria.veiculos as any;
    const vistoriadorData = vistoria.vistoriador as any;

    return {
      protocolo: vistoria.protocolo || `VIST-${vistoriaId.slice(0, 8).toUpperCase()}`,
      dataVistoria: vistoria.created_at,
      local: enderecoVistoria,
      vistoriador: {
        nome: vistoriadorData?.name || 'Não informado',
      },
      associado: {
        nome: associado?.nome || 'Não informado',
        cpf: associado?.cpf || '',
        endereco: enderecoAssociado,
      },
      veiculo: {
        marca: veiculo?.marca || '',
        modelo: veiculo?.modelo || '',
        ano: veiculo?.ano_fabricacao && veiculo?.ano_modelo
          ? `${veiculo.ano_fabricacao}/${veiculo.ano_modelo}`
          : veiculo?.ano_modelo || '',
        cor: veiculo?.cor || '',
        placa: veiculo?.placa || '',
        chassi: veiculo?.chassi || '',
        hodometro: vistoria.km_atual || 0,
      },
      fotos: (fotos || [])
        .filter(f => f.visivel_cliente !== false) // Filtrar fotos ocultas (local do rastreador)
        .map(f => ({
          tipo: f.tipo,
          url: f.arquivo_url,
        })),
      observacoes: vistoria.observacoes || undefined,
    };
  };

  // Carregar e embedar imagem no PDF
  const embedImage = async (pdfDoc: PDFDocument, url: string): Promise<PDFImage | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      
      const arrayBuffer = await response.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      // Tentar como JPEG primeiro, depois PNG
      try {
        return await pdfDoc.embedJpg(bytes);
      } catch {
        try {
          return await pdfDoc.embedPng(bytes);
        } catch {
          console.warn('Não foi possível embedar imagem:', url);
          return null;
        }
      }
    } catch (error) {
      console.warn('Erro ao carregar imagem:', url, error);
      return null;
    }
  };

  // Desenhar cabeçalho
  const desenharCabecalho = (
    page: PDFPage,
    font: PDFFont,
    fontBold: PDFFont,
    dados: DadosLaudo,
    pageNum: number,
    totalPages: number
  ) => {
    const y = PAGE_HEIGHT - MARGIN;

    // Título
    page.drawText('LAUDO DE VISTORIA VEICULAR', {
      x: MARGIN,
      y: y - 20,
      size: 18,
      font: fontBold,
      color: PRIMARY_COLOR,
    });

    page.drawText('PRATICCAR', {
      x: PAGE_WIDTH - MARGIN - 80,
      y: y - 20,
      size: 14,
      font: fontBold,
      color: MUTED_COLOR,
    });

    // Linha divisória
    page.drawLine({
      start: { x: MARGIN, y: y - 30 },
      end: { x: PAGE_WIDTH - MARGIN, y: y - 30 },
      thickness: 1,
      color: PRIMARY_COLOR,
    });

    // Número da página
    page.drawText(`Página ${pageNum} de ${totalPages}`, {
      x: PAGE_WIDTH - MARGIN - 80,
      y: MARGIN - 15,
      size: 8,
      font,
      color: MUTED_COLOR,
    });

    return y - 50;
  };

  // Desenhar seção de dados no cabeçalho
  const desenharDados = (
    page: PDFPage,
    font: PDFFont,
    fontBold: PDFFont,
    dados: DadosLaudo,
    startY: number
  ) => {
    let y = startY;
    const lineHeight = 14;
    const colWidth = CONTENT_WIDTH / 2;

    // Box de protocolo e data
    page.drawRectangle({
      x: MARGIN,
      y: y - 35,
      width: CONTENT_WIDTH,
      height: 35,
      color: SECTION_BG,
    });

    page.drawText(`Protocolo: ${dados.protocolo}`, {
      x: MARGIN + 10,
      y: y - 22,
      size: 10,
      font: fontBold,
      color: TEXT_COLOR,
    });

    const dataFormatada = format(new Date(dados.dataVistoria), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    page.drawText(`Data: ${dataFormatada}`, {
      x: MARGIN + colWidth,
      y: y - 22,
      size: 10,
      font,
      color: TEXT_COLOR,
    });

    y -= 50;

    // Seção Associado
    page.drawText('DADOS DO ASSOCIADO', {
      x: MARGIN,
      y,
      size: 9,
      font: fontBold,
      color: PRIMARY_COLOR,
    });
    y -= lineHeight;

    page.drawText(`Nome: ${dados.associado.nome}`, {
      x: MARGIN,
      y,
      size: 9,
      font,
      color: TEXT_COLOR,
    });

    page.drawText(`CPF: ${dados.associado.cpf}`, {
      x: MARGIN + colWidth,
      y,
      size: 9,
      font,
      color: TEXT_COLOR,
    });
    y -= lineHeight;

    if (dados.associado.endereco) {
      const enderecoTruncado = dados.associado.endereco.length > 80
        ? dados.associado.endereco.slice(0, 80) + '...'
        : dados.associado.endereco;
      page.drawText(`Endereço: ${enderecoTruncado}`, {
        x: MARGIN,
        y,
        size: 9,
        font,
        color: TEXT_COLOR,
      });
      y -= lineHeight;
    }

    y -= 10;

    // Seção Veículo
    page.drawText('DADOS DO VEÍCULO', {
      x: MARGIN,
      y,
      size: 9,
      font: fontBold,
      color: PRIMARY_COLOR,
    });
    y -= lineHeight;

    page.drawText(`Marca/Modelo: ${dados.veiculo.marca} ${dados.veiculo.modelo}`, {
      x: MARGIN,
      y,
      size: 9,
      font,
      color: TEXT_COLOR,
    });

    page.drawText(`Ano: ${dados.veiculo.ano}  |  Cor: ${dados.veiculo.cor}`, {
      x: MARGIN + colWidth,
      y,
      size: 9,
      font,
      color: TEXT_COLOR,
    });
    y -= lineHeight;

    page.drawText(`Placa: ${dados.veiculo.placa}`, {
      x: MARGIN,
      y,
      size: 9,
      font,
      color: TEXT_COLOR,
    });

    page.drawText(`Chassi: ${dados.veiculo.chassi}`, {
      x: MARGIN + colWidth,
      y,
      size: 9,
      font,
      color: TEXT_COLOR,
    });
    y -= lineHeight;

    page.drawText(`Hodômetro: ${dados.veiculo.hodometro.toLocaleString('pt-BR')} km`, {
      x: MARGIN,
      y,
      size: 9,
      font,
      color: TEXT_COLOR,
    });
    y -= lineHeight + 10;

    // Seção Vistoria
    page.drawText('INFORMAÇÕES DA VISTORIA', {
      x: MARGIN,
      y,
      size: 9,
      font: fontBold,
      color: PRIMARY_COLOR,
    });
    y -= lineHeight;

    page.drawText(`Vistoriador: ${dados.vistoriador.nome}`, {
      x: MARGIN,
      y,
      size: 9,
      font,
      color: TEXT_COLOR,
    });

    page.drawText(`Local: ${dados.local.slice(0, 50)}${dados.local.length > 50 ? '...' : ''}`, {
      x: MARGIN + colWidth,
      y,
      size: 9,
      font,
      color: TEXT_COLOR,
    });
    y -= lineHeight;

    // Status
    page.drawRectangle({
      x: MARGIN,
      y: y - 5,
      width: 80,
      height: 18,
      color: rgb(0.2, 0.7, 0.3),
      borderWidth: 0,
    });

    page.drawText('APROVADO', {
      x: MARGIN + 12,
      y: y,
      size: 10,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    y -= 30;

    // Linha divisória
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: MUTED_COLOR,
    });

    return y - 15;
  };

  // Gerar o PDF completo
  const gerarPDF = async (dados: DadosLaudo): Promise<Uint8Array> => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Agrupar fotos por categoria
    const fotosAgrupadas = CATEGORIAS_VISTORIA_COMPLETA
      .filter(cat => cat.id !== 'instalacao') // Excluir categoria de instalação
      .map(categoria => ({
        ...categoria,
        fotos: FOTOS_VISTORIA_COMPLETA
          .filter(fotoConfig => fotoConfig.categoria === categoria.id)
          .map(fotoConfig => ({
            config: fotoConfig,
            url: dados.fotos.find(f => f.tipo === fotoConfig.id)?.url,
          }))
          .filter(f => f.url), // Apenas fotos que existem
      }))
      .filter(cat => cat.fotos.length > 0);

    // Calcular número total de páginas
    let totalFotos = fotosAgrupadas.reduce((acc, cat) => acc + cat.fotos.length, 0);
    const fotosPerPage = 6; // 3 colunas x 2 linhas
    const totalPages = 1 + Math.ceil(totalFotos / fotosPerPage);

    // Primeira página com cabeçalho e dados
    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let pageNum = 1;
    
    let y = desenharCabecalho(page, font, fontBold, dados, pageNum, totalPages);
    y = desenharDados(page, font, fontBold, dados, y);

    // Carregar todas as imagens
    setProgresso(10);
    const imagensCarregadas: Map<string, PDFImage> = new Map();
    let carregadas = 0;
    
    for (const categoria of fotosAgrupadas) {
      for (const foto of categoria.fotos) {
        if (foto.url) {
          const img = await embedImage(pdfDoc, foto.url);
          if (img) {
            imagensCarregadas.set(foto.config.id, img);
          }
          carregadas++;
          setProgresso(10 + Math.round((carregadas / totalFotos) * 60));
        }
      }
    }

    // Desenhar fotos organizadas por categoria
    let fotoIndex = 0;
    
    for (const categoria of fotosAgrupadas) {
      // Verificar se cabe título da categoria
      if (y < 180) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        pageNum++;
        y = desenharCabecalho(page, font, fontBold, dados, pageNum, totalPages);
      }

      // Título da categoria
      page.drawRectangle({
        x: MARGIN,
        y: y - 18,
        width: CONTENT_WIDTH,
        height: 22,
        color: SECTION_BG,
      });

      page.drawText(categoria.nome.toUpperCase(), {
        x: MARGIN + 10,
        y: y - 12,
        size: 10,
        font: fontBold,
        color: PRIMARY_COLOR,
      });

      page.drawText(`(${categoria.fotos.length} fotos)`, {
        x: MARGIN + 10 + font.widthOfTextAtSize(categoria.nome.toUpperCase(), 10) + 10,
        y: y - 12,
        size: 8,
        font,
        color: MUTED_COLOR,
      });

      y -= 35;

      // Desenhar fotos da categoria
      for (let i = 0; i < categoria.fotos.length; i++) {
        const foto = categoria.fotos[i];
        const img = imagensCarregadas.get(foto.config.id);
        
        // Calcular posição no grid
        const col = fotoIndex % COLS;
        const row = Math.floor((fotoIndex % fotosPerPage) / COLS);
        
        // Verificar se precisa nova página
        const neededHeight = IMG_HEIGHT + 20 + (row === 0 ? 0 : IMG_GAP);
        if (y - neededHeight < MARGIN + 30) {
          page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          pageNum++;
          y = desenharCabecalho(page, font, fontBold, dados, pageNum, totalPages);
          fotoIndex = 0;
        }

        const x = MARGIN + col * (IMG_WIDTH + IMG_GAP);
        const imgY = y - IMG_HEIGHT;

        if (img) {
          // Calcular dimensões mantendo aspect ratio
          const imgDims = img.scale(1);
          const scale = Math.min(IMG_WIDTH / imgDims.width, IMG_HEIGHT / imgDims.height);
          const scaledWidth = imgDims.width * scale;
          const scaledHeight = imgDims.height * scale;

          // Centralizar imagem
          const imgX = x + (IMG_WIDTH - scaledWidth) / 2;
          const imgYCentered = imgY + (IMG_HEIGHT - scaledHeight) / 2;

          // Borda
          page.drawRectangle({
            x: x - 2,
            y: imgY - 2,
            width: IMG_WIDTH + 4,
            height: IMG_HEIGHT + 4,
            borderColor: rgb(0.8, 0.8, 0.8),
            borderWidth: 1,
          });

          page.drawImage(img, {
            x: imgX,
            y: imgYCentered,
            width: scaledWidth,
            height: scaledHeight,
          });
        } else {
          // Placeholder para imagem não carregada
          page.drawRectangle({
            x,
            y: imgY,
            width: IMG_WIDTH,
            height: IMG_HEIGHT,
            color: rgb(0.9, 0.9, 0.9),
            borderColor: rgb(0.7, 0.7, 0.7),
            borderWidth: 1,
          });
        }

        // Legenda
        const legendaTruncada = foto.config.nome.length > 25
          ? foto.config.nome.slice(0, 22) + '...'
          : foto.config.nome;

        page.drawText(legendaTruncada, {
          x: x + 2,
          y: imgY - 12,
          size: 7,
          font,
          color: TEXT_COLOR,
        });

        fotoIndex++;

        // Atualizar y se completou uma linha
        if ((fotoIndex % COLS) === 0) {
          y -= IMG_HEIGHT + 25;
        }
      }

      // Completar a linha se não terminou
      if ((fotoIndex % COLS) !== 0) {
        y -= IMG_HEIGHT + 25;
      }

      y -= 10; // Espaço entre categorias
    }

    // Observações (se houver)
    if (dados.observacoes) {
      if (y < 100) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        pageNum++;
        y = desenharCabecalho(page, font, fontBold, dados, pageNum, totalPages);
      }

      page.drawText('OBSERVAÇÕES:', {
        x: MARGIN,
        y,
        size: 9,
        font: fontBold,
        color: PRIMARY_COLOR,
      });
      y -= 14;

      page.drawText(dados.observacoes.slice(0, 200), {
        x: MARGIN,
        y,
        size: 9,
        font,
        color: TEXT_COLOR,
      });
    }

    // Rodapé da última página
    const dataGeracao = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    page.drawText(`Documento gerado em ${dataGeracao}`, {
      x: MARGIN,
      y: MARGIN - 15,
      size: 7,
      font,
      color: MUTED_COLOR,
    });

    setProgresso(90);

    return await pdfDoc.save();
  };

  // Função principal para gerar e salvar o laudo
  const gerarESalvarLaudo = async (
    vistoriaId: string,
    contratoId: string,
    veiculoPlaca: string
  ): Promise<string | null> => {
    setGerando(true);
    setProgresso(0);

    try {
      // Buscar dados
      const dados = await buscarDadosLaudo(vistoriaId);
      if (!dados) {
        throw new Error('Não foi possível buscar os dados da vistoria');
      }
      setProgresso(5);

      // Gerar PDF
      const pdfBytes = await gerarPDF(dados);
      setProgresso(95);

      // Upload para Storage
      const fileName = `laudos/${contratoId}/laudo_vistoria_${veiculoPlaca}_${Date.now()}.pdf`;
      const blob = new Blob([new Uint8Array(pdfBytes) as BlobPart], { type: 'application/pdf' });

      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(fileName, blob, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Erro ao fazer upload: ${uploadError.message}`);
      }

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('documentos')
        .getPublicUrl(fileName);

      // Inserir na tabela de documentos do contrato
      const { error: insertError } = await supabase
        .from('contratos_documentos')
        .insert({
          contrato_id: contratoId,
          tipo: 'laudo_vistoria',
          arquivo_url: urlData.publicUrl,
          nome_arquivo: `Laudo_Vistoria_${veiculoPlaca}.pdf`,
          status: 'aprovado',
        });

      if (insertError) {
        console.error('Erro ao registrar documento:', insertError);
        // Não falhar por isso, o PDF foi gerado
      }

      setProgresso(100);
      return urlData.publicUrl;

    } catch (error) {
      console.error('Erro ao gerar laudo:', error);
      toast.error('Erro ao gerar laudo de vistoria');
      return null;
    } finally {
      setGerando(false);
    }
  };

  return {
    gerarESalvarLaudo,
    gerando,
    progresso,
  };
}
