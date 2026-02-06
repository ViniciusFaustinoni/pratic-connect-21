import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { TipoComissao, Deducao } from '@/types/comissoes';

// Tipos específicos para visão do vendedor
export interface MeuResumoTipo {
  tipo: TipoComissao;
  quantidade: number;
  valor_total: number;
}

export interface MeuRanking {
  posicao_ranking: number | null;
  vendas_liquidas: number;
  valor_premio: number;
  total_participantes: number;
  categoria_tempo: string;
}

export interface MeuRecorrente {
  placas_ativas: number;
  total_boletos_pagos: number;
  percentual_aplicado: number;
  valor_recorrente: number;
}

export interface MinhaDeducao extends Omit<Deducao, 'id'> {
  id: string;
  contrato_numero?: string;
  associado_nome?: string;
}

export interface MeuCrescimento {
  marco_placas: number;
  data_atingido: string;
  valor_pago: number;
  percentual_recorrente_garantido: number;
}

export interface MeuHistoricoMensal {
  mes: number;
  ano: number;
  vendas_confirmadas: number;
  total_adesao: number;
  total_recorrente: number;
  total_producao: number;
  total_ranking: number;
  total_crescimento: number;
  total_deducoes: number;
  total_geral: number;
  status: string;
}

export interface RankingPublico {
  vendedor_id: string;
  vendedor_nome: string;
  vendas_liquidas: number;
  posicao_ranking: number | null;
}

export interface MinhasComissoesAdesao {
  id: string;
  contrato_numero?: string;
  associado_nome?: string;
  placa?: string;
  valor_adesao: number;
  tipo_atendimento?: string;
  valor_deducao: number;
  valor_liquido: number;
  status: string;
}

