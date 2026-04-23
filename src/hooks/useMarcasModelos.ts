import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type TipoVeiculo = 'carro' | 'moto' | 'caminhao' | 'onibus' | 'utilitario' | 'outros';

export interface MarcaModelo {
  id: string;
  marca: string;
  modelo: string | null;
  ativo: boolean;
  tipo_veiculo: TipoVeiculo | null;
  created_at: string;
}

export const TIPO_VEICULO_LABELS: Record<TipoVeiculo, string> = {
  carro: 'Carro',
  moto: 'Moto',
  caminhao: 'Caminhão',
  onibus: 'Ônibus',
  utilitario: 'Utilitário',
  outros: 'Outros',
};

export function useMarcasModelos() {
  return useQuery({
    queryKey: ['marcas_modelos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marcas_modelos')
        .select('*')
        .order('marca')
        .order('modelo');
      if (error) throw error;
      return data as MarcaModelo[];
    },
  });
}

export function useCreateMarcaModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { marca: string; modelo?: string }) => {
      const { error } = await supabase.from('marcas_modelos').insert(input);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marcas_modelos'] }); toast.success('Salvo'); },
    onError: () => toast.error('Erro ao salvar'),
  });
}

export function useToggleMarcaModelo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('marcas_modelos').update({ ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marcas_modelos'] }),
  });
}

export function useMarcasDistintas(tipo?: TipoVeiculo | null) {
  return useQuery({
    queryKey: ['marcas_distintas', tipo ?? 'all'],
    queryFn: async () => {
      const all: string[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        let q = supabase
          .from('marcas_modelos')
          .select('marca')
          .eq('ativo', true)
          .order('marca')
          .range(from, from + pageSize - 1);
        if (tipo) q = q.eq('tipo_veiculo', tipo);
        const { data, error } = await q;
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data.map(d => d.marca));
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return [...new Set(all)].sort();
    },
  });
}

export function useTiposVeiculo() {
  return useQuery({
    queryKey: ['tipos_veiculo_distintos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marcas_modelos')
        .select('tipo_veiculo')
        .eq('ativo', true)
        .not('tipo_veiculo', 'is', null);
      if (error) throw error;
      const set = new Set<TipoVeiculo>();
      (data ?? []).forEach((d: any) => d.tipo_veiculo && set.add(d.tipo_veiculo));
      return Array.from(set).sort();
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useModelosPorMarca(marca: string) {
  return useQuery({
    queryKey: ['modelos_por_marca', marca],
    enabled: !!marca,
    queryFn: async () => {
      const all: string[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('marcas_modelos')
          .select('modelo')
          .eq('marca', marca)
          .eq('ativo', true)
          .not('modelo', 'is', null)
          .order('modelo')
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data.filter(d => d.modelo).map(d => d.modelo as string));
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return [...new Set(all)].sort();
    },
  });
}

export function useBulkInsertMarcasModelos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { marca: string; modelo?: string }[]) => {
      const { error } = await supabase.from('marcas_modelos').insert(items);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['marcas_modelos'] }); toast.success('Importação concluída'); },
    onError: () => toast.error('Erro na importação'),
  });
}
