import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface RecusarVeiculoData {
  vistoriaId: string;
  instalacaoId?: string;
  veiculoId: string;
  associadoId: string;
  motivo: string;
  observacoes: string;
  fotosRecusa: File[];
}

interface AprovarVeiculoData {
  vistoriaId: string;
  instalacaoId?: string;
  veiculoId: string;
  associadoId: string;
  hodometro: number;
  observacoes?: string;
}

// Hook para aprovar veículo na vistoria completa
export function useAprovarVeiculoVistoria() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: AprovarVeiculoData) => {
      const agora = new Date().toISOString();

      // 1. Atualizar veículo com cobertura total
      const { error: veiculoError } = await supabase
        .from('veiculos')
        .update({ 
          status: 'ativo',
          cobertura_total: true,
          updated_at: agora,
        })
        .eq('id', data.veiculoId);

      if (veiculoError) throw veiculoError;

      // 2. Atualizar associado para ativo
      const { error: associadoError } = await supabase
        .from('associados')
        .update({ 
          status: 'ativo',
          data_ativacao: agora,
          updated_at: agora,
        })
        .eq('id', data.associadoId);

      if (associadoError) throw associadoError;

      // 3. Atualizar vistoria como aprovada
      const { error: vistoriaError } = await supabase
        .from('vistorias')
        .update({ 
          status: 'aprovada',
          km_atual: data.hodometro,
          observacoes: data.observacoes,
          updated_at: agora,
        })
        .eq('id', data.vistoriaId);

      if (vistoriaError) throw vistoriaError;

      // 4. Concluir instalação se existir
      if (data.instalacaoId) {
        const { error: instalacaoError } = await supabase
          .from('instalacoes')
          .update({ 
            status: 'concluida',
            concluida_em: agora,
          })
          .eq('id', data.instalacaoId);

        if (instalacaoError) throw instalacaoError;
      }

      // 5. Registrar no histórico
      await supabase.from('associados_historico').insert({
        associado_id: data.associadoId,
        tipo: 'veiculo_aprovado',
        descricao: 'Veículo aprovado pelo técnico instalador - Cobertura total ativada',
        dados_novos: { 
          vistoria_id: data.vistoriaId,
          instalacao_id: data.instalacaoId, 
          veiculo_id: data.veiculoId,
          cobertura_total: true,
          hodometro: data.hodometro,
        },
        usuario_id: profile?.id,
      });

      // 6. Propagar conclusão para cotações/contratos
      const { data: vistoriaData } = await supabase
        .from('vistorias')
        .select('cotacao_id, contrato_id')
        .eq('id', data.vistoriaId)
        .single();

      if (vistoriaData?.cotacao_id) {
        await supabase
          .from('cotacoes')
          .update({ 
            status_contratacao: 'ativo',
            vistoria_concluida_em: agora,
          })
          .eq('id', vistoriaData.cotacao_id);
      }

      if (vistoriaData?.contrato_id) {
        await supabase
          .from('contratos')
          .update({ 
            status: 'ativo',
            vistoria_concluida_em: agora,
          })
          .eq('id', vistoriaData.contrato_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['vistoria'] });
      queryClient.invalidateQueries({ queryKey: ['vistoria-completa'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      toast.success('Veículo aprovado com sucesso! Cobertura total ativada.');
    },
    onError: (error) => {
      console.error('Erro ao aprovar veículo:', error);
      toast.error('Erro ao aprovar veículo');
    },
  });
}

