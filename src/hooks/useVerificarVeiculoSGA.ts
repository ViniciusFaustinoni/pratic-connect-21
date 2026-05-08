import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SgaAssociadoCompleto } from './useBuscaSGA';

interface SGAVerificacaoResult {
  existe: boolean;
  mensagem?: string;
  aviso?: string;
  /** True quando a falha foi transitória (auth/janela/5xx). UI deve oferecer retry,
   *  não afirmar "veículo não cadastrado". */
  erroTransitorio?: boolean;
  motivoTransitorio?: string | null;
  /** Payload completo do SGA quando existe — usado para mostrar débitos */
  sga?: SgaAssociadoCompleto;
}

/**
 * Verifica via API SGA (Hinova) se uma placa já existe no sistema.
 * Não consulta mais a base local de veículos.
 */
export function useVerificarVeiculoSGA() {
  return useMutation({
    mutationFn: async (placa: string): Promise<SGAVerificacaoResult> => {
      const placaLimpa = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (placaLimpa.length < 7) return { existe: false };

      const { data, error } = await supabase.functions.invoke('sga-buscar-associado-completo', {
        body: { placa: placaLimpa },
      });

      if (error) {
        console.warn('[Verificar Veículo SGA] invoke error → transitório:', error.message);
        return {
          existe: false,
          erroTransitorio: true,
          motivoTransitorio: 'invoke_error',
          aviso: 'API SGA temporariamente indisponível. Tente novamente em instantes.',
        };
      }

      const payload = data as SgaAssociadoCompleto;

      if (payload?.erro_transitorio) {
        return {
          existe: false,
          erroTransitorio: true,
          motivoTransitorio: payload.motivo || null,
          aviso: 'API SGA temporariamente indisponível. Tente novamente em instantes.',
        };
      }

      if (payload?.encontrado) {
        return {
          existe: true,
          mensagem: 'Veículo já cadastrado no sistema SGA (Hinova)',
          sga: payload,
        };
      }

      return { existe: false };
    },
  });
}
