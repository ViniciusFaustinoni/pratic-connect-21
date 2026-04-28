import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LimboAlerta {
  id: string;
  associado_id: string | null;
  instalacao_id: string | null;
  tipo: string;
  severidade: string;
  status: string;
  detalhes: any;
  primeira_deteccao_em: string;
  ultima_deteccao_em: string;
  resolvido_em: string | null;
}

export interface IntegrationItem {
  id: string;
  integration: string;
  operation: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  next_attempt_at: string | null;
  dead_letter_at: string | null;
  succeeded_at: string | null;
  created_at: string;
  correlation_id: string | null;
  payload: any;
}

export function useSaudeAtivacao() {
  const limbo = useQuery({
    queryKey: ['saude-ativacao', 'limbo'],
    queryFn: async (): Promise<LimboAlerta[]> => {
      const { data, error } = await (supabase as any)
        .from('ativacao_limbo_alertas')
        .select('*')
        .eq('status', 'aberto')
        .order('severidade', { ascending: false })
        .order('ultima_deteccao_em', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  const fila = useQuery({
    queryKey: ['saude-ativacao', 'fila'],
    queryFn: async (): Promise<IntegrationItem[]> => {
      const { data, error } = await (supabase as any)
        .from('integration_retry_queue')
        .select('*')
        .in('status', ['pending', 'processing', 'failed', 'dead_letter'])
        .order('updated_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const log = useQuery({
    queryKey: ['saude-ativacao', 'log'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ativacao_status_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  const resumo = {
    limbo_total: limbo.data?.length ?? 0,
    limbo_alta: limbo.data?.filter(l => l.severidade === 'alta').length ?? 0,
    fila_pending: fila.data?.filter(i => i.status === 'pending').length ?? 0,
    fila_failed: fila.data?.filter(i => i.status === 'failed').length ?? 0,
    fila_dead: fila.data?.filter(i => i.status === 'dead_letter').length ?? 0,
  };

  return { limbo, fila, log, resumo, loading: limbo.isLoading || fila.isLoading };
}
