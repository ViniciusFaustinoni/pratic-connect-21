import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export type Plataforma = 'softruck' | 'rede_veiculos';

export interface RastSyncQueueItem {
  id: string;
  rastreador_id: string | null;
  veiculo_id: string | null;
  associado_id: string | null;
  plataforma: Plataforma;
  operacao: string;
  status: string;
  tentativas: number | null;
  max_tentativas: number | null;
  etapa_parou: string | null;
  erro_ultimo: string | null;
  payload: any;
  response_ultimo: any;
  created_at: string;
  ultima_tentativa_em: string | null;
  proximo_reenvio_em: string | null;
  concluido_em: string | null;
  // joined
  imei?: string | null;
  veiculo_placa?: string | null;
  associado_nome?: string | null;
}

export function useRastreadoresSyncQueue(plataforma: Plataforma) {
  const qc = useQueryClient();

  const queue = useQuery({
    queryKey: ['rast-sync-queue', plataforma],
    queryFn: async (): Promise<RastSyncQueueItem[]> => {
      const { data, error } = await (supabase as any)
        .from('rastreadores_sync_queue')
        .select('*, rastreador:rastreadores!rastreadores_sync_queue_rastreador_id_fkey(imei)')
        .eq('plataforma', plataforma)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = data || [];
      const veicIds = Array.from(new Set(rows.map((r: any) => r.veiculo_id).filter(Boolean)));
      const assocIds = Array.from(new Set(rows.map((r: any) => r.associado_id).filter(Boolean)));
      const [veicRes, assocRes] = await Promise.all([
        veicIds.length ? (supabase as any).from('veiculos').select('id, placa').in('id', veicIds) : Promise.resolve({ data: [] }),
        assocIds.length ? (supabase as any).from('associados').select('id, nome').in('id', assocIds) : Promise.resolve({ data: [] }),
      ]);
      const veicMap = new Map((veicRes.data || []).map((v: any) => [v.id, v.placa]));
      const assocMap = new Map((assocRes.data || []).map((a: any) => [a.id, a.nome]));
      return rows.map((r: any) => ({
        ...r,
        imei: r.rastreador?.imei,
        veiculo_placa: veicMap.get(r.veiculo_id) || null,
        associado_nome: assocMap.get(r.associado_id) || null,
      }));
    },
  });

  const counts = useQuery({
    queryKey: ['rast-sync-queue-counts', plataforma],
    queryFn: async () => {
      const statuses = ['pendente', 'falha', 'falha_permanente'] as const;
      const [tot, ...rest] = await Promise.all([
        (supabase as any).from('rastreadores_sync_queue').select('id', { count: 'exact', head: true }).eq('plataforma', plataforma),
        ...statuses.map((s) =>
          (supabase as any).from('rastreadores_sync_queue').select('id', { count: 'exact', head: true }).eq('plataforma', plataforma).eq('status', s),
        ),
      ]);
      return {
        total: tot.count || 0,
        pendente: rest[0].count || 0,
        falha: rest[1].count || 0,
        falha_permanente: rest[2].count || 0,
      };
    },
  });

  const logs = useQuery({
    queryKey: ['rast-api-logs', plataforma],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('rastreadores_api_logs')
        .select('id, created_at, operacao, status, erro_mensagem, duracao_ms, plataforma')
        .eq('plataforma', plataforma)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const pendentes = useQuery({
    queryKey: ['rast-pendentes-vinculo', plataforma],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('rastreadores_pendentes_vinculo')
        .select('*')
        .eq('plataforma', plataforma)
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const health = useQuery({
    queryKey: ['rast-sync-health', plataforma],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('rastreadores_sync_health_checks')
        .select('*')
        .eq('plataforma', plataforma)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const reprocess = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('rastreadores-sync-worker', {
        body: { action: 'reprocess', id },
      });
      if (error) throw error;
      if (!data?.success && data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Reprocessamento disparado' });
      qc.invalidateQueries({ queryKey: ['rast-sync-queue', plataforma] });
      qc.invalidateQueries({ queryKey: ['rast-sync-queue-counts', plataforma] });
      qc.invalidateQueries({ queryKey: ['rast-pendentes-vinculo', plataforma] });
    },
    onError: (e: Error) => toast({ title: 'Erro ao reprocessar', description: e.message, variant: 'destructive' }),
  });

  const discard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.functions.invoke('rastreadores-sync-worker', {
        body: { action: 'discard', id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Item descartado' });
      qc.invalidateQueries({ queryKey: ['rast-sync-queue', plataforma] });
      qc.invalidateQueries({ queryKey: ['rast-sync-queue-counts', plataforma] });
    },
  });

  const enqueue = useMutation({
    mutationFn: async (rastreador_id: string) => {
      const { data, error } = await supabase.functions.invoke('rastreadores-sync-worker', {
        body: { action: 'enqueue', rastreador_id, plataforma },
      });
      if (error) throw error;
      if (!data?.success && data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Enfileirado para sincronização' });
      qc.invalidateQueries({ queryKey: ['rast-sync-queue', plataforma] });
      qc.invalidateQueries({ queryKey: ['rast-pendentes-vinculo', plataforma] });
    },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const testConnection = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('rastreadores-sync-worker', {
        body: { action: 'health_check', plataforma },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast({
        title: d?.ok ? 'Conexão OK' : 'Falha na conexão',
        description: d?.ok ? `Resposta em ${d?.tempo_ms}ms` : (d?.error || 'Erro desconhecido'),
        variant: d?.ok ? 'default' : 'destructive',
      });
      qc.invalidateQueries({ queryKey: ['rast-sync-health', plataforma] });
    },
  });

  const refetchAll = () => {
    queue.refetch();
    counts.refetch();
    logs.refetch();
    pendentes.refetch();
    health.refetch();
  };

  return {
    queue: queue.data || [],
    counts: counts.data || { total: 0, pendente: 0, falha: 0, falha_permanente: 0 },
    logs: logs.data || [],
    pendentes: pendentes.data || [],
    health: health.data || [],
    isLoading: queue.isLoading,
    reprocess,
    discard,
    enqueue,
    testConnection,
    refetchAll,
  };
}
