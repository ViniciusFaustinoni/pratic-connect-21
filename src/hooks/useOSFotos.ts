import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { OrdemServicoFoto, TipoFotoOS } from '@/types/database';

export function useOSFotos(osId: string | undefined) {
  return useQuery({
    queryKey: ['os_fotos', osId],
    queryFn: async () => {
      if (!osId) return [];
      const { data, error } = await supabase
        .from('ordens_servico_fotos')
        .select('*')
        .eq('ordem_servico_id', osId)
        .order('created_at');
      if (error) throw error;
      return data as OrdemServicoFoto[];
    },
    enabled: !!osId,
  });
}

export function useAddOSFoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      ordem_servico_id,
      tipo,
      arquivo,
      descricao,
    }: {
      ordem_servico_id: string;
      tipo: TipoFotoOS;
      arquivo: File;
      descricao?: string;
    }) => {
      // Upload file to storage
      const fileExt = arquivo.name.split('.').pop();
      const fileName = `${ordem_servico_id}/${tipo}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('ordens-servico')
        .upload(fileName, arquivo);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('ordens-servico')
        .getPublicUrl(fileName);

      // Insert record
      const { data, error } = await supabase
        .from('ordens_servico_fotos')
        .insert({
          ordem_servico_id,
          tipo,
          arquivo_url: urlData.publicUrl,
          descricao,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['os_fotos', data.ordem_servico_id] });
      toast.success('Foto adicionada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao adicionar foto: ' + error.message);
    },
  });
}

export function useDeleteOSFoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ordem_servico_id, arquivo_url }: { id: string; ordem_servico_id: string; arquivo_url: string }) => {
      // Extract file path from URL
      const urlParts = arquivo_url.split('/ordens-servico/');
      if (urlParts.length > 1) {
        await supabase.storage.from('ordens-servico').remove([urlParts[1]]);
      }

      const { error } = await supabase
        .from('ordens_servico_fotos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { ordem_servico_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['os_fotos', data.ordem_servico_id] });
      toast.success('Foto removida!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover foto: ' + error.message);
    },
  });
}
