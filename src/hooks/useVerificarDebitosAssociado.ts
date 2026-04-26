import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBuscaSGA, type BoletoAbertoSGA } from './useBuscaSGA';

export interface DebitoVeiculo {
  placa: string;
  modelo: string;
  marca: string;
  total: number;
  quantidade: number;
  boletos: BoletoAbertoSGA[];
}

export interface DebitosResult {
  temDebito: boolean;
  debitosPorVeiculo: DebitoVeiculo[];
  saldoTotal: number;
  /** True quando o SGA está temporariamente indisponível */
  erroTransitorio?: boolean;
}

/**
 * Verifica débitos em aberto consultando direto a API do SGA (Hinova).
 *
 * Aceita tanto CPF (string de 11 dígitos) quanto UUID local de associado:
 *  - CPF → consulta direta no SGA;
 *  - UUID → resolve o CPF na tabela `associados` e em seguida consulta o SGA.
 *
 * Não usa mais a tabela local `cobrancas` como fonte de verdade.
 */
export function useVerificarDebitosAssociado(cpfOrId: string | undefined) {
  const limpoDigitos = (cpfOrId || '').replace(/\D/g, '');
  const ehCpf = limpoDigitos.length === 11;
  const ehUuid =
    !!cpfOrId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cpfOrId);

  // Se veio UUID, resolvemos o CPF do associado local primeiro
  const { data: cpfFromUuid } = useQuery({
    queryKey: ['associado-cpf-from-uuid', cpfOrId],
    queryFn: async () => {
      if (!ehUuid) return null;
      const { data } = await supabase
        .from('associados')
        .select('cpf')
        .eq('id', cpfOrId!)
        .maybeSingle();
      return (data?.cpf || '').replace(/\D/g, '');
    },
    enabled: ehUuid,
    staleTime: 60_000,
  });

  const cpfFinal = ehCpf ? limpoDigitos : (cpfFromUuid || '');
  const cpfValido = cpfFinal.length === 11;

  const sga = useBuscaSGA({ cpf: cpfFinal, enabled: cpfValido });

  const data: DebitosResult = (() => {
    if (!sga.data || !sga.data.encontrado) {
      return {
        temDebito: false,
        debitosPorVeiculo: [],
        saldoTotal: 0,
        erroTransitorio: !!sga.data?.erro_transitorio,
      };
    }
    const debitosPorVeiculo: DebitoVeiculo[] = sga.data.veiculos
      .filter((v) => v.boletos_abertos.length > 0)
      .map((v) => ({
        placa: v.placa || 'N/A',
        modelo: v.modelo || 'Não identificado',
        marca: v.marca || '',
        total: v.saldo_devedor,
        quantidade: v.boletos_abertos.length,
        boletos: v.boletos_abertos,
      }));
    return {
      temDebito: debitosPorVeiculo.length > 0,
      debitosPorVeiculo,
      saldoTotal: sga.data.saldo_devedor_total,
    };
  })();

  return { ...sga, data };
}
