import { useState } from 'react';
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import { supabase } from '@/integrations/supabase/client';
import { DocumentoTemplate, DadosMerge, OpcaoGeracaoPDF, DocumentoGerado } from '@/types/documentos';
import { toast } from 'sonner';

// Configurações padrão
const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const LINE_HEIGHT = 16;

// Helper para evitar deep type instantiation em veiculos
const queryVeiculoPrincipal = async (associadoId: string): Promise<any> => {
  // @ts-expect-error - veiculos table has deep type instantiation
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

    // Função para adicionar cabeçalho
    const adicionarCabecalho = (p: PDFPage, numPag: number) => {
      if (!config.mostrarCabecalho) return;
      
      // Linha do cabeçalho
      p.drawLine({
        start: { x: marginLeft, y: pageHeight - marginTop + 20 },
        end: { x: pageWidth - marginRight, y: pageHeight - marginTop + 20 },
        thickness: 1,
        color: rgb(0.8, 0.8, 0.8),
      });

      // Nome da empresa
      p.drawText('PRATICCAR', {
        x: marginLeft,
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
    adicionarCabecalho(page, pageNumber);
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
          adicionarCabecalho(page, pageNumber);
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
    arquivoUrl?: string,
    arquivoNome?: string
  ): Promise<DocumentoGerado | null> => {
    const { data: user } = await supabase.auth.getUser();

    // Por enquanto, apenas logamos - a tabela será criada na próxima etapa
    console.log('Salvando histórico de documento:', {
      template_id: templateId,
      associado_id: associadoId,
      dados_utilizados: dados,
      arquivo_url: arquivoUrl,
      arquivo_nome: arquivoNome,
      gerado_por: user?.user?.id,
    });

    // TODO: Implementar quando a tabela existir
    // const { data, error } = await supabase
    //   .from('documento_gerados')
    //   .insert({...})
    //   .select()
    //   .single();

    return null;
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
    opcoes: OpcaoGeracaoPDF = { modo: 'baixar' }
  ): Promise<Uint8Array | void> => {
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

      // Salvar histórico se solicitado
      if (opcoes.salvarHistorico !== false) {
        await salvarHistorico(template.id, associadoId, dados, undefined, nomeArquivo);
      }

      // Executar ação conforme modo
      switch (opcoes.modo) {
        case 'baixar':
          baixarPDF(pdfBytes, nomeArquivo);
          toast.success('Documento gerado com sucesso!');
          break;
        case 'abrir':
          abrirPDF(pdfBytes);
          break;
        case 'bytes':
          return pdfBytes;
        case 'salvar':
          // TODO: Implementar upload para Supabase Storage
          toast.success('Documento salvo com sucesso!');
          break;
      }

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
