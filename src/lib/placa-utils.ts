/**
 * Utilitários para tratamento de placas de veículos.
 *
 * Veículos 0km não possuem placa física, mas a coluna `placa` na tabela
 * `veiculos` é NOT NULL/UNIQUE. Para satisfazer a constraint, geramos um
 * placeholder técnico no formato `0KM` + 5 caracteres alfanuméricos
 * (ex: `0KM321B3`, `0KMA1B2C`). Esse valor não deve ser exibido ao usuário.
 */

const PLACA_PLACEHOLDER_REGEX = /^0KM[A-Z0-9]{5}$/i;

/**
 * Detecta se a placa é um placeholder técnico de veículo 0km.
 */
export const isPlacaPlaceholder = (placa?: string | null): boolean => {
  return !!placa && PLACA_PLACEHOLDER_REGEX.test(placa.trim());
};

/**
 * Formata uma placa para exibição ao usuário final.
 * - Placeholder de 0km → fallback amigável (default: "0KM (sem placa)").
 * - Vazio/null → fallback amigável.
 * - Placa real → uppercase.
 */
export const formatPlacaExibicao = (
  placa?: string | null,
  fallback = '0KM (sem placa)'
): string => {
  if (!placa || isPlacaPlaceholder(placa)) return fallback;
  return placa.trim().toUpperCase();
};
