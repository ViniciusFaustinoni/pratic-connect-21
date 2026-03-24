import { useCoberturaCidade, CoberturaVistoria } from './useCoberturaCidade';

export type TipoCobertura = 'coberta_comum' | 'area_prestador' | 'fora_cobertura';

interface UseCoberturaInstalacaoParams {
  cidade?: string;
  uf?: string;
  status?: string;
  instalador_id?: string | null;
}

interface UseCoberturaInstalacaoResult {
  tipo: TipoCobertura | null;
  isLoading: boolean;
  cobertura: CoberturaVistoria | undefined;
}

const STATUS_NAO_AVALIAR = ['concluida', 'cancelada', 'em_andamento', 'em_rota'];

export function useCoberturaInstalacao({
  cidade,
  uf,
  status,
  instalador_id,
}: UseCoberturaInstalacaoParams): UseCoberturaInstalacaoResult {
  const deveAvaliar = !instalador_id && !!status && !STATUS_NAO_AVALIAR.includes(status);

  const { data: cobertura, isLoading } = useCoberturaCidade(
    deveAvaliar ? cidade : undefined,
    deveAvaliar ? uf : undefined,
  );

  if (!deveAvaliar) {
    return { tipo: null, isLoading: false, cobertura: undefined };
  }

  if (isLoading || !cobertura) {
    return { tipo: null, isLoading, cobertura: undefined };
  }

  let tipo: TipoCobertura;
  if (cobertura.tem_comum) {
    tipo = 'coberta_comum';
  } else if (cobertura.tem_prestador) {
    tipo = 'area_prestador';
  } else {
    tipo = 'fora_cobertura';
  }

  return { tipo, isLoading: false, cobertura };
}
