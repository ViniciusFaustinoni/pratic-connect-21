import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CotacaoEvento {
  id: string;
  sinistro_id: string;
  auto_center_id: string;
  itens: any[];
  mensagem_enviada: string | null;
  status: string;
  resposta: any;
  valor_total: number;
  prazo_geral: string | null;
  observacoes_auto_center: string | null;
  aprovada: boolean;
  aprovada_em: string | null;
  aprovada_por: string | null;
  prazo_resposta: string | null;
  created_at: string;
  auto_center: {
    id: string;
    nome_fantasia: string | null;
    nome: string;
    whatsapp: string | null;
  } | null;
}

export function useCotacoesEvento(sinistroId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['cotacoes-evento', sinistroId],
    queryFn: async (): Promise<CotacaoEvento[]> => {
      if (!sinistroId) return [];

      const { data, error } = await supabase
        .from('evento_cotacoes_pecas')
        .select('*, auto_center:auto_centers(id, nome_fantasia, nome, whatsapp)')
        .eq('sinistro_id', sinistroId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as CotacaoEvento[];
    },
    enabled: !!sinistroId,
  });

  const registrarCotacao = useMutation({
    mutationFn: async ({
      cotacaoId,
      resposta,
      valorTotal,
      prazoGeral,
      observacoes,
    }: {
      cotacaoId: string;
      resposta: any;
      valorTotal: number;
      prazoGeral: string;
      observacoes: string;
    }) => {
      const { error } = await supabase
        .from('evento_cotacoes_pecas')
        .update({
          status: 'respondido',
          resposta,
          valor_total: valorTotal,
          prazo_geral: prazoGeral,
          observacoes_auto_center: observacoes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cotacaoId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cotação registrada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['cotacoes-evento', sinistroId] });
    },
    onError: () => toast.error('Erro ao registrar cotação'),
  });

  const aprovarCotacao = useMutation({
    mutationFn: async (cotacaoId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Aprovar a selecionada
      const { error: err1 } = await supabase
        .from('evento_cotacoes_pecas')
        .update({
          aprovada: true,
          aprovada_em: new Date().toISOString(),
          aprovada_por: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cotacaoId);

      if (err1) throw err1;

      // Marcar demais como não selecionadas
      const { error: err2 } = await supabase
        .from('evento_cotacoes_pecas')
        .update({
          status: 'nao_selecionada',
          updated_at: new Date().toISOString(),
        })
        .eq('sinistro_id', sinistroId!)
        .neq('id', cotacaoId)
        .eq('status', 'respondido');

      if (err2) throw err2;
    },
    onSuccess: async (_: unknown, cotacaoId: string) => {
      toast.success('Cotação aprovada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['cotacoes-evento', sinistroId] });

      // Gerar OS automaticamente via edge function
      try {
        const { data, error } = await supabase.functions.invoke('gerar-os-cotacao-aprovada', {
          body: { sinistro_id: sinistroId, cotacao_id: cotacaoId },
        });
        if (error) throw error;
        if (data?.os_numero) {
          toast.success(`OS ${data.os_numero} gerada automaticamente!`);
        }
        queryClient.invalidateQueries({ queryKey: ['ordens_servico'] });
      } catch (e: any) {
        console.error('Erro ao gerar OS:', e);
        toast.error('Cotação aprovada, mas houve erro ao gerar a OS: ' + (e.message || 'erro desconhecido'));
      }
    },
    onError: () => toast.error('Erro ao aprovar cotação'),
  });

  return {
    cotacoes: query.data || [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    registrarCotacao,
    aprovarCotacao,
  };
}
