import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Hook para buscar contrato por token (público)
export function useContratoByToken(token: string | undefined) {
  return useQuery({
    queryKey: ['contrato-publico', token],
    queryFn: async () => {
      if (!token) return null;
      
      const { data, error } = await supabase
        .from('contratos')
        .select(`
          *,
          planos:plano_id (nome, descricao),
          associados:associado_id (nome, email, telefone, cpf),
          leads:lead_id (nome, email, telefone, cpf)
        `)
        .eq('link_token', token)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });
}

// Hook para gerar link do associado
export function useGerarLinkAssociado() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (contratoId: string) => {
      // Atualizar contrato com link_gerado_em
      const { data, error } = await supabase
        .from('contratos')
        .update({
          link_gerado_em: new Date().toISOString(),
        })
        .eq('id', contratoId)
        .select('link_token')
        .single();
      
      if (error) throw error;
      
      // Registrar no histórico
      await supabase.from('contratos_historico').insert({
        contrato_id: contratoId,
        evento: 'link_gerado',
        descricao: 'Link do associado gerado',
        dados: { link_token: data.link_token },
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      toast.success('Link gerado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao gerar link');
    },
  });
}

// Hook para selecionar tipo de vistoria
export function useSelecionarTipoVistoria() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ contratoId, tipoVistoria }: { contratoId: string; tipoVistoria: 'agendada' | 'autovistoria' }) => {
      const { error } = await supabase
        .from('contratos')
        .update({
          tipo_vistoria: tipoVistoria,
        })
        .eq('id', contratoId);
      
      if (error) throw error;
      
      // Registrar no histórico
      await supabase.from('contratos_historico').insert({
        contrato_id: contratoId,
        evento: 'vistoria_tipo_selecionado',
        descricao: `Tipo de vistoria selecionado: ${tipoVistoria === 'agendada' ? 'Vistoria Agendada' : 'Autovistoria'}`,
        dados: { tipo_vistoria: tipoVistoria },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contrato-publico'] });
    },
  });
}

// Hook para criar vistoria agendada
export function useCriarVistoriaAgendada() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      contratoId, 
      dataAgendada, 
      horarioAgendado,
      veiculoId,
      associadoId,
    }: { 
      contratoId: string; 
      dataAgendada: string; 
      horarioAgendado: string;
      veiculoId?: string;
      associadoId?: string;
    }) => {
      // Criar vistoria
      const { data: vistoria, error: vistoriaError } = await supabase
        .from('vistorias')
        .insert({
          associado_id: associadoId || '00000000-0000-0000-0000-000000000000',
          veiculo_id: veiculoId,
          contrato_id: contratoId,
          data_agendada: dataAgendada,
          horario_agendado: horarioAgendado,
          modalidade: 'presencial',
          status: 'pendente',
          tipo: 'entrada',
        })
        .select()
        .single();
      
      if (vistoriaError) throw vistoriaError;
      
      // Registrar no histórico do contrato
      await supabase.from('contratos_historico').insert({
        contrato_id: contratoId,
        evento: 'vistoria_agendada',
        descricao: `Vistoria agendada para ${dataAgendada} às ${horarioAgendado}`,
        dados: { vistoria_id: vistoria.id, data: dataAgendada, horario: horarioAgendado },
      });
      
      return vistoria;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contrato-publico'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      toast.success('Vistoria agendada com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao agendar vistoria');
    },
  });
}

// Hook para criar autovistoria
export function useCriarAutovistoria() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      contratoId, 
      veiculoId,
      associadoId,
    }: { 
      contratoId: string; 
      veiculoId?: string;
      associadoId?: string;
    }) => {
      // Criar vistoria como autovistoria
      const { data: vistoria, error: vistoriaError } = await supabase
        .from('vistorias')
        .insert({
          associado_id: associadoId || '00000000-0000-0000-0000-000000000000',
          veiculo_id: veiculoId,
          contrato_id: contratoId,
          modalidade: 'autovistoria',
          status: 'pendente',
          tipo: 'entrada',
        })
        .select()
        .single();
      
      if (vistoriaError) throw vistoriaError;
      
      // Registrar no histórico do contrato
      await supabase.from('contratos_historico').insert({
        contrato_id: contratoId,
        evento: 'autovistoria_iniciada',
        descricao: 'Autovistoria iniciada pelo associado',
        dados: { vistoria_id: vistoria.id },
      });
      
      return vistoria;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contrato-publico'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
    },
  });
}

// Hook para upload de foto da autovistoria
export function useUploadFotoAutovistoria() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      vistoriaId, 
      fotoId, 
      file,
      contratoId,
    }: { 
      vistoriaId: string; 
      fotoId: string; 
      file: File;
      contratoId: string;
    }) => {
      const fileName = `vistorias/${vistoriaId}/${fotoId}_${Date.now()}.${file.name.split('.').pop()}`;
      
      // Upload do arquivo
      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('documentos')
        .getPublicUrl(fileName);
      
      // Salvar referência na tabela vistoria_fotos (se existir) ou nas observações
      // Por enquanto, vamos registrar no histórico
      await supabase.from('contratos_historico').insert({
        contrato_id: contratoId,
        evento: 'autovistoria_foto_enviada',
        descricao: `Foto enviada: ${fotoId}`,
        dados: { vistoria_id: vistoriaId, foto_id: fotoId, url: urlData.publicUrl },
      });
      
      return { fotoId, url: urlData.publicUrl };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contrato-publico'] });
    },
  });
}

// Gerar URL do link do associado
export function getAssociadoLinkUrl(token: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/associado/${token}`;
}
