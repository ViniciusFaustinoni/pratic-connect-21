import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Detecta solicitações de Troca de Titularidade em "limbo pós-Monitoramento":
 * status=aguardando_vistoria/aguardando_manutencao SEM serviço de campo vivo
 * (NULL, inexistente ou cancelada). Usa a RPC canônica `fn_detectar_troca_limbo`.
 *
 * Ver: mem://logic/operations/troca-titularidade-anti-limbo-pos-monitoramento
 */
export interface TrocaLimboRow {
  solicitacao_id: string;
  veiculo_id: string | null;
  placa: string | null;
  status: 'aguardando_vistoria' | 'aguardando_manutencao';
  servico_id: string | null;
  servico_status: string;
  motivo: 'servico_vistoria_id_null' | 'servico_manutencao_id_null' | 'servico_inexistente' | 'servico_cancelado' | 'desconhecido';
  updated_at: string;
}

export function useTrocaLimbo(minIdadeMinutos: number = 0) {
  return useQuery({
    queryKey: ['troca-limbo', minIdadeMinutos],
    queryFn: async (): Promise<TrocaLimboRow[]> => {
      const { data, error } = await (supabase as any).rpc('fn_detectar_troca_limbo', {
        p_min_idade_minutos: minIdadeMinutos,
      });
      if (error) throw error;
      return (data || []) as TrocaLimboRow[];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useSolicitacaoEmLimbo(solicitacaoId: string | null | undefined) {
  const { data } = useTrocaLimbo(0);
  if (!solicitacaoId || !data) return null;
  return data.find((r) => r.solicitacao_id === solicitacaoId) || null;
}
