import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { formatarMoeda } from '@/utils/format';
import { resolverTipoUsoQuery, resolverPrecoApp } from '@/utils/precoApp';

// ============================================
// TIPOS — agora dinâmicos, sem categorias fixas
// ============================================

export interface PlanoOpcaoCotacao {
  id: string;
  codigo: string;
  nome: string;
  valor_cota: number;
  taxa_administrativa: number;
  valor_assistencia: number;
  valor_rastreamento: number;
  valor_adesao: number;
  taxa_aplicativo: number;
  mensalidade_total: number;
  valor_desagio: number | null;
}

export interface AdicionalOpcao {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  preco: number;
}

export interface AdicionalSelecionado {
  id: string;
  codigo: string;
  nome: string;
  preco: number;
}

export interface DadosCotacaoAvancada {
  leadId?: string;
  clienteNome: string;
  clienteTelefone: string;
  clienteEmail?: string;
  veiculoMarca?: string;
  veiculoModelo?: string;
  veiculoAno?: number;
  veiculoPlaca?: string;
  veiculoCombustivel?: string;
  valorFipe: number;
  cidade: string;
  planoId: string;
  usoAplicativo: boolean;
  desagio: number;
  adicionaisSelecionados: AdicionalSelecionado[];
  regiao?: string;
}

export interface ResultadoCotacaoDinamica {
  plano: PlanoOpcaoCotacao;
  valorAdicionais: number;
  adicionaisNomes: string[];
  desagio: number;
  precoBase: { adesao: number; mensal: number };
  precoFinal: { adesao: number; mensal: number };
}

export interface CotacaoSalva {
  id: string;
  numero: string;
  token_publico: string;
  linkPublico: string;
  cotacao: ResultadoCotacaoDinamica;
}

// ============================================
// HOOKS DE DADOS
// ============================================

