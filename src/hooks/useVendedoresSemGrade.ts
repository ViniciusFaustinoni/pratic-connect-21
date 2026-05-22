import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Detecta vendedores que originaram comissão no período mas não têm
 * grade atribuída em `usuario_grade_comissao`. Sem grade, a função
 * `fn_gerar_comissao_plano_nivel` grava lançamentos com valor zero,
 * o que faz o Dashboard exibir R$ 0,00.
 *
 * Ver memória: mem://logic/commissions/grade-do-vendedor-prevalece
 */
export function useVendedoresSemGrade(dataInicio?: Date, dataFim?: Date) {
  return useQuery({
    queryKey: [
      'vendedores-sem-grade',
      dataInicio?.toISOString().slice(0, 10),
      dataFim?.toISOString().slice(0, 10),
    ],
    queryFn: async () => {
      const inicio = dataInicio ? new Date(dataInicio) : new Date();
      const fim = dataFim ? new Date(dataFim) : new Date();
      inicio.setHours(0, 0, 0, 0);
      fim.setHours(23, 59, 59, 999);

      const { data: comissoes, error } = await (supabase as any)
        .from('comissoes')
        .select('vendedor_id')
        .gte('created_at', inicio.toISOString())
        .lte('created_at', fim.toISOString())
        .not('vendedor_id', 'is', null);
      if (error) throw error;

      const vendedorIds = Array.from(
        new Set((comissoes || []).map((c: any) => c.vendedor_id).filter(Boolean)),
      ) as string[];
      if (vendedorIds.length === 0) {
        return { total: 0, semGrade: [] as Array<{ id: string; nome: string }> };
      }

      const { data: grades, error: gErr } = await (supabase as any)
        .from('usuario_grade_comissao')
        .select('user_id')
        .in('user_id', vendedorIds);
      if (gErr) throw gErr;

      const comGrade = new Set((grades || []).map((g: any) => g.user_id));
      const semGradeIds = vendedorIds.filter((id) => !comGrade.has(id));

      if (semGradeIds.length === 0) return { total: 0, semGrade: [] };

      const { data: profiles } = await (supabase as any)
        .from('profiles')
        .select('id, nome')
        .in('id', semGradeIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.nome]));

      return {
        total: semGradeIds.length,
        semGrade: semGradeIds.map((id) => ({
          id,
          nome: profileMap.get(id) || 'Vendedor sem nome',
        })),
      };
    },
    enabled: !!dataInicio && !!dataFim,
  });
}
