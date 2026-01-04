import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ConsultaFilters {
  status?: string;
  prioridade?: string;
  solicitante_id?: string;
}

export function useConsultasJuridicas(filters?: ConsultaFilters) {
  const queryClient = useQueryClient();

  const { data: consultas = [], isLoading } = useQuery({
    queryKey: ['consultas_juridicas', filters],
    queryFn: async () => {
      let query = supabase
        .from('consultas_juridicas')
        .select(`
          *,
          solicitante:profiles!consultas_juridicas_solicitante_id_fkey(id, nome),
          respondido_usuario:profiles!consultas_juridicas_respondido_por_fkey(id, nome)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.prioridade) query = query.eq('prioridade', filters.prioridade);
      if (filters?.solicitante_id) query = query.eq('solicitante_id', filters.solicitante_id);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { mutateAsync: criarConsulta, isPending: isCriando } = useMutation({
    mutationFn: async (consulta: {
      assunto: string;
      descricao: string;
      solicitante_id?: string;
      departamento?: string;
      associado_id?: string;
      sinistro_id?: string;
      processo_id?: string;
      prioridade?: string;
    }) => {
      const { data, error } = await supabase
        .from('consultas_juridicas')
        .insert([consulta])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultas_juridicas'] });
      toast.success('Consulta jurídica enviada!');
    },
    onError: (error) => {
      toast.error('Erro ao enviar consulta: ' + error.message);
    },
  });

  const { mutateAsync: responderConsulta, isPending: isRespondendo } = useMutation({
    mutationFn: async ({ id, parecer }: { id: string; parecer: string }) => {
      const { error } = await supabase
        .from('consultas_juridicas')
        .update({
          parecer,
          status: 'respondida',
          respondido_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultas_juridicas'] });
      toast.success('Consulta respondida!');
    },
    onError: (error) => {
      toast.error('Erro ao responder consulta: ' + error.message);
    },
  });

  const { mutateAsync: atualizarStatus } = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('consultas_juridicas')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultas_juridicas'] });
      toast.success('Status atualizado!');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar status: ' + error.message);
    },
  });

  return {
    consultas,
    isLoading,
    criarConsulta,
    responderConsulta,
    atualizarStatus,
    isCriando,
    isRespondendo,
  };
}

export function useConsultaJuridica(id?: string) {
  return useQuery({
    queryKey: ['consultas_juridicas', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('consultas_juridicas')
        .select(`
          *,
          solicitante:profiles!consultas_juridicas_solicitante_id_fkey(id, nome),
          respondido_usuario:profiles!consultas_juridicas_respondido_por_fkey(id, nome),
          associado:associados(id, nome),
          sinistro:sinistros(id, protocolo),
          processo:processos(id, numero)
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}
