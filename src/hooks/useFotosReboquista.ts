import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface FotoReboquista {
  id: string;
  chamado_id: string;
  arquivo_url: string;
  momento: string | null;
  observacao: string | null;
  uploaded_by: string;
  created_at: string;
  uploader_nome?: string;
}

// Busca fotos de um chamado
export function useFotosReboquista(chamadoId: string | undefined) {
  return useQuery({
    queryKey: ['fotos-reboquista', chamadoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fotos_reboquista' as any)
        .select('*, uploader:profiles!fotos_reboquista_uploaded_by_fkey(nome)')
        .eq('chamado_id', chamadoId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data as any[]).map((f) => ({
        ...f,
        uploader_nome: f.uploader?.nome || 'Desconhecido',
      })) as FotoReboquista[];
    },
    enabled: !!chamadoId,
  });
}

// Busca fotos via sinistro (chamado_assistencia_id ou chamado_origem_id)
export function useFotosReboquistaBySinistro(sinistro: any) {
  const chamadoId = sinistro?.chamado_assistencia_id || sinistro?.chamado_origem_id;
  return useFotosReboquista(chamadoId);
}

// Upload de fotos
export function useAddFotoReboquista() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      chamadoId,
      files,
      momento,
      observacao,
    }: {
      chamadoId: string;
      files: File[];
      momento: string;
      observacao: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const results = [];
      for (const file of files) {
        const ext = file.name.split('.').pop();
        const path = `${user.id}/${chamadoId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('fotos-reboquista')
          .upload(path, file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('fotos-reboquista')
          .getPublicUrl(path);

        const { data, error } = await supabase
          .from('fotos_reboquista' as any)
          .insert({
            chamado_id: chamadoId,
            arquivo_url: urlData.publicUrl,
            momento: momento || null,
            observacao: observacao || null,
            uploaded_by: user.id,
          } as any)
          .select()
          .single();
        if (error) throw error;
        results.push(data);
      }
      return results;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['fotos-reboquista', vars.chamadoId] });
      toast.success('Fotos enviadas com sucesso!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao enviar fotos');
    },
  });
}

// Deletar foto
export function useDeleteFotoReboquista() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, arquivoUrl, chamadoId }: { id: string; arquivoUrl: string; chamadoId: string }) => {
      // Extrair path do storage a partir da URL pública
      const urlParts = arquivoUrl.split('/fotos-reboquista/');
      if (urlParts.length > 1) {
        await supabase.storage.from('fotos-reboquista').remove([urlParts[1]]);
      }

      const { error } = await supabase
        .from('fotos_reboquista' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
      return chamadoId;
    },
    onSuccess: (chamadoId) => {
      queryClient.invalidateQueries({ queryKey: ['fotos-reboquista', chamadoId] });
      toast.success('Foto excluída');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao excluir foto');
    },
  });
}
