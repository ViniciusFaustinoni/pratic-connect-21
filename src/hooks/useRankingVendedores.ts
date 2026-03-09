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
}

interface RankingVendedoresData {
  ranking: VendedorRanking[];
  total: number;
  totalValor: number;
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

      // 1. Buscar roles de vendedores dinamicamente (apenas vendedor_clt e vendedor_externo para ranking)
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['vendedor_clt', 'vendedor_externo']); // Ranking é apenas para vendedores diretos

      if (rolesError) {
        console.error('Erro ao buscar roles:', rolesError);
        throw rolesError;
      }

      if (!roles || roles.length === 0) {
        return { ranking: [], total: 0, totalValor: 0 };
      }

      // Mapear vendedor -> tipo
      const vendedorTipoMap: Record<string, 'interno' | 'externo'> = {};
      roles.forEach((r) => {
        vendedorTipoMap[r.user_id] = r.role === 'vendedor_clt' ? 'interno' : 'externo';
      });

      // Filtrar por tipo se necessário
      let vendedorIds = Object.keys(vendedorTipoMap);
      if (tipoFiltro !== 'todos') {
        vendedorIds = vendedorIds.filter(
          (id) => vendedorTipoMap[id] === (tipoFiltro === 'interno' ? 'interno' : 'externo')
        );
      }

      if (vendedorIds.length === 0) {
        return { ranking: [], total: 0, totalValor: 0 };
      }

      // 2. Buscar contratos ativos do período por vendedor
      const { data: contratos, error: contratosError } = await supabase
        .from('contratos')
        .select(`
          id,
          vendedor_id,
          valor_mensal,
          data_inicio
        `)
        .gte('data_inicio', dataInicioStr)
        .eq('status', 'ativo')
        .in('vendedor_id', vendedorIds);

      if (contratosError) {
        console.error('Erro ao buscar contratos:', contratosError);
        throw contratosError;
      }

      // 3. Buscar leads para calcular taxa de conversão
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('id, vendedor_id')
        .gte('created_at', dataInicioStr)
        .in('vendedor_id', vendedorIds);

      if (leadsError) {
        console.error('Erro ao buscar leads:', leadsError);
      }

      // Agrupar leads por vendedor
      const leadsPorVendedor: Record<string, number> = {};
      leads?.forEach((lead) => {
        if (lead.vendedor_id) {
          leadsPorVendedor[lead.vendedor_id] = (leadsPorVendedor[lead.vendedor_id] || 0) + 1;
        }
      });

      // 4. Buscar profiles dos vendedores
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nome, avatar_url')
        .in('id', vendedorIds);

      if (profilesError) {
        console.error('Erro ao buscar profiles:', profilesError);
        throw profilesError;
      }

      const profileMap = profiles?.reduce((acc, p) => {
        acc[p.id] = { nome: p.nome, avatar_url: p.avatar_url };
        return acc;
      }, {} as Record<string, { nome: string; avatar_url: string | null }>);

      // 5. Agrupar contratos por vendedor
      const agrupado: Record<string, { vendas: number; valorTotal: number }> = {};
      contratos?.forEach((contrato) => {
        const vendedorId = contrato.vendedor_id;
        if (!vendedorId) return;

        if (!agrupado[vendedorId]) {
          agrupado[vendedorId] = { vendas: 0, valorTotal: 0 };
        }
        agrupado[vendedorId].vendas++;
        agrupado[vendedorId].valorTotal += contrato.valor_mensal || 0;
      });

      // 6. Criar ranking ordenado
      const ranking: VendedorRanking[] = Object.entries(agrupado)
        .map(([vendedorId, stats]) => {
          const totalLeads = leadsPorVendedor[vendedorId] || 0;
          const taxaConversao = totalLeads > 0 ? (stats.vendas / totalLeads) * 100 : 0;

          return {
            posicao: 0,
            vendedorId,
            vendedorNome: profileMap?.[vendedorId]?.nome || 'Vendedor',
            avatarUrl: profileMap?.[vendedorId]?.avatar_url || null,
            tipoVendedor: vendedorTipoMap[vendedorId],
            totalVendas: stats.vendas,
            valorTotal: stats.valorTotal,
            ticketMedio: stats.vendas > 0 ? stats.valorTotal / stats.vendas : 0,
            taxaConversao,
          };
        })
        .sort((a, b) => b.totalVendas - a.totalVendas)
        .slice(0, 20)
        .map((v, index) => ({
          ...v,
          posicao: index + 1,
        }));

      const total = ranking.reduce((sum, v) => sum + v.totalVendas, 0);
      const totalValor = ranking.reduce((sum, v) => sum + v.valorTotal, 0);

      return { ranking, total, totalValor };
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}
