import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CotacaoVistoriaFoto {
  id: string;
  cotacao_id: string;
  tipo: string;
  arquivo_url: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

// Hook para buscar fotos existentes da vistoria
export function useFotosCotacaoVistoria(cotacaoId: string | undefined) {
  return useQuery({
    queryKey: ['cotacao-vistoria-fotos', cotacaoId],
    queryFn: async (): Promise<CotacaoVistoriaFoto[]> => {
      if (!cotacaoId) return [];
      
      const { data, error } = await supabase
        .from('cotacoes_vistoria_fotos')
        .select('*')
        .eq('cotacao_id', cotacaoId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Erro ao buscar fotos da vistoria:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!cotacaoId,
  });
}

interface UploadFotoParams {
  cotacaoId: string;
  fotoId: string;
  file: File;
  latitude?: number;
  longitude?: number;
}

interface UploadFotoResult {
  fotoId: string;
  url: string;
  kmExtraido: number | null;
}

// Hook para upload de foto da autovistoria
export function useUploadFotoCotacaoVistoria() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ cotacaoId, fotoId, file, latitude, longitude }: UploadFotoParams): Promise<UploadFotoResult> => {
      const fileName = `cotacoes/${cotacaoId}/vistoria/${fotoId}_${Date.now()}.${file.name.split('.').pop()}`;
      
      // Upload do arquivo para storage
      const { error: uploadError } = await supabase.storage
        .from('cotacoes-docs')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        throw new Error('Falha ao enviar foto');
      }
      
      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('cotacoes-docs')
        .getPublicUrl(fileName);
      
      const publicUrl = urlData.publicUrl;
      
      // Persistir/atualizar em cotacoes_vistoria_fotos (upsert por cotacao_id + tipo)
      const { error: dbError } = await supabase
        .from('cotacoes_vistoria_fotos')
        .upsert(
          { 
            cotacao_id: cotacaoId, 
            tipo: fotoId, 
            arquivo_url: publicUrl,
            latitude: latitude || null,
            longitude: longitude || null,
          },
          { onConflict: 'cotacao_id,tipo' }
        );
      
      if (dbError) {
        console.error('Erro ao salvar foto no banco:', dbError);
        throw new Error('Falha ao registrar foto');
      }
      
      // Se for foto do odômetro, extrair quilometragem via IA
      let kmExtraido: number | null = null;
      if (fotoId === 'odometro') {
        try {
          const { data: ocrResult, error: ocrError } = await supabase.functions.invoke('odometro-ocr', {
            body: { url: publicUrl }
          });
          
          if (!ocrError && ocrResult?.km && ocrResult.confianca >= 0.7) {
            kmExtraido = ocrResult.km;
            console.log('KM extraído do odômetro:', kmExtraido);
          }
        } catch (error) {
          console.error('Erro ao extrair km do odômetro:', error);
        }
      }
      
      return { fotoId, url: publicUrl, kmExtraido };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cotacao-vistoria-fotos', variables.cotacaoId] });
    },
    onError: (error) => {
      console.error('Erro no upload da foto:', error);
      toast.error('Falha ao enviar foto. Tente novamente.');
    },
  });
}

interface FinalizarVistoriaParams {
  cotacaoId: string;
  tipoVistoria: 'autovistoria' | 'agendada';
}

// Hook para finalizar vistoria
export function useFinalizarVistoriaCotacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ cotacaoId, tipoVistoria }: FinalizarVistoriaParams) => {
      const { error } = await supabase
        .from('cotacoes')
        .update({
          tipo_vistoria: tipoVistoria,
          vistoria_concluida_em: new Date().toISOString(),
          status_contratacao: 'vistoria_ok',
        })
        .eq('id', cotacaoId);
      
      if (error) throw error;
      
      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cotacao-contratacao'] });
      queryClient.invalidateQueries({ queryKey: ['cotacao-vistoria-fotos', variables.cotacaoId] });
      toast.success('Vistoria concluída com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao finalizar vistoria:', error);
      toast.error('Erro ao finalizar vistoria');
    },
  });
}
