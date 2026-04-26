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
 * IMPORTANTE: O parâmetro mudou — agora aceita CPF (string de 11 dígitos)
 * em vez do `associado_id` local, porque a fonte de verdade não é mais
 * a tabela `cobrancas` do nosso banco.
 *
 * Para retrocompatibilidade, se receber um UUID (associado_id local),
 * o hook simplesmente não faz a busca e retorna sem débito — esses
 * call sites devem migrar para passar o CPF.
 */
export function useVerificarDebitosAssociado(cpfOrId: string | undefined) {
  const limpo = (cpfOrId || '').replace(/\D/g, '');
  const ehCpf = limpo.length === 11;

  const sga = useBuscaSGA({ cpf: ehCpf ? limpo : undefined, enabled: ehCpf });

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
