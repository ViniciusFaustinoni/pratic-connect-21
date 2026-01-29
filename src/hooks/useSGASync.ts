import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { StatusSGA } from '@/components/cadastro/BotaoAtivarSGA';

interface UseSGASyncOptions {
  veiculoId: string;
  associadoId: string;
  onSuccess?: (data: SyncResult) => void;
  onError?: (error: Error) => void;
}

interface SyncResult {
  success: boolean;
  codigo_associado_hinova?: number;
  codigo_veiculo_hinova?: number;
  fotos_enviadas?: number;
  fotos_com_erro?: string[];
}

interface SyncLog {
  id: string;
  created_at: string;
  action: string;
  status: string;
  error_message?: string | null;
  duracao_ms?: number | null;
}

interface VeiculoSGAData {
  id: string;
  placa: string | null;
  status: string | null;
  status_sga: string | null;
  codigo_hinova: number | null;
  sincronizado_hinova: boolean | null;
  sincronizado_hinova_em: string | null;
  associado_id: string | null;
}

export function useSGASync({
  veiculoId,
  associadoId,
  onSuccess,
  onError,
}: UseSGASyncOptions) {
  const queryClient = useQueryClient();

  // Query para buscar dados do veículo
  const veiculoQuery = useQuery({
    queryKey: ['veiculo-sga', veiculoId],
    queryFn: async (): Promise<VeiculoSGAData | null> => {
      const { data, error } = await supabase
        .from('veiculos')
        .select(`
          id,
          placa,
          status,
          status_sga,
          codigo_hinova,
          sincronizado_hinova,
          sincronizado_hinova_em,
          associado_id
        `)
        .eq('id', veiculoId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!veiculoId,
  });

  // Query para buscar logs
  const logsQuery = useQuery({
    queryKey: ['sga-logs', veiculoId],
    queryFn: async (): Promise<SyncLog[]> => {
      const { data, error } = await supabase
        .from('sga_sync_logs')
        .select('id, created_at, action, status, error_message, duracao_ms')
        .eq('veiculo_id', veiculoId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data as SyncLog[]) || [];
    },
    enabled: !!veiculoId,
  });

  // Mutation para sincronizar
  const syncMutation = useMutation({
    mutationFn: async (): Promise<SyncResult> => {
      const { data, error } = await supabase.functions.invoke('sga-hinova-sync', {
        body: {
          veiculo_id: veiculoId,
          associado_id: associadoId,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro na sincronização');
      
      return data.data as SyncResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['veiculo-sga', veiculoId] });
      queryClient.invalidateQueries({ queryKey: ['sga-logs', veiculoId] });
      onSuccess?.(data);
    },
    onError: (err) => {
      queryClient.invalidateQueries({ queryKey: ['veiculo-sga', veiculoId] });
      onError?.(err as Error);
    },
  });

  // Verificar se pode sincronizar
  const canSync = useMemo(() => {
    const veiculo = veiculoQuery.data;
    if (!veiculo) return false;
    if (veiculo.sincronizado_hinova) return false;
    if (veiculo.status_sga === 'sincronizando') return false;

    // Veículo deve estar aprovado ou ativo
    const statusOk = ['aprovado', 'ativo'].includes(veiculo.status || '');

    return statusOk;
  }, [veiculoQuery.data]);

  // Status atual
  const statusSGA: StatusSGA = useMemo(() => {
    if (syncMutation.isPending) return 'sincronizando';
    
    const veiculo = veiculoQuery.data;
    if (!veiculo) return 'pendente';
    
    if (veiculo.sincronizado_hinova) return 'ativado_sga';
    if (veiculo.status_sga === 'erro_sincronizacao') return 'erro_sincronizacao';
    if (veiculo.status_sga === 'sincronizando') return 'sincronizando';
    
    return 'pendente';
  }, [veiculoQuery.data, syncMutation.isPending]);

  return {
    // Estado
    status: syncMutation.status,
    statusSGA,
    isLoading: syncMutation.isPending || veiculoQuery.isLoading,
    isSynced: veiculoQuery.data?.sincronizado_hinova || false,
    canSync,
    error: syncMutation.error?.message || null,
    syncResult: syncMutation.data || null,

    // Dados
    veiculoData: veiculoQuery.data,
    codigoHinova: veiculoQuery.data?.codigo_hinova,
    sincronizadoEm: veiculoQuery.data?.sincronizado_hinova_em,
    logs: logsQuery.data || [],
    isLoadingLogs: logsQuery.isLoading,

    // Ações
    sync: syncMutation.mutateAsync,
    retry: syncMutation.mutateAsync,
    refetch: () => {
      veiculoQuery.refetch();
      logsQuery.refetch();
    },
  };
}
