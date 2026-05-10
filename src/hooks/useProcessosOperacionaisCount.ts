import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Conta o total de itens pendentes em "Processos" (Cadastro):
 * - Trocas de titularidade aguardando cadastro / em cotação
 * - Substituições aguardando aprovação
 * - Migrações pendentes
 * - Cotações de inclusão em rascunho/enviada
 *
 * Usado para exibir o badge na sidebar.
 */
export function useProcessosOperacionaisCount() {
  return useQuery({
    queryKey: ['processos-operacionais-count'],
    queryFn: async () => {
      const q1 = (supabase as any)
        .from('solicitacoes_troca_titularidade')
        .select('id', { count: 'exact', head: true })
        .in('status', ['aguardando_cadastro', 'cotacao_em_andamento']);

      const q2 = supabase
        .from('substituicoes_veiculo')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'aguardando_aprovacao');

      const q3 = supabase
        .from('solicitacoes_migracao')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente');

      const q4 = supabase
        .from('cotacoes')
        .select('id', { count: 'exact', head: true })
        .filter('dados_extras->>tipo_entrada', 'eq', 'inclusao')
        .in('status', ['rascunho', 'enviada']);

      const [t, s, m, i] = await Promise.all([q1, q2, q3, q4]);
      return (t.count || 0) + (s.count || 0) + (m.count || 0) + (i.count || 0);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
