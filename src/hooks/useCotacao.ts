// ============================================
// HOOKS ESPECIALIZADOS PARA MÓDULO DE COTAÇÃO
// SGA Pratic 2.0 - Proteção Veicular
// Migrado para tabelas_preco_mensalidade + plano_preco_map
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { resolverTipoUsoQuery, resolverPrecoApp } from '@/utils/precoApp';
import type {
  PlanoParaCotacao,
  CotacaoCompleta,
  ResultadoCotacao,
  TipoUso,
  StatusCotacaoExtended,
  CriarCotacaoPayload,
} from '@/types/cotacao';
import { useConfiguracaoNumero, useConfigDecomposicao } from '@/hooks/useConteudosSistema';

// Tipo do status no banco (sem 'visualizada')
type StatusCotacaoDB = Database['public']['Tables']['cotacoes']['Row']['status'];

// ============================================
// TIPOS INTERNOS
// ============================================

interface PlanoPrecoMapEntry {
  id: string;
  plano_id: string;
  linha_slug: string;
  tipo_uso: string;
}

interface FaixaMensalidade {
  id: string;
  linha_slug: string | null;
  regiao: string | null;
  combustivel_tipo: string | null;
  tipo_uso: string | null;
  fipe_min: number;
  fipe_max: number;
  valor_mensal: number;
  valor_desagio: number | null;
  is_active: boolean | null;
}

// ============================================
// FUNÇÕES DE MAPEAMENTO (BD → Interface)
// ============================================

function mapPlanoToInterface(data: any): PlanoParaCotacao {
  return {
    id: data.id,
    codigo: data.codigo,
    nome: data.nome,
    tipo_uso: data.tipo_uso as TipoUso,
    fipe_minimo: data.fipe_minima ? Number(data.fipe_minima) : null,
    fipe_maximo: data.fipe_maxima ? Number(data.fipe_maxima) : null,
    valor_adesao: Number(data.valor_adesao || 0),
    coberturas: data.coberturas || [],
    adicional_mensal: Number(data.adicional_mensal || 0),
    desconto_percentual: Number(data.desconto_percentual || 0),
    ativo: data.ativo,
    created_at: data.created_at,
  };
}

// ============================================
// HOOK: BUSCAR PLANOS ATIVOS
// ============================================

