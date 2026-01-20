import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { toast } from 'sonner';
import { geocodificarEndereco } from '@/services/geocodingService';

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
          const { data: ocrData } = await supabase.functions.invoke('odometro-ocr', { body: { imageUrl: url } });
          if (ocrData?.quilometragem) kmExtraido = ocrData.quilometragem;
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
}

export function useFinalizarVistoriaCotacao() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ cotacaoId, tipoVistoria, dataAgendada, horarioAgendado, endereco, responsavel }: FinalizarVistoriaParams) => {
      // Buscar dados da cotação para preencher a vistoria
      const { data: cotacao, error: cotacaoFetchError } = await supabase
        .from('cotacoes')
        .select('id, nome_solicitante, telefone1_solicitante, veiculo_placa, veiculo_marca, veiculo_modelo')
        .eq('id', cotacaoId)
        .single();
      
      if (cotacaoFetchError) throw cotacaoFetchError;
      
      const updateData: Record<string, unknown> = {
        tipo_vistoria: tipoVistoria,
        status_contratacao: 'vistoria_ok'
      };
      
      let coords: { success: boolean; latitude?: number; longitude?: number } = { success: false };
      
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
        
        // Geocodificar endereço
        coords = await geocodificarEndereco({
          logradouro: endereco.logradouro,
          numero: endereco.numero,
          bairro: endereco.bairro,
          cidade: endereco.cidade,
          uf: endereco.estado,
          cep: endereco.cep,
        });
        
        if (coords.success) {
          updateData.vistoria_endereco_latitude = coords.latitude;
          updateData.vistoria_endereco_longitude = coords.longitude;
        }
      }
      
      // Atualizar cotação
      const { error } = await supabase.from('cotacoes').update(updateData).eq('id', cotacaoId);
      if (error) throw error;
      
      // CRIAR REGISTRO NA TABELA VISTORIAS para aparecer nas rotas
      if (tipoVistoria === 'agendada' && endereco && responsavel) {
        const obsResponsavel = responsavel.euMesmo 
          ? `Responsável: ${cotacao.nome_solicitante} - ${cotacao.telefone1_solicitante}` 
          : `Responsável: ${responsavel.nome} - ${responsavel.telefone}`;
        
        const vistoriaData = {
          cotacao_id: cotacaoId,
          tipo: 'entrada' as const,
          modalidade: 'presencial' as const,
          status: 'pendente' as const,
          origem: 'cotacao' as const,
          data_agendada: dataAgendada,
          horario_agendado: horarioAgendado,
          endereco_cep: endereco.cep,
          endereco_logradouro: endereco.logradouro,
          endereco_numero: endereco.numero,
          endereco_bairro: endereco.bairro,
          endereco_cidade: endereco.cidade,
          endereco_estado: endereco.estado,
          endereco_latitude: coords.success ? coords.latitude : null,
          endereco_longitude: coords.success ? coords.longitude : null,
          observacoes: obsResponsavel,
        };
        
        const { data: novaVistoria, error: vistoriaError } = await supabase
          .from('vistorias')
          .insert([vistoriaData])
          .select('id')
          .single();
        
        if (vistoriaError) {
          console.error('[FinalizarVistoria] Erro ao criar vistoria:', vistoriaError);
        } else {
          console.log('[FinalizarVistoria] Vistoria criada:', novaVistoria.id);
          
          // Vincular vistoria ao contrato
          const { error: contratoError } = await supabase
            .from('contratos')
            .update({ vistoria_id: novaVistoria.id })
            .eq('cotacao_id', cotacaoId);
          
          if (contratoError) {
            console.error('[FinalizarVistoria] Erro ao vincular vistoria ao contrato:', contratoError);
          }
        }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cotacao', variables.cotacaoId] });
      queryClient.invalidateQueries({ queryKey: ['cotacao-publica'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['servicos-disponiveis'] });
      queryClient.invalidateQueries({ queryKey: ['bairros-servicos'] });
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
}

export function useAgendarVistoriaCompleta() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ cotacaoId, dataAgendada, horarioAgendado, endereco, responsavel }: AgendarVistoriaCompletaParams) => {
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
