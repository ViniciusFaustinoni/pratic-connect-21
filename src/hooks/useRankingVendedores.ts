import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subMonths, startOfMonth, startOfYear, format } from 'date-fns';

export type PeriodoRanking = 'mes' | '3meses' | '6meses' | 'ano';
export type TipoVendedor = 'todos' | 'interno' | 'externo';

export interface VendedorRanking {
  posicao: number;
  vendedorId: string;
  vendedorNome: string;
  avatarUrl: string | null;
  tipoVendedor: 'interno' | 'externo';
  totalVendas: number;
  valorTotal: number;
  ticketMedio: number;
  taxaConversao: number;
  cotacoesCriadas: number;
  cotacoesAceitas: number;
}

interface RankingVendedoresData {
  ranking: VendedorRanking[];
  total: number;
  totalValor: number;
  totalCotacoes: number;
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

export function useRankingVendedores(
  periodo: PeriodoRanking = 'mes',
  tipoFiltro: TipoVendedor = 'todos'
) {
  return useQuery<RankingVendedoresData>({
    queryKey: ['ranking-vendedores', periodo, tipoFiltro],
    queryFn: async () => {
      const dataInicio = calcularDataInicio(periodo);
      const dataInicioStr = format(dataInicio, 'yyyy-MM-dd');

      // 1. Buscar roles de vendedores
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['vendedor_clt', 'vendedor_externo']);

      if (rolesError) throw rolesError;
      if (!roles || roles.length === 0) {
        return { ranking: [], total: 0, totalValor: 0, totalCotacoes: 0 };
      }

      const vendedorTipoMap: Record<string, 'interno' | 'externo'> = {};
      roles.forEach((r) => {
        vendedorTipoMap[r.user_id] = r.role === 'vendedor_clt' ? 'interno' : 'externo';
      });

      let vendedorIds = Object.keys(vendedorTipoMap);
      if (tipoFiltro !== 'todos') {
        vendedorIds = vendedorIds.filter(
          (id) => vendedorTipoMap[id] === (tipoFiltro === 'interno' ? 'interno' : 'externo')
        );
      }

      if (vendedorIds.length === 0) {
        return { ranking: [], total: 0, totalValor: 0, totalCotacoes: 0 };
      }

      // 2. Buscar contratos, cotações e profiles em paralelo
      const [contratosResult, cotacoesResult, profilesResult] = await Promise.all([
        supabase
          .from('contratos')
          .select('id, vendedor_id, valor_mensal, data_inicio')
          .gte('data_inicio', dataInicioStr)
          .in('status', ['ativo', 'assinado'])
          .in('vendedor_id', vendedorIds),
        supabase
          .from('cotacoes')
          .select('id, vendedor_id, status')
          .gte('created_at', dataInicioStr)
          .in('vendedor_id', vendedorIds),
        supabase
          .from('profiles')
          .select('id, nome, avatar_url')
          .in('id', vendedorIds),
      ]);

      if (contratosResult.error) throw contratosResult.error;
      if (cotacoesResult.error) throw cotacoesResult.error;

      const contratos = contratosResult.data || [];
      const cotacoes = cotacoesResult.data || [];
      const profiles = profilesResult.data || [];

      const profileMap = profiles.reduce((acc, p) => {
        acc[p.id] = { nome: p.nome, avatar_url: p.avatar_url };
        return acc;
      }, {} as Record<string, { nome: string; avatar_url: string | null }>);

      // 3. Agrupar cotações por vendedor
      const cotacoesPorVendedor: Record<string, { criadas: number; aceitas: number }> = {};
      cotacoes.forEach((c) => {
        if (!c.vendedor_id) return;
        if (!cotacoesPorVendedor[c.vendedor_id]) {
          cotacoesPorVendedor[c.vendedor_id] = { criadas: 0, aceitas: 0 };
        }
        cotacoesPorVendedor[c.vendedor_id].criadas++;
        if (c.status === 'aceita') {
          cotacoesPorVendedor[c.vendedor_id].aceitas++;
        }
      });

      // 4. Agrupar contratos por vendedor
      const contratosPorVendedor: Record<string, { vendas: number; valorTotal: number }> = {};
      contratos.forEach((contrato) => {
        const vendedorId = contrato.vendedor_id;
        if (!vendedorId) return;
        if (!contratosPorVendedor[vendedorId]) {
          contratosPorVendedor[vendedorId] = { vendas: 0, valorTotal: 0 };
        }
        contratosPorVendedor[vendedorId].vendas++;
        contratosPorVendedor[vendedorId].valorTotal += contrato.valor_mensal || 0;
      });

      // 5. Unificar vendedores que têm contratos OU cotações
      const todosVendedorIds = new Set([
        ...Object.keys(contratosPorVendedor),
        ...Object.keys(cotacoesPorVendedor),
      ]);

      const ranking: VendedorRanking[] = Array.from(todosVendedorIds)
        .filter((id) => vendedorIds.includes(id))
        .map((vendedorId) => {
          const stats = contratosPorVendedor[vendedorId] || { vendas: 0, valorTotal: 0 };
          const cotStats = cotacoesPorVendedor[vendedorId] || { criadas: 0, aceitas: 0 };
          const taxaConversao = cotStats.criadas > 0 ? (stats.vendas / cotStats.criadas) * 100 : 0;

          return {
            posicao: 0,
            vendedorId,
            vendedorNome: profileMap[vendedorId]?.nome || 'Vendedor',
            avatarUrl: profileMap[vendedorId]?.avatar_url || null,
            tipoVendedor: vendedorTipoMap[vendedorId],
            totalVendas: stats.vendas,
            valorTotal: stats.valorTotal,
            ticketMedio: stats.vendas > 0 ? stats.valorTotal / stats.vendas : 0,
            taxaConversao,
            cotacoesCriadas: cotStats.criadas,
            cotacoesAceitas: cotStats.aceitas,
          };
        })
        .sort((a, b) => b.totalVendas - a.totalVendas || b.cotacoesCriadas - a.cotacoesCriadas)
        .slice(0, 20)
        .map((v, index) => ({ ...v, posicao: index + 1 }));

      const total = ranking.reduce((sum, v) => sum + v.totalVendas, 0);
      const totalValor = ranking.reduce((sum, v) => sum + v.valorTotal, 0);
      const totalCotacoes = ranking.reduce((sum, v) => sum + v.cotacoesCriadas, 0);

      return { ranking, total, totalValor, totalCotacoes };
    },
    staleTime: 5 * 60 * 1000,
  });
}