export function useMinhasComissoesExtended(mes?: number, ano?: number) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  // Query: Resumo agrupado por tipo de comissão
  const { data: meuResumoMensal, isLoading: isLoadingResumo } = useQuery({
    queryKey: ['minhas-comissoes-resumo-tipo', userId, mes, ano],
    queryFn: async () => {
      if (!userId || !mes || !ano) return [];

      const { data, error } = await supabase
        .from('comissoes')
        .select('tipo_comissao, valor_total')
        .eq('vendedor_id', userId)
        .eq('mes_referencia', mes)
        .eq('ano_referencia', ano)
        .neq('status', 'cancelada');

      if (error) throw error;

      // Agrupar por tipo
      const resumoPorTipo = new Map<TipoComissao, { quantidade: number; valor_total: number }>();
      
      data?.forEach((c) => {
        const tipo = (c.tipo_comissao || 'adesao') as TipoComissao;
        if (!resumoPorTipo.has(tipo)) {
          resumoPorTipo.set(tipo, { quantidade: 0, valor_total: 0 });
        }
        const atual = resumoPorTipo.get(tipo)!;
        atual.quantidade++;
        atual.valor_total += c.valor_total || 0;
      });

      return Array.from(resumoPorTipo.entries()).map(([tipo, dados]) => ({
        tipo,
        quantidade: dados.quantidade,
        valor_total: dados.valor_total,
      })) as MeuResumoTipo[];
    },
    enabled: !!userId && !!mes && !!ano,
  });

  // Query: Minha posição no ranking
  const { data: meuRanking, isLoading: isLoadingRanking } = useQuery({
    queryKey: ['minhas-comissoes-ranking', userId, mes, ano],
    queryFn: async () => {
      if (!userId || !mes || !ano) return null;

      // Buscar campanha do mês
      const { data: campanha, error: campanhaError } = await supabase
        .from('comissoes_campanhas')
        .select('id')
        .eq('mes', mes)
        .eq('ano', ano)
        .maybeSingle();

      if (campanhaError) throw campanhaError;
      if (!campanha) return null;

      // Buscar minha posição
      const { data: meuRankingData, error: rankingError } = await supabase
        .from('comissoes_ranking_mensal')
        .select('posicao_ranking, vendas_liquidas, valor_premio, categoria_tempo')
        .eq('campanha_id', campanha.id)
        .eq('vendedor_id', userId)
        .maybeSingle();

      if (rankingError) throw rankingError;
      if (!meuRankingData) return null;

      // Contar total de participantes
      const { count } = await supabase
        .from('comissoes_ranking_mensal')
        .select('id', { count: 'exact', head: true })
        .eq('campanha_id', campanha.id);

      return {
        posicao_ranking: meuRankingData.posicao_ranking,
        vendas_liquidas: meuRankingData.vendas_liquidas || 0,
        valor_premio: meuRankingData.valor_premio || 0,
        total_participantes: count || 0,
        categoria_tempo: meuRankingData.categoria_tempo || 'menos_1_ano',
      } as MeuRanking;
    },
    enabled: !!userId && !!mes && !!ano,
  });

  // Query: Ranking público (sem valores de prêmio de outros)
  const { data: rankingPublico, isLoading: isLoadingRankingPublico } = useQuery({
    queryKey: ['minhas-comissoes-ranking-publico', mes, ano],
    queryFn: async () => {
      if (!mes || !ano) return [];

      // Buscar campanha do mês
      const { data: campanha, error: campanhaError } = await supabase
        .from('comissoes_campanhas')
        .select('id')
        .eq('mes', mes)
        .eq('ano', ano)
        .maybeSingle();

      if (campanhaError) throw campanhaError;
      if (!campanha) return [];

      // Buscar ranking completo (apenas nome e vendas, sem prêmios de outros)
      const { data, error } = await supabase
        .from('comissoes_ranking_mensal')
        .select(`
          vendedor_id,
          vendas_liquidas,
          posicao_ranking,
          vendedor:profiles!comissoes_ranking_mensal_vendedor_id_fkey(nome)
        `)
        .eq('campanha_id', campanha.id)
        .order('vendas_liquidas', { ascending: false });

      if (error) throw error;

      return (data || []).map((r: any) => ({
        vendedor_id: r.vendedor_id,
        vendedor_nome: r.vendedor?.nome || 'Vendedor',
        vendas_liquidas: r.vendas_liquidas || 0,
        posicao_ranking: r.posicao_ranking,
      })) as RankingPublico[];
    },
    enabled: !!mes && !!ano,
  });

  // Query: Meu recorrente do mês
  const { data: meuRecorrente, isLoading: isLoadingRecorrente } = useQuery({
    queryKey: ['minhas-comissoes-recorrente', userId, mes, ano],
    queryFn: async () => {
      if (!userId || !mes || !ano) return null;

      const { data, error } = await supabase
        .from('comissoes_recorrentes')
        .select('placas_ativas, total_boletos_pagos, percentual_aplicado, valor_recorrente')
        .eq('vendedor_id', userId)
        .eq('mes_referencia', mes)
        .eq('ano_referencia', ano)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return data as MeuRecorrente;
    },
    enabled: !!userId && !!mes && !!ano,
  });

  // Query: Minhas deduções do mês
  const { data: minhasDeducoes, isLoading: isLoadingDeducoes } = useQuery({
    queryKey: ['minhas-comissoes-deducoes', userId, mes, ano],
    queryFn: async () => {
      if (!userId || !mes || !ano) return [];

      const startDate = new Date(ano, mes - 1, 1).toISOString();
      const endDate = new Date(ano, mes, 0, 23, 59, 59).toISOString();

      const { data, error } = await supabase
        .from('comissoes_deducoes')
        .select(`
          *,
          contrato:contratos!comissoes_deducoes_contrato_id_fkey(numero),
          associado:associados!comissoes_deducoes_associado_id_fkey(nome)
        `)
        .eq('vendedor_id', userId)
        .gte('aplicada_em', startDate)
        .lte('aplicada_em', endDate)
        .order('aplicada_em', { ascending: false });

      if (error) throw error;

      return (data || []).map((d: any) => ({
        ...d,
        contrato_numero: d.contrato?.numero,
        associado_nome: d.associado?.nome,
      })) as MinhaDeducao[];
    },
    enabled: !!userId && !!mes && !!ano,
  });

  // Query: Meu crescimento (todos os marcos)
  const { data: meuCrescimento, isLoading: isLoadingCrescimento } = useQuery({
    queryKey: ['minhas-comissoes-crescimento', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('comissoes_crescimento_log')
        .select('marco_placas, data_atingido, valor_pago, percentual_recorrente_garantido')
        .eq('vendedor_id', userId)
        .order('marco_placas', { ascending: true });

      if (error) throw error;
      return data as MeuCrescimento[];
    },
    enabled: !!userId,
  });

  // Query: Meu histórico (últimos 12 meses)
  const { data: meuHistorico, isLoading: isLoadingHistorico } = useQuery({
    queryKey: ['minhas-comissoes-historico', userId],
    queryFn: async () => {
      if (!userId) return [];

      // Calcular range de 12 meses
      const hoje = new Date();
      const dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1);

      const { data, error } = await supabase
        .from('comissoes')
        .select('mes_referencia, ano_referencia, tipo_comissao, valor_total, status')
        .eq('vendedor_id', userId)
        .gte('ano_referencia', dataInicio.getFullYear())
        .neq('status', 'cancelada');

      if (error) throw error;

      // Agrupar por mês/ano
      const historicoMap = new Map<string, MeuHistoricoMensal>();

      data?.forEach((c) => {
        const key = `${c.ano_referencia}-${c.mes_referencia}`;
        if (!historicoMap.has(key)) {
          historicoMap.set(key, {
            mes: c.mes_referencia,
            ano: c.ano_referencia,
            vendas_confirmadas: 0,
            total_adesao: 0,
            total_recorrente: 0,
            total_producao: 0,
            total_ranking: 0,
            total_crescimento: 0,
            total_deducoes: 0,
            total_geral: 0,
            status: 'pendente',
          });
        }

        const item = historicoMap.get(key)!;
        const valor = c.valor_total || 0;

        switch (c.tipo_comissao) {
          case 'adesao':
            item.total_adesao += valor;
            item.vendas_confirmadas++;
            break;
          case 'recorrente':
            item.total_recorrente += valor;
            break;
          case 'producao':
            item.total_producao += valor;
            break;
          case 'classificacao':
            item.total_ranking += valor;
            break;
          case 'crescimento':
            item.total_crescimento += valor;
            break;
        }

        item.total_geral += valor;

        // Status mais avançado prevalece
        if (c.status === 'paga') item.status = 'paga';
        else if (c.status === 'aprovada' && item.status !== 'paga') item.status = 'aprovada';
      });

      // Ordenar por data DESC
      return Array.from(historicoMap.values())
        .sort((a, b) => {
          if (a.ano !== b.ano) return b.ano - a.ano;
          return b.mes - a.mes;
        })
        .slice(0, 12);
    },
    enabled: !!userId,
  });

  // Query: Comissões de adesão do mês (detalhadas)
  const { data: minhasAdesoes, isLoading: isLoadingAdesoes } = useQuery({
    queryKey: ['minhas-comissoes-adesoes', userId, mes, ano],
    queryFn: async () => {
      if (!userId || !mes || !ano) return [];

      const { data, error } = await supabase
        .from('comissoes')
        .select(`
          id,
          valor_base,
          valor_total,
          valor_deducoes,
          status,
          contrato:contratos!comissoes_contrato_id_fkey(
            numero,
            valor_adesao,
            associado:associados(nome),
            veiculo:veiculos(placa)
          )
        `)
        .eq('vendedor_id', userId)
        .eq('mes_referencia', mes)
        .eq('ano_referencia', ano)
        .eq('tipo_comissao', 'adesao')
        .neq('status', 'cancelada')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((c: any) => ({
        id: c.id,
        contrato_numero: c.contrato?.numero,
        associado_nome: c.contrato?.associado?.nome,
        placa: c.contrato?.veiculo?.placa,
        valor_adesao: c.contrato?.valor_adesao || 0,
        tipo_atendimento: 'balcão',
        valor_deducao: c.valor_deducoes || 0,
        valor_liquido: c.valor_total || 0,
        status: c.status,
      })) as MinhasComissoesAdesao[];
    },
    enabled: !!userId && !!mes && !!ano,
  });

  // Query: Tipo do consultor
  const { data: tipoConsultor } = useQuery({
    queryKey: ['meu-tipo-consultor', userId],
    queryFn: async () => {
      if (!userId) return 'interno';

      const { data, error } = await supabase.rpc('fn_tipo_consultor', {
        p_vendedor_id: userId,
      });

      if (error) {
        console.error('Erro ao buscar tipo consultor:', error);
        return 'interno';
      }
      return (data as string) || 'interno';
    },
    enabled: !!userId,
  });

  // Query: Placas ativas do consultor
  const { data: placasAtivas } = useQuery({
    queryKey: ['minhas-placas-ativas', userId],
    queryFn: async () => {
      if (!userId) return 0;

      const { data, error } = await supabase.rpc('fn_placas_ativas_consultor', {
        p_vendedor_id: userId,
      });

      if (error) {
        console.error('Erro ao buscar placas ativas:', error);
        return 0;
      }
      return (data as number) || 0;
    },
    enabled: !!userId,
  });

  // Mutation: Contestar comissão
  const contestarComissao = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { error } = await supabase
        .from('comissoes')
        .update({
          contestada: true,
          contestada_em: new Date().toISOString(),
          contestacao_motivo: motivo,
        })
        .eq('id', id)
        .eq('vendedor_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['minhas-comissoes'] });
      queryClient.invalidateQueries({ queryKey: ['minhas-comissoes-adesoes'] });
      toast.success('Comissão marcada como contestada');
    },
    onError: (error: Error) => {
      toast.error('Erro ao contestar: ' + error.message);
    },
  });

  // Totais derivados
  const totalMes = meuResumoMensal?.reduce((sum, r) => sum + r.valor_total, 0) || 0;
  const vendasConfirmadas = meuResumoMensal?.find(r => r.tipo === 'adesao')?.quantidade || 0;
  const totalDeducoes = minhasDeducoes?.reduce((sum, d) => sum + d.valor, 0) || 0;

  return {
    // Queries
    meuResumoMensal,
    meuRanking,
    rankingPublico,
    meuRecorrente,
    minhasDeducoes,
    meuCrescimento,
    meuHistorico,
    minhasAdesoes,
    tipoConsultor,
    placasAtivas,
    // Loading states
    isLoading: isLoadingResumo || isLoadingRanking,
    isLoadingResumo,
    isLoadingRanking,
    isLoadingRankingPublico,
    isLoadingRecorrente,
    isLoadingDeducoes,
    isLoadingCrescimento,
    isLoadingHistorico,
    isLoadingAdesoes,
    // Mutation
    contestarComissao,
    // Totais
    totalMes,
    vendasConfirmadas,
    totalDeducoes,
  };
}
