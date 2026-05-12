import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SolicitacaoSubstituicao {
  id: string;
  associado_id: string | null;
  veiculo_antigo_id: string | null;
  veiculo_antigo_placa: string;
  veiculo_antigo_snapshot: any;
  associado_snapshot: any;
  cotacao_id: string | null;
  status: 'aguardando_termo' | 'termo_enviado' | 'termo_assinado' | 'cotacao_criada' | 'efetivada' | 'cancelada';
  termo_cancelamento_autentique_id: string | null;
  termo_cancelamento_url: string | null;
  termo_cancelamento_enviado_em: string | null;
  termo_cancelamento_assinado_em: string | null;
  termo_whatsapp_status: string | null;
  termo_reenvios_count: number;
  termo_ultimo_reenvio_em: string | null;
  created_at: string;
  updated_at: string;
}

export function useSolicitacaoSubstituicao(id: string | null | undefined) {
  return useQuery({
    queryKey: ['solicitacao-substituicao', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solicitacoes_substituicao_placa' as any)
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as SolicitacaoSubstituicao | null;
    },
    refetchInterval: 15000,
  });
}

export function useCriarSolicitacaoSubstituicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (placa: string) => {
      const { data, error } = await supabase.functions.invoke('criar-solicitacao-substituicao', {
        body: { placa },
      });
      if (error) {
        let msg: string | undefined;
        try {
          const anyErr = error as any;
          if (anyErr?.context && typeof anyErr.context.json === 'function') {
            const body = await anyErr.context.json();
            msg = body?.error;
          }
        } catch { /* ignore */ }
        throw new Error(msg || error.message);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { id: string; reutilizada: boolean; status: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['outros-processos'] }),
  });
}

export function useEnviarTermoCancelamentoSubstituicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { solicitacao_id: string; force_resend?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('enviar-termo-cancelamento-substituicao', {
        body: vars,
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['solicitacao-substituicao', vars.solicitacao_id] });
      qc.invalidateQueries({ queryKey: ['outros-processos'] });
    },
  });
}
