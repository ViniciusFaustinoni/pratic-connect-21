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
      const { count } = await supabase
        .from('contratos')
        .select('id', { count: 'exact', head: true })
        .in('status', ['assinado', 'em_analise']);
      return count || 0;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
