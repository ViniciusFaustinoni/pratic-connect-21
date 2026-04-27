import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type FormaPagamentoAlteravel = 'PIX' | 'BOLETO' | 'CREDIT_CARD';

interface AlterarFormaPagamentoInput {
  cobrancaId: string;
  novaForma: FormaPagamentoAlteravel;
  associadoId?: string;
}

interface AlterarFormaPagamentoResponse {
  success: boolean;
  recriou?: boolean;
  cobranca?: any;
  pix?: { encodedImage?: string; payload?: string; expirationDate?: string } | null;
  asaas_id?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  error?: string;
}

export function useAlterarFormaPagamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ cobrancaId, novaForma }: AlterarFormaPagamentoInput): Promise<AlterarFormaPagamentoResponse> => {
      const { data, error } = await supabase.functions.invoke('asaas-alterar-forma-pagamento', {
        body: { cobrancaId, novaForma },
      });
      if (error) throw new Error(error.message || 'Erro ao alterar forma de pagamento');
      if (!data?.success) throw new Error(data?.error || 'Erro ao alterar forma de pagamento');
      return data as AlterarFormaPagamentoResponse;
    },
    onSuccess: (_data, vars) => {
      toast.success('Forma de pagamento alterada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['cobrancas'] });
      queryClient.invalidateQueries({ queryKey: ['cobrancas-associado'] });
      queryClient.invalidateQueries({ queryKey: ['resumo-financeiro-associado'] });
      queryClient.invalidateQueries({ queryKey: ['my-boletos'] });
      queryClient.invalidateQueries({ queryKey: ['my-boleto'] });
      if (vars.associadoId) {
        queryClient.invalidateQueries({ queryKey: ['associado-historico', vars.associadoId] });
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Falha ao alterar forma de pagamento');
    },
  });
}
