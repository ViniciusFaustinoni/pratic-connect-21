import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SituacaoFinanceiraCheck {
  id: string;
  contrato_id: string | null;
  solicitacao_troca_id: string | null;
  cpf: string;
  codigo_hinova: number | null;
  verificado_em: string;
  tem_debito: boolean;
  saldo_devedor: number;
  qtd_boletos_abertos: number;
  origem_resultado:
    | 'sga'
    | 'transitorio'
    | 'associado_inexistente_sga'
    | 'bypass'
    | 'erro';
  motivo: string | null;
  bypass: boolean;
  bypass_motivo: string | null;
  payload: any;
}

interface GateResponse {
  ok: boolean;
  check: SituacaoFinanceiraCheck;
  liberado: boolean;
  cached?: boolean;
  sga?: any;
}

interface Args {
  contratoId?: string | null;
  solicitacaoTrocaId?: string | null;
  /** Quando true, dispara automaticamente ao montar. */
  enabled?: boolean;
}

export function useSituacaoFinanceiraCadastro({
  contratoId = null,
  solicitacaoTrocaId = null,
  enabled = true,
}: Args) {
  const qc = useQueryClient();
  const key = ['situacao-financeira-cadastro', contratoId, solicitacaoTrocaId];

  const query = useQuery<GateResponse>({
    queryKey: key,
    enabled: enabled && !!(contratoId || solicitacaoTrocaId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        'verificar-situacao-financeira-cadastro',
        {
          body: {
            contrato_id: contratoId ?? undefined,
            solicitacao_troca_id: solicitacaoTrocaId ?? undefined,
          },
        }
      );
      if (error) throw error;
      return data as GateResponse;
    },
  });

  // Dispara consulta no SGA imediatamente ao montar a tela (mesmo se já houver cache no DB)
  useEffect(() => {
    if (!enabled) return;
    if (!contratoId && !solicitacaoTrocaId) return;
    // a query já dispara — esse efeito existe só para deixar explícito o "auto-disparo"
  }, [enabled, contratoId, solicitacaoTrocaId]);

  const reconsultar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        'verificar-situacao-financeira-cadastro',
        {
          body: {
            contrato_id: contratoId ?? undefined,
            solicitacao_troca_id: solicitacaoTrocaId ?? undefined,
            force: true,
          },
        }
      );
      if (error) throw error;
      return data as GateResponse;
    },
    onSuccess: (data) => qc.setQueryData(key, data),
  });

  const bypass = useMutation({
    mutationFn: async (motivo: string) => {
      const { data, error } = await supabase.functions.invoke(
        'verificar-situacao-financeira-cadastro',
        {
          body: {
            contrato_id: contratoId ?? undefined,
            solicitacao_troca_id: solicitacaoTrocaId ?? undefined,
            bypass: { motivo },
          },
        }
      );
      if (error) throw error;
      return data as GateResponse;
    },
    onSuccess: (data) => qc.setQueryData(key, data),
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    reconsultar,
    bypass,
  };
}
