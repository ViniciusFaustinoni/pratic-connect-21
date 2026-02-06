import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { RankingMensal } from '@/types/comissoes';

interface RankingMensalExtended extends RankingMensal {
  vendedor_nome?: string;
  vendedor_avatar?: string | null;
}

interface RankingPorCategoria {
  internoMais1Ano: RankingMensalExtended[];
  internoMenos1Ano: RankingMensalExtended[];
  externo: RankingMensalExtended[];
}

export function useComissoesRanking(mes?: number, ano?: number) {
  const { data: ranking, isLoading, error } = useQuery({
    queryKey: ['comissoes-ranking', mes, ano],
    queryFn: async () => {
      if (!mes || !ano) return [];

      // Primeiro buscar a campanha do mês/ano
      const { data: campanha, error: campanhaError } = await supabase
        .from('comissoes_campanhas')
        .select('id')
        .eq('mes', mes)
        .eq('ano', ano)
        .single();

      if (campanhaError) {
        // Sem campanha = sem ranking
        if (campanhaError.code === 'PGRST116') return [];
        throw campanhaError;
      }

      if (!campanha) return [];

      // Buscar ranking da campanha
      const { data, error } = await supabase
        .from('comissoes_ranking_mensal')
        .select(`
          *,
          vendedor:profiles!comissoes_ranking_mensal_vendedor_id_fkey(nome, avatar_url)
        `)
        .eq('campanha_id', campanha.id)
        .order('vendas_liquidas', { ascending: false });

      if (error) throw error;

      return (data || []).map((r: any) => ({
        ...r,
        vendedor_nome: r.vendedor?.nome,
        vendedor_avatar: r.vendedor?.avatar_url,
      })) as RankingMensalExtended[];
    },
    enabled: !!mes && !!ano,
  });

  // Estados derivados: separar por categoria
  const rankingPorCategoria: RankingPorCategoria = {
    internoMais1Ano: [],
    internoMenos1Ano: [],
    externo: [],
  };

  ranking?.forEach((r) => {
    if (r.tipo_consultor === 'interno' && r.categoria_tempo === 'mais_1_ano') {
      rankingPorCategoria.internoMais1Ano.push(r);
    } else if (r.tipo_consultor === 'interno' && r.categoria_tempo === 'menos_1_ano') {
      rankingPorCategoria.internoMenos1Ano.push(r);
    } else if (r.tipo_consultor === 'externo') {
      rankingPorCategoria.externo.push(r);
    }
  });

  // Ordenar cada categoria por posição
  Object.keys(rankingPorCategoria).forEach((key) => {
    rankingPorCategoria[key as keyof RankingPorCategoria].sort((a, b) => 
      (a.posicao_ranking || 999) - (b.posicao_ranking || 999)
    );
  });

  // Total de placas da campanha
  const totalPlacas = ranking?.reduce((sum, r) => sum + (r.vendas_confirmadas || 0), 0) || 0;

  // Faixa de placas (300, 400, 500)
  let faixaPlacas: number = 0;
  if (totalPlacas >= 500) faixaPlacas = 500;
  else if (totalPlacas >= 400) faixaPlacas = 400;
  else if (totalPlacas >= 300) faixaPlacas = 300;

  return {
    ranking,
    rankingPorCategoria,
    totalPlacas,
    faixaPlacas,
    isLoading,
    error,
  };
}