export function usePlanosParaCotacao(valorFipe: number, usoAplicativo: boolean, regiao: string = 'rj', combustivel: string = 'gasolina') {
  return useQuery({
    queryKey: ['planos-cotacao-avancada', valorFipe, usoAplicativo, regiao, combustivel],
    queryFn: async () => {
      if (!valorFipe || valorFipe <= 0) return [];

      // Buscar planos ativos, mapeamento, preços e config adicional_app em paralelo
      const [planosRes, mapRes, mensalidadeRes, configRes, decomRes] = await Promise.all([
        supabase
          .from('planos')
          .select('id, codigo, nome, categoria, valor_adesao, descricao, adicional_mensal, desconto_percentual')
          .eq('ativo', true)
          .order('ordem', { ascending: true }),
        supabase
          .from('plano_preco_map')
          .select('*'),
        supabase
          .from('tabelas_preco_mensalidade')
          .select('*')
          .eq('is_active', true),
        supabase
          .from('configuracoes')
          .select('valor')
          .eq('chave', 'adicional_app')
          .maybeSingle(),
        supabase
          .from('configuracoes')
          .select('chave, valor')
          .in('chave', ['decomposicao_cota', 'decomposicao_admin', 'decomposicao_rastreamento', 'decomposicao_assistencia']),
      ]);

      const adicionalApp = parseFloat(configRes.data?.valor || '35.90') || 35.90;

      // Decomposição percentual do banco
      const decMap = Object.fromEntries((decomRes.data || []).map(d => [d.chave, parseFloat(d.valor || '0') || 0]));
      const dec = {
        cota: decMap.decomposicao_cota || 0.60,
        admin: decMap.decomposicao_admin || 0.25,
        rastreamento: decMap.decomposicao_rastreamento || 0.10,
        assistencia: decMap.decomposicao_assistencia || 0.05,
      };

      if (planosRes.error) throw planosRes.error;
      const planos = planosRes.data;
      if (!planos?.length) return [];

      const planoPrecoMap = mapRes.data || [];
      const tabelasMensalidade = mensalidadeRes.data || [];

      const regiaoLower = regiao.toLowerCase();
      const combustivelLower = combustivel.toLowerCase();

      // Filtrar por tipo uso
      const planosFiltrados = planos.filter(p => {
        const isApp = p.categoria === 'aplicativo' || p.codigo?.includes('aplicativo');
        return usoAplicativo ? isApp : !isApp;
      });

      const resultado: PlanoOpcaoCotacao[] = [];

      for (const plano of planosFiltrados) {
        // Buscar mapeamento para este plano
        const mapping = planoPrecoMap.find(m => m.plano_id === plano.id);
        if (!mapping) continue;

        // Resolver tipo_uso para query (regras de adicional app)
        const tipoUsoQuery = resolverTipoUsoQuery(mapping.linha_slug, regiaoLower, mapping.tipo_uso);

        // Buscar faixa de preço na nova tabela
        const faixa = tabelasMensalidade.find(t =>
          t.linha_slug === mapping.linha_slug &&
          t.regiao === regiaoLower &&
          t.tipo_uso === tipoUsoQuery &&
          (t.combustivel_tipo === combustivelLower || t.combustivel_tipo === null) &&
          valorFipe >= Number(t.fipe_min) &&
          valorFipe <= Number(t.fipe_max)
        );

        if (!faixa) continue;

        // Aplicar adicional app se necessário
        let valorMensal = resolverPrecoApp(mapping.linha_slug, regiaoLower, mapping.tipo_uso, Number(faixa.valor_mensal), adicionalApp);

        // Aplicar adicional_mensal do plano (Premium +30, Exclusive +60)
        valorMensal += Number(plano.adicional_mensal || 0);

        // Aplicar desconto percentual dinâmico (ex: 5% OFF)
        const descontoPerc = Number(plano.desconto_percentual || 0);
        if (descontoPerc > 0) {
          valorMensal *= (1 - descontoPerc / 100);
        }

        let valorDesagio = faixa.valor_desagio != null ? Number(faixa.valor_desagio) : null;
        if (valorDesagio != null && descontoPerc > 0) {
          valorDesagio *= (1 - descontoPerc / 100);
        }
        const valorAdesao = Number(plano.valor_adesao) || 0;

        // Decomposição percentual (valores do banco)
        const valorCota = Math.round(valorMensal * dec.cota * 100) / 100;
        const taxaAdmin = Math.round(valorMensal * dec.admin * 100) / 100;
        const valorAssist = Math.round(valorMensal * dec.assistencia * 100) / 100;
        const valorRastreamento = Math.round(valorMensal * dec.rastreamento * 100) / 100;

        resultado.push({
          id: plano.id,
          codigo: plano.codigo || '',
          nome: plano.nome,
          valor_cota: valorCota,
          taxa_administrativa: taxaAdmin,
          valor_assistencia: valorAssist,
          valor_rastreamento: valorRastreamento,
          valor_adesao: valorAdesao,
          taxa_aplicativo: 0, // Já incluído no valor_mensal para planos aplicativo
          mensalidade_total: Math.round(valorMensal * 100) / 100,
          valor_desagio: valorDesagio,
        });
      }

      return resultado;
    },
    enabled: valorFipe > 0,
    staleTime: 1000 * 60 * 5,
  });
}

export function useAdicionaisDisponiveis(linhaSlug?: string) {
  return useQuery({
    queryKey: ['adicionais-cotacao', linhaSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('beneficios_adicionais')
        .select('id, codigo, nome, descricao, preco, linhas_permitidas, beneficios_regioes(regiao_id, preco_regional)')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;

      // Filtrar por linha permitida
      const filtered = (data || []).filter(b => {
        if (!linhaSlug) return true;
        const permitidas = b.linhas_permitidas as string[] | null;
        if (!permitidas || permitidas.length === 0) return true;
        return permitidas.includes(linhaSlug);
      });

      return filtered.map(b => ({
        id: b.id,
        codigo: b.codigo,
        nome: b.nome,
        descricao: b.descricao || '',
        preco: b.preco,
        _regioes: (b as any).beneficios_regioes || [],
      })) as (AdicionalOpcao & { _regioes: { regiao_id: string; preco_regional: number | null }[] })[];
    },
    staleTime: 1000 * 60 * 10,
  });
}

