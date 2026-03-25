import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SGAVerificacaoResult {
  existe: boolean;
  mensagem?: string;
  aviso?: string;
}

export function useVerificarVeiculoSGA() {
  return useMutation({
    mutationFn: async (placa: string): Promise<SGAVerificacaoResult> => {
      const { data, error } = await supabase.functions.invoke('sga-verificar-veiculo', {
        body: { placa },
      });

      if (error) {
        console.error('[SGA Verificar] Erro na chamada:', error);
        // Em caso de erro, não bloquear a cotação
        return { existe: false, aviso: 'Erro ao verificar no SGA' };
      }

      return data as SGAVerificacaoResult;
    },
  });
}
