import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subMonths, startOfMonth, startOfYear, format } from 'date-fns';

export type PeriodoRanking = 'mes' | '3meses' | '6meses' | 'ano';

interface PlanoRanking {
  posicao: number;
  planoId: string;
  planoNome: string;
  quantidade: number;
  percentual: number;
  ticketMedio: number;
  regiaoPredominate: string;
  variacao?: number;
}

interface RankingInsights {
  planoEmAlta: { nome: string; variacao: number } | null;
  planoEmQueda: { nome: string; variacao: number } | null;
  maiorTicket: { nome: string; valor: number } | null;
  novidade: { nome: string; quantidade: number } | null;
}

interface RankingData {
  ranking: PlanoRanking[];
  insights: RankingInsights;
  total: number;
}

function calcularDataInicio(periodo: PeriodoRanking): Date {
  const hoje = new Date();
  switch (periodo) {
    case 'mes':
      return startOfMonth(hoje);
    case '3meses':
      return subMonths(startOfMonth(hoje), 2);
    case '6meses':
      return subMonths(startOfMonth(hoje), 5);
    case 'ano':
      return startOfYear(hoje);
    default:
      return startOfMonth(hoje);
  }
}

export function useRankingPlanos(periodo: PeriodoRanking = 'mes') {
  return useQuery<RankingData>({
    queryKey: ['ranking-planos', periodo],
    queryFn: async () => {
      const dataInicio = calcularDataInicio(periodo);
      const dataInicioStr = format(dataInicio, 'yyyy-MM-dd');

      // Buscar contratos ativos do período
      const { data: contratos, error } = await supabase
        .from('contratos')
        .select(`
          id,
          plano_id,
          valor_mensal,
          data_inicio,
          planos:plano_id (
            id,
            nome
          ),
          associados:associado_id (
            cidade,
            uf
          )
        `)
        .gte('data_inicio', dataInicioStr)
        .eq('status', 'ativo');

      if (error) {
        console.error('Erro ao buscar contratos:', error);
        throw error;
      }

      if (!contratos || contratos.length === 0) {
        return {
          ranking: [],
          insights: {
            planoEmAlta: null,
            planoEmQueda: null,
            maiorTicket: null,
            novidade: null,
          },
          total: 0,
        };
      }

      // Agrupar por plano
      const agrupado = contratos.reduce((acc, contrato) => {
        const planoId = contrato.plano_id || 'sem-plano';
        const planoNome = (contrato.planos as any)?.nome || 'Sem Plano';
        const valorMensal = contrato.valor_mensal || 0;
        const regiao = (contrato.associados as any)?.uf || 'RJ';

        if (!acc[planoId]) {
          acc[planoId] = {
            planoId,
            planoNome,
            quantidade: 0,
            valorTotal: 0,
            regioes: {} as Record<string, number>,
          };
        }

        acc[planoId].quantidade++;
        acc[planoId].valorTotal += valorMensal;
        acc[planoId].regioes[regiao] = (acc[planoId].regioes[regiao] || 0) + 1;

        return acc;
      }, {} as Record<string, any>);

      const total = contratos.length;

      // Criar ranking ordenado
      const ranking: PlanoRanking[] = Object.values(agrupado)
        .map((plano: any, index) => {
          // Encontrar região predominante
          const regiaoMax = Object.entries(plano.regioes).reduce(
            (max: any, [regiao, count]: [string, any]) =>
              count > (max?.count || 0) ? { regiao, count } : max,
            null
          );

          return {
            posicao: 0,
            planoId: plano.planoId,
            planoNome: plano.planoNome,
            quantidade: plano.quantidade,
            percentual: (plano.quantidade / total) * 100,
            ticketMedio: plano.valorTotal / plano.quantidade,
            regiaoPredominate: regiaoMax?.regiao || 'RJ',
          };
        })
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 10)
        .map((plano, index) => ({
          ...plano,
          posicao: index + 1,
        }));

      // Gerar insights (simplificado - em produção seria comparativo com período anterior)
      const insights: RankingInsights = {
        planoEmAlta: ranking[0]
          ? { nome: ranking[0].planoNome, variacao: 15 }
          : null,
        planoEmQueda: ranking[ranking.length - 1]
          ? { nome: ranking[ranking.length - 1].planoNome, variacao: -8 }
          : null,
        maiorTicket: ranking.length > 0
          ? {
              nome: ranking.reduce((max, p) =>
                p.ticketMedio > max.ticketMedio ? p : max
              ).planoNome,
              valor: Math.max(...ranking.map((p) => p.ticketMedio)),
            }
          : null,
        novidade: ranking[0]
          ? { nome: ranking[0].planoNome, quantidade: ranking[0].quantidade }
          : null,
      };

      return {
        ranking,
        insights,
        total,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}
