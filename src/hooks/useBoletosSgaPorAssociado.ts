import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SgaAssociadoCompleto } from './useBuscaSGA';

/**
 * Busca veículos + boletos do associado no SGA usando o `codigo_hinova`
 * canônico do espelho local. Substitui `useBuscaSGA({ cpf })` no fluxo de
 * Troca de Titularidade (a base local é a fonte de verdade primeiro).
 *
 * Retorna o mesmo shape de `SgaAssociadoCompleto` para reuso da UI.
 */
export function useBoletosSgaPorAssociado(
  codigoHinova: number | null | undefined,
  cpfFallback?: string | null,
  enabled = true,
) {
  const codigo = codigoHinova && codigoHinova > 0 ? codigoHinova : null;
  const cpf = (cpfFallback || '').replace(/\D/g, '');
  const podeBuscar = enabled && (!!codigo || cpf.length === 11);

  return useQuery<SgaAssociadoCompleto>({
    queryKey: ['sga-boletos-por-associado', codigo, cpf],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        'sga-listar-boletos-associado',
        { body: { codigo_associado: codigo, cpf } },
      );
      if (error) {
        return {
          encontrado: false,
          codigo_associado: codigo,
          associado: null,
          veiculos: [],
          saldo_devedor_total: 0,
          tem_debito: false,
          origem_busca: 'cpf',
          erro_transitorio: true,
          motivo: 'invoke_error',
        } as SgaAssociadoCompleto;
      }
      return data as SgaAssociadoCompleto;
    },
    enabled: podeBuscar,
    staleTime: 30_000,
    gcTime: 2 * 60_000,
    retry: (failureCount, _err) => failureCount < 2,
    retryDelay: (attempt) => Math.min(2000 * 2 ** attempt, 8_000),
  });
}
