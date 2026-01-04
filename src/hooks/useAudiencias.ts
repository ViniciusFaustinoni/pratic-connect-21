import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Audiencia {
  id: string;
  processo_id: string;
  tipo: string;
  data_hora: string;
  local?: string;
  link_videoconferencia?: string;
  pauta?: string;
  status: string;
  resultado?: string;
  advogado_presente?: boolean;
  parte_presente?: boolean;
  testemunhas?: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
  processo?: {
    id: string;
    numero: string;
    numero_processo?: string;
    parte_contraria_nome: string;
    tipo: string;
  };
}

export interface AudienciasFilters {
  busca?: string;
  dataInicio?: string;
  dataFim?: string;
  status?: string;
  tipo?: string;
}

export function useAudiencias(filters?: AudienciasFilters) {
  const queryClient = useQueryClient();

  const audienciasQuery = useQuery({
    queryKey: ['audiencias', filters],
    queryFn: async () => {
      let query = supabase
        .from('processos_audiencias')
        .select(`
          *,
          processo:processos(id, numero, numero_processo, parte_contraria_nome, tipo)
        `)
        .order('data_hora', { ascending: true });

      if (filters?.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      }

      if (filters?.tipo && filters.tipo !== 'todos') {
        query = query.eq('tipo', filters.tipo);
      }

      if (filters?.dataInicio) {
        query = query.gte('data_hora', filters.dataInicio);
      }

      if (filters?.dataFim) {
        query = query.lte('data_hora', `${filters.dataFim}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Audiencia[];
    }
  });

  const atualizarStatusMutation = useMutation({
    mutationFn: async ({ 
      audienciaId, 
      status, 
      resultado,
      advogado_presente,
      parte_presente,
      observacoes
    }: { 
      audienciaId: string; 
      status: string;
      resultado?: string;
      advogado_presente?: boolean;
      parte_presente?: boolean;
      observacoes?: string;
    }) => {
      const { error } = await supabase
        .from('processos_audiencias')
        .update({
          status,
          resultado,
          advogado_presente,
          parte_presente,
          observacoes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', audienciaId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audiencias'] });
      toast.success('Audiência atualizada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar audiência: ' + error.message);
    }
  });

  return {
    audiencias: audienciasQuery.data || [],
    isLoading: audienciasQuery.isLoading,
    refetch: audienciasQuery.refetch,
    atualizarStatus: atualizarStatusMutation.mutate,
    isAtualizando: atualizarStatusMutation.isPending,
  };
}
