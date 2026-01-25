import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AssinaturaTipo = 'instalacao' | 'vistoria' | 'servico';

export function useSaveAssinatura() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      signatureBlob,
      tipo = 'instalacao', // default para retrocompatibilidade
      // Parâmetro legado - mantido por compatibilidade
      instalacaoId,
    }: {
      id?: string;
      signatureBlob: Blob;
      tipo?: AssinaturaTipo;
      instalacaoId?: string; // legado
    }) => {
      // Suporte a parâmetro legado
      const entityId = id || instalacaoId;
      if (!entityId) throw new Error('ID obrigatório');

      // 1. Upload para storage bucket 'assinaturas'
      const fileName = `${entityId}/assinatura_${Date.now()}.png`;
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

      const publicUrl = urlData.publicUrl;

      // 3. Salvar na tabela correta baseado no tipo
      if (tipo === 'vistoria') {
        // Para vistorias: salvar como foto na tabela vistoria_fotos
        const { error } = await supabase
          .from('vistoria_fotos')
          .insert({
            vistoria_id: entityId,
            tipo: 'assinatura_cliente',
            arquivo_url: publicUrl,
            visivel_cliente: true,
          });
        if (error) throw error;
      } else if (tipo === 'servico') {
        // Para serviços unificados: salvar na tabela servicos
        const { error } = await supabase
          .from('servicos')
          .update({ assinatura_cliente_url: publicUrl })
          .eq('id', entityId);
        if (error) throw error;
        
        // Também salvar na vistoria_fotos se houver vistoria vinculada
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vistoriaResult = await (supabase as any)
          .from('vistorias')
          .select('id')
          .eq('servico_id', entityId)
          .maybeSingle();
        const servicoData = vistoriaResult?.data as { id: string } | null;
        
        if (servicoData?.id) {
          await supabase.from('vistoria_fotos').insert({
            vistoria_id: servicoData.id,
            tipo: 'assinatura_cliente',
            arquivo_url: publicUrl,
            visivel_cliente: true,
          });
        }
      } else {
        // Instalação (legado): salvar na tabela instalacoes
        const { error } = await supabase
          .from('instalacoes')
          .update({ assinatura_cliente_url: publicUrl })
          .eq('id', entityId);
        if (error) throw error;
      }

      return publicUrl;
    },
    onSuccess: (_, variables) => {
      const entityId = variables.id || variables.instalacaoId;
      queryClient.invalidateQueries({ queryKey: ['instalacao-detalhes', entityId] });
      queryClient.invalidateQueries({ queryKey: ['instalador-instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['servico-detalhes', entityId] });
      queryClient.invalidateQueries({ queryKey: ['vistoria-completa', entityId] });
      queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
    },
  });
}
