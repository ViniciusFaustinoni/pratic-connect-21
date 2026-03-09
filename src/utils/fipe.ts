/**
 * Utilitários para estimativa de valor FIPE
 * Valores base, depreciação e ajustes por marca vêm da tabela configuracoes
 */

export interface EstimativaFipeConfig {
  base: number;
  depreciacao: number;
  ajusteMarca: Record<string, number>;
}

const DEFAULT_CONFIG: EstimativaFipeConfig = {
  base: 35000,
  depreciacao: 0.06,
  ajusteMarca: {
    Toyota: 1.3, Honda: 1.25, Hyundai: 1.15, Volkswagen: 1.1, Chevrolet: 1.05,
    Fiat: 1.0, Renault: 0.95, Nissan: 1.1, Jeep: 1.4, Ford: 1.0,
  },
};

/**
 * Estima o valor FIPE quando a API não retorna resultado.
 * @param marca - Marca do veículo
 * @param ano - Ano do modelo
 * @param config - Configuração dinâmica (do banco). Se não informada, usa defaults.
 */
export function estimarValorFipe(
  marca: string,
  ano: number,
  config?: Partial<EstimativaFipeConfig>,
): number {
  const base = config?.base ?? DEFAULT_CONFIG.base;
  const depreciacao = config?.depreciacao ?? DEFAULT_CONFIG.depreciacao;
  const ajuste = config?.ajusteMarca ?? DEFAULT_CONFIG.ajusteMarca;

  const fatorMarca = ajuste[marca] || 1.0;
  const anoAtual = new Date().getFullYear();
  const fatorDepreciacao = Math.max(0.5, 1 - (anoAtual - ano) * depreciacao);
  return Math.round(base * fatorMarca * fatorDepreciacao / 100) * 100;
}
