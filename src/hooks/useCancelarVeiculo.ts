import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CancelarVeiculoArgs {
  veiculoId: string;
  motivo: string;
}

interface CancelarVeiculoResult {
  ok: boolean;
  veiculoId: string;
  placa: string;
  associadoCancelado: boolean;
  results: Array<{ step: string; ok: boolean; detail?: string }>;
}

export function useCancelarVeiculo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ veiculoId, motivo }: CancelarVeiculoArgs): Promise<CancelarVeiculoResult> => {
      const { data, error } = await supabase.functions.invoke('cancelar-veiculo', {
        body: { veiculoId, motivo },
      });
      // Edge errors (não-2xx) chegam em `error`; o body bruto fica em data quando possível.
      if (error) {
        // Tenta extrair code do response body
        const ctx: any = (error as any).context;
        let code: string | undefined;
        try {
          const txt = ctx?.responseText || (await ctx?.response?.text?.());
          if (txt) code = JSON.parse(txt)?.error;
        } catch { /* ignore */ }
        const err: any = new Error(code || error.message);
        err.code = code;
        throw err;
      }
      return data as CancelarVeiculoResult;
    },
    onSuccess: (data) => {
      if (data?.associadoCancelado) {
        toast.success('Veículo cancelado. Associado também foi cancelado (sem veículos/contratos ativos).');
      } else {
        toast.success('Veículo cancelado e processos vinculados encerrados.');
      }
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos-paginados'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
    },
    onError: (err: any) => {
      const code = err?.code || err?.message;
      if (code === 'TROCA_EM_ANDAMENTO') {
        toast.error('Há troca de titularidade em andamento para este veículo. Conclua ou cancele a troca antes.');
      } else if (code === 'SUBSTITUICAO_EM_ANDAMENTO') {
        toast.error('Há substituição em andamento para este veículo. Conclua ou cancele a substituição antes.');
      } else if (code === 'veiculo_em_estado_terminal') {
        toast.error('Este veículo já está em estado terminal (cancelado/vendido/transferido).');
      } else if (code === 'motivo_obrigatorio') {
        toast.error('Informe um motivo de cancelamento.');
      } else {
        toast.error(`Erro ao cancelar veículo: ${err?.message || 'desconhecido'}`);
      }
    },
  });
}
