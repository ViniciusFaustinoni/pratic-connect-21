import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AprovacaoFipeMenor {
  id: string;
  cotacao_id: string;
  solicitante_id: string;
  supervisor_id: string | null;
  fipe_real: number;
  fipe_faixa_original_min: number;
  fipe_faixa_original_max: number;
  fipe_faixa_solicitada_min: number;
  fipe_faixa_solicitada_max: number;
  valor_mensal_original: number;
  valor_mensal_reduzido: number;
  justificativa: string;
  status: 'pendente' | 'aprovado' | 'recusado';
  observacao_supervisor: string | null;
  respondido_em: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  cotacao?: {
    id: string;
    numero: string;
    valor_fipe: number;
    veiculo_marca: string | null;
    veiculo_modelo: string | null;
    veiculo_ano: number | null;
    veiculo_placa: string | null;
    nome_solicitante: string | null;
    telefone1_solicitante: string | null;
    status: string;
  } | null;
  solicitante?: {
    nome: string;
    email: string;
  } | null;
}

export function useAprovacoesFipeMenor(statusFilter?: string) {
  return useQuery({
    queryKey: ['aprovacoes-fipe-menor', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('aprovacoes_fipe_menor')
        .select(`
          *,
          cotacao:cotacoes!cotacao_id(
            id, numero, valor_fipe, veiculo_marca, veiculo_modelo,
            veiculo_ano, veiculo_placa, nome_solicitante, telefone1_solicitante, status
          ),
          solicitante:profiles!solicitante_id(nome, email)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as AprovacaoFipeMenor[];
    },
  });
}

export function useAprovarFipeMenor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      observacao,
      cotacao_id,
    }: {
      id: string;
      observacao?: string;
      cotacao_id: string;
    }) => {
      // Get the aprovacao to know the approved bracket
      const { data: aprovacao, error: fetchErr } = await supabase
        .from('aprovacoes_fipe_menor')
        .select('fipe_faixa_solicitada_min, fipe_faixa_solicitada_max')
        .eq('id', id)
        .single();

      if (fetchErr) throw fetchErr;

      const { data: currentUser } = await supabase.auth.getUser();

      // Update aprovacao status
      const { error: updateErr } = await supabase
        .from('aprovacoes_fipe_menor')
        .update({
          status: 'aprovado',
          observacao_supervisor: observacao || null,
          supervisor_id: currentUser.user?.id || null,
          respondido_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateErr) throw updateErr;

      // Update cotacao with approved bracket
      const { error: cotErr } = await supabase
        .from('cotacoes')
        .update({
          fipe_menor_aprovado: true,
          fipe_faixa_cobranca_min: aprovacao.fipe_faixa_solicitada_min,
          fipe_faixa_cobranca_max: aprovacao.fipe_faixa_solicitada_max,
        })
        .eq('id', cotacao_id);

      if (cotErr) throw cotErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aprovacoes-fipe-menor'] });
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['acompanhamento'] });
      toast.success('FIPE menor aprovada com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao aprovar solicitação');
    },
  });
}

export function useRecusarFipeMenor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      observacao,
      cotacao_id,
    }: {
      id: string;
      observacao?: string;
      cotacao_id: string;
    }) => {
      const { data: currentUser } = await supabase.auth.getUser();

      const { error: updateErr } = await supabase
        .from('aprovacoes_fipe_menor')
        .update({
          status: 'recusado',
          observacao_supervisor: observacao || null,
          supervisor_id: currentUser.user?.id || null,
          respondido_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateErr) throw updateErr;

      // Mark cotacao as rejected
      const { error: cotErr } = await supabase
        .from('cotacoes')
        .update({
          fipe_menor_aprovado: false,
        })
        .eq('id', cotacao_id);

      if (cotErr) throw cotErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aprovacoes-fipe-menor'] });
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['acompanhamento'] });
      toast.success('Solicitação de FIPE menor recusada');
    },
    onError: () => {
      toast.error('Erro ao recusar solicitação');
    },
  });
}

export function useCriarSolicitacaoFipeMenor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      cotacao_id: string;
      fipe_real: number;
      fipe_faixa_original_min: number;
      fipe_faixa_original_max: number;
      fipe_faixa_solicitada_min: number;
      fipe_faixa_solicitada_max: number;
      valor_mensal_original: number;
      valor_mensal_reduzido: number;
      justificativa: string;
    }) => {
      const { data: currentUser } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('aprovacoes_fipe_menor')
        .insert({
          ...data,
          solicitante_id: currentUser.user?.id!,
        });

      if (error) throw error;

      // Mark cotacao
      const { error: cotErr } = await supabase
        .from('cotacoes')
        .update({ solicitar_fipe_menor: true })
        .eq('id', data.cotacao_id);

      if (cotErr) throw cotErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aprovacoes-fipe-menor'] });
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      toast.success('Solicitação de FIPE menor enviada ao supervisor!');
    },
    onError: () => {
      toast.error('Erro ao enviar solicitação');
    },
  });
}
