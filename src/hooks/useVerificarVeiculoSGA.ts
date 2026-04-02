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
      const placaNormalizada = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

      if (placaNormalizada.length < 7) {
        return { existe: false };
      }

      const { data, error } = await supabase
        .from('veiculos')
        .select('id, placa, modelo, marca, associado_id')
        .eq('placa', placaNormalizada)
        .eq('status', 'ativo')
        .limit(1);

      if (error) {
        console.error('[Verificar Veículo] Erro na consulta:', error);
        return { existe: false, aviso: 'Erro ao verificar veículo no sistema' };
      }

      return {
        existe: !!(data && data.length > 0),
        mensagem: data?.length ? 'Veículo já cadastrado no sistema' : undefined,
      };
    },
  });
}
