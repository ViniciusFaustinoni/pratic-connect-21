import { useConfiguracoesAll } from './useConfiguracoesAll';

const FIPE_MINIMO_RASTREADOR_PADRAO = 30000;
const FIPE_MINIMO_RASTREADOR_MOTO_PADRAO = 9000;

/** Lê do cache global (1 fetch para a app inteira). Mantém shape `useQuery`. */
export function useConfigFipeRastreador() {
  const q = useConfiguracoesAll();
  const data = Number(q.data?.['operacional_fipe_minimo_rastreador']) || FIPE_MINIMO_RASTREADOR_PADRAO;
  return { ...q, data } as typeof q & { data: number };
}

export function useConfigFipeRastreadorMoto() {
  const q = useConfiguracoesAll();
  const data = Number(q.data?.['operacional_fipe_minimo_rastreador_moto']) || FIPE_MINIMO_RASTREADOR_MOTO_PADRAO;
  return { ...q, data } as typeof q & { data: number };
}

/**
 * Verifica se o veículo precisa de rastreador baseado no valor FIPE e tipo de veículo
 */
export function precisaRastreador(
  valorFipe: number | null | undefined,
  fipeMinimo: number,
  tipoVeiculo: 'automovel' | 'moto' = 'automovel',
  fipeMinimoMoto?: number
): boolean {
  const limite = tipoVeiculo === 'moto' ? (fipeMinimoMoto ?? FIPE_MINIMO_RASTREADOR_MOTO_PADRAO) : fipeMinimo;
  
  // Se não tem FIPE cadastrado, exige por segurança
  if (valorFipe === null || valorFipe === undefined || valorFipe <= 0) {
    return true;
  }
  // Se FIPE >= mínimo configurado, exige rastreador
  return valorFipe >= limite;
}
