import { useBuscaSGA } from './useBuscaSGA';

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
 */
export function useBuscaPlaca(termo: string) {
  const placaLimpa = (termo || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  // Só consulta SGA quando o termo bate o formato real de placa (Mercosul AAA0A00 ou antiga AAA0000).
  // Evita disparar SGA para nomes longos (ex.: "MARCOSVINICIUS"), o que gerava 503/runtime error.
  const PLACA_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;
  const enabled = PLACA_REGEX.test(placaLimpa);

  const sga = useBuscaSGA({ placa: placaLimpa, enabled });

  let results: PlacaSearchResult[] = [];
  if (sga.data?.encontrado) {
    const veiculo = sga.data.veiculos.find((v) => v.placa === placaLimpa) || sga.data.veiculos[0];
    if (veiculo) {
      results = [
        {
          veiculoId: String(veiculo.codigo_veiculo),
          placa: veiculo.placa || '',
          modelo: veiculo.modelo || '',
          marca: veiculo.marca || '',
          associadoId: String(sga.data.codigo_associado),
          associadoNome: sga.data.associado?.nome || '',
          associadoCpf: sga.data.associado?.cpf || '',
          associadoStatus: 'ativo',
          origem_sga: true,
        },
      ];
    }
  }

  return { ...sga, data: results, sga: sga.data };
}
