import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AcordoFilters {
  status?: string;
  associadoId?: string;
}

export function useAcordos(filters?: AcordoFilters) {
  const queryClient = useQueryClient();

  const acordosQuery = useQuery({
    queryKey: ['acordos', filters],
    queryFn: async () => {
      let query = supabase
        .from('acordos')
        .select(`
          *,
          associado:associados!acordos_associado_id_fkey(id, nome, cpf, telefone)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.associadoId) {
        query = query.eq('associado_id', filters.associadoId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const criarAcordoMutation = useMutation({
    mutationFn: async (dados: {
      associado_id: string;
      cobrancas_ids: string[];
      valor_original: number;
      valor_desconto: number;
      valor_juros: number;
      valor_acordo: number;
      qtd_parcelas: number;
      valor_parcela: number;
      dia_vencimento: number;
      primeira_parcela_data: string;
      valor_entrada?: number;
    }) => {
      const user = await supabase.auth.getUser();

      // Criar acordo
      const { data: acordo, error: acordoError } = await supabase
        .from('acordos')
        .insert({
          ...dados,
          status: dados.valor_entrada && dados.valor_entrada > 0 ? 'pendente' : 'ativo',
          criado_por: user.data.user?.id
        })
        .select()
        .single();

      if (acordoError) throw acordoError;

      // Criar parcelas
      const parcelas = [];
      const dataBase = new Date(dados.primeira_parcela_data);

      for (let i = 1; i <= dados.qtd_parcelas; i++) {
        const dataVencimento = new Date(dataBase);
        dataVencimento.setMonth(dataVencimento.getMonth() + (i - 1));
        dataVencimento.setDate(dados.dia_vencimento);

        parcelas.push({
          acordo_id: acordo.id,
          numero_parcela: i,
          valor: dados.valor_parcela,
          data_vencimento: dataVencimento.toISOString().split('T')[0],
          status: 'pendente'
        });
      }

      const { error: parcelasError } = await supabase
        .from('acordo_parcelas')
        .insert(parcelas);

      if (parcelasError) throw parcelasError;

      // Enviar notificação via WhatsApp para o associado
      try {
        await supabase.functions.invoke('disparar-notificacao', {
          body: {
            associado_id: dados.associado_id,
            tipo: 'cobranca',
            subtipo: 'acordo_criado',
            dados: {
              valor_acordo: dados.valor_acordo.toFixed(2),
              parcelas: dados.qtd_parcelas,
              valor_parcela: dados.valor_parcela.toFixed(2),
              data_primeira: new Date(dados.primeira_parcela_data).toLocaleDateString('pt-BR'),
            },
            forcar_envio: true,
          },
        });
        console.log('[useAcordos] Notificação de acordo enviada');
      } catch (notifError) {
        console.error('[useAcordos] Erro ao enviar notificação:', notifError);
        // Não interrompe o fluxo principal
      }

      return acordo;
    },
    onSuccess: () => {
      toast.success('Acordo criado com sucesso! O associado foi notificado.');
      queryClient.invalidateQueries({ queryKey: ['acordos'] });
    },
    onError: () => {
      toast.error('Erro ao criar acordo');
    }
  });

  const registrarPagamentoParcelaMutation = useMutation({
    mutationFn: async (dados: {
      parcelaId: string;
      valorPago: number;
      dataPagamento: string;
    }) => {
      const { error } = await supabase
        .from('acordo_parcelas')
        .update({
          status: 'pago',
          valor_pago: dados.valorPago,
          data_pagamento: dados.dataPagamento
        })
        .eq('id', dados.parcelaId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pagamento registrado!');
      queryClient.invalidateQueries({ queryKey: ['acordos'] });
      queryClient.invalidateQueries({ queryKey: ['acordo'] });
    }
  });

  const cancelarAcordoMutation = useMutation({
    mutationFn: async (dados: { acordoId: string; motivo: string }) => {
      const { error } = await supabase
        .from('acordos')
        .update({
          status: 'cancelado',
          motivo_quebra: dados.motivo,
          updated_at: new Date().toISOString()
        })
        .eq('id', dados.acordoId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Acordo cancelado');
      queryClient.invalidateQueries({ queryKey: ['acordos'] });
      queryClient.invalidateQueries({ queryKey: ['acordo'] });
    }
  });

  const confirmarEntradaMutation = useMutation({
    mutationFn: async (acordoId: string) => {
      const { error } = await supabase
        .from('acordos')
        .update({
          entrada_paga: true,
          entrada_data_pagamento: new Date().toISOString().split('T')[0],
          status: 'ativo',
          updated_at: new Date().toISOString()
        })
        .eq('id', acordoId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Entrada confirmada!');
      queryClient.invalidateQueries({ queryKey: ['acordos'] });
      queryClient.invalidateQueries({ queryKey: ['acordo'] });
    }
  });

  return {
    acordos: acordosQuery.data || [],
    isLoading: acordosQuery.isLoading,
    criarAcordo: criarAcordoMutation.mutateAsync,
    isCriando: criarAcordoMutation.isPending,
    registrarPagamentoParcela: registrarPagamentoParcelaMutation.mutate,
    cancelarAcordo: cancelarAcordoMutation.mutate,
    confirmarEntrada: confirmarEntradaMutation.mutate
  };
}

export function useAcordo(id: string | undefined) {
  return useQuery({
    queryKey: ['acordo', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('acordos')
        .select(`
          *,
          associado:associados!acordos_associado_id_fkey(id, nome, cpf, telefone, email),
          parcelas:acordo_parcelas(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id
  });
}
