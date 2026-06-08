import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type AprovacaoBypassTroca = {
  id: string;
  tipo: 'bypass_janela' | 'troca_convertida_cotacao';
  status: 'ciente_pendente' | 'ciente';
  solicitacao_troca_id: string | null;
  contrato_id: string | null;
  cotacao_id: string | null;
  associado_id: string | null;
  veiculo_id: string | null;
  placa: string | null;
  nome_autorizador: string;
  justificativa: string;
  operador_user_id: string | null;
  operador_nome: string | null;
  ciente_por: string | null;
  ciente_em: string | null;
  observacao_supervisor: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  // Joins
  cotacao?: { numero: string | null; nome_solicitante: string | null } | null;
  veiculo?: { marca: string | null; modelo: string | null; ano: number | null; placa: string | null } | null;
  contrato?: { numero_contrato: string | null } | null;
};

export function useAprovacoesBypassTroca(status?: string) {
  return useQuery({
    queryKey: ['aprovacoes-bypass-troca', status ?? 'todas'],
    queryFn: async (): Promise<AprovacaoBypassTroca[]> => {
      let q = supabase
        .from('aprovacoes_bypass_troca' as any)
        .select(
          `*,
          cotacao:cotacao_id ( numero, nome_solicitante ),
          veiculo:veiculo_id ( marca, modelo, ano, placa ),
          contrato:contrato_id ( numero_contrato )`,
        )
        .order('created_at', { ascending: false })
        .limit(500);
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useAprovacoesBypassTrocaPendentesCount() {
  return useQuery({
    queryKey: ['aprovacoes-bypass-troca-count'],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('aprovacoes_bypass_troca' as any)
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ciente_pendente');
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useMarcarCienteBypassTroca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, observacao }: { id: string; observacao?: string }) => {
      const { data, error } = await supabase.functions.invoke('marcar-ciente-bypass-troca', {
        body: { id, observacao: observacao || '' },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      toast.success('Marcado como ciente');
      qc.invalidateQueries({ queryKey: ['aprovacoes-bypass-troca'] });
      qc.invalidateQueries({ queryKey: ['aprovacoes-bypass-troca-count'] });
    },
    onError: (e: any) => {
      toast.error(`Falha ao marcar como ciente: ${e?.message || 'erro'}`);
    },
  });
}
