import { useBuscaSGA, extractTransientPayload, type SgaAssociadoCompleto } from './useBuscaSGA';

export interface PlacaSearchResult {
  veiculoId: string; // codigo_veiculo SGA
  placa: string;
  modelo: string;
  marca: string;
  associadoId: string; // codigo_associado SGA
  associadoNome: string;
  associadoCpf: string;
  associadoStatus: string;
  origem_sga: true;
}

/**
 * Busca veículos pela placa via API SGA (não mais base local).
 * Retorna no máximo um veículo (a placa é única no SGA), mas mantém
 * a interface de array para compat com consumidores.
 *
 * Adicionalmente expõe `erroTransitorio` e `motivoTransitorio` para que a UI
 * mostre um banner "Tentar novamente" em vez de afirmar "nenhum encontrado"
 * quando a API SGA estiver instável.
 */
export function useBuscaPlaca(termo: string) {
  const placaLimpa = (termo || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  // Só consulta SGA quando o termo bate o formato real de placa (Mercosul AAA0A00 ou antiga AAA0000).
  // Evita disparar SGA para nomes longos (ex.: "MARCOSVINICIUS"), o que gerava 503/runtime error.
  const PLACA_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;
  const enabled = PLACA_REGEX.test(placaLimpa);

  const sga = useBuscaSGA({ placa: placaLimpa, enabled });

  // Extrai payload soft mesmo quando o RQ falhou todos os retries (transitório).
  const transientPayload = sga.error ? extractTransientPayload(sga.error) : null;
  const sgaPayload: SgaAssociadoCompleto | null = sga.data ?? transientPayload;

  let results: PlacaSearchResult[] = [];
  if (sgaPayload?.encontrado) {
    const veiculo =
      sgaPayload.veiculos.find((v) => v.placa === placaLimpa) || sgaPayload.veiculos[0];
    if (veiculo) {
      results = [
        {
          veiculoId: String(veiculo.codigo_veiculo),
          placa: veiculo.placa || '',
          modelo: veiculo.modelo || '',
          marca: veiculo.marca || '',
          associadoId: String(sgaPayload.codigo_associado),
          associadoNome: sgaPayload.associado?.nome || '',
          associadoCpf: sgaPayload.associado?.cpf || '',
          associadoStatus: 'ativo',
          origem_sga: true,
        },
      ];
    }
  }

  return {
    ...sga,
    data: results,
    sga: sgaPayload,
    erroTransitorio: !!sgaPayload?.erro_transitorio || !!transientPayload,
    motivoTransitorio: sgaPayload?.motivo || transientPayload?.motivo || null,
  };
}
