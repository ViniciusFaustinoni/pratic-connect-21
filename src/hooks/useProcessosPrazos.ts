import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PrazoFilters {
  status?: string;
  responsavel_id?: string;
  processo_id?: string;
}

export function useProcessosPrazos(filters?: PrazoFilters) {
  const queryClient = useQueryClient();

  const { data: prazos = [], isLoading } = useQuery({
    queryKey: ['processos_prazos', filters],
    queryFn: async () => {
      let query = supabase
        .from('processos_prazos')
        .select(`
          *,
          processo:processos(id, numero, numero_processo, parte_contraria_nome, tipo),
          responsavel:profiles!processos_prazos_responsavel_id_fkey(id, nome)
        `)
        .order('data_fim', { ascending: true });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.responsavel_id) query = query.eq('responsavel_id', filters.responsavel_id);
      if (filters?.processo_id) query = query.eq('processo_id', filters.processo_id);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // View de prazos próximos
  const { data: prazosProximos = [], isLoading: isLoadingProximos } = useQuery({
    queryKey: ['view_prazos_proximos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('view_prazos_proximos')
        .select('*')
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { mutateAsync: criarPrazo, isPending: isCriando } = useMutation({
    mutationFn: async (prazo: {
      processo_id: string;
      descricao: string;
      data_inicio: string;
      data_fim: string;
      prioridade?: string;
      responsavel_id?: string;
      dias_uteis?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('processos_prazos')
        .insert([prazo])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processos_prazos'] });
      queryClient.invalidateQueries({ queryKey: ['view_prazos_proximos'] });
      toast.success('Prazo criado com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao criar prazo: ' + error.message);
    },
  });

  const { mutateAsync: cumprirPrazo, isPending: isCumprindo } = useMutation({
    mutationFn: async ({ id, observacao }: { id: string; observacao?: string }) => {
      const { error } = await supabase
        .from('processos_prazos')
        .update({
          status: 'cumprido',
          cumprido_em: new Date().toISOString(),
          observacao_cumprimento: observacao,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processos_prazos'] });
      queryClient.invalidateQueries({ queryKey: ['view_prazos_proximos'] });
      toast.success('Prazo marcado como cumprido!');
    },
    onError: (error) => {
      toast.error('Erro ao cumprir prazo: ' + error.message);
    },
  });

  const { mutateAsync: cancelarPrazo } = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('processos_prazos')
        .update({
          status: 'cancelado',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processos_prazos'] });
      queryClient.invalidateQueries({ queryKey: ['view_prazos_proximos'] });
      toast.success('Prazo cancelado!');
    },
    onError: (error) => {
      toast.error('Erro ao cancelar prazo: ' + error.message);
    },
  });

  return {
    prazos,
    prazosProximos,
    isLoading,
    isLoadingProximos,
    criarPrazo,
    cumprirPrazo,
    cancelarPrazo,
    isCriando,
    isCumprindo,
  };
}
