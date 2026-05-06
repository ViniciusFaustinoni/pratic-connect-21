import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook canônico que carrega TODAS as linhas de `configuracoes` em UMA chamada
 * e mantém em cache global por 10 min. Substitui dezenas de N+1 fetches
 * (`select=valor&chave=eq.X`) que aconteciam por toda a app.
 *
 * Use sempre via os hooks específicos em `useConteudosSistema.ts`
 * (ex.: `useTaxaAdesaoPercentual`, `useCarenciaDiasPadrao`...) — eles agora
 * são meros seletores deste cache.
 */
export const CONFIGURACOES_ALL_KEY = ['configuracoes', 'all'] as const;

export function useConfiguracoesAll() {
  return useQuery({
    queryKey: CONFIGURACOES_ALL_KEY,
    queryFn: async (): Promise<Record<string, string>> => {
      // Fase 4.1: usa RPC `get_app_config()` (STABLE + SECURITY DEFINER) que
      // devolve o agregado pronto em uma única chamada — evita scan +
      // serialização linha-a-linha do PostgREST.
      const { data, error } = await supabase.rpc('get_app_config');
      if (!error && data && typeof data === 'object') {
        const map: Record<string, string> = {};
        for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
          if (v != null) map[k] = String(v);
        }
        return map;
      }
      // Fallback: caso a RPC ainda não tenha sido aplicada, recai no SELECT
      const { data: rows, error: err2 } = await supabase
        .from('configuracoes')
        .select('chave, valor');
      if (err2) throw err2;
      const map: Record<string, string> = {};
      for (const row of rows ?? []) {
        if (row.chave != null && row.valor != null) {
          map[row.chave as string] = String(row.valor);
        }
      }
      return map;
    },
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });
}

/**
 * Útil após mutações que gravam em `configuracoes` — invalida o cache global
 * para que todos os hooks dependentes reflitam o novo valor.
 */
export function useInvalidateConfiguracoes() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: CONFIGURACOES_ALL_KEY });
}
