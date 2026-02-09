import { useState } from 'react';
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont, PDFImage } from 'pdf-lib';
import { supabase } from '@/integrations/supabase/client';
import { DocumentoTemplate, DadosMerge, OpcaoGeracaoPDF, DocumentoGerado } from '@/types/documentos';
import { toast } from 'sonner';

// Configurações padrão
const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const LINE_HEIGHT = 16;

// Logo padrão da PRATICCAR em Base64 (vazio por enquanto - pode ser preenchido depois)
const LOGO_PADRAO_BASE64 = '';

// Helper para evitar deep type instantiation em veiculos
const queryVeiculoPrincipal = async (associadoId: string): Promise<any> => {
  const result = await supabase
    .from('veiculos')
    .select('id, marca, modelo, ano_modelo, placa, chassi, renavam, cor, valor_fipe')
    .eq('associado_id', associadoId)
    .eq('principal', true)
    .maybeSingle();
  return result.data;
};

export function useGerarDocumento() {
  const [gerando, setGerando] = useState(false);
  const [progresso, setProgresso] = useState(0);

  // ===== BUSCAR DADOS DO ASSOCIADO =====
  const buscarDadosAssociado = async (associadoId: string): Promise<DadosMerge> => {
    // Buscar associado
    const associadoResult = await supabase
      .from('associados')
      .select('id, nome, cpf, rg, email, telefone, whatsapp, cep, logradouro, numero, complemento, bairro, cidade, uf, data_adesao, dia_vencimento')
      .eq('id', associadoId)
      .single();
    const associado = associadoResult.data;

    // Buscar veículo principal
    const veiculo = await queryVeiculoPrincipal(associadoId) as any;

    // Buscar contrato ativo
    const contratoResult = await supabase
      .from('contratos')
      .select('id, numero, valor_adesao, valor_mensal, plano_id')
      .eq('associado_id', associadoId)
      .eq('status', 'ativo')
      .single();
    const contrato = contratoResult.data;

    // Buscar plano se houver contrato
    let planoNome = '';
    if (contrato?.plano_id) {
      const planoResult = await supabase
        .from('planos')
        .select('nome')
        .eq('id', contrato.plano_id)
        .single();
      planoNome = planoResult.data?.nome || '';
    }

    // Montar endereço completo
    const enderecoCompleto = associado 
      ? `${associado.logradouro || ''}, ${associado.numero || ''} ${associado.complemento ? '- ' + associado.complemento : ''} - ${associado.bairro || ''} - ${associado.cidade || ''}/${associado.uf || ''}`
      : '';

    // Data por extenso
    const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const hoje = new Date();
    const dataExtenso = `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;

    return {
      associado: {
        nome: associado?.nome || '',
        cpf: associado?.cpf || '',
        rg: associado?.rg || '',
        email: associado?.email || '',
        telefone: associado?.telefone || '',
        whatsapp: associado?.whatsapp || '',
        endereco_completo: enderecoCompleto.trim(),
        cep: associado?.cep || '',
        logradouro: associado?.logradouro || '',
        numero: associado?.numero || '',
        complemento: associado?.complemento || '',
        bairro: associado?.bairro || '',
        cidade: associado?.cidade || '',
        estado: associado?.uf || '',
        data_adesao: associado?.data_adesao ? new Date(associado.data_adesao).toLocaleDateString('pt-BR') : '',
      },
      veiculo: {
        marca: veiculo?.marca || '',
        modelo: veiculo?.modelo || '',
        ano: veiculo?.ano_modelo || '',
        placa: veiculo?.placa || '',
        chassi: veiculo?.chassi || '',
        renavam: veiculo?.renavam || '',
        cor: veiculo?.cor || '',
        valor_fipe: veiculo?.valor_fipe ? `R$ ${Number(veiculo.valor_fipe).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '',
      },
      contrato: {
        numero: contrato?.numero || '',
        plano: planoNome,
        valor_adesao: contrato?.valor_adesao ? `R$ ${Number(contrato.valor_adesao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '',
        valor_mensal: contrato?.valor_mensal ? `R$ ${Number(contrato.valor_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '',
        dia_vencimento: associado?.dia_vencimento || '',
      },
      sistema: {
        data_atual: hoje.toLocaleDateString('pt-BR'),
        data_extenso: dataExtenso,
        hora_atual: hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      },
      empresa: {
        nome: 'PRATICCAR',
        razao_social: 'PRATICCAR Associação de Proteção Veicular',
        cnpj: '12.345.678/0001-90', // Substituir pelo real
        endereco: 'Av. Principal, 1000 - Centro - Cidade/UF', // Substituir pelo real
        telefone: '(11) 3333-4444', // Substituir pelo real
      },
    };
  };

  // ===== FAZER MERGE DO TEMPLATE COM DADOS =====
  const fazerMerge = (conteudo: string, dados: DadosMerge): string => {
    let resultado = conteudo;

    // Substituir todas as variáveis {{grupo.campo}}
    const regex = /\{\{(\w+)\.(\w+)\}\}/g;
    resultado = resultado.replace(regex, (match, grupo, campo) => {
      const valor = dados[grupo]?.[campo];
      return valor !== undefined && valor !== null && valor !== '' ? String(valor) : '';
    });

    // Substituir variáveis simples {{campo}}
    const regexSimples = /\{\{(\w+)\}\}/g;
    resultado = resultado.replace(regexSimples, (match, campo) => {
      // Procurar em todos os grupos
      for (const grupo of Object.values(dados)) {
        if (grupo[campo] !== undefined && grupo[campo] !== null && grupo[campo] !== '') {
          return String(grupo[campo]);
        }
      }
      return '';
    });

    return resultado;
  };

  // ===== QUEBRAR TEXTO EM LINHAS =====
  const quebrarTextoEmLinhas = (texto: string, font: PDFFont, fontSize: number, maxWidth: number): string[] => {
    const palavras = texto.split(' ');
    const linhas: string[] = [];
    let linhaAtual = '';

    for (const palavra of palavras) {
      const teste = linhaAtual ? `${linhaAtual} ${palavra}` : palavra;
      const largura = font.widthOfTextAtSize(teste, fontSize);

      if (largura <= maxWidth) {
        linhaAtual = teste;
      } else {
        if (linhaAtual) linhas.push(linhaAtual);
        linhaAtual = palavra;
      }
    }

    if (linhaAtual) linhas.push(linhaAtual);
    return linhas;
  };

  // ===== GERAR PDF =====
  const gerarPDF = async (
    template: DocumentoTemplate,
    dados: DadosMerge
  ): Promise<Uint8Array> => {
    const config = template.config_layout;
    const pageWidth = config.orientacao === 'paisagem' ? A4_HEIGHT : A4_WIDTH;
    const pageHeight = config.orientacao === 'paisagem' ? A4_WIDTH : A4_HEIGHT;

    // Criar documento
    const pdfDoc = await PDFDocument.create();
    setProgresso(10);

    // Carregar fontes
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    setProgresso(20);

    // Fazer merge do conteúdo
    const conteudoMerged = fazerMerge(template.conteudo, dados);
    setProgresso(30);

    // Calcular área útil
    const marginLeft = config.margemEsquerda;
    const marginRight = config.margemDireita;
    const marginTop = config.margemTopo;
    const marginBottom = config.margemBaixo;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const fontSize = config.tamanhoFonte;

    // Processar parágrafos
    const paragrafos = conteudoMerged.split('\n').filter(p => p.trim());
    
    // Criar primeira página
    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - marginTop;
    let pageNumber = 1;

    // Função para carregar logo (do URL ou Base64)
    const carregarLogo = async (logoUrl?: string): Promise<PDFImage | null> => {
      try {
        let logoBytes: ArrayBuffer;

        if (logoUrl) {
          // Carregar do URL fornecido
          const response = await fetch(logoUrl);
          if (!response.ok) throw new Error('Falha ao carregar logo');
          logoBytes = await response.arrayBuffer();
        } else if (LOGO_PADRAO_BASE64) {
          // Usar logo padrão em Base64
          const binaryString = atob(LOGO_PADRAO_BASE64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          logoBytes = bytes.buffer;
        } else {
          return null;
        }

        // Detectar tipo de imagem e embedar
        const uint8Array = new Uint8Array(logoBytes);

        // Verificar se é PNG (começa com 89 50 4E 47)
        if (uint8Array[0] === 0x89 && uint8Array[1] === 0x50) {
          return await pdfDoc.embedPng(logoBytes);
        }

        // Verificar se é JPEG (começa com FF D8 FF)
        if (uint8Array[0] === 0xFF && uint8Array[1] === 0xD8) {
          return await pdfDoc.embedJpg(logoBytes);
        }

        console.warn('Formato de imagem não suportado para logo');
        return null;
      } catch (error) {
        console.error('Erro ao carregar logo:', error);
        return null;
      }
    };

    // Função para adicionar cabeçalho (agora assíncrona para suportar logo)
    const adicionarCabecalho = async (p: PDFPage, numPag: number) => {
      if (!config.mostrarCabecalho) return;

      let xTexto = marginLeft;

      // Desenhar logo se habilitado
      if (config.mostrarLogo) {
        const logo = await carregarLogo(config.logoUrl);

        if (logo) {
          const logoWidth = 60;
          const logoHeight = (logo.height / logo.width) * logoWidth;

          p.drawImage(logo, {
            x: marginLeft,
            y: pageHeight - marginTop + 10,
            width: logoWidth,
            height: logoHeight,
          });

          xTexto = marginLeft + logoWidth + 10;
        }
      }
      
      // Linha do cabeçalho
      p.drawLine({
        start: { x: marginLeft, y: pageHeight - marginTop + 20 },
        end: { x: pageWidth - marginRight, y: pageHeight - marginTop + 20 },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8),
      });

      // Nome da empresa
      p.drawText('PRATICCAR', {
        x: xTexto,
        y: pageHeight - marginTop + 30,
        size: 12,
        font: fontBold,
        color: rgb(0.1, 0.3, 0.6),
      });

      // Nome do documento
      p.drawText(template.nome, {
        x: pageWidth - marginRight - fontRegular.widthOfTextAtSize(template.nome, 10),
        y: pageHeight - marginTop + 30,
        size: 10,
        font: fontRegular,
        color: rgb(0.5, 0.5, 0.5),
      });

      yPosition = pageHeight - marginTop - 10;
    };

    // Função para adicionar rodapé
    const adicionarRodape = (p: PDFPage, numPag: number) => {
      if (!config.mostrarRodape) return;

      // Linha do rodapé
      p.drawLine({
        start: { x: marginLeft, y: marginBottom - 10 },
        end: { x: pageWidth - marginRight, y: marginBottom - 10 },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8),
      });

      // Data de geração
      p.drawText(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, {
        x: marginLeft,
        y: marginBottom - 25,
        size: 8,
        font: fontRegular,
        color: rgb(0.5, 0.5, 0.5),
      });

      // Número da página
      if (config.mostrarNumeroPagina) {
        const textoPagina = `Página ${numPag}`;
        p.drawText(textoPagina, {
          x: pageWidth - marginRight - fontRegular.widthOfTextAtSize(textoPagina, 8),
          y: marginBottom - 25,
          size: 8,
          font: fontRegular,
          color: rgb(0.5, 0.5, 0.5),
        });
      }
    };

    // Adicionar cabeçalho da primeira página
    await adicionarCabecalho(page, pageNumber);
    setProgresso(40);

    // Processar cada parágrafo
    for (let i = 0; i < paragrafos.length; i++) {
      const paragrafo = paragrafos[i].trim();
      
      // Detectar se é título (começa com # ou é todo maiúsculo)
      const isTitulo = paragrafo.startsWith('#') || (paragrafo === paragrafo.toUpperCase() && paragrafo.length < 100);
      const textoLimpo = paragrafo.replace(/^#+\s*/, '');
      const fonte = isTitulo ? fontBold : fontRegular;
      const tamanhoFonte = isTitulo ? fontSize + 2 : fontSize;

      // Quebrar em linhas
      const linhas = quebrarTextoEmLinhas(textoLimpo, fonte, tamanhoFonte, contentWidth);

      for (const linha of linhas) {
        // Verificar se precisa de nova página
        if (yPosition < marginBottom + 40) {
          adicionarRodape(page, pageNumber);
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          pageNumber++;
          yPosition = pageHeight - marginTop;
          await adicionarCabecalho(page, pageNumber);
        }

        // Desenhar linha
        page.drawText(linha, {
          x: marginLeft,
          y: yPosition,
          size: tamanhoFonte,
          font: fonte,
          color: rgb(0.1, 0.1, 0.1),
        });

        yPosition -= LINE_HEIGHT;
      }

      // Espaço entre parágrafos
      yPosition -= 8;

      setProgresso(40 + Math.round((i / paragrafos.length) * 40));
    }

    // Adicionar rodapé da última página
    adicionarRodape(page, pageNumber);
    setProgresso(90);

    // Salvar
    const pdfBytes = await pdfDoc.save();
    setProgresso(100);

    return pdfBytes;
  };

  // ===== SALVAR NO HISTÓRICO =====
  const salvarHistorico = async (
    templateId: string,
    associadoId: string,
    dados: DadosMerge,
    pdfBytes: Uint8Array,
    arquivoNome: string
  ): Promise<DocumentoGerado | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. Upload do PDF para o Storage
      const timestamp = Date.now();
      const nomeSeguro = arquivoNome.replace(/[^a-zA-Z0-9.-]/g, '_');
      const nomeUnico = `gerados/${associadoId}/${timestamp}-${nomeSeguro}`;
      
      // Converter Uint8Array para Blob corretamente
      const pdfBlob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(nomeUnico, pdfBlob, {
          contentType: 'application/pdf',
        });
      
      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        throw uploadError;
      }
      
      // 2. Obter URL pública
      const { data: urlData } = supabase.storage
        .from('documentos')
        .getPublicUrl(uploadData.path);
      
      // 3. Gerar número do documento
      const numeroDoc = `DOC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${timestamp.toString().slice(-6)}`;
      
      // 4. Inserir na tabela documento_gerados
      const { data, error } = await supabase
        .from('documento_gerados')
        .insert({
          template_id: templateId,
          associado_id: associadoId,
          numero_documento: numeroDoc,
          dados_utilizados: dados,
          arquivo_url: urlData.publicUrl,
          arquivo_nome: arquivoNome,
          gerado_por: user?.id || null,
          assinado: false,
        })
        .select()
        .single();
      
      if (error) {
        console.error('Erro ao salvar registro:', error);
        throw error;
      }
      
      return data as DocumentoGerado;
    } catch (error) {
      console.error('Erro ao salvar histórico:', error);
      return null;
    }
  };

  // ===== BAIXAR PDF =====
  const baixarPDF = (pdfBytes: Uint8Array, nomeArquivo: string) => {
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  // ===== ABRIR PDF =====
  const abrirPDF = (pdfBytes: Uint8Array) => {
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  // ===== FUNÇÃO PRINCIPAL =====
  const gerarDocumento = async (
    template: DocumentoTemplate,
    associadoId: string,
    opcoes: OpcaoGeracaoPDF & { salvarHistorico?: boolean } = { modo: 'baixar' }
  ): Promise<{ pdfBytes?: Uint8Array; documentoGerado?: DocumentoGerado | null } | void> => {
    try {
      setGerando(true);
      setProgresso(0);

      // Buscar dados
      const dados = await buscarDadosAssociado(associadoId);
      setProgresso(5);

      // Gerar PDF
      const pdfBytes = await gerarPDF(template, dados);

      // Nome do arquivo
      const nomeArquivo = opcoes.nomeArquivo || 
        `${template.codigo}-${dados.associado.nome.split(' ')[0]}-${Date.now()}.pdf`;

      let documentoGerado: DocumentoGerado | null = null;

      // Salvar histórico se solicitado
      if (opcoes.salvarHistorico === true) {
        documentoGerado = await salvarHistorico(template.id, associadoId, dados, pdfBytes, nomeArquivo);
        if (documentoGerado) {
          toast.success('Documento salvo no histórico!');
        }
      }

      // Executar ação conforme modo
      switch (opcoes.modo) {
        case 'baixar':
          baixarPDF(pdfBytes, nomeArquivo);
          if (!opcoes.salvarHistorico) {
            toast.success('Documento gerado com sucesso!');
          }
          break;
        case 'abrir':
          abrirPDF(pdfBytes);
          break;
        case 'bytes':
          return { pdfBytes, documentoGerado };
        case 'salvar':
          // Upload já feito em salvarHistorico
          if (!documentoGerado) {
            documentoGerado = await salvarHistorico(template.id, associadoId, dados, pdfBytes, nomeArquivo);
          }
          break;
      }

      return { documentoGerado };

    } catch (error) {
      console.error('Erro ao gerar documento:', error);
      toast.error('Erro ao gerar documento. Tente novamente.');
      throw error;
    } finally {
      setGerando(false);
      setProgresso(0);
    }
  };

  // ===== PREVIEW (sem salvar) =====
  const previewDocumento = async (
    template: DocumentoTemplate,
    associadoId: string
  ): Promise<string> => {
    const dados = await buscarDadosAssociado(associadoId);
    return fazerMerge(template.conteudo, dados);
  };

  return {
    gerarDocumento,
    previewDocumento,
    buscarDadosAssociado,
    fazerMerge,
    gerando,
    progresso,
  };
}