// Hook para recusar veículo na vistoria completa (com fotos)
export function useRecusarVeiculoVistoria() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: RecusarVeiculoData) => {
      const agora = new Date().toISOString();
      const fotosUrls: string[] = [];

      // 1. Upload das fotos de recusa (se houver)
      for (const foto of data.fotosRecusa) {
        const fileExt = foto.name.split('.').pop();
        const fileName = `recusa/${data.vistoriaId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('vistoria-fotos')
          .upload(fileName, foto);

        if (!uploadError) {
          const { data: publicUrl } = supabase.storage
            .from('vistoria-fotos')
            .getPublicUrl(fileName);
          fotosUrls.push(publicUrl.publicUrl);
        }
      }

      // 2. Atualizar veículo como suspenso
      const { error: veiculoError } = await supabase
        .from('veiculos')
        .update({ 
          status: 'suspenso',
          motivo_recusa_veiculo: data.observacoes,
          recusado_por: profile?.id,
          recusado_em: agora,
          updated_at: agora,
        })
        .eq('id', data.veiculoId);

      if (veiculoError) throw veiculoError;

      // 3. Atualizar vistoria como reprovada
      const { error: vistoriaError } = await supabase
        .from('vistorias')
        .update({ 
          status: 'reprovada',
          observacoes: data.observacoes,
          fotos_recusa: fotosUrls.length > 0 ? fotosUrls : null,
          updated_at: agora,
        })
        .eq('id', data.vistoriaId);

      if (vistoriaError) throw vistoriaError;

      // 4. Cancelar instalação se existir
      if (data.instalacaoId) {
        const { error: instalacaoError } = await supabase
          .from('instalacoes')
          .update({ 
            status: 'cancelada',
            observacoes: `Veículo recusado: ${data.motivo}`,
          })
          .eq('id', data.instalacaoId);

        if (instalacaoError) throw instalacaoError;
      }

      // 5. Registrar no histórico
      await supabase.from('associados_historico').insert({
        associado_id: data.associadoId,
        tipo: 'veiculo_recusado',
        descricao: `Veículo recusado pelo técnico instalador: ${data.motivo}`,
        dados_novos: { 
          vistoria_id: data.vistoriaId,
          instalacao_id: data.instalacaoId, 
          veiculo_id: data.veiculoId,
          motivo: data.motivo,
          observacoes: data.observacoes,
          fotos_recusa: fotosUrls,
        },
        usuario_id: profile?.id,
      });

      // 6. Propagar cancelamento
      const { data: vistoriaData } = await supabase
        .from('vistorias')
        .select('cotacao_id, contrato_id')
        .eq('id', data.vistoriaId)
        .single();

      if (vistoriaData?.cotacao_id) {
        await supabase
          .from('cotacoes')
          .update({ status_contratacao: 'veiculo_recusado' })
          .eq('id', vistoriaData.cotacao_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['vistoria'] });
      queryClient.invalidateQueries({ queryKey: ['vistoria-completa'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-mapa'] });
      toast.success('Veículo recusado. O associado será notificado.');
    },
    onError: (error) => {
      console.error('Erro ao recusar veículo:', error);
      toast.error('Erro ao recusar veículo');
    },
  });
}

// Hook para upload de vídeo 360
export function useUploadVideo360() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { vistoriaId: string; file: File }) => {
      const fileExt = data.file.name.split('.').pop();
      const fileName = `${data.vistoriaId}/video_360_${Date.now()}.${fileExt}`;

      // Upload para bucket de vídeos
      const { error: uploadError } = await supabase.storage
        .from('vistoria-videos')
        .upload(fileName, data.file);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: publicUrl } = supabase.storage
        .from('vistoria-videos')
        .getPublicUrl(fileName);

      // Atualizar vistoria com URL do vídeo
      const { error: updateError } = await supabase
        .from('vistorias')
        .update({ video_360_url: publicUrl.publicUrl })
        .eq('id', data.vistoriaId);

      if (updateError) throw updateError;

      return publicUrl.publicUrl;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vistoria-completa', variables.vistoriaId] });
      toast.success('Vídeo 360° enviado com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao enviar vídeo:', error);
      toast.error('Erro ao enviar vídeo');
    },
  });
}

// Hook para upload de foto com flag visivel_cliente
export function useUploadFotoVistoriaCompleta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { 
      vistoriaId: string; 
      tipo: string; 
      file: File;
      visivelCliente?: boolean;
    }) => {
      const fileExt = data.file.name.split('.').pop();
      const fileName = `${data.vistoriaId}/${data.tipo}_${Date.now()}.${fileExt}`;

      // Upload para storage
      const { error: uploadError } = await supabase.storage
        .from('vistoria-fotos')
        .upload(fileName, data.file);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: publicUrl } = supabase.storage
        .from('vistoria-fotos')
        .getPublicUrl(fileName);

      // Inserir registro na tabela
      const { data: result, error } = await supabase
        .from('vistoria_fotos')
        .insert({
          vistoria_id: data.vistoriaId,
          tipo: data.tipo,
          arquivo_url: publicUrl.publicUrl,
          visivel_cliente: data.visivelCliente ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vistoria-completa', variables.vistoriaId] });
    },
    onError: (error) => {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao enviar foto');
    },
  });
}