import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SyncStats {
  softruck: {
    total: number;
    sincronizados: number;
    pendentes: number;
    falhas: number;
  };
  rede_veiculos: {
    total: number;
    sincronizados: number;
    pendentes: number;
  };
}

async function fetchSyncStats(): Promise<SyncStats> {
  // Softruck — instalados
  const { data: softruckRows } = await supabase
    .from('rastreadores')
    .select('id, plataforma_device_id, softruck_integration_status', { count: 'exact' })
    .eq('plataforma', 'softruck')
    .eq('status', 'instalado');

  const softruckTotal = softruckRows?.length || 0;
  const softruckSincronizados = (softruckRows || []).filter(
    (r: any) => r.plataforma_device_id && r.softruck_integration_status === 'SUCCESS'
  ).length;
  const softruckFalhas = (softruckRows || []).filter(
    (r: any) =>
      r.softruck_integration_status &&
      r.softruck_integration_status.startsWith('FAILED')
  ).length;
  const softruckPendentes = softruckTotal - softruckSincronizados - softruckFalhas;

  // Rede Veículos — instalados; checa via veiculo.rede_veiculos_veiculo_id
  const { data: rvRows } = await supabase
    .from('rastreadores')
    .select('id, veiculo_id, plataforma_device_id, veiculos:veiculo_id(rede_veiculos_veiculo_id)')
    .eq('plataforma', 'rede_veiculos')
    .eq('status', 'instalado');

  const rvTotal = rvRows?.length || 0;
  const rvSincronizados = (rvRows || []).filter(
    (r: any) => r.veiculos?.rede_veiculos_veiculo_id || r.plataforma_device_id
  ).length;
  const rvPendentes = rvTotal - rvSincronizados;

  return {
    softruck: {
      total: softruckTotal,
      sincronizados: softruckSincronizados,
      pendentes: Math.max(0, softruckPendentes),
      falhas: softruckFalhas,
    },
    rede_veiculos: {
      total: rvTotal,
      sincronizados: rvSincronizados,
      pendentes: Math.max(0, rvPendentes),
    },
  };
}

export function useRastreadoresSyncStatus() {
  return useQuery({
    queryKey: ['rastreadores-sync-status'],
    queryFn: fetchSyncStats,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useRastreadoresSyncActions() {
  const qc = useQueryClient();

  const softruckBackfill = useMutation({
    mutationFn: async (opts: { limit?: number; incluirFalhas?: boolean } = {}) => {
      const { data, error } = await supabase.functions.invoke('softruck-backfill-veiculos', {
        body: { limit: opts.limit ?? 50, incluirFalhas: opts.incluirFalhas ?? false },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha no backfill');
      return data;
    },
    onSuccess: (data) => {
      toast.success(
        `Softruck: ${data.sucessos} sincronizado(s), ${data.falhas} falha(s) (de ${data.total_processados})`
      );
      qc.invalidateQueries({ queryKey: ['rastreadores-sync-status'] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao executar backfill Softruck'),
  });

  const redeVeiculosBackfill = useMutation({
    mutationFn: async (opts: { limit?: number } = {}) => {
      const { data, error } = await supabase.functions.invoke('rede-veiculos-backfill-veiculos', {
        body: { limit: opts.limit ?? 30 },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha no backfill');
      return data;
    },
    onSuccess: (data) => {
      toast.success(
        `Rede Veículos: ${data.sucessos} sincronizado(s), ${data.falhas} falha(s) (de ${data.total_processados})`
      );
      qc.invalidateQueries({ queryKey: ['rastreadores-sync-status'] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao executar backfill Rede Veículos'),
  });

  const recriarSoftruck = useMutation({
    mutationFn: async (opts: { dryRun?: boolean; deletarAntigos?: boolean } = {}) => {
      const { data, error } = await supabase.functions.invoke(
        'softruck-recriar-veiculos-enterprise-correta',
        { body: { dryRun: opts.dryRun ?? false, deletarAntigos: opts.deletarAntigos ?? true } }
      );
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Falha ao migrar');
      return data;
    },
    onSuccess: (data) => {
      if (data.dryRun) {
        toast.info(`Simulação: ${data.a_migrar?.length || 0} veículo(s) seriam migrados`);
      } else {
        toast.success(
          `Migrados ${data.total_migrados || 0} veículo(s); ${data.total_falhas || 0} falha(s)`
        );
      }
      qc.invalidateQueries({ queryKey: ['rastreadores-sync-status'] });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao migrar veículos'),
  });

  return { softruckBackfill, redeVeiculosBackfill, recriarSoftruck };
}
