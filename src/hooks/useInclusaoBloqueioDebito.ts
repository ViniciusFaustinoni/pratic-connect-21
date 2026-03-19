import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Lê a configuração `inclusao_bloquear_debito_outro_veiculo` da tabela `configuracoes`.
 * Default: true (bloqueio ativo).
 */
export function useInclusaoBloqueioDebito() {
  return useQuery({
    queryKey: ['configuracao', 'inclusao_bloquear_debito_outro_veiculo'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'inclusao_bloquear_debito_outro_veiculo')
        .maybeSingle();

      // Default true se não existir
      if (!data?.valor) return true;
      return data.valor === 'true';
    },
    staleTime: 1000 * 60 * 5,
  });
}
