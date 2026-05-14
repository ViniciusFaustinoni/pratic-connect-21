import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { toast } from 'sonner';
import { geocodificarEndereco } from '@/services/geocodingService';
import { uploadVideoWithRetry, VideoUploadError } from '@/lib/videoUpload';
import { isFotoComValidacaoPlaca } from '@/data/autovistoriaConfig';
import { isPlacaPlaceholder } from '@/lib/placa-utils';

export interface PlacaOcrResultado {
  placa: string | null;
  match: boolean;
  legivel: boolean;
  confianca: number;
  observacao?: string | null;
  skipped?: boolean;
}

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
      const { data, error } = await publicSupabase
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
  onProgress?: (percent: number) => void;
}

export interface UploadFotoResult {
  fotoId: string;
  url: string;
  kmExtraido?: number;
  ocrFalhou?: boolean;
  placaOcr?: PlacaOcrResultado;
}

export function useUploadFotoCotacaoVistoria() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ cotacaoId, fotoId, file, latitude, longitude, onProgress }: UploadFotoParams): Promise<UploadFotoResult> => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${cotacaoId}/${fotoId}-${Date.now()}.${fileExt}`;
      const isVideo = file.type.startsWith('video/') || fotoId === 'video_360';

      if (isVideo) {
        // Upload resiliente com retry e progresso para vídeos.
        try {
          await uploadVideoWithRetry({
            supabase: publicSupabase,
            bucket: 'cotacoes-vistoria',
            path: fileName,
            file,
            contentType: file.type || undefined,
            upsert: true,
            onProgress,
          });
        } catch (err) {
          if (err instanceof VideoUploadError) {
            toast.error(err.userMessage);
          }
          throw err;
        }
      } else {
        const { error: uploadError } = await publicSupabase.storage
          .from('cotacoes-vistoria')
          .upload(fileName, file, { upsert: true });
        if (uploadError) throw uploadError;
      }

      const { data: urlData } = publicSupabase.storage
        .from('cotacoes-vistoria')
        .getPublicUrl(fileName);
      const url = urlData.publicUrl;
      
      const { error: dbError } = await publicSupabase
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
      let ocrFalhou = false;
      // OCR de odômetro: agora a foto canônica é 'painel_ligado'.
      // Mantém compatibilidade com 'odometro' (legado).
      if (fotoId === 'odometro' || fotoId === 'painel_ligado') {
        try {
          const { data: ocrData } = await supabase.functions.invoke('odometro-ocr', { body: { url } });
          if (ocrData?.km && (ocrData.confianca == null || ocrData.confianca >= 0.7)) {
            kmExtraido = ocrData.km;
          } else {
            ocrFalhou = true;
          }
        } catch (e) {
          ocrFalhou = true;
          console.warn('OCR odômetro falhou:', e);
        }
      }

      // OCR de placa: roda nas 6 fotos com placa visível.
      let placaOcr: PlacaOcrResultado | undefined;
      if (isFotoComValidacaoPlaca(fotoId)) {
        try {
          const { data: cot } = await publicSupabase
            .from('cotacoes')
            .select('veiculo_placa')
            .eq('id', cotacaoId)
            .maybeSingle();
          const placaEsperada = (cot as any)?.veiculo_placa || '';
          if (!placaEsperada || isPlacaPlaceholder(placaEsperada)) {
            // 0KM ou sem placa real — não valida.
            placaOcr = { placa: null, match: true, legivel: true, confianca: 1, skipped: true };
          } else {
            const { data: ocrPlaca } = await supabase.functions.invoke('placa-ocr', {
              body: { url, placaEsperada, fotoTipo: fotoId },
            });
            if (ocrPlaca) {
              placaOcr = ocrPlaca as PlacaOcrResultado;
            }
          }
        } catch (e) {
          console.warn('[placa-ocr] falha — não bloqueia upload:', e);
        }
      }
      return { fotoId, url, kmExtraido, ocrFalhou, placaOcr };

    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cotacao-vistoria-fotos', variables.cotacaoId] });
    },
    onError: (err) => {
      // VideoUploadError já mostrou toast específico — evita duplicar.
      if (!(err instanceof VideoUploadError)) {
        toast.error('Erro ao enviar arquivo');
      }
    }
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
      
      // FLUXO AUTOVISTORIA — materializa vistoria + servico via edge (RLS-safe + idempotente).
      // Sem isso, a fila Monitoramento › Aprovação de Associados não enxerga o caso e o
      // veículo fica em limbo após o pagamento.
      const { data, error } = await publicSupabase.functions.invoke<{ success: boolean; vistoriaId?: string; servicoId?: string; error?: string }>(
        'finalizar-autovistoria-cotacao',
        { body: { cotacaoId } },
      );
      if (error) {
        console.error('[FinalizarVistoria] edge finalizar-autovistoria-cotacao falhou:', error);
        throw error;
      }
      if (!data?.success) {
        console.error('[FinalizarVistoria] edge retornou erro:', data?.error);
        throw new Error(data?.error || 'Erro ao finalizar autovistoria');
      }
      return { vistoriaId: data.vistoriaId ?? null, instalacaoId: null };
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
