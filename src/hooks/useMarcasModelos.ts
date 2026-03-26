import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MarcaModelo {
  id: string;
  marca: string;
  modelo: string | null;
  ativo: boolean;
  created_at: string;
}

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
