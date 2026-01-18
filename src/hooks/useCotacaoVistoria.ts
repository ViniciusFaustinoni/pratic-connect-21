import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CotacaoVistoriaFoto {
  id: string;
  cotacao_id: string;
  tipo: string;
  url: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
}

export function useFotosCotacaoVistoria(cotacaoId: string | null) {
  return useQuery({
    queryKey: ['cotacao-vistoria-fotos', cotacaoId],
    queryFn: async () => {
      if (!cotacaoId) return [];
      const { data, error } = await supabase
        .from('cotacoes_vistoria_fotos')
        .select('*')
        .eq('cotacao_id', cotacaoId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as CotacaoVistoriaFoto[];
    },
    enabled: !!cotacaoId
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
  quilometragem?: number;
}

export function useUploadFotoCotacaoVistoria() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ cotacaoId, fotoId, file, latitude, longitude }: UploadFotoParams): Promise<UploadFotoResult> => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${cotacaoId}/${fotoId}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('cotacoes-vistoria')
        .upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('cotacoes-vistoria')
        .getPublicUrl(fileName);
      const url = urlData.publicUrl;
      
      const { error: dbError } = await supabase
        .from('cotacoes_vistoria_fotos')
        .upsert({ cotacao_id: cotacaoId, tipo: fotoId, url, latitude, longitude }, { onConflict: 'cotacao_id,tipo' });
      if (dbError) throw dbError;
      
      let quilometragem: number | undefined;
      if (fotoId === 'odometro') {
        try {
          const { data: ocrData } = await supabase.functions.invoke('odometro-ocr', { body: { imageUrl: url } });
          if (ocrData?.quilometragem) quilometragem = ocrData.quilometragem;
        } catch (e) { console.warn('OCR falhou:', e); }
      }
      return { fotoId, url, quilometragem };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cotacao-vistoria-fotos', variables.cotacaoId] });
      toast.success('Foto enviada com sucesso!');
    },
    onError: () => toast.error('Erro ao enviar foto')
  });
}

export interface FinalizarVistoriaParams {
  cotacaoId: string;
  tipoVistoria: 'autovistoria' | 'agendada';
  dataAgendada?: string;
  horarioAgendado?: string;
  endereco?: { cep: string; logradouro: string; numero: string; bairro: string; cidade: string; estado: string; };
  responsavel?: { euMesmo: boolean; nome?: string; telefone?: string; };
}

export function useFinalizarVistoriaCotacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ cotacaoId, tipoVistoria, dataAgendada, horarioAgendado, endereco, responsavel }: FinalizarVistoriaParams) => {
      const updateData: Record<string, unknown> = {
        tipo_vistoria: tipoVistoria,
        vistoria_concluida_em: new Date().toISOString(),
        status_contratacao: 'vistoria_ok'
      };
      
      if (tipoVistoria === 'agendada' && endereco && responsavel) {
        updateData.vistoria_data_agendada = dataAgendada;
        updateData.vistoria_horario_agendado = horarioAgendado;
        updateData.vistoria_endereco_cep = endereco.cep;
        updateData.vistoria_endereco_logradouro = endereco.logradouro;
        updateData.vistoria_endereco_numero = endereco.numero;
        updateData.vistoria_endereco_bairro = endereco.bairro;
        updateData.vistoria_endereco_cidade = endereco.cidade;
        updateData.vistoria_endereco_estado = endereco.estado;
        updateData.vistoria_responsavel_eu_mesmo = responsavel.euMesmo;
        updateData.vistoria_responsavel_nome = responsavel.nome || null;
        updateData.vistoria_responsavel_telefone = responsavel.telefone || null;
      }
      
      const { error } = await supabase.from('cotacoes').update(updateData).eq('id', cotacaoId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cotacao', variables.cotacaoId] });
      queryClient.invalidateQueries({ queryKey: ['cotacao-publica'] });
      toast.success(variables.tipoVistoria === 'agendada' ? 'Vistoria agendada!' : 'Vistoria enviada!');
    },
    onError: () => toast.error('Erro ao finalizar vistoria')
  });
}
