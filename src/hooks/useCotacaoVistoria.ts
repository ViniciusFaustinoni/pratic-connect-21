import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
      const updateData: Record<string, unknown> = {
        tipo_vistoria: tipoVistoria,
        // vistoria_concluida_em será setado apenas quando o vistoriador concluir a instalação
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
        
        // Geocodificar endereço em background (não bloqueia a operação)
        geocodificarEndereco({
          logradouro: endereco.logradouro,
          numero: endereco.numero,
          bairro: endereco.bairro,
          cidade: endereco.cidade,
          uf: endereco.estado,
          cep: endereco.cep,
        }).then(coords => {
          if (coords.success) {
            // Atualizar cotação com coordenadas em background
            supabase
              .from('cotacoes')
              .update({
                vistoria_endereco_latitude: coords.latitude,
                vistoria_endereco_longitude: coords.longitude,
              })
              .eq('id', cotacaoId)
              .then(() => console.log('[Geocode] Coordenadas salvas para cotação:', cotacaoId));
          }
        }).catch(err => console.error('[Geocode] Erro background:', err));
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
      // Geocodificar endereço antes de salvar
      const coords = await geocodificarEndereco({
        logradouro: endereco.logradouro,
        numero: endereco.numero,
        bairro: endereco.bairro,
        cidade: endereco.cidade,
        uf: endereco.estado,
        cep: endereco.cep,
      });
      
      const updateData: Record<string, unknown> = {
        vistoria_completa_data_agendada: dataAgendada,
        vistoria_completa_horario_agendado: horarioAgendado,
        vistoria_completa_endereco_cep: endereco.cep,
        vistoria_completa_endereco_logradouro: endereco.logradouro,
        vistoria_completa_endereco_numero: endereco.numero,
        vistoria_completa_endereco_bairro: endereco.bairro,
        vistoria_completa_endereco_cidade: endereco.cidade,
        vistoria_completa_endereco_estado: endereco.estado,
        vistoria_completa_responsavel_eu_mesmo: responsavel.euMesmo,
        vistoria_completa_responsavel_nome: responsavel.nome || null,
        vistoria_completa_responsavel_telefone: responsavel.telefone || null,
      };
      
      // Adicionar coordenadas se geocodificação foi bem sucedida
      if (coords.success) {
        updateData.vistoria_endereco_latitude = coords.latitude;
        updateData.vistoria_endereco_longitude = coords.longitude;
      }
      
      // 1. Atualizar cotação
      const { error: cotacaoError } = await supabase
        .from('cotacoes')
        .update(updateData)
        .eq('id', cotacaoId);
      
      if (cotacaoError) throw cotacaoError;
      
      // 2. Buscar dados da cotação para obter informações do cliente
      const { data: cotacao } = await supabase
        .from('cotacoes')
        .select('id, nome_solicitante, telefone1_solicitante, veiculo_placa, veiculo_marca, veiculo_modelo')
        .eq('id', cotacaoId)
        .single();
      
      // 3. Buscar contrato vinculado para obter associado_id e veiculo_id
      const { data: contrato } = await supabase
        .from('contratos')
        .select('id, associado_id, veiculo_id')
        .eq('cotacao_id', cotacaoId)
        .single();
      
      // 4. CRIAR REGISTRO NA TABELA VISTORIAS
      // Montar observações com dados do responsável
      const obsResponsavel = responsavel.euMesmo 
        ? `Responsável: ${cotacao?.nome_solicitante} - ${cotacao?.telefone1_solicitante}` 
        : `Responsável: ${responsavel.nome} - ${responsavel.telefone}`;
      
      const vistoriaData = {
        cotacao_id: cotacaoId,
        contrato_id: contrato?.id || null,
        associado_id: contrato?.associado_id || null,
        veiculo_id: contrato?.veiculo_id || null,
        tipo: 'entrada' as const,
        modalidade: 'presencial',
        status: 'agendada' as const,
        origem: 'cotacao',
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
        .insert(vistoriaData)
        .select('id')
        .single();
      
      if (vistoriaError) {
        console.error('[AgendarVistoriaCompleta] Erro ao criar vistoria:', vistoriaError);
        throw vistoriaError;
      }
      
      console.log('[AgendarVistoriaCompleta] Vistoria criada com sucesso:', novaVistoria.id);
      
      // 5. Atualizar contrato com vistoria_id
      if (contrato?.id && novaVistoria?.id) {
        await supabase
          .from('contratos')
          .update({ vistoria_id: novaVistoria.id })
          .eq('id', contrato.id);
      }
      
      // 6. CRIAR REGISTRO NA TABELA INSTALACOES
      const instalacaoData = {
        contrato_id: contrato?.id || null,
        associado_id: contrato?.associado_id || null,
        veiculo_id: contrato?.veiculo_id || null,
        vistoria_id: novaVistoria.id,
        status: 'agendada' as const,
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
      
      const { data: novaInstalacao, error: instalacaoError } = await supabase
        .from('instalacoes')
        .insert(instalacaoData)
        .select('id')
        .single();
      
      if (instalacaoError) {
        console.error('[AgendarVistoriaCompleta] Erro ao criar instalação:', instalacaoError);
        // Não vamos dar throw aqui para não interromper o fluxo
        // A instalação pode ser criada manualmente depois
      } else {
        console.log('[AgendarVistoriaCompleta] Instalação criada com sucesso:', novaInstalacao.id);
        
        // 7. VINCULAR INSTALAÇÃO À VISTORIA (para que useVistoriaCompleta encontre a vistoria correta)
        await supabase
          .from('vistorias')
          .update({ instalacao_id: novaInstalacao.id })
          .eq('id', novaVistoria.id);
        
        console.log('[AgendarVistoriaCompleta] Vistoria vinculada à instalação');
      }
      
      return novaVistoria;
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
