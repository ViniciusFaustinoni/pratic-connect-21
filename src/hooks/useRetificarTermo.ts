import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface RetificarTermoPayload {
  contrato_id: string;
  motivo: string;
  associado?: Record<string, unknown>;
  veiculo?: Record<string, unknown>;
  contrato?: Record<string, unknown>;
}

export function useRetificacoesContrato(contratoId: string | null | undefined) {
  return useQuery({
    queryKey: ['contrato-retificacoes', contratoId],
    enabled: !!contratoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contrato_retificacoes')
        .select('*')
        .eq('contrato_id', contratoId!)
        .order('versao', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRetificarTermo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RetificarTermoPayload) => {
      const { data, error } = await supabase.functions.invoke('retificar-termo-filiacao', {
        body: payload,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as {
        success: boolean;
        retificacao_id: string;
        versao: number;
        short_link: string | null;
        campos_alterados: string[];
      };
    },
    onSuccess: (data, vars) => {
      toast.success(`Retificação v${data.versao} enviada para assinatura`);
      qc.invalidateQueries({ queryKey: ['contrato-retificacoes', vars.contrato_id] });
      qc.invalidateQueries({ queryKey: ['associado'] });
    },
    onError: (e: any) => {
      toast.error(`Falha ao retificar: ${e?.message || 'erro desconhecido'}`);
    },
  });
}
