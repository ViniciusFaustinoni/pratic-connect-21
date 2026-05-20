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
      // Conta SOMENTE a fila real de aprovação do Cadastro
      // (`aguardando_cadastro` é definido pelo trigger
      // trg_troca_promove_cadastro_via_cotacao quando a cotação atinge
      // `aguardando_aprovacao_cadastro`). Trocas em
      // `aguardando_termo_cancelamento` / `cotacao_em_andamento` ainda estão
      // sob responsabilidade do novo titular no link público — não viram
      // pendência do Cadastro.
      const q1 = (supabase as any)
        .from('solicitacoes_troca_titularidade')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'aguardando_cadastro');

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
