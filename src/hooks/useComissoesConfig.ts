import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ComissaoConfig, ComissaoConfigFormData } from '@/types/comissoes';

export function useComissoesConfig() {
  const queryClient = useQueryClient();

  const { data: configs, isLoading } = useQuery({
    queryKey: ['comissoes-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissoes_config')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ComissaoConfig[];
    },
  });

  const { data: configsAtivas } = useQuery({
    queryKey: ['comissoes-config-ativas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissoes_config')
        .select('*')
        .eq('ativo', true)
        .order('tipo_vendedor');

      if (error) throw error;
      return data as ComissaoConfig[];
    },
  });

  const createConfig = useMutation({
    mutationFn: async (formData: ComissaoConfigFormData) => {
      const { data, error } = await supabase
        .from('comissoes_config')
        .insert([formData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comissoes-config'] });
      toast.success('Regra de comissão criada com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar regra: ' + error.message);
    },
  });

  const updateConfig = useMutation({
    mutationFn: async ({ id, ...formData }: ComissaoConfigFormData & { id: string }) => {
      const { data, error } = await supabase
        .from('comissoes_config')
        .update(formData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comissoes-config'] });
      toast.success('Regra de comissão atualizada');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar regra: ' + error.message);
    },
  });

  const deleteConfig = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('comissoes_config')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comissoes-config'] });
      toast.success('Regra de comissão removida');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover regra: ' + error.message);
    },
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('comissoes_config')
        .update({ ativo })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comissoes-config'] });
      toast.success('Status atualizado');
    },
  });

  return {
    configs,
    configsAtivas,
    isLoading,
    createConfig,
    updateConfig,
    deleteConfig,
    toggleAtivo,
  };
}
