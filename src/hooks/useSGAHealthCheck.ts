import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// ── Types ──────────────────────────────────────────
export interface SGAHealthCheck {
  id: string;
  created_at: string;
  conexao_ok: boolean;
  tempo_resposta_ms: number | null;
  fila_pendentes: number;
  fila_falhas: number;
  veiculos_nao_sincronizados: number;
  erro_mensagem: string | null;
}

export interface SGAQueueItem {
  id: string;
  associado_id: string;
  veiculo_id: string;
  status: string | null;
  tentativas: number | null;
  etapa_parou: string | null;
  erro_ultimo: string | null;
  created_at: string | null;
  ultima_tentativa_em: string | null;
  proximo_reenvio_em: string | null;
  // Joined
  associado_nome?: string;
  veiculo_placa?: string;
}

export interface SGASyncLog {
  id: string;
  created_at: string | null;
  action: string;
  status: string;
  error_message: string | null;
  duracao_ms: number | null;
  veiculo_id: string | null;
  associado_id: string | null;
}

// ── Hook ──────────────────────────────────────────
export function useSGAHealthCheck() {
  const queryClient = useQueryClient();

  // Health checks history
  const healthChecks = useQuery({
    queryKey: ['sga-health-checks'],
    queryFn: async (): Promise<SGAHealthCheck[]> => {
      const { data, error } = await supabase
        .from('sga_health_checks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as SGAHealthCheck[];
    },
  });

  // Sync queue
  const queue = useQuery({
    queryKey: ['sga-sync-queue'],
    queryFn: async (): Promise<SGAQueueItem[]> => {
      const { data, error } = await supabase
        .from('sga_sync_queue')
        .select(`
          id, associado_id, veiculo_id, status, tentativas,
          etapa_parou, erro_ultimo, created_at,
          ultima_tentativa_em, proximo_reenvio_em,
          associados!sga_sync_queue_associado_id_fkey(nome),
          veiculos!sga_sync_queue_veiculo_id_fkey(placa)
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []).map((item: any) => ({
        ...item,
        associado_nome: item.associados?.nome || '—',
        veiculo_placa: item.veiculos?.placa || '—',
      }));
    },
  });

  // Recent logs
  const logs = useQuery({
    queryKey: ['sga-sync-logs-recent'],
    queryFn: async (): Promise<SGASyncLog[]> => {
      const { data, error } = await supabase
        .from('sga_sync_logs')
        .select('id, created_at, action, status, error_message, duracao_ms, veiculo_id, associado_id')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as SGASyncLog[];
    },
  });

  // Pending vehicles (active but not synced)
  const pendingVehicles = useQuery({
    queryKey: ['sga-veiculos-pendentes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('veiculos')
        .select('id, placa, status, associado_id, associados!veiculos_associado_id_fkey(nome)')
        .eq('status', 'ativo')
        .eq('sincronizado_hinova', false)
        .limit(100);
      if (error) throw error;
      return (data || []).map((v: any) => ({
        ...v,
        associado_nome: v.associados?.nome || '—',
      }));
    },
  });

  // Test connection
  const testConnection = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sga-hinova-sync', {
        body: { action: 'test_connection' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: data?.success ? 'Conexão OK' : 'Falha na conexão',
        description: data?.success
          ? `API respondeu em ${data?.tempo_ms || '?'}ms`
          : data?.error || 'Erro desconhecido',
        variant: data?.success ? 'default' : 'destructive',
      });
      queryClient.invalidateQueries({ queryKey: ['sga-health-checks'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao testar', description: err.message, variant: 'destructive' });
    },
  });

  // Reprocess queue item
  const reprocess = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sga_sync_queue')
        .update({
          status: 'pendente',
          tentativas: 0,
          proximo_reenvio_em: new Date().toISOString(),
          erro_ultimo: null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Item reenfileirado com sucesso' });
      queryClient.invalidateQueries({ queryKey: ['sga-sync-queue'] });
    },
  });

  // Discard queue item (permanent failure)
  const discard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sga_sync_queue')
        .update({ status: 'falha_permanente' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Item marcado como falha permanente' });
      queryClient.invalidateQueries({ queryKey: ['sga-sync-queue'] });
    },
  });

  // Trigger sync for a pending vehicle
  const triggerSync = useMutation({
    mutationFn: async ({ veiculoId, associadoId }: { veiculoId: string; associadoId: string }) => {
      const { data, error } = await supabase.functions.invoke('sga-hinova-sync', {
        body: { veiculo_id: veiculoId, associado_id: associadoId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Sincronização iniciada' });
      queryClient.invalidateQueries({ queryKey: ['sga-veiculos-pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['sga-sync-queue'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Erro ao sincronizar', description: err.message, variant: 'destructive' });
    },
  });

  const refetchAll = () => {
    healthChecks.refetch();
    queue.refetch();
    logs.refetch();
    pendingVehicles.refetch();
  };

  return {
    healthChecks: healthChecks.data || [],
    queue: queue.data || [],
    logs: logs.data || [],
    pendingVehicles: pendingVehicles.data || [],
    isLoading: healthChecks.isLoading || queue.isLoading,
    testConnection,
    reprocess,
    discard,
    triggerSync,
    refetchAll,
  };
}
