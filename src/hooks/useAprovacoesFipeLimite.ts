import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AprovacaoFipeLimite {
  id: string;
  cotacao_id: string;
  solicitante_id: string;
  aprovador_id: string | null;
  valor_fipe: number;
  limite_aplicado: number;
  tipo_veiculo: string;
  veiculo_marca: string | null;
  veiculo_modelo: string | null;
  veiculo_ano: number | null;
  veiculo_placa: string | null;
  nome_solicitante: string | null;
  justificativa: string | null;
  status: 'pendente' | 'aprovado' | 'recusado';
  observacao_aprovador: string | null;
  respondido_em: string | null;
  created_at: string;
  updated_at: string;
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

export function useAprovacoesFipeLimite(statusFilter?: string) {
  return useQuery({
    queryKey: ['aprovacoes-fipe-limite', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('aprovacoes_fipe_limite')
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
      return (data || []) as unknown as AprovacaoFipeLimite[];
    },
  });
}

export function useAprovacaoFipeLimitePorCotacao(cotacaoId: string | undefined) {
  return useQuery({
    queryKey: ['aprovacao-fipe-limite-cotacao', cotacaoId],
    queryFn: async () => {
      if (!cotacaoId) return null;
      const { data, error } = await supabase
        .from('aprovacoes_fipe_limite')
        .select('id, status')
        .eq('cotacao_id', cotacaoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; status: string } | null;
    },
    enabled: !!cotacaoId,
  });
}

export function useAprovarFipeLimite() {
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
        .from('aprovacoes_fipe_limite')
        .update({
          status: 'aprovado',
          observacao_aprovador: observacao || null,
          aprovador_id: currentUser.user?.id || null,
          respondido_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateErr) throw updateErr;

      const { error: cotErr } = await supabase
        .from('cotacoes')
        .update({ fipe_limite_aprovado: true })
        .eq('id', cotacao_id);

      if (cotErr) throw cotErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aprovacoes-fipe-limite'] });
      queryClient.invalidateQueries({ queryKey: ['aprovacao-fipe-limite-cotacao'] });
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      toast.success('Autorização FIPE aprovada com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao aprovar solicitação');
    },
  });
}

export function useRecusarFipeLimite() {
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
        .from('aprovacoes_fipe_limite')
        .update({
          status: 'recusado',
          observacao_aprovador: observacao || null,
          aprovador_id: currentUser.user?.id || null,
          respondido_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateErr) throw updateErr;

      const { error: cotErr } = await supabase
        .from('cotacoes')
        .update({ fipe_limite_aprovado: false })
        .eq('id', cotacao_id);

      if (cotErr) throw cotErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aprovacoes-fipe-limite'] });
      queryClient.invalidateQueries({ queryKey: ['aprovacao-fipe-limite-cotacao'] });
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      toast.success('Solicitação de autorização FIPE recusada');
    },
    onError: () => {
      toast.error('Erro ao recusar solicitação');
    },
  });
}

export function useCriarSolicitacaoFipeLimite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      cotacao_id: string;
      valor_fipe: number;
      limite_aplicado: number;
      tipo_veiculo: string;
      veiculo_marca?: string;
      veiculo_modelo?: string;
      veiculo_ano?: number;
      veiculo_placa?: string;
      nome_solicitante?: string;
      justificativa?: string;
    }) => {
      const { data: currentUser } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('aprovacoes_fipe_limite')
        .insert({
          ...data,
          solicitante_id: currentUser.user?.id!,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aprovacoes-fipe-limite'] });
      queryClient.invalidateQueries({ queryKey: ['aprovacao-fipe-limite-cotacao'] });
      toast.success('Solicitação de autorização FIPE enviada!');
    },
    onError: () => {
      toast.error('Erro ao enviar solicitação');
    },
  });
}
