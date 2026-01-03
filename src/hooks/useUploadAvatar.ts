import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (blob: Blob) => {
      if (!user?.id) throw new Error('Não autenticado');

      const fileName = `${user.id}/avatar.jpg`;
      
      // Upload para o bucket avatars (público)
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { 
          upsert: true,
          contentType: 'image/jpeg'
        });

      if (uploadError) throw uploadError;

      // Gerar URL pública com cache buster
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Atualizar o campo avatar_url no associado
      const { error: updateError } = await supabase
        .from('associados')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      return avatarUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-associado'] });
    },
  });
}

export function useRemoveAvatar() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Não autenticado');

      const fileName = `${user.id}/avatar.jpg`;
      
      // Remover arquivo do storage (ignora erro se não existir)
      await supabase.storage
        .from('avatars')
        .remove([fileName]);

      // Limpar o campo avatar_url no associado
      const { error: updateError } = await supabase
        .from('associados')
        .update({ avatar_url: null })
        .eq('user_id', user.id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-associado'] });
    },
  });
}
