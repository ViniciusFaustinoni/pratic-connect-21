import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Contagem combinada para o badge do item "Aprovações" no sidebar:
 * - Ressalvas pendentes de monitoramento
 * - Imprevistos sem resposta (follow-ups esgotados)
 */
export function useAprovacoesMonitoramentoCount() {
  return useQuery<number>({
    queryKey: ['aprovacoes-monitoramento-count'],
    queryFn: async () => {
      const [ressalvasRes, imprevistosRes] = await Promise.all([
        supabase
          .from('servicos')
          .select('id', { count: 'exact', head: true })
          .eq('decisao_instalador', 'pendente_monitoramento')
          .eq('status', 'em_analise'),
        supabase
          .from('servicos')
          .select('id', { count: 'exact', head: true })
          .in('status', ['nao_compareceu', 'imprevisto_pendente'])
          .gte('reagendamento_followup_count', 3),
      ]);
      const r = ressalvasRes.count || 0;
      const i = imprevistosRes.count || 0;
      return r + i;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
