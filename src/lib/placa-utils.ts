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

/**
 * Para uso em cards/listas: exibe placa real quando existir; para 0KM,
 * exibe o chassi (que é o identificador físico do veículo sem placa).
 *  - Placa real → "ABC1D23"
 *  - 0KM com chassi → "0KM · 9BWZZZ..." (mode 'badge') ou "Chassi 9BWZZZ..." (mode 'full')
 *  - 0KM sem chassi → fallback ("0KM (sem placa)")
 */
export const formatPlacaOuChassi = (
  placa?: string | null,
  chassi?: string | null,
  opts: { mode?: 'badge' | 'full'; fallback?: string } = {}
): string => {
  const { mode = 'badge', fallback = '0KM (sem placa)' } = opts;
  if (placa && !isPlacaPlaceholder(placa)) return placa.trim().toUpperCase();
  const c = chassi?.trim().toUpperCase();
  if (c) return mode === 'badge' ? `0KM · ${c}` : `Chassi ${c}`;
  return fallback;
};

// ============================================================================
// Comparação resiliente de placa (tolera confusões comuns de OCR)
// ============================================================================

const PLACA_ANTIGA_REGEX = /^[A-Z]{3}[0-9]{4}$/;
const PLACA_MERCOSUL_REGEX = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

// Mapas de confusões comuns do OCR
const LETTER_TO_DIGIT: Record<string, string> = {
  O: '0', Q: '0', D: '0',
  I: '1', L: '1',
  Z: '2',
  S: '5',
  G: '6',
  T: '7',
  B: '8',
};

const DIGIT_TO_LETTER: Record<string, string> = {
  '0': 'O',
  '1': 'I',
  '2': 'Z',
  '5': 'S',
  '6': 'G',
  '8': 'B',
};

const limparPlaca = (p: string): string =>
  (p || '').replace(/[-\s]/g, '').toUpperCase().trim();

type FormatoPlaca = 'antiga' | 'mercosul' | 'desconhecido';

const detectarFormato = (placa: string): FormatoPlaca => {
  if (PLACA_ANTIGA_REGEX.test(placa)) return 'antiga';
  if (PLACA_MERCOSUL_REGEX.test(placa)) return 'mercosul';
  return 'desconhecido';
};

/**
 * Sanea a placa do OCR forçando-a a um formato específico, corrigindo
 * confusões comuns letra↔dígito por posição.
 */
const sanearParaFormato = (placa: string, formato: FormatoPlaca): string => {
  if (placa.length !== 7 || formato === 'desconhecido') return placa;

  return placa
    .split('')
    .map((ch, i) => {
      let isLetterPos = false;
      let isDigitPos = false;

      if (formato === 'antiga') {
        // ABC1234 — 0,1,2 letras; 3,4,5,6 dígitos
        isLetterPos = i <= 2;
        isDigitPos = i >= 3;
      } else {
        // ABC1D23 (Mercosul) — 0,1,2,4 letras; 3,5,6 dígitos
        isLetterPos = i <= 2 || i === 4;
        isDigitPos = i === 3 || i === 5 || i === 6;
      }

      if (isLetterPos && DIGIT_TO_LETTER[ch]) return DIGIT_TO_LETTER[ch];
      if (isDigitPos && LETTER_TO_DIGIT[ch]) return LETTER_TO_DIGIT[ch];
      return ch;
    })
    .join('');
};

/**
 * Compara duas placas de forma resiliente a erros comuns de OCR
 * (confusões entre 0/O, 1/I, 5/S, 6/G, 8/B etc.).
 *
 * A `placaEsperada` é tratada como referência confiável (vinda da cotação/cadastro)
 * e dita o formato (antigo vs Mercosul) usado para sanear a `placaOCR`.
 *
 * Retorna `true` quando, após saneamento, as placas batem.
 */
export const placasEquivalentes = (
  placaOCR?: string | null,
  placaEsperada?: string | null
): boolean => {
  const a = limparPlaca(placaOCR || '');
  const b = limparPlaca(placaEsperada || '');

  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length !== 7 || b.length !== 7) return false;

  // 1) Tentar saneamento usando o formato da placa esperada (referência confiável)
  const formatoEsperado = detectarFormato(b);
  if (formatoEsperado !== 'desconhecido') {
    const saneada = sanearParaFormato(a, formatoEsperado);
    if (saneada === b) return true;
  }

  // 2) Fallback cruzado: tentar o outro formato (caso a esperada esteja em formato
  //    inesperado ou o OCR tenha errado mais de uma posição em direção ambígua).
  const formatoOCR = detectarFormato(a);
  if (formatoOCR !== 'desconhecido' && formatoOCR !== formatoEsperado) {
    const saneadaCruzada = sanearParaFormato(a, formatoOCR);
    if (saneadaCruzada === b) return true;
  }

  // 3) Última tentativa: sanear ambas para o mesmo formato (antiga) e comparar
  const aAntiga = sanearParaFormato(a, 'antiga');
  const bAntiga = sanearParaFormato(b, 'antiga');
  if (aAntiga === bAntiga) return true;

  return false;
};

/**
 * Versão de `placasEquivalentes` que retorna detalhes para diagnóstico/log.
 */
export const compararPlacasComDetalhe = (
  placaOCR?: string | null,
  placaEsperada?: string | null
) => {
  const a = limparPlaca(placaOCR || '');
  const b = limparPlaca(placaEsperada || '');
  const formatoEsperado = detectarFormato(b);
  const placaSaneada =
    formatoEsperado !== 'desconhecido' ? sanearParaFormato(a, formatoEsperado) : a;
  return {
    placaOCR: a,
    placaSaneada,
    placaEsperada: b,
    formatoEsperado,
    equivalentes: placasEquivalentes(a, b),
  };
};
