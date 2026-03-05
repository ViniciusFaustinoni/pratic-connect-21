import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { toast } from 'sonner';
import { geocodificarEndereco } from '@/services/geocodingService';

// Interface para resultado da edge function de agendamento presencial
interface AgendarPresencialResponse {
  success: boolean;
  vistoriaId: string | null;
  instalacaoId: string | null;
  error?: string;
  message?: string;
}

export interface CotacaoVistoriaFoto {
  id: string;
  cotacao_id: string;
  tipo: string;
  arquivo_url: string;
  latitude: number | null;
  longitude: number | null;
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
      return (data || []) as CotacaoVistoriaFoto[];
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

export interface UploadFotoResult {
  fotoId: string;
  url: string;
  kmExtraido?: number;
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
        .upsert({
          cotacao_id: cotacaoId,
          tipo: fotoId,
          arquivo_url: url,
          latitude: latitude ?? null,
          longitude: longitude ?? null
        }, { onConflict: 'cotacao_id,tipo' });
      if (dbError) throw dbError;
      
      let kmExtraido: number | undefined;
      if (fotoId === 'odometro') {
        try {
          const { data: ocrData } = await supabase.functions.invoke('odometro-ocr', { body: { url } });
          if (ocrData?.km) kmExtraido = ocrData.km;
        } catch (e) { console.warn('OCR falhou:', e); }
      }
      return { fotoId, url, kmExtraido };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cotacao-vistoria-fotos', variables.cotacaoId] });
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
  permiteEncaixe?: boolean;
}

export function useFinalizarVistoriaCotacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ cotacaoId, tipoVistoria, dataAgendada, horarioAgendado, endereco, responsavel, permiteEncaixe }: FinalizarVistoriaParams) => {
      // FLUXO AGENDADA (sem autovistoria) - usar edge function para criar vistoria E instalacao
      if (tipoVistoria === 'agendada' && endereco && responsavel) {
        // Geocodificar endereço antes de enviar
        const coords = await geocodificarEndereco({
          logradouro: endereco.logradouro,
          numero: endereco.numero,
          bairro: endereco.bairro,
          cidade: endereco.cidade,
          uf: endereco.estado,
          cep: endereco.cep,
        });
        
        // Chamar Edge Function que cria vistoria + instalacao usando service_role
        const { data, error } = await publicSupabase.functions.invoke<AgendarPresencialResponse>('agendar-vistoria-presencial', {
          body: {
            cotacaoId,
            dataAgendada,
            horarioAgendado,
            endereco,
            responsavel,
            latitude: coords.success ? coords.latitude : null,
            longitude: coords.success ? coords.longitude : null,
            permiteEncaixe: permiteEncaixe || false,
          },
        });
        
        if (error) {
          console.error('[FinalizarVistoria] Erro na edge function:', error);
          throw error;
        }
        
        if (!data?.success) {
          console.error('[FinalizarVistoria] Erro:', data?.error);
          throw new Error(data?.error || 'Erro ao agendar vistoria');
        }
        
        console.log('[FinalizarVistoria] Agendamento presencial criado:', data);
        return { vistoriaId: data.vistoriaId, instalacaoId: data.instalacaoId };
      }
      
      // FLUXO AUTOVISTORIA - apenas atualiza cotação (a instalação será agendada depois)
      const updateData: Record<string, unknown> = {
        tipo_vistoria: tipoVistoria,
        status_contratacao: 'vistoria_ok'
      };
      
      // Atualizar cotação
      const { error } = await publicSupabase.from('cotacoes').update(updateData).eq('id', cotacaoId);
      if (error) throw error;
      
      return { vistoriaId: null, instalacaoId: null };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cotacao', variables.cotacaoId] });
      queryClient.invalidateQueries({ queryKey: ['cotacao-publica'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['servicos-disponiveis'] });
      queryClient.invalidateQueries({ queryKey: ['bairros-servicos'] });
      queryClient.invalidateQueries({ queryKey: ['monitoramento-estatisticas'] });
      toast.success(variables.tipoVistoria === 'agendada' ? 'Vistoria agendada!' : 'Vistoria enviada!');
    },
    onError: () => toast.error('Erro ao finalizar vistoria')
  });
}

// Hook para agendar vistoria completa (após autovistoria)
export interface AgendarVistoriaCompletaParams {
  cotacaoId: string;
  dataAgendada: string;
  horarioAgendado: string;
  endereco: { cep: string; logradouro: string; numero: string; bairro: string; cidade: string; estado: string; };
  responsavel: { euMesmo: boolean; nome?: string; telefone?: string; };
  permiteEncaixe?: boolean;
}

export function useAgendarVistoriaCompleta() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ cotacaoId, dataAgendada, horarioAgendado, endereco, responsavel, permiteEncaixe }: AgendarVistoriaCompletaParams) => {
      // Geocodificar endereço antes de enviar
      const coords = await geocodificarEndereco({
        logradouro: endereco.logradouro,
        numero: endereco.numero,
        bairro: endereco.bairro,
        cidade: endereco.cidade,
        uf: endereco.estado,
        cep: endereco.cep,
      });
      
      // Chamar Edge Function que usa service_role para bypassar RLS
      const { data, error } = await publicSupabase.functions.invoke('agendar-vistoria-completa', {
        body: {
          cotacaoId,
          dataAgendada,
          horarioAgendado,
          endereco,
          responsavel,
          latitude: coords.success ? coords.latitude : null,
          longitude: coords.success ? coords.longitude : null,
          permiteEncaixe: permiteEncaixe || false,
        },
      });
      
      if (error) {
        console.error('[AgendarVistoriaCompleta] Erro na edge function:', error);
        throw error;
      }
      
      if (!data?.success) {
        console.error('[AgendarVistoriaCompleta] Erro:', data?.error);
        throw new Error(data?.error || 'Erro ao agendar vistoria');
      }
      
      console.log('[AgendarVistoriaCompleta] Sucesso:', data);
      return { id: data.vistoriaId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cotacao', variables.cotacaoId] });
      queryClient.invalidateQueries({ queryKey: ['cotacao-publica'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-mapa'] });
      queryClient.invalidateQueries({ queryKey: ['monitoramento-estatisticas'] });
      toast.success('Vistoria completa agendada com sucesso!');
    },
    onError: () => toast.error('Erro ao agendar vistoria completa')
  });
}
