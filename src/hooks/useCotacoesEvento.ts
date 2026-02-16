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

      // Criar conta a pagar para o auto center
      try {
        const cotacao = query.data?.find(c => c.id === cotacaoId);
        if (cotacao && cotacao.valor_total > 0) {
          const acNome = cotacao.auto_center?.nome_fantasia || cotacao.auto_center?.nome || 'Auto Center';

          // Buscar protocolo do sinistro
          let protocolo = '';
          try {
            const { data: sinistro } = await supabase
              .from('sinistros')
              .select('protocolo')
              .eq('id', sinistroId!)
              .single();
            protocolo = sinistro?.protocolo || '';
          } catch {}

          const vencimento = new Date();
          vencimento.setDate(vencimento.getDate() + 30);

          await supabase.from('contas_pagar').insert({
            fornecedor_nome: acNome,
            categoria: 'pecas',
            valor: cotacao.valor_total,
            data_vencimento: vencimento.toISOString().split('T')[0],
            referencia_tipo: 'cotacao_pecas',
            referencia_id: cotacaoId,
            observacao: `Peças cotação aprovada${protocolo ? ` - Sinistro ${protocolo}` : ''}`,
            status: 'pendente',
          });

          queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
          queryClient.invalidateQueries({ queryKey: ['contas-pagar-kpis'] });
        }
      } catch (cpErr) {
        console.error('Erro ao criar conta a pagar (cotação):', cpErr);
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
