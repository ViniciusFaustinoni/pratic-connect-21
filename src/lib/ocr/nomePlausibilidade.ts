/**
 * Heurística de plausibilidade para nomes extraídos por OCR (CNH, RG, etc.).
 *
 * O OCR frequentemente confunde caracteres similares (E↔W, O↔0, I↔1, B↔8…)
 * em fotos com pouco contraste, reflexo na plastificação ou ângulo ruim.
 * Esta função detecta combinações de letras que praticamente não existem
 * em nomes próprios em português brasileiro e marca o nome para revisão
 * obrigatória antes de virar contrato.
 *
 * NÃO é uma validação ortográfica — é apenas um sinalizador de "muito
 * provavelmente errado" para forçar conferência humana.
 */

/** Bigramas e padrões extremamente raros em nomes próprios PT-BR. */
const PADROES_IMPROVAVEIS: Array<{ pattern: RegExp; motivo: string }> = [
  // W combinado com consoantes raríssimas no interior da palavra
  { pattern: /PW/i, motivo: 'sequência "PW"' },
  { pattern: /WP/i, motivo: 'sequência "WP"' },
  { pattern: /WX/i, motivo: 'sequência "WX"' },
  { pattern: /XW/i, motivo: 'sequência "XW"' },
  { pattern: /BW/i, motivo: 'sequência "BW"' },
  { pattern: /DW/i, motivo: 'sequência "DW"' },
  { pattern: /FW/i, motivo: 'sequência "FW"' },
  { pattern: /KW/i, motivo: 'sequência "KW"' },
  { pattern: /MW/i, motivo: 'sequência "MW"' },
  { pattern: /NW/i, motivo: 'sequência "NW"' },
  { pattern: /TW/i, motivo: 'sequência "TW"' },
  { pattern: /VW/i, motivo: 'sequência "VW"' },
  { pattern: /WB/i, motivo: 'sequência "WB"' },
  { pattern: /WD/i, motivo: 'sequência "WD"' },
  { pattern: /WK/i, motivo: 'sequência "WK"' },
  { pattern: /WM/i, motivo: 'sequência "WM"' },
  { pattern: /WN/i, motivo: 'sequência "WN"' },
  { pattern: /WT/i, motivo: 'sequência "WT"' },
  { pattern: /WV/i, motivo: 'sequência "WV"' },

  // Q sem U
  { pattern: /Q[^U\s]/i, motivo: 'Q sem U' },
  { pattern: /KQ/i, motivo: 'sequência "KQ"' },
  { pattern: /QZ/i, motivo: 'sequência "QZ"' },
  { pattern: /QK/i, motivo: 'sequência "QK"' },
  { pattern: /QX/i, motivo: 'sequência "QX"' },

  // Outros bigramas raríssimos
  { pattern: /ZX/i, motivo: 'sequência "ZX"' },
  { pattern: /XJ/i, motivo: 'sequência "XJ"' },
  { pattern: /KJ/i, motivo: 'sequência "KJ"' },
  { pattern: /JK/i, motivo: 'sequência "JK"' },
  { pattern: /JX/i, motivo: 'sequência "JX"' },

  // 3+ consoantes raras em sequência
  { pattern: /[BCDFGHJKLMNPQRSTVWXZ]{4,}/i, motivo: '4+ consoantes seguidas' },

  // Caracteres que NÃO deveriam estar em um nome
  { pattern: /[0-9]/, motivo: 'dígito numérico em nome' },
  { pattern: /[@#$%&*+=_<>{}[\]()|/\\]/, motivo: 'caractere especial em nome' },
];

export interface ValidacaoNomeOCR {
  /** true quando o nome passa em todas as heurísticas. */
  ok: boolean;
  /** Motivo legível quando ok=false. */
  motivo?: string;
}

/**
 * Detecta combinações tipograficamente improváveis no nome.
 * Retorna o primeiro motivo encontrado ou null.
 */
export function detectarCombinacaoImprovavel(nome: string): string | null {
  if (!nome) return null;
  for (const { pattern, motivo } of PADROES_IMPROVAVEIS) {
    if (pattern.test(nome)) return motivo;
  }
  return null;
}

/**
 * Valida um nome extraído por OCR.
 *
 * Critérios:
 *  - ≥ 2 palavras (nome + sobrenome).
 *  - Apenas letras (com acentos), espaço, hífen e apóstrofo.
 *  - Sem combinações tipograficamente improváveis.
 *  - Tamanho mínimo razoável.
 */
export function validarNomeOCR(nome: string | null | undefined): ValidacaoNomeOCR {
  const v = (nome || '').trim();
  if (!v) return { ok: false, motivo: 'Nome vazio' };
  if (v.length < 5) return { ok: false, motivo: 'Nome muito curto' };

  // Apenas letras (com acentos PT-BR), espaços, hífen, apóstrofo
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ\s'-]+$/.test(v)) {
    return { ok: false, motivo: 'Caracteres inválidos no nome' };
  }

  const palavras = v.split(/\s+/).filter(Boolean);
  if (palavras.length < 2) {
    return { ok: false, motivo: 'Informe nome e sobrenome' };
  }

  const motivoImpro = detectarCombinacaoImprovavel(v);
  if (motivoImpro) {
    return { ok: false, motivo: `Revise: ${motivoImpro} (provável erro de leitura)` };
  }

  return { ok: true };
}

/** Normaliza para comparação: maiúsculas, sem acento, espaços únicos. */
export function normalizarNomeComparacao(s: string | null | undefined): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