// ============================================
// CÁLCULO
// ============================================

export function calcularCotacaoDinamica(
  plano: PlanoOpcaoCotacao,
  adicionais: AdicionalOpcao[],
  adicionaisSelecionadosIds: string[],
  desagio: number
): ResultadoCotacaoDinamica {
  const desagioClamp = Math.min(Math.max(desagio || 0, 0), 30);
  const fatorDesconto = (100 - desagioClamp) / 100;

  let valorAdicionais = 0;
  const adicionaisNomes: string[] = [];

  for (const id of adicionaisSelecionadosIds) {
    const ad = adicionais.find(a => a.id === id);
    if (ad) {
      valorAdicionais += ad.preco;
      adicionaisNomes.push(ad.nome);
    }
  }

  const precoBase = {
    adesao: plano.valor_adesao,
    mensal: plano.mensalidade_total,
  };

  const precoFinal = {
    adesao: Math.round(precoBase.adesao * fatorDesconto * 100) / 100,
    mensal: Math.round((precoBase.mensal * fatorDesconto + valorAdicionais) * 100) / 100,
  };

  return {
    plano,
    valorAdicionais,
    adicionaisNomes,
    desagio: desagioClamp,
    precoBase,
    precoFinal,
  };
}

// ============================================
// HOOK PRINCIPAL
// ============================================

function gerarTokenCotacao(): string {
  const uuid1 = crypto.randomUUID().replace(/-/g, '');
  const uuid2 = crypto.randomUUID().replace(/-/g, '');
  return (uuid1 + uuid2).substring(0, 64);
}