export function usePlanosCotacao(tipoUso?: TipoUso) {
  return useQuery({
    queryKey: ['planos-cotacao', tipoUso],
    queryFn: async () => {
      let query = supabase
        .from('planos')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (tipoUso) {
        query = query.eq('tipo_uso', tipoUso);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(mapPlanoToInterface);
    },
  });
}

// ============================================
// HOOK: BUSCAR DADOS DE PREÇO (nova tabela)
// ============================================

function usePlanoPrecoMap() {
  return useQuery({
    queryKey: ['plano_preco_map'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plano_preco_map')
        .select('*');
      if (error) throw error;
      return data as PlanoPrecoMapEntry[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

function useTabelasMensalidade() {
  return useQuery({
    queryKey: ['tabelas_preco_mensalidade'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tabelas_preco_mensalidade')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data as FaixaMensalidade[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ============================================
// FUNÇÃO: ENCONTRAR FAIXA POR VALOR FIPE
// ============================================

function encontrarFaixaMensalidade(
  tabelasMensalidade: FaixaMensalidade[],
  planoPrecoMap: PlanoPrecoMapEntry[],
  planoId: string,
  valorFipe: number,
  regiao: string,
  combustivel: string,
  adicionalApp: number = 0,
  adicionalMensal: number = 0,
  descontoPercentual: number = 0,
): { valorMensal: number; valorDesagio: number | null } | null {
  const mapping = planoPrecoMap.find(m => m.plano_id === planoId);
  if (!mapping) return null;

  // Resolver tipo_uso para query (regras de adicional app)
  const tipoUsoQuery = resolverTipoUsoQuery(mapping.linha_slug, regiao, mapping.tipo_uso);

  // For eletrico: ignore region (national pricing) and combustivel
  const isEletrico = mapping.linha_slug === 'eletrico';
  const regiaoLower = regiao.toLowerCase();
  const combustivelLower = combustivel.toLowerCase();

  const faixa = tabelasMensalidade.find(t =>
    t.linha_slug === mapping.linha_slug &&
    (isEletrico || t.regiao === regiaoLower) &&
    t.tipo_uso === tipoUsoQuery &&
    (isEletrico || t.combustivel_tipo === combustivelLower || t.combustivel_tipo === null) &&
    valorFipe >= t.fipe_min &&
    valorFipe <= t.fipe_max
  );

  if (!faixa) return null;

  // Aplicar adicional app se necessário
  let valorMensalFinal = resolverPrecoApp(mapping.linha_slug, regiao, mapping.tipo_uso, faixa.valor_mensal, adicionalApp);

  // Aplicar adicional_mensal do plano (ex: Premium +30, Exclusive +60)
  valorMensalFinal += adicionalMensal;

  // Aplicar desconto percentual dinâmico (ex: 5% OFF)
  if (descontoPercentual > 0) {
    valorMensalFinal *= (1 - descontoPercentual / 100);
  }

  return {
    valorMensal: Math.round(valorMensalFinal * 100) / 100,
    valorDesagio: faixa.valor_desagio,
  };
}

// ============================================
// FUNÇÃO: CALCULAR VALORES DA COTAÇÃO
// ============================================

export function calcularValoresCotacao(
  plano: PlanoParaCotacao,
  valorMensalDireto: number,
  valorFipe: number,
  decomposicao?: { cota: number; admin: number; rastreamento: number; assistencia: number },
): ResultadoCotacao['valores'] {
  // Decomposição percentual sobre valor_mensal (valores do banco com fallback)
  const decCota = decomposicao?.cota || 0.60;
  const decAdmin = decomposicao?.admin || 0.25;
  const decRastreamento = decomposicao?.rastreamento || 0.10;
  const decAssistencia = decomposicao?.assistencia || 0.05;

  const valor_cota = Math.round(valorMensalDireto * decCota * 100) / 100;
  const taxa_administrativa = Math.round(valorMensalDireto * decAdmin * 100) / 100;
  const valor_rastreamento = Math.round(valorMensalDireto * decRastreamento * 100) / 100;
  const valor_assistencia = Math.round(valorMensalDireto * decAssistencia * 100) / 100;

  return {
    valor_fipe: valorFipe,
    valor_cota,
    taxa_administrativa,
    valor_rastreamento,
    valor_assistencia,
    valor_mensal: valorMensalDireto,
    valor_adesao: Math.max(100, Math.round(valorFipe * 0.01 * 100) / 100),
  };
}

// ============================================
// HOOK: CALCULAR COTAÇÃO
// ============================================

export function useCalcularCotacao() {
  const { data: planos, isLoading: loadingPlanos } = usePlanosCotacao();
  const { data: planoPrecoMap, isLoading: loadingMap } = usePlanoPrecoMap();
  const { data: tabelasMensalidade, isLoading: loadingMensalidade } = useTabelasMensalidade();
  const { data: adicionalApp = 35.90 } = useConfiguracaoNumero('adicional_app', 35.90);
  const { data: decomposicao } = useConfigDecomposicao();

  const calcular = (
    valorFipe: number,
    tipoUso: TipoUso,
    planoId?: string,
    regiao: string = 'rj',
    combustivel: string = 'gasolina',
  ): ResultadoCotacao[] => {
    if (!planos || !planoPrecoMap || !tabelasMensalidade || valorFipe <= 0) return [];

    // Filtrar planos pelo tipo de uso
    // 'passeio' no banco é tratado como 'particular' (motos e elétricos usam 'passeio')
    let planosDisponiveis = planos.filter((p) => {
      const tipoUsoBD = p.tipo_uso?.toLowerCase();
      if (tipoUso === 'particular') {
        return tipoUsoBD === 'particular' || tipoUsoBD === 'passeio';
      }
      return tipoUsoBD === tipoUso;
    });
    
    // Se não encontrou planos para aplicativo, incluir planos passeio/particular
    if (planosDisponiveis.length === 0 && tipoUso === 'aplicativo') {
      planosDisponiveis = planos.filter((p) => {
        const t = p.tipo_uso?.toLowerCase();
        return t === 'particular' || t === 'passeio';
      });
    }

    // Se especificou plano, filtrar (bypass tipo_uso — o plano já foi escolhido)
    if (planoId) {
      const planoEspecifico = planos.filter((p) => p.id === planoId);
      if (planoEspecifico.length > 0) {
        planosDisponiveis = planoEspecifico;
      }
    }

    const resultados: ResultadoCotacao[] = [];

    for (const plano of planosDisponiveis) {
      const faixaResult = encontrarFaixaMensalidade(
        tabelasMensalidade,
        planoPrecoMap,
        plano.id,
        valorFipe,
        regiao,
        combustivel,
        adicionalApp,
        plano.adicional_mensal || 0,
        plano.desconto_percentual || 0,
      );

      if (!faixaResult) continue;

      resultados.push({
        plano,
        faixa: null as any, // Campo legado — decomposição é feita internamente
        valores: calcularValoresCotacao(plano, faixaResult.valorMensal, valorFipe, decomposicao),
      });
    }

    if (resultados.length === 0 && planosDisponiveis.length > 0) {
      if (valorFipe > 500000) {
        toast.error('Valor FIPE acima de R$ 500.000. Entre em contato para cotação especial.');
      } else {
        toast.error('Valor FIPE fora das faixas configuradas para esta região/uso.');
      }
    }

    return resultados;
  };

  return {
    calcular,
    isReady: !!planos && !!planoPrecoMap && !!tabelasMensalidade,
    isLoading: loadingPlanos || loadingMap || loadingMensalidade,
    planos,
    faixas: tabelasMensalidade,
  };
}

// ============================================
// HOOK: LISTAR COTAÇÕES COM FILTROS
// ============================================

export function useCotacoesFiltradas(filtros?: {
  vendedor_id?: string;
  lead_id?: string;
  status?: StatusCotacaoExtended;
}) {
  return useQuery({
    queryKey: ['cotacoes-filtradas', filtros],
    queryFn: async () => {
      let query = supabase
        .from('cotacoes')
        .select(`
          *,
          lead:leads!fk_cotacoes_lead_id(id, nome, telefone, email),
          plano:planos(id, codigo, nome)
        `)
        .order('created_at', { ascending: false });

      if (filtros?.vendedor_id) {
        query = query.eq('vendedor_id', filtros.vendedor_id);
      }
      if (filtros?.lead_id) {
        query = query.eq('lead_id', filtros.lead_id);
      }
      if (filtros?.status) {
        const statusValido = filtros.status as StatusCotacaoDB;
        query = query.eq('status', statusValido);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []).map((item): CotacaoCompleta => ({
        id: item.id,
        numero: item.numero,
        lead_id: item.lead_id,
        plano_id: item.plano_id,
        vendedor_id: item.vendedor_id || '',
        veiculo_marca: item.veiculo_marca,
        veiculo_modelo: item.veiculo_modelo,
        veiculo_ano: item.veiculo_ano,
        veiculo_placa: undefined,
        codigo_fipe: item.codigo_fipe,
        valor_fipe: Number(item.valor_fipe),
        uso_aplicativo: false,
        valor_cota: Number(item.valor_cota || 0),
        taxa_administrativa: Number(item.taxa_administrativa || 0),
        valor_rastreamento: Number(item.valor_rastreamento || 0),
        valor_assistencia: Number(item.valor_assistencia || 0),
        valor_mensal: Number(item.valor_total_mensal || 0),
        valor_adesao: Number(item.valor_adesao || 0),
        status: item.status as StatusCotacaoExtended,
        validade_dias: item.validade_dias || 7,
        created_at: item.created_at,
        updated_at: item.updated_at,
        lead: item.lead,
        plano: item.plano ? mapPlanoToInterface(item.plano) : undefined,
      }));
    },
  });
}

// ============================================
// HOOK: BUSCAR COTAÇÃO POR ID
// ============================================

export function useCotacaoDetalhe(id: string | undefined) {
  return useQuery({
    queryKey: ['cotacao-detalhe', id],
    queryFn: async () => {
      if (!id) throw new Error('ID não informado');

      const { data, error } = await supabase
        .from('cotacoes')
        .select(`
          *,
          lead:leads!fk_cotacoes_lead_id(id, nome, telefone, email, cpf),
          plano:planos(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      return {
        id: data.id,
        numero: data.numero,
        lead_id: data.lead_id,
        plano_id: data.plano_id,
        vendedor_id: data.vendedor_id || '',
        veiculo_marca: data.veiculo_marca,
        veiculo_modelo: data.veiculo_modelo,
        veiculo_ano: data.veiculo_ano,
        veiculo_placa: undefined,
        codigo_fipe: data.codigo_fipe,
        valor_fipe: Number(data.valor_fipe),
        uso_aplicativo: false,
        valor_cota: Number(data.valor_cota || 0),
        taxa_administrativa: Number(data.taxa_administrativa || 0),
        valor_rastreamento: Number(data.valor_rastreamento || 0),
        valor_assistencia: Number(data.valor_assistencia || 0),
        valor_mensal: Number(data.valor_total_mensal || 0),
        valor_adesao: Number(data.valor_adesao || 0),
        status: data.status as StatusCotacaoExtended,
        validade_dias: data.validade_dias || 7,
        created_at: data.created_at,
        updated_at: data.updated_at,
        lead: data.lead,
        plano: data.plano ? mapPlanoToInterface(data.plano) : undefined,
      } as CotacaoCompleta;
    },
    enabled: !!id,
  });
}

// ============================================
// HOOK: CRIAR COTAÇÃO
// ============================================

export function useCriarCotacao() {
  const queryClient = useQueryClient();
  const { calcular, isReady } = useCalcularCotacao();

  return useMutation({
    mutationFn: async (payload: CriarCotacaoPayload) => {
      if (!isReady) {
        throw new Error('Dados de planos/faixas ainda carregando');
      }

      const tipoUso: TipoUso = payload.uso_aplicativo ? 'aplicativo' : 'particular';
      const resultados = calcular(payload.valor_fipe, tipoUso, payload.plano_id);
      
      if (resultados.length === 0) {
        const valorFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payload.valor_fipe);
        throw new Error(
          payload.valor_fipe > 500000
            ? `Valor FIPE (${valorFormatado}) acima do limite. Entre em contato para cotação especial.`
            : payload.valor_fipe <= 0
            ? 'Valor FIPE inválido. Verifique o valor do veículo.'
            : `Não foi possível calcular a cotação para o valor ${valorFormatado}. Verifique as faixas de preço configuradas.`
        );
      }

      const resultado = resultados[0];

      let vendedorId: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: perfil } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', user.id)
            .single();
          if (perfil) vendedorId = perfil.id;
        }
      } catch (err) {
        console.warn('[useCriarCotacao] Erro ao obter vendedor:', err);
      }

      const dataAtual = new Date();
      const numero = `COT-${dataAtual.getFullYear()}${String(dataAtual.getMonth() + 1).padStart(2, '0')}${String(dataAtual.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;

      const cotacaoData = {
        numero,
        lead_id: payload.lead_id,
        plano_id: payload.plano_id,
        vendedor_id: vendedorId,
        veiculo_marca: payload.veiculo_marca,
        veiculo_modelo: payload.veiculo_modelo,
        veiculo_ano: payload.veiculo_ano,
        veiculo_placa: payload.veiculo_placa || null,
        codigo_fipe: payload.codigo_fipe,
        valor_fipe: payload.valor_fipe,
        valor_cota: resultado.valores.valor_cota,
        taxa_administrativa: resultado.valores.taxa_administrativa,
        valor_rastreamento: resultado.valores.valor_rastreamento,
        valor_assistencia: resultado.valores.valor_assistencia,
        valor_total_mensal: resultado.valores.valor_mensal,
        valor_adesao: payload.valor_adesao || resultado.valores.valor_adesao,
        status: 'rascunho' as const,
        validade_dias: 7,
        categoria: payload.categoria_veiculo,
        nome_solicitante: payload.nome_solicitante || null,
      };

      const { data, error } = await supabase
        .from('cotacoes')
        .insert(cotacaoData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['cotacoes-filtradas'] });
      toast.success('Cotação criada com sucesso!');
    },
    onError: (error) => {
      toast.error(`Erro ao criar cotação: ${error.message}`);
    },
  });
}

// ============================================
// HOOK: ATUALIZAR STATUS COTAÇÃO
// ============================================

export function useAtualizarStatusCotacaoV2() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: StatusCotacaoExtended;
    }) => {
      const statusValido = status as StatusCotacaoDB;
      
      const { data, error } = await supabase
        .from('cotacoes')
        .update({ status: statusValido, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['cotacoes-filtradas'] });
      queryClient.invalidateQueries({ queryKey: ['cotacao-detalhe', variables.id] });
    },
  });
}
