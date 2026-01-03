import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useSaveAssinatura() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      instalacaoId,
      signatureBlob,
    }: {
      instalacaoId: string;
      signatureBlob: Blob;
    }) => {
      // 1. Upload para storage bucket 'assinaturas'
      const fileName = `${instalacaoId}/assinatura_${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('assinaturas')
        .upload(fileName, signatureBlob, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // 2. Obter URL pública
      const { data: urlData } = supabase.storage
        .from('assinaturas')
        .getPublicUrl(fileName);

      // 3. Atualizar instalação com URL da assinatura
      const { error } = await supabase
        .from('instalacoes')
        .update({ assinatura_cliente_url: urlData.publicUrl })
        .eq('id', instalacaoId);

      if (error) throw error;

      return urlData.publicUrl;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['instalacao-detalhes', variables.instalacaoId] });
      queryClient.invalidateQueries({ queryKey: ['instalador-instalacoes'] });
    },
  });
}