export function useCotacaoAvancada() {
  const queryClient = useQueryClient();

  const salvarCotacaoMutation = useMutation({
    mutationFn: async (dados: DadosCotacaoAvancada & { cotacao: ResultadoCotacaoDinamica }): Promise<CotacaoSalva> => {
      const { cotacao } = dados;
      const token = gerarTokenCotacao();

      const valorMensal = cotacao.precoFinal.mensal;

      const cotacaoData = {
        numero: '',
        lead_id: dados.leadId || null,
        plano_id: dados.planoId,
        status: 'pendente' as Database['public']['Enums']['status_cotacao'],
        veiculo_marca: dados.veiculoMarca || null,
        veiculo_modelo: dados.veiculoModelo || null,
        veiculo_ano: dados.veiculoAno || null,
        veiculo_placa: dados.veiculoPlaca || null,
        veiculo_combustivel: dados.veiculoCombustivel || null,
        valor_fipe: dados.valorFipe,
        regiao: dados.regiao || 'RJ',
        categoria: cotacao.plano.codigo,
        combustivel: dados.veiculoCombustivel || null,
        uso_aplicativo: dados.usoAplicativo,
        desagio_aplicado: dados.desagio,
        valor_adesao: cotacao.precoFinal.adesao,
        valor_cota: cotacao.plano.valor_cota,
        valor_total_mensal: valorMensal,
        taxa_administrativa: cotacao.plano.taxa_administrativa,
        valor_rastreamento: cotacao.plano.valor_rastreamento,
        valor_adesao_original: cotacao.precoBase.adesao,
        valor_mensal_original: cotacao.precoBase.mensal,
        nome_solicitante: dados.clienteNome || null,
        telefone1_solicitante: dados.clienteTelefone?.replace(/\D/g, '') || null,
        email_solicitante: dados.clienteEmail || null,
        adicionais_selecionados: dados.adicionaisSelecionados,
        cidade: dados.cidade,
        token_publico: token,
        dados_extras: {
          valorAdicionais: cotacao.valorAdicionais,
          adicionaisNomes: cotacao.adicionaisNomes,
          calculadoEm: new Date().toISOString(),
          clienteNome: dados.clienteNome,
          clienteTelefone: dados.clienteTelefone,
          clienteEmail: dados.clienteEmail,
        },
      };

      const { data: cotacaoSalva, error } = await supabase
        .from('cotacoes')
        .insert(cotacaoData)
        .select()
        .single();

      if (error) throw error;

      if (dados.leadId) {
        await supabase
          .from('leads')
          .update({
            etapa: 'cotacao_enviada',
            updated_at: new Date().toISOString(),
          })
          .eq('id', dados.leadId);
      }

      const linkPublico = `${window.location.origin}/cotacao/${token}`;

      return {
        id: cotacaoSalva.id,
        numero: cotacaoSalva.numero,
        token_publico: token,
        linkPublico,
        cotacao,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Cotação gerada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar cotação: ${error.message}`);
    },
  });

  const gerarMensagemWhatsApp = (
    dados: DadosCotacaoAvancada,
    cotacao: ResultadoCotacaoDinamica,
    linkPublico: string
  ): string => {
    const veiculo = `${dados.veiculoMarca || ''} ${dados.veiculoModelo || ''} ${dados.veiculoAno || ''}`.trim();
    const primeiroNome = dados.clienteNome?.split(' ')[0] || 'Cliente';

    return `🚗 *PRATIC - Proteção Veicular*

Olá ${primeiroNome}! 

Preparamos uma cotação especial para você:

📋 *Veículo:* ${veiculo || 'Não informado'}
💰 *Valor FIPE:* ${formatarMoeda(dados.valorFipe)}

📦 *Plano ${cotacao.plano.nome}*

💵 *Adesão:* ${formatarMoeda(cotacao.precoFinal.adesao)}
💳 *Mensalidade:* ${formatarMoeda(cotacao.precoFinal.mensal)}

${dados.usoAplicativo ? '⚠️ _Cotação para uso em aplicativo (Uber, 99, etc)_\n' : ''}
${cotacao.adicionaisNomes.length > 0 ? `✨ *Adicionais inclusos:* ${cotacao.adicionaisNomes.join(', ')}\n` : ''}

🔗 *Clique no link abaixo para ver sua cotação:*
${linkPublico}

Qualquer dúvida, estou à disposição! 😊`;
  };

  const abrirWhatsApp = async (dados: DadosCotacaoAvancada & { cotacao: ResultadoCotacaoDinamica }) => {
    try {
      const result = await salvarCotacaoMutation.mutateAsync(dados);
      const mensagem = gerarMensagemWhatsApp(dados, result.cotacao, result.linkPublico);
      const telefone = dados.clienteTelefone?.replace(/\D/g, '');

      if (telefone) {
        const urlWhatsApp = `https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`;
        window.open(urlWhatsApp, '_blank');
      } else {
        toast.error('Telefone não informado');
      }

      return result;
    } catch (error) {
      console.error('Erro ao abrir WhatsApp:', error);
      throw error;
    }
  };

  const copiarLink = async (dados: DadosCotacaoAvancada & { cotacao: ResultadoCotacaoDinamica }) => {
    try {
      const result = await salvarCotacaoMutation.mutateAsync(dados);
      await navigator.clipboard.writeText(result.linkPublico);
      toast.success('Link copiado para a área de transferência!');
      return result;
    } catch (error) {
      console.error('Erro ao copiar link:', error);
      throw error;
    }
  };

  return {
    salvarCotacao: salvarCotacaoMutation.mutateAsync,
    abrirWhatsApp,
    copiarLink,
    isLoading: salvarCotacaoMutation.isPending,
  };
}
