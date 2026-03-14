import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface HealthCheckRecord {
  id: string;
  created_at: string;
  integracao: string;
  conexao_ok: boolean;
  tempo_resposta_ms: number | null;
  detalhes: Record<string, any> | null;
  erro_mensagem: string | null;
}

export function useIntegracaoHealthCheck(integracao: string) {
  const queryClient = useQueryClient();

  const history = useQuery({
    queryKey: ['integracoes-health-checks', integracao],
    queryFn: async (): Promise<HealthCheckRecord[]> => {
      const { data, error } = await supabase
        .from('integracoes_health_checks')
        .select('*')
        .eq('integracao', integracao)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as unknown as HealthCheckRecord[];
    },
  });

  const testNow = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('cron-integracoes-health-check', {
        body: { integracao },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const result = data?.results?.[integracao];
      toast({
        title: result?.conexao_ok ? '✅ Conexão OK' : '❌ Falha na conexão',
        description: result?.conexao_ok
          ? `Respondeu em ${result?.tempo_resposta_ms || 0}ms`
          : result?.erro_mensagem || 'Erro desconhecido',
        variant: result?.conexao_ok ? 'default' : 'destructive',
      });
      queryClient.invalidateQueries({ queryKey: ['integracoes-health-checks', integracao] });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao testar', description: err.message, variant: 'destructive' });
    },
  });

  const lastCheck = history.data?.[0] || null;

  return {
    history: history.data || [],
    lastCheck,
    isLoading: history.isLoading,
    testNow,
    refetch: () => history.refetch(),
  };
}

// Hook to get latest check for ALL integrations (used in cards page)
export function useAllLatestHealthChecks() {
  return useQuery({
    queryKey: ['integracoes-health-checks-latest'],
    queryFn: async (): Promise<Record<string, HealthCheckRecord>> => {
      // Get the latest check per integration using a simple approach
      const { data, error } = await supabase
        .from('integracoes_health_checks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      const latest: Record<string, HealthCheckRecord> = {};
      for (const row of (data || []) as unknown as HealthCheckRecord[]) {
        if (!latest[row.integracao]) {
          latest[row.integracao] = row;
        }
      }
      return latest;
    },
    staleTime: 60000,
  });
}
