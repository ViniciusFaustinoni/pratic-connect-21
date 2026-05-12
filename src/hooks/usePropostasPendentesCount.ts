import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Conta o total de propostas pendentes (Cadastro › Propostas Pendentes):
 * contratos com status 'assinado' ou 'em_analise'. Usado para o badge da sidebar.
 */
export function usePropostasPendentesCount() {
  return useQuery({
    queryKey: ['propostas-pendentes-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('contratos')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'assinado');
      if (error) {
        console.warn('[usePropostasPendentesCount]', error.message);
        return 0;
      }
      return count || 0;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
