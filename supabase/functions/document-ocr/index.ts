import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiGatewayFetch, getActiveAIConfig, callAI } from "../_shared/ai-client.ts";
// unpdf: extração de texto nativo de PDF para runtimes serverless (Deno/edge),
// sem worker e sem dependência de canvas. Substitui pdfjs-dist que falhava com
// "Setting up fake worker failed" no edge runtime do Supabase.
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";
import { rasterizePdfPages, shouldRasterizePdf } from "../_shared/pdf-rasterize.ts";
import { runMistralOcr, callPixtralChat } from "../_shared/mistral-ocr.ts";
import { extractPdfTextUnpdf, scoreExtractedText } from "../_shared/unpdf-extract.ts";
import { routeOcr, type OcrMethod } from "../_shared/ocr-router.ts";
import { shrinkImageBase64 } from "../_shared/image-shrink.ts";
import { extractMrzLine, validateMrzCheckDigit, getRegistroFromMrz } from "../_shared/mrz.ts";

// Teto por imagem ao mandar para provedor multimodal.
// Anthropic e Gemini medem a STRING BASE64 contra ~5MB por imagem.
// Usamos 4MB de teto em base64 como margem de segurança contra o hard limit.
// Aplicado independente do modelo destino (Anthropic OU Gemini).
// https://docs.anthropic.com/en/docs/build-with-claude/vision#image-size
const MAX_IMAGE_BASE64_BYTES = 4_000_000;
// Equivalente em bytes raw (binário) para checagens legadas.
const MAX_IMAGE_BYTES = Math.floor((MAX_IMAGE_BASE64_BYTES * 3) / 4); // ~3MB raw

// ============================================================
// Motor de OCR (engine) — lê ocr_engine_config (singleton)
// ============================================================
type OcrEngine = 'auto' | 'global' | 'mistral' | 'anthropic' | 'google';
interface OcrEngineConfig {
  engine: OcrEngine;
  primary_model: string;
  secondary_model: string | null;
  dupla_leitura_tipos: string[];
  pdf_rasterizar: boolean;
  pdf_dpi: number;
}
const DEFAULT_OCR_ENGINE: OcrEngineConfig = {
  engine: 'auto',
  // Mistral REMOVIDO do pipeline (2026-04-30): default agora é Claude Sonnet 4.5.
  primary_model: 'claude-sonnet-4-5',
  secondary_model: 'claude-opus-4-5',
  dupla_leitura_tipos: ['cnh', 'crlv'],
  pdf_rasterizar: true,
  pdf_dpi: 144,
};
let _engineCache: { value: OcrEngineConfig; ts: number } | null = null;
async function getOcrEngineConfig(): Promise<OcrEngineConfig> {
  if (_engineCache && Date.now() - _engineCache.ts < 30_000) return _engineCache.value;
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !srk) return DEFAULT_OCR_ENGINE;
    const sb = createClient(url, srk);
    const { data } = await sb.from('ocr_engine_config').select('*').limit(1).maybeSingle();
    const value: OcrEngineConfig = data ? {
      engine: data.engine,
      primary_model: data.primary_model,
      secondary_model: data.secondary_model,
      dupla_leitura_tipos: data.dupla_leitura_tipos ?? ['cnh', 'crlv'],
      pdf_rasterizar: data.pdf_rasterizar ?? true,
      pdf_dpi: data.pdf_dpi ?? 144,
    } : DEFAULT_OCR_ENGINE;
    _engineCache = { value, ts: Date.now() };
    return value;
  } catch (e) {
    console.warn('[OCR] falha lendo ocr_engine_config:', (e as Error)?.message);
    return DEFAULT_OCR_ENGINE;
  }
}
const ENGINE_DEFAULTS: Record<'mistral'|'anthropic'|'google', { primary: string; secondary: string }> = {
  mistral:   { primary: 'mistral-ocr-latest',    secondary: 'pixtral-large-latest' },
  anthropic: { primary: 'claude-sonnet-4-5',     secondary: 'claude-opus-4-5' },
  google:    { primary: 'google/gemini-2.5-pro', secondary: 'google/gemini-2.5-pro' },
};
async function resolveEngine(cfg: OcrEngineConfig): Promise<{ engine: 'mistral'|'anthropic'|'google'; primary: string; secondary: string }> {
  // ⚠️ Mistral REMOVIDO do pipeline runtime (2026-04-30). Se a config persistida
  // ainda apontar engine='mistral', forçamos Anthropic. Código do Mistral
  // permanece no repositório (mistral-ocr.ts, runMistralPass) para reativação
  // futura, mas nunca é executado.
  if (cfg.engine === 'mistral') {
    return {
      engine: 'anthropic',
      primary: ENGINE_DEFAULTS.anthropic.primary,
      secondary: ENGINE_DEFAULTS.anthropic.secondary,
    };
  }
  if (cfg.engine !== 'global' && cfg.engine !== 'auto') {
    return {
      engine: cfg.engine,
      primary: cfg.primary_model || ENGINE_DEFAULTS[cfg.engine].primary,
      secondary: cfg.secondary_model || ENGINE_DEFAULTS[cfg.engine].secondary,
    };
  }
  // 'global' ou 'auto': usa provedor configurado no AIConfig (anthropic/google).
  const ai = await getActiveAIConfig();
  const eng: 'anthropic'|'google' = ai.provider === 'anthropic' ? 'anthropic' : 'google';
  return { engine: eng, primary: ENGINE_DEFAULTS[eng].primary, secondary: ENGINE_DEFAULTS[eng].secondary };
}

/** Compara campos críticos entre duas leituras (para CNH/CRLV). */
function compareCriticalFields(a: any, b: any, tipo: string): {
  matches: number; total: number; mismatches: Array<{ field: string; a: any; b: any }>;
} {
  const fieldsByType: Record<string, string[]> = {
    cnh:  ['cpf', 'nome', 'numero_registro', 'validade', 'categoria'],
    crlv: ['placa', 'renavam', 'chassi', 'ano_modelo', 'marca', 'modelo'],
  };
  const fields = fieldsByType[tipo] ?? [];
  const dadosA = a?.dados ?? {};
  const dadosB = b?.dados ?? {};
  const mismatches: Array<{ field: string; a: any; b: any }> = [];
  let matches = 0;
  for (const f of fields) {
    const va = normForCompare(dadosA[f]);
    const vb = normForCompare(dadosB[f]);
    if (va && vb && va === vb) matches++;
    else if (va !== vb) mismatches.push({ field: f, a: dadosA[f] ?? null, b: dadosB[f] ?? null });
  }
  return { matches, total: fields.length, mismatches };
}
function normForCompare(v: any): string {
  if (v == null) return '';
  return String(v).toLowerCase().replace(/[^\w]/g, '');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ============================================================
// Validadores de campos brasileiros (checksum)
// ============================================================

// Validação de CPF por dígito verificador
function validateCPF(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleaned[i]) * (10 - i);
  let r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(cleaned[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * (11 - i);
  r = (sum * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(cleaned[10]);
}

// Validação de CNPJ por dígito verificador
function validateCNPJ(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += parseInt(cleaned[i]) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === parseInt(cleaned[12]) && calc(13) === parseInt(cleaned[13]);
}

// Placa brasileira: ABC1234 (antiga) ou ABC1D23 (Mercosul)
function validatePlaca(placa: string): boolean {
  if (!placa) return false;
  const cleaned = placa.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (cleaned.length !== 7) return false;
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(cleaned);
}

// Mapas para desambiguar caracteres confundidos pelo OCR (Mercosul vs antigo)
const DIGIT_TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '5': 'S', '8': 'B', '2': 'Z', '6': 'G' };
const LETTER_TO_DIGIT: Record<string, string> = { 'O': '0', 'I': '1', 'S': '5', 'B': '8', 'Z': '2', 'G': '6', 'T': '7', 'L': '1', 'Q': '0' };

// Pares de dígitos visualmente confundíveis em CRLVs físicos esmaecidos.
// Ordem: o primeiro é o "default seguro" (mais comum em casos limítrofes).
const DIGIT_SWAPS: Array<[string, string]> = [
  ['6', '8'], ['8', '6'],
  ['0', '8'], ['8', '0'],
  ['5', '6'], ['6', '5'],
  ['1', '7'], ['7', '1'],
  ['0', '9'], ['9', '0'],
  ['3', '8'], ['8', '3'],
  ['2', '7'], ['7', '2'],
];

const PLACA_MERCOSUL_RE = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
const PLACA_ANTIGA_RE = /^[A-Z]{3}[0-9]{4}$/;

/**
 * Gera todas as variantes plausíveis da placa para cobrir confusões OCR
 * comuns entre Mercosul (LLL N L NN) e formato antigo (LLL NNNN).
 * Inclui:
 *  - placa original
 *  - normalização Mercosul / antiga (swaps letra↔dígito)
 *  - variantes com 1 swap dígito↔dígito nas posições numéricas (6↔8, etc.)
 *
 * Limita a 1 swap por candidato para manter o conjunto pequeno (<30 itens).
 */
function gerarCandidatosPlaca(raw: string): string[] {
  if (!raw) return [];
  const cleaned = raw.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (cleaned.length !== 7) return [cleaned];
  const out = new Set<string>([cleaned]);

  // Variante 1: força Mercosul (5ª posição = letra)
  const mercosul = cleaned.split('');
  for (const i of [0, 1, 2, 4]) {
    const ch = mercosul[i];
    if (/[0-9]/.test(ch) && DIGIT_TO_LETTER[ch]) mercosul[i] = DIGIT_TO_LETTER[ch];
  }
  for (const i of [3, 5, 6]) {
    const ch = mercosul[i];
    if (/[A-Z]/.test(ch) && LETTER_TO_DIGIT[ch]) mercosul[i] = LETTER_TO_DIGIT[ch];
  }
  out.add(mercosul.join(''));

  // Variante 2: força antiga (5ª posição = dígito)
  const antiga = cleaned.split('');
  for (const i of [0, 1, 2]) {
    const ch = antiga[i];
    if (/[0-9]/.test(ch) && DIGIT_TO_LETTER[ch]) antiga[i] = DIGIT_TO_LETTER[ch];
  }
  for (const i of [3, 4, 5, 6]) {
    const ch = antiga[i];
    if (/[A-Z]/.test(ch) && LETTER_TO_DIGIT[ch]) antiga[i] = LETTER_TO_DIGIT[ch];
  }
  out.add(antiga.join(''));

  // Variante 3: para CADA placa já no conjunto que seja válida, gera variantes
  // com 1 swap dígito↔dígito nas posições numéricas (cobre 6↔8 e similares).
  const baseValidas = Array.from(out).filter(p => validatePlaca(p));
  for (const base of baseValidas) {
    const isMercosul = PLACA_MERCOSUL_RE.test(base);
    const digitPositions = isMercosul ? [3, 5, 6] : [3, 4, 5, 6];
    for (const pos of digitPositions) {
      const ch = base[pos];
      if (!/[0-9]/.test(ch)) continue;
      for (const [from, to] of DIGIT_SWAPS) {
        if (ch !== from) continue;
        const variant = base.substring(0, pos) + to + base.substring(pos + 1);
        if (validatePlaca(variant)) out.add(variant);
      }
    }
  }

  return Array.from(out);
}


/**
 * Normalização posicional Mercosul-aware (LLL N L NN).
 * Posições 0,1,2,4 → letras (corrige 0→O, 1→I, etc.)
 * Posições 3,5,6 → dígitos (corrige O→0, I→1, etc.)
 * Retorna a placa "saneada" para o padrão Mercosul. Não garante validade.
 */
function normalizePlacaMercosul(raw: string): string {
  if (!raw) return '';
  const cleaned = raw.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (cleaned.length !== 7) return cleaned;
  const out: string[] = cleaned.split('');
  const letterIdx = [0, 1, 2, 4];
  const digitIdx = [3, 5, 6];
  for (const i of letterIdx) {
    const ch = out[i];
    if (/[0-9]/.test(ch) && DIGIT_TO_LETTER[ch]) out[i] = DIGIT_TO_LETTER[ch];
  }
  for (const i of digitIdx) {
    const ch = out[i];
    if (/[A-Z]/.test(ch) && LETTER_TO_DIGIT[ch]) out[i] = LETTER_TO_DIGIT[ch];
  }
  return out.join('');
}


/**
 * Resolve a placa preferindo o formato Mercosul quando há ambiguidade
 * na 5ª posição (ex.: "1" lido no lugar de "I").
 * Retorna { placa, ajustada } com a melhor escolha.
 */
function resolvePlacaPreferMercosul(raw: string): { placa: string; ajustada: boolean } {
  const cleaned = (raw || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (cleaned.length !== 7) return { placa: cleaned, ajustada: false };

  // Já é Mercosul válido
  if (PLACA_MERCOSUL_RE.test(cleaned)) return { placa: cleaned, ajustada: false };

  // Tenta normalizar para Mercosul
  const normalized = normalizePlacaMercosul(cleaned);
  if (PLACA_MERCOSUL_RE.test(normalized) && normalized !== cleaned) {
    // Só prefere Mercosul se a 5ª posição original era um dígito ambíguo (1/0/5/8/2/6)
    const ch5 = cleaned[4];
    if (/[0-9]/.test(ch5) && DIGIT_TO_LETTER[ch5]) {
      return { placa: normalized, ajustada: true };
    }
  }

  // Senão, mantém o cleaned (pode ser placa antiga válida)
  return { placa: cleaned, ajustada: false };
}

// Renavam: 11 dígitos com dígito verificador (módulo 11)
function validateRenavam(renavam: string): boolean {
  if (!renavam) return false;
  const cleaned = renavam.replace(/\D/g, '').padStart(11, '0');
  if (cleaned.length !== 11) return false;
  if (/^0+$/.test(cleaned)) return false;
  const base = cleaned.substring(0, 10);
  const dv = parseInt(cleaned[10]);
  const reversed = base.split('').reverse().join('');
  const weights = [2,3,4,5,6,7,8,9,2,3];
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(reversed[i]) * weights[i];
  const mod = (sum * 10) % 11;
  const dvCalc = mod === 10 ? 0 : mod;
  return dvCalc === dv;
}

// Chassi: 17 caracteres alfanuméricos, sem I, O ou Q
function validateChassi(chassi: string): boolean {
  if (!chassi) return false;
  const cleaned = chassi.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (cleaned.length !== 17) return false;
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned);
}

/**
 * Tenta sanear chassis "quase válidos" do OCR trocando caracteres comumente
 * confundidos (O→0, I→1, Q→0, S→5) que são proibidos no padrão VIN.
 * Retorna o chassi saneado se ficar válido, ou null caso contrário.
 */
function sanitizeChassiOCR(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (cleaned.length !== 17) return null;
  // Já é válido
  if (validateChassi(cleaned)) return cleaned;
  // Substituições proibidas no VIN → dígito equivalente
  const fixed = cleaned
    .replace(/O/g, '0')
    .replace(/I/g, '1')
    .replace(/Q/g, '0');
  if (validateChassi(fixed)) return fixed;
  // Tentativa adicional com S→5 (menos comum mas ocorre)
  const fixed2 = fixed.replace(/S/g, '5');
  if (validateChassi(fixed2)) return fixed2;
  return null;
}

// Mapa de dígitos comumente confundidos por modelos de visão
const DIGIT_CONFUSIONS: Record<number, number[]> = {
  0: [8, 6],
  1: [7, 4],
  3: [8],
  4: [6, 9],
  5: [6, 8],
  6: [4, 5, 8, 0],
  7: [1],
  8: [3, 0, 6],
  9: [4, 7],
};

function tryFixCPFByPermutation(cpf: string): string | null {
  const digits = cpf.replace(/\D/g, '').split('').map(Number);
  if (digits.length !== 11) return null;

  const validResults: string[] = [];

  for (let pos = 0; pos < 11; pos++) {
    const originalDigit = digits[pos];
    const alternatives = DIGIT_CONFUSIONS[originalDigit];
    if (!alternatives) continue;

    for (const alt of alternatives) {
      const candidate = [...digits];
      candidate[pos] = alt;
      const candidateStr = candidate.join('');
      if (validateCPF(candidateStr)) {
        const formatted = candidateStr.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        if (!validResults.includes(formatted)) {
          validResults.push(formatted);
        }
      }
    }
  }

  if (validResults.length === 1) {
    return validResults[0];
  }
  return null;
}

const systemPrompt = `Analista de documentos brasileiros. Detecte o tipo e extraia dados.

## Tipos e campos obrigatórios:

### CNH
nome, cpf (XXX.XXX.XXX-XX - PRIORIDADE MÁXIMA), rg, numero_registro (11 dígitos), data_nascimento (YYYY-MM-DD), validade (YYYY-MM-DD), categoria, mrz_registro (string)

- MRZ_REGISTRO (campo de validação cruzada — OBRIGATÓRIO em CNH-e digital):
  No RODAPÉ da página há 3 linhas de leitura mecânica (MRZ) impressas em fonte OCR-B (monoespaçada), com 30 caracteres cada e o caractere "<" como preenchimento.
  A PRIMEIRA dessas linhas começa com "I<BRA" seguido de 9 dígitos do número de registro, mais 1 dígito verificador, mais "<" até completar 30 caracteres.
  Exemplo real: "I<BRA070646502<024<<<<<<<<<<<<" — aqui "070646502" são os 9 dígitos do registro e o próximo caractere ("<" ou um dígito) faz parte do payload ICAO.
  Regras estritas para preencher "mrz_registro":
    1. Transcreva LITERALMENTE essa primeira linha, exatamente como aparece, mantendo TODOS os "<" (não substitua por espaço, hífen ou nada).
    2. Não invente dígitos: se a linha não estiver legível ou se você só conseguir ver parte dela, retorne mrz_registro:"" (vazio é melhor que inventado).
    3. Em caso de divergência entre o que você lê no campo visual "5 Nº REGISTRO" e o que está na MRZ, a MRZ É A FONTE DE VERDADE — confie nos 9 dígitos da MRZ. A MRZ é leitura mecânica e não admite ambiguidade visual.
    4. NUNCA copie um número de registro que você "leu visualmente" para o campo mrz_registro fingindo que veio da MRZ. Se a MRZ não está visível, deixe vazio.

- CPF SEMPRE existe na CNH: campo "CPF"/"CPF/MF", próximo ao nome/foto. Procure sequências de 11 dígitos.
- NÃO confunda com RENACH (tem letras), registro CNH ou RG.
- NUNCA retorne cpf:null. Se ilegível: cpf:"ilegivel"
- LEIA CADA DÍGITO DO CPF INDIVIDUALMENTE, DA ESQUERDA PARA A DIREITA. O CPF possui dígitos verificadores matemáticos — se tiver dúvida em qualquer dígito, retorne cpf:"ilegivel" em vez de adivinhar.
- CATEGORIA (REGRA CRÍTICA — LEIA COM ATENÇÃO):
  • Leia EXCLUSIVAMENTE do campo rotulado "9 CAT HAB", que fica EMBAIXO/À DIREITA, ao lado do "5 Nº REGISTRO" (sequência de 11 dígitos). É a letra/sigla dentro da caixinha rotulada com o número "9" e o texto "CAT HAB".
  • ARMADILHA #1 — Campo "ACC": existe uma OUTRA caixinha pequena no TOPO/À DIREITA, ao lado do campo "4b VALIDADE" (data dd/mm/aaaa). Essa caixa é rotulada "ACC" e contém uma única letra grande (frequentemente D, E ou vazia). ESSA LETRA NÃO É CATEGORIA — é o código de Atividade Remunerada / Exercício de Atividade. NUNCA use o conteúdo do campo ACC como categoria.
  • ARMADILHA #2 — Grade do verso/rodapé: existe uma tabela com linhas ACC, A, A1, B, B1, C, C1, D, D1, BE, CE, DE, C1E, D1E e datas ao lado. Essa tabela é apenas o detalhamento das categorias habilitadas — não a categoria principal.
  • DICA DE VALIDAÇÃO: a categoria correta (do campo "9 CAT HAB") SEMPRE aparece também na grade do verso com uma data de validade ao lado, e essa data normalmente coincide (ou é a mesma) da validade principal "4b" da CNH. Se você está em dúvida entre duas letras, escolha a que tem data igual à validade principal.
  • Categorias válidas: ACC, A, A1, B, B1, C, C1, D, D1, E, AB, AC, AD, AE, BE, CE, DE, C1E, D1E.

### RG / CIN (Carteira de Identidade Nacional)
Aceite TANTO o RG antigo (modelo estadual com REGISTRO GERAL próprio) QUANTO a nova CIN (Carteira de Identidade Nacional - válida em todo território nacional, com QR Code, layout bilíngue PT/EN, texto "VÁLIDA EM TODO O TERRITÓRIO NACIONAL"). Ambos retornam tipo_detectado:"rg".

Campos:
- nome: campo "NOME / Name" no topo, logo abaixo do cabeçalho. NÃO confundir com filiação (nomes dos pais), autoridades, "PRESIDENTE DO DETRAN" ou assinaturas no rodapé.
- cpf: SEMPRE presente. Formato XXX.XXX.XXX-XX. Se ilegível, retorne "ilegivel".
  • CIN: aparece como "Registro Geral - CPF / Personal Number" — o CPF é o número único de identificação.
  • RG antigo: campo CPF separado (frente ou verso).
- rg: número do Registro Geral.
  • RG antigo: campo "REGISTRO GERAL" com número estadual (ex.: 12.345.678-9).
  • CIN: o CPF É o número único — use o mesmo valor do CPF.
- data_nascimento: "Data de Nascimento / Date of Birth" (YYYY-MM-DD).
- data_expedicao: "Data de Emissão / Issue Date" (YYYY-MM-DD).
- validade: "Validade / Expiry" (YYYY-MM-DD).
  • CIN frequentemente traz "INDETERMINADA" — nesse caso retorne validade:"indeterminada" e considere VÁLIDO.
- orgao_expedidor: "DETRAN-RJ", "SSP-SP", etc. (se visível).
- variante: "cin" se for a nova Carteira de Identidade Nacional (QR Code grande, layout bilíngue, "VÁLIDA EM TODO O TERRITÓRIO NACIONAL"); "rg_antigo" caso contrário.

Regras especiais CIN:
- NÃO reprove por validade ausente/INDETERMINADA — é o padrão da CIN.
- NÃO reprove por RG igual ao CPF — é o comportamento esperado da CIN.
- QR Code grande presente é indicador forte de CIN.

### CRLV
placa (ABC1234/ABC1D23), renavam (11 dígitos), chassi (17 chars), marca, modelo, ano_fabricacao (int), ano_modelo (int), cor (campo "COR"/"COR PREDOMINANTE" - leia literalmente), combustivel, motor, numero_motor, nome_proprietario, blindado (bool)

⚠️ CAMPO OBRIGATÓRIO — numero_motor (NÚMERO DO MOTOR):
Este campo é OBRIGATÓRIO no CRLV e NUNCA deve ser omitido. Procure ATIVAMENTE no documento usando TODAS estas variações de rótulo:
  • "MOTOR Nº", "MOTOR N°", "Nº MOTOR", "N° MOTOR", "Nº DO MOTOR", "N° DO MOTOR"
  • "MOTOR:", "MOTOR /SÉRIE", "MOTOR/SERIE", "MOTOR / SERIE"
  • Em CRLV-e/Digital o campo aparece tipicamente LOGO ABAIXO ou AO LADO de "CHASSI"
Como ler:
  • Leia caractere por caractere — geralmente 7 a 17 caracteres alfanuméricos (letras MAIÚSCULAS + dígitos, podendo conter hífen "-").
  • Exemplos: "G3W6E104052", "9C6KG991070073366", "BAH123456", "MOTOR:ABC-12345".
  • NÃO confunda com Renavam (apenas dígitos), Chassi (17 chars exatos) ou Cilindradas.
  • Se estiver presente mas você NÃO conseguir ler com certeza, retorne numero_motor:"ilegivel" (NUNCA null se houver campo visível).
  • Se o campo realmente não existir no documento, retorne numero_motor:null.
Sempre preencha tanto "motor" quanto "numero_motor" com o MESMO valor (alias obrigatório).

- "ANO FAB/MOD: 2013/2014" → ano_fabricacao:2013, ano_modelo:2014
- Blindado: procure em OBS/TIPO por "BLINDADO/BLINDAGEM/PROTEÇÃO BALÍSTICA". Sempre inclua campo blindado.
- ⚠️ PLACA — REGRA OBRIGATÓRIA DE FORMATO:
  • Existem DOIS formatos legais no Brasil. NUNCA misture os dois.
  • **Placa ANTIGA** (LLLNNNN, ex: ABC1234, LQV3623): as **4 últimas posições são SEMPRE dígitos (0-9)**. Se a 5ª posição parecer uma letra (G/I/O/S/B/Z), é OCR errado — leia como dígito (G→6, I→1, O→0, S→5, B→8, Z→2).
  • **Placa MERCOSUL** (LLLNLNN, ex: RKR3I57, BRA2E19): a **5ª posição é SEMPRE uma LETRA (A-Z)**. Se parecer dígito (1/0/5/8/2/6), leia como letra.
  • COMO DECIDIR O FORMATO: o CRLV brasileiro emitido a partir de set/2018 usa Mercosul; veículos anteriores podem manter a placa antiga. Use o **campo "PLACA ANTERIOR/UF"** e o ano de fabricação como pista. Se "PLACA ANTERIOR" estiver no formato antigo e for igual à placa atual, então a placa atual também é antiga.
  • ⚠️ **DESAMBIGUAÇÃO DE DÍGITOS NUMÉRICOS** (4ª, 6ª e 7ª posições da Mercosul; 4ª–7ª da antiga): em CRLVs físicos esmaecidos os pares mais confundidos são **6↔8**, **0↔8**, **5↔6**, **1↔7**, **0↔9**, **3↔8**, **2↔7**. ANTES de devolver um dígito numérico, **compare visualmente o glifo** com outras ocorrências do MESMO dígito em campos de alta confiança do MESMO documento:
      - **Chassi** (17 caracteres alfanuméricos) — costuma estar mais nítido
      - **Renavam** (11 dígitos)
      - **Nº do CRLV** (no topo, 11 dígitos)
    Heurísticas de glifo: o "6" tem topo ABERTO/curvo e UMA barriga fechada; o "8" tem DUAS barrigas fechadas. O "0" não tem barriga superior; o "8" tem. O "1" não tem traço diagonal; o "7" tem.
  • **NUNCA copie dígitos da "PLACA ANTERIOR" para a "PLACA" atual.** São campos distintos. A placa atual é a que aparece no campo "PLACA" em destaque, normalmente próxima ao CPF/CNPJ do proprietário.
  • **EM CASO DE DÚVIDA REAL não resolvida**, escreva a placa com o caractere de menor risco. Nunca chute "8" sem evidência — o default seguro é "6" quando o glifo tem topo aberto.

### Nota Fiscal de Veículo (DANFE / NF-e com dados veiculares)

**Como reconhecer uma DANFE/NF-e de veículo (use TODAS as pistas abaixo):**
- Cabeçalho com "DANFE" ou "DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA"
- Campo "CHAVE DE ACESSO" com 44 dígitos (frequentemente acompanhado de código de barras horizontal)
- "PROTOCOLO DE AUTORIZAÇÃO DE USO" com data/hora
- "NATUREZA DA OPERAÇÃO" (ex.: "VENDA DE VEÍCULO 0 KM", "VENDA DE PROD. DO ESTAB.", "VENDA DE MERC. ADQ. OU REC.")
- Tabela "DADOS DO PRODUTO / SERVIÇOS" com colunas: CÓDIGO, DESCRIÇÃO DOS PRODUTOS / SERVIÇOS, NCM/SH, CST, **CFOP**, UN, QUANT, V. UNITÁRIO, V. TOTAL
- Blocos "EMITENTE", "DESTINATÁRIO/REMETENTE", "DADOS ADICIONAIS"

**Sinais de que a NF é de VEÍCULO (qualquer um basta):**
- A descrição do produto contém um CHASSI de 17 caracteres alfanuméricos (sem I, O, Q)
- CFOP nas faixas 5405/5104/5403/6405/6104/6403/5102/6102 (venda)
- Descrição contém palavras: "VEÍCULO", "VEICULO", "MOTOCICLETA", "MOTO", "AUTOMÓVEL", "0 KM", "ZERO KM", "ZERO-KM"
- NCM começa com 8703 (automóveis) ou 8711 (motocicletas)

⚠️ Se identificar QUALQUER desses sinais, **tipo_detectado = "nota_fiscal_veiculo"** — NUNCA "crlv" e NUNCA "outro".

**Onde encontrar os dados veiculares (geralmente concatenados na "DESCRIÇÃO DOS PRODUTOS / SERVIÇOS"):**
A descrição vem em linha única com vários campos separados por vírgula ou espaço. Padrões típicos:
- \`CHASSI:9C6KG991070073366\` ou \`CHASSI Nº 9C6KG...\` ou \`CHASSI/SERIE 9C6KG...\`
- \`MOTOR:G3W6E-104052\` ou \`Nº MOTOR G3W6E-104052\` ou \`No MOTOR:G3W6E-104052\` ou \`MOTOR Nº G3W6E-104052\`
- \`RENAVAM:00118712345\`
- \`COR:VERMELHA\` / \`COR BRANCA\`
- \`COMBUSTÍVEL:GASOLINA\` / \`FLEX\` / \`DIESEL\`
- \`ANO FAB:2024\` \`ANO MOD:2025\` (ou \`ANO/MOD: 2024/2025\`)
- \`MARCA:YAMAHA\` \`MODELO:YBR 150 FACTOR\`
- \`CILINDRADAS:150\` \`POTENCIA:12CV\` \`CATEGORIA:PARTICULAR\` \`TIPO VEICULO:MOTOCICLETA\`

**Extração obrigatória de numero_motor:**
Mesmo quando o número do motor estiver concatenado na descrição com outros campos, EXTRAIA SOMENTE o valor do motor. Use o padrão mental: \`MOTOR\s*:?\s*([A-Z0-9-]+)\` — capture até o próximo separador (vírgula, espaço, RENAVAM, COR, etc.). Devolva apenas a sequência alfanumérica do motor (com hífen se houver).

**Campos a retornar:**
- valor_nota_fiscal: prefira "VALOR TOTAL DA NOTA" do bloco "CÁLCULO DO IMPOSTO". Se não houver, use "V. TOTAL" do produto principal (quando único). Numérico, ponto decimal (ex.: 18890.00).
- chassi (17 chars), numero_motor, placa (se presente), marca, modelo, ano_fabricacao (int), ano_modelo (int), cor, combustivel
- nome_comprador: campo "NOME / RAZÃO SOCIAL" do bloco "DESTINATÁRIO/REMETENTE"
- cpf_cnpj_comprador: campo "CNPJ / CPF" do bloco "DESTINATÁRIO/REMETENTE" (formato XXX.XXX.XXX-XX para CPF ou XX.XXX.XXX/XXXX-XX para CNPJ)

- tipo_detectado deve ser "nota_fiscal_veiculo"
- Este documento substitui o CRLV para veículos zero km ou recém-adquiridos.

### ATPV-e / CRV Digital (Autorização para Transferência de Propriedade de Veículo - Eletrônica)
Detectar quando o documento for emitido pelo SENATRAN/DETRAN com título "AUTORIZAÇÃO PARA TRANSFERÊNCIA DE PROPRIEDADE DE VEÍCULO" ou "ATPV-e" / "CRV Digital" / "CRV-e". Geralmente contém QR Code, código de segurança, dados do veículo, dados do vendedor e dados do comprador.
Campos: placa, renavam (11 dígitos), chassi (17 chars), marca, modelo, ano_fabricacao (int), ano_modelo (int), cor, combustivel, motor, numero_motor,
nome_comprador, cpf_comprador (XXX.XXX.XXX-XX), endereco_comprador (logradouro+numero), cidade_comprador, uf_comprador (2 letras), cep_comprador,
nome_vendedor, cpf_cnpj_vendedor,
valor_declarado_venda (numérico), data_emissao_crv (YYYY-MM-DD), data_venda (YYYY-MM-DD),
numero_crv, codigo_seguranca_crv, numero_atpv
- numero_motor: extraia do bloco "Características do Veículo" (rótulos: "MOTOR Nº", "Nº DO MOTOR", "MOTOR:"). Mesmo padrão do CRLV: 7-17 caracteres alfanuméricos. Sempre preencha "motor" e "numero_motor" com o mesmo valor. Se ilegível, use "ilegivel".
- tipo_detectado deve ser "atpv_e"
- Este documento SUBSTITUI o CRLV para veículos recém-adquiridos cujo CRLV ainda não foi emitido no nome do novo proprietário.
- NÃO confundir com CRLV (que tem título "CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEÍCULO") nem com Nota Fiscal.

### Comprovante de Residência
Aceitar: contas (água/luz/gás/telefone/internet), faturas/boletos, IPTU/IPVA, IRPF, extratos, contratos aluguel, escrituras, **declaração de residência (modelo livre)**.
Campos: logradouro, numero, complemento, bairro, cidade, uf (2 letras), cep, nome_titular, tipo_comprovante ("conta_luz"|"conta_agua"|"conta_gas"|"conta_telefone"|"conta_internet"|"fatura_cartao"|"boleto_plano_saude"|"boleto_condominio"|"iptu"|"ipva"|"extrato_bancario"|"contrato_aluguel"|"declaracao_residencia"|"outro"), data_emissao
- Aceitar sem data de emissão. IPTU/IPVA do ano vigente/anterior válidos.
- **BAIRRO obrigatório quando o documento o exibe.** Quando o bairro vier embutido no logradouro (ex.: "EST CAFUNDA - TAQUARA", "RUA X, JARDIM PAULISTA", "AV Y BL 1 — COPACABANA"), separe e preencha bairro com a parte após o hífen/vírgula/travessão; mantenha logradouro apenas com a via. Quando o documento (ex.: algumas contas de luz) realmente não imprime bairro, deixe bairro:null e sugira **revisar** (não reprovar por isso).
- **NÃO extrair CPF do titular do comprovante de residência** — o CPF do associado é obtido exclusivamente da CNH ou Documento Pessoal (RG) e reaproveitado. Ignore qualquer CPF que apareça no comprovante.

#### Declaração de Residência (modelo livre, escrito pelo próprio interessado ou por terceiro)
- Detectar pelo título "DECLARAÇÃO DE RESIDÊNCIA" (ou variantes como "DECLARAÇÃO DE DOMICÍLIO", "DECLARAÇÃO DE COMPROVAÇÃO DE RESIDÊNCIA").
- Aceitar quando contiver: nome e CPF do declarante, endereço completo (CEP + logradouro + número + bairro + cidade + UF), local/data e assinatura (manuscrita, digitalizada ou eletrônica).
- Extrair campos de endereço normalmente nos campos padrão.
- tipo_comprovante = "declaracao_residencia".
- nome_titular = nome do declarante (quem assina/declara residir no endereço).
- **Aceitar sem reconhecimento de firma** — a validação humana posterior cobre o restante.
- Se faltar assinatura OU CPF do declarante → sugerir REVISAR (não reprovar).
- Se faltar endereço completo (sem CEP ou sem logradouro/número) → REPROVAR.

#### Titularidade (quando nomeEsperado fornecido)
Compare nome_titular com nomeEsperado:
- Ignore case/acentos. Aceite abreviações (M.=Mario, D.=Da/De). Sobrenome obrigatório.
- Correspondência OK → aprovar. Não corresponde → reprovar. Ilegível → revisar. Mesmo sobrenome, nome diferente → revisar (cônjuge).
- **Exceção para declaracao_residencia**: se declarante ≠ nomeEsperado, sempre sugerir REVISAR (analista valida vínculo familiar/coabitação) em vez de reprovar.
- Inclua campo "validacao_titularidade": {nome_titular_extraido, nome_esperado, correspondencia, tipo_correspondencia, observacao}

## Regras gerais:
- Documento vencido: informar. Campo ilegível: null. Suspeita adulteração: reprovar. Dúvida: revisar.
- CPF: XXX.XXX.XXX-XX. Datas: YYYY-MM-DD. Placa: formato antigo ou Mercosul.

## JSON de resposta:
{"tipo_detectado":"cnh"|"rg"|"crlv"|"nota_fiscal_veiculo"|"atpv_e"|"comprovante_residencia"|"outro","sucesso":bool,"dados":{...},"legivel":bool,"valido":bool,"sugestao":"aprovar"|"reprovar"|"revisar","motivo":"...","confianca":0.0-1.0}`;

/**
 * Tenta reparar um JSON truncado pela IA (max_tokens atingido).
 */
function tryRepairTruncatedJSON(raw: string): object | null {
  let s = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  s = s.replace(/:\s*_[A-Z_]+_\s*([,}\]])/g, ': null$1');

  try { return JSON.parse(s); } catch { /* continue */ }

  s = s.replace(/,\s*$/, '');

  let inString = false;
  let lastQuoteIndex = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && inString) { i++; continue; }
    if (s[i] === '"') {
      inString = !inString;
      lastQuoteIndex = i;
    }
  }

  if (inString && lastQuoteIndex >= 0) {
    s = s.substring(0, lastQuoteIndex + 1);
    const beforeKey = s.lastIndexOf(',', lastQuoteIndex - 1);
    const beforeBrace = s.lastIndexOf('{', lastQuoteIndex - 1);
    const beforeBracket = s.lastIndexOf('[', lastQuoteIndex - 1);
    const cutPoint = Math.max(beforeKey, beforeBrace, beforeBracket);
    
    if (cutPoint >= 0) {
      if (s[cutPoint] === ',') {
        s = s.substring(0, cutPoint);
      } else {
        s = s.substring(0, cutPoint + 1);
      }
    }
  }

  s = s.replace(/,\s*$/, '');

  let openBraces = 0;
  let openBrackets = 0;
  inString = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && inString) { i++; continue; }
    if (s[i] === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (s[i] === '{') openBraces++;
    if (s[i] === '}') openBraces--;
    if (s[i] === '[') openBrackets++;
    if (s[i] === ']') openBrackets--;
  }

  for (let i = 0; i < openBrackets; i++) s += ']';
  for (let i = 0; i < openBraces; i++) s += '}';

  try {
    return JSON.parse(s);
  } catch {
    console.error('[OCR] Reparo de JSON falhou. Tentando extração via regex...');
  }

  try {
    const tipoMatch = raw.match(/"tipo_detectado"\s*:\s*"([^"]+)"/);
    const sugestaoMatch = raw.match(/"sugestao"\s*:\s*"([^"]+)"/);
    const motivoMatch = raw.match(/"motivo"\s*:\s*"([^"]+)"/);
    const confiancaMatch = raw.match(/"confianca"\s*:\s*([\d.]+)/);
    const legivelMatch = raw.match(/"legivel"\s*:\s*(true|false)/);
    const validoMatch = raw.match(/"valido"\s*:\s*(true|false)/);
    const sucessoMatch = raw.match(/"sucesso"\s*:\s*(true|false)/);

    if (tipoMatch) {
      const dados: Record<string, string | null> = {};
      const dadosFields = [
        // pessoais
        'nome', 'cpf', 'rg', 'data_nascimento', 'numero_registro', 'validade', 'data_expedicao', 'orgao_expedidor', 'categoria', 'variante', 'mrz_registro',
        // veículo
        'placa', 'renavam', 'chassi', 'marca', 'modelo', 'cor', 'combustivel', 'motor', 'numero_motor', 'nome_proprietario',
        // comprovante de residência
        'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'cep', 'nome_titular', 'cpf_titular', 'tipo_comprovante', 'data_emissao',
        // ATPV-e / NF veículo
        'nome_comprador', 'cpf_comprador', 'cpf_cnpj_comprador', 'valor_nota_fiscal',
      ];
      for (const field of dadosFields) {
        const m = raw.match(new RegExp(`"${field}"\\s*:\\s*"([^"]+)"`));
        if (m) dados[field] = m[1];
      }
      const anoFabMatch = raw.match(/"ano_fabricacao"\s*:\s*(\d+)/);
      const anoModMatch = raw.match(/"ano_modelo"\s*:\s*(\d+)/);
      if (anoFabMatch) dados['ano_fabricacao'] = anoFabMatch[1];
      if (anoModMatch) dados['ano_modelo'] = anoModMatch[1];

      return {
        tipo_detectado: tipoMatch[1],
        sucesso: sucessoMatch ? sucessoMatch[1] === 'true' : true,
        dados,
        legivel: legivelMatch ? legivelMatch[1] === 'true' : true,
        valido: validoMatch ? validoMatch[1] === 'true' : true,
        sugestao: sugestaoMatch?.[1] || 'revisar',
        motivo: motivoMatch?.[1] || 'Resposta da IA foi truncada - dados parciais recuperados',
        confianca: confiancaMatch ? parseFloat(confiancaMatch[1]) : 0.5,
        _reparado: true,
      };
    }
  } catch {
    // Falhou completamente
  }

  return null;
}

/**
 * Extrai CPF de uma resposta truncada/malformada via regex
 */
function extractCPFFromRaw(raw: string): string | null {
  // Tentar JSON repair primeiro
  const repaired = tryRepairTruncatedJSON(raw);
  if (repaired && typeof repaired === 'object' && 'cpf' in repaired) {
    return (repaired as any).cpf;
  }
  
  // Fallback: regex para CPF formatado
  const cpfMatch = raw.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
  if (cpfMatch) return cpfMatch[1];
  
  // Fallback: regex para 11 dígitos seguidos
  const digitsMatch = raw.match(/(\d{11})/);
  if (digitsMatch) {
    const d = digitsMatch[1];
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9,11)}`;
  }
  
  // Verificar se contém "ilegivel"
  if (raw.toLowerCase().includes('ilegivel') || raw.toLowerCase().includes('ilegível')) {
    return 'ilegivel';
  }
  
  return null;
}

// Modelo estável para OCR de TEXTO (não usar -image, otimizado para geração)
const OCR_MODEL = 'google/gemini-2.5-flash';
const OCR_RETRY_MODEL = 'google/gemini-2.5-pro';

/**
 * Formata um CPF de 11 dígitos puros para XXX.XXX.XXX-XX.
 */
function formatCPF(digits: string): string {
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Coleta todos os candidatos a CPF (11 dígitos OU formato XXX.XXX.XXX-XX)
 * presentes no texto, retornando posição (offset) de cada ocorrência.
 */
function collectCPFCandidates(text: string): Array<{ digits: string; index: number; raw: string; valid: boolean }> {
  const out: Array<{ digits: string; index: number; raw: string; valid: boolean }> = [];
  if (!text) return out;
  // Formato XXX.XXX.XXX-XX (com possíveis espaços)
  for (const m of text.matchAll(/(\d{3})[.\s]?(\d{3})[.\s]?(\d{3})[-\s]?(\d{2})/g)) {
    const digits = `${m[1]}${m[2]}${m[3]}${m[4]}`;
    out.push({ digits, index: m.index ?? -1, raw: m[0], valid: validateCPF(digits) });
  }
  // 11 dígitos contíguos (CNH-e digital costuma trazer assim)
  for (const m of text.matchAll(/(?<!\d)(\d{11})(?!\d)/g)) {
    const digits = m[1];
    // Evitar duplicar candidatos já capturados pelo regex pontuado
    if (!out.some((c) => c.index === m.index && c.digits === digits)) {
      out.push({ digits, index: m.index ?? -1, raw: m[0], valid: validateCPF(digits) });
    }
  }
  return out;
}

/**
 * Procura o trecho do texto onde aparece o rótulo "CPF" (variantes inclusas)
 * e devolve o primeiro CPF VÁLIDO que apareça logo após esse rótulo.
 *
 * Variantes aceitas: "CPF", "CPF/MF", "CPF / MF", "4d CPF", "4d. CPF",
 * "CPF do contribuinte", "CPF/CNPJ".
 *
 * Diferente de `extractValidCPFFromText`, NÃO retorna o primeiro número
 * válido qualquer — exige proximidade com o rótulo, evitando trocar o CPF
 * pelo Nº Registro / RENACH / RG / numeração lateral.
 */
function extractAnchoredCPFFromText(text: string): { cpf: string | null; contexto: string | null } {
  if (!text) return { cpf: null, contexto: null };

  // Acha posições do rótulo "CPF" (com possíveis prefixos numéricos tipo "4d ")
  const labelRegex = /(?:^|\n|\s)(?:\d{1,2}\s?[a-z]?\s+)?CPF(?:\s*\/?\s*(?:MF|CNPJ))?/gi;
  const matches: Array<{ index: number; len: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = labelRegex.exec(text)) !== null) {
    matches.push({ index: m.index, len: m[0].length });
    if (m.index === labelRegex.lastIndex) labelRegex.lastIndex++;
  }

  if (matches.length === 0) return { cpf: null, contexto: null };

  // Para cada rótulo, olhar uma janela de até 80 chars depois e tentar achar CPF válido
  for (const lbl of matches) {
    const windowStart = lbl.index + lbl.len;
    const windowEnd = Math.min(windowStart + 80, text.length);
    const window = text.slice(windowStart, windowEnd);

    // Procurar CPF formatado primeiro
    const fmt = window.match(/(\d{3})[.\s]?(\d{3})[.\s]?(\d{3})[-\s]?(\d{2})/);
    if (fmt) {
      const digits = `${fmt[1]}${fmt[2]}${fmt[3]}${fmt[4]}`;
      if (validateCPF(digits)) {
        return {
          cpf: formatCPF(digits),
          contexto: text.slice(Math.max(0, lbl.index - 20), windowEnd).trim().slice(0, 200),
        };
      }
    }
    // 11 dígitos contíguos
    const cont = window.match(/(?<!\d)(\d{11})(?!\d)/);
    if (cont && validateCPF(cont[1])) {
      return {
        cpf: formatCPF(cont[1]),
        contexto: text.slice(Math.max(0, lbl.index - 20), windowEnd).trim().slice(0, 200),
      };
    }
  }

  return { cpf: null, contexto: text.slice(matches[0].index, Math.min(matches[0].index + 200, text.length)).trim() };
}

/**
 * Extrai o primeiro CPF VÁLIDO do texto, sem ancoragem a rótulo.
 * Mantido como fallback (compatibilidade), mas o caminho preferencial agora
 * é `extractAnchoredCPFFromText`.
 */
function extractValidCPFFromText(text: string): string | null {
  if (!text) return null;
  const cands = collectCPFCandidates(text);
  for (const c of cands) {
    if (c.valid) return formatCPF(c.digits);
  }
  return null;
}

/**
 * Extrai dados confiáveis de uma CNH a partir do texto nativo do PDF.
 * CNH-e (digital) tem layout estável com rótulos: NOME, CPF, DOC. IDENTIDADE,
 * DATA NASCIMENTO, VALIDADE, Nº REGISTRO, CAT. HAB.
 */
function extractCNHFromText(text: string): Record<string, any> {
  const out: Record<string, any> = {};
  if (!text) return out;

  // CPF: prefere ancoragem ao rótulo "CPF" / "4d CPF"; se falhar, primeiro válido
  const anchored = extractAnchoredCPFFromText(text);
  if (anchored.cpf) {
    out.cpf = anchored.cpf;
    out.__cpf_fonte = 'native_anchored';
    out.__cpf_contexto = anchored.contexto;
  } else {
    const cpf = extractValidCPFFromText(text);
    if (cpf) {
      out.cpf = cpf;
      out.__cpf_fonte = 'native_first_valid';
    }
  }

  // Datas DD/MM/YYYY → YYYY-MM-DD
  const toIso = (d: string) => {
    const m = d.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  };

  // Nome: linha após "NOME" / "1 NOME"
  const nomeMatch = text.match(/(?:^|\n)\s*(?:1\s+)?NOME\s*\/?\s*[A-Z\s]*\n?\s*([A-ZÁÂÃÀÉÊÍÓÔÕÚÇ ]{6,})/m);
  if (nomeMatch) out.nome = nomeMatch[1].trim().replace(/\s+/g, ' ');

  // Data de nascimento
  const nascMatch = text.match(/(?:DATA\s+NASCIMENTO|DATA\s+DE\s+NASCIMENTO)[^\d]*(\d{2}\/\d{2}\/\d{4})/i);
  if (nascMatch) out.data_nascimento = toIso(nascMatch[1]);

  // Validade
  const valMatch = text.match(/VALIDADE[^\d]*(\d{2}\/\d{2}\/\d{4})/i);
  if (valMatch) out.validade = toIso(valMatch[1]);

  // Nº Registro CNH
  const regMatch = text.match(/(?:N[ºO°]\s*REGISTRO|REGISTRO\s+CNH|REGISTRO)[^\d]*(\d{11})/i);
  if (regMatch) out.numero_registro = regMatch[1];

  // Categoria CAT HAB — ordem importa: prefixos longos antes dos curtos
  // (ex.: C1E antes de C1 antes de C; AB/AC/AD/AE antes de A; BE antes de B).
  const catMatch = text.match(/CAT[\.\s]*HAB[^\w]*(ACC|C1E|D1E|A1|B1|C1|D1|AB|AC|AD|AE|BE|CE|DE|A|B|C|D|E)\b/i);
  if (catMatch) out.categoria = catMatch[1].toUpperCase();

  // RG
  const rgMatch = text.match(/(?:DOC[\.\s]*IDENTIDADE|RG)[^\n]*?([\d.\-/]{6,15})/i);
  if (rgMatch) out.rg = rgMatch[1].replace(/\s+/g, '');

  return out;
}

/**
 * Mescla campos extraídos do texto nativo SOBREPONDO os da IA quando temos
 * alta confiança (CPF passou checksum, datas no formato correto, etc.).
 * Garantia: NUNCA degrada — só substitui se o valor nativo for melhor.
 */
function mergeNativeOverAI(
  aiDados: Record<string, any>,
  nativeDados: Record<string, any>,
  reqId: string
): Record<string, any> {
  const merged = { ...aiDados };
  for (const [key, val] of Object.entries(nativeDados)) {
    // Ignorar campos meta (prefixados com __) — usados apenas para logging
    if (key.startsWith('__')) continue;
    if (val === null || val === undefined || val === '') continue;
    const aiVal = aiDados[key];
    // CPF: nativo SEMPRE ganha (já passou checksum)
    if (key === 'cpf' && val) {
      if (aiVal !== val) {
        console.log(`[OCR][${reqId}] CPF do texto nativo sobrepõe IA: "${aiVal}" → "${val}"`);
      }
      merged[key] = val;
      continue;
    }
    // Demais: só sobrepõe se IA não tem valor ou tem "ilegivel"/null
    if (!aiVal || aiVal === 'ilegivel' || aiVal === null) {
      merged[key] = val;
      console.log(`[OCR][${reqId}] Campo "${key}" preenchido do texto nativo: "${val}"`);
    }
  }
  return merged;
}

/**
 * Chama o Lovable AI Gateway com retry exponencial em falhas transitórias.
 * - Retenta em erros de rede e respostas 500/502/503/504.
 * - NÃO retenta em 401/402/429 (erros legítimos que devem chegar ao usuário).
 * - Backoff: 500ms, 1500ms, 3500ms (3 tentativas no total).
 */
async function callAIGatewayWithRetry(
  body: Record<string, unknown>,
  apiKey: string,
  label: string,
): Promise<Response> {
  const delays = [500, 1500, 3500];
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < delays.length; attempt++) {
    try {
      const resp = await aiGatewayFetch({
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (resp.ok || ![500, 502, 503, 504].includes(resp.status)) {
        if (attempt > 0) {
          console.log(`[OCR][${label}] sucesso após ${attempt + 1} tentativa(s) (status ${resp.status})`);
        }
        return resp;
      }
      const errBody = await resp.text().catch(() => '');
      console.warn(`[OCR][${label}] tentativa ${attempt + 1}/${delays.length} falhou: HTTP ${resp.status} ${errBody.slice(0, 200)}`);
      lastErr = new Error(`HTTP ${resp.status}`);
      if (attempt < delays.length - 1) {
        await new Promise((r) => setTimeout(r, delays[attempt + 1]));
      }
    } catch (err) {
      lastErr = err;
      console.warn(`[OCR][${label}] tentativa ${attempt + 1}/${delays.length} erro de rede:`, err instanceof Error ? err.message : err);
      if (attempt < delays.length - 1) {
        await new Promise((r) => setTimeout(r, delays[attempt + 1]));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('AI Gateway indisponível após retries');
}

// ============================================================
// Persistência de logs de execução do OCR (tabela ocr_execution_logs)
// ============================================================
type OcrLogCtx = {
  reqId?: string;
  startedAt: number;
  usuario_id?: string | null;
  cotacao_id?: string | null;
  associado_id?: string | null;
  tipo_esperado?: string | null;
  arquivo_url_hash?: string | null;
  mime?: string | null;
  bytes?: number | null;
  is_pdf?: boolean;
  has_native_text?: boolean;
  native_text_len?: number;
  provider?: string | null;
  modelo?: string | null;
  usage?: any;
  truncated?: boolean;
  used_retry?: boolean;
  used_native_fallback?: boolean;
  cpf_corrigido_via?: string | null;
  cpf_fonte?: string | null;
  cpf_contexto?: string | null;
  cpf_candidatos?: any;
  dados_esperados?: any;
  modo_teste?: boolean;
  ocrLogId?: string | null;
  // Motor OCR (v5)
  engine?: string | null;
  primary_model?: string | null;
  secondary_model?: string | null;
  dupla_leitura?: boolean;
  divergencias?: any;
  pdf_rasterizado?: boolean;
  pdf_paginas_rasterizadas?: number | null;
  fallback_emergency?: boolean;
};

async function persistOcrLog(ctx: OcrLogCtx, outcome: {
  result?: any;
  status: 'sucesso' | 'revisar' | 'falha' | 'truncado';
  motivo?: string | null;
  erro?: string | null;
  sucesso?: boolean | null;
}) {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SERVICE_KEY) return;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const r = outcome.result || {};

    // Calcular score_campos quando há ground truth
    let scoreCampos: any = null;
    if (ctx.dados_esperados && r?.dados) {
      try {
        const { data: scoreData } = await admin.rpc('calcular_score_ocr', {
          esperado: ctx.dados_esperados,
          obtido: r.dados,
        });
        scoreCampos = scoreData ?? null;
      } catch (e) {
        console.warn('[OCR][score] Falha ao calcular score:', e);
      }
    }

    const { data: inserted } = await admin.from('ocr_execution_logs').insert({
      req_id: ctx.reqId ?? null,
      usuario_id: ctx.usuario_id ?? null,
      cotacao_id: ctx.cotacao_id ?? null,
      associado_id: ctx.associado_id ?? null,
      tipo_esperado: ctx.tipo_esperado ?? null,
      tipo_detectado: r?.tipo_detectado ?? null,
      arquivo_url_hash: ctx.arquivo_url_hash ?? null,
      mime: ctx.mime ?? null,
      bytes: ctx.bytes ?? null,
      is_pdf: !!ctx.is_pdf,
      has_native_text: !!ctx.has_native_text,
      native_text_len: ctx.native_text_len ?? 0,
      provider: ctx.provider ?? null,
      modelo: ctx.modelo ?? null,
      latency_ms: Date.now() - ctx.startedAt,
      usage: ctx.usage ?? null,
      confianca: typeof r?.confianca === 'number' ? r.confianca : null,
      legivel: typeof r?.legivel === 'boolean' ? r.legivel : null,
      sugestao: r?.sugestao ?? null,
      sucesso: outcome.sucesso ?? (typeof r?.sucesso === 'boolean' ? r.sucesso : null),
      truncated: !!ctx.truncated,
      used_retry: !!ctx.used_retry,
      used_native_fallback: !!ctx.used_native_fallback,
      cpf_corrigido_via: ctx.cpf_corrigido_via ?? null,
      cpf_fonte: ctx.cpf_fonte ?? null,
      cpf_contexto: ctx.cpf_contexto ?? null,
      cpf_candidatos: ctx.cpf_candidatos ?? null,
      status: outcome.status,
      motivo: outcome.motivo ?? r?.motivo ?? null,
      erro: outcome.erro ?? null,
      dados_extraidos: r?.dados ?? null,
      dados_esperados: ctx.dados_esperados ?? null,
      score_campos: scoreCampos,
      engine: ctx.engine ?? null,
      primary_model: ctx.primary_model ?? null,
      secondary_model: ctx.secondary_model ?? null,
      dupla_leitura: !!ctx.dupla_leitura,
      divergencias: ctx.divergencias ?? null,
      pdf_rasterizado: !!ctx.pdf_rasterizado,
      pdf_paginas_rasterizadas: ctx.pdf_paginas_rasterizadas ?? null,
    }).select('id').maybeSingle();

    if (inserted?.id) {
      ctx.ocrLogId = inserted.id;
    }
  } catch (err) {
    // Nunca falhar a resposta principal por causa do log
    console.warn('[OCR][log] Falha ao persistir log de execução:', err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Contexto compartilhado entre try/catch para garantir que o log seja
  // persistido mesmo em caminhos de erro/fallback.
  const logCtx: OcrLogCtx = { startedAt: Date.now() };

  try {
    // Autenticação OPCIONAL - permite uso público para cotações
    const authHeader = req.headers.get('Authorization');
    let isAuthenticated = false;
    
    if (authHeader?.startsWith('Bearer ')) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );

      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
        
        if (!claimsError && claimsData?.claims) {
          isAuthenticated = true;
          logCtx.usuario_id = (claimsData.claims as any).sub ?? null;
          console.log('Authenticated request from user:', claimsData.claims.sub);
        }
      } catch (authErr) {
        console.warn('Auth validation failed (proceeding as public):', authErr);
      }
    }
    
    console.log('Request mode:', isAuthenticated ? 'authenticated' : 'public');

    const reqId = (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).slice(0, 8);
    logCtx.reqId = reqId;

    const { url, tipoEsperado, cpfEsperado, nomeEsperado, extrairDados, cotacaoId, associadoId, modoTeste, dadosEsperados } = await req.json();
    logCtx.tipo_esperado = tipoEsperado || null;
    logCtx.cotacao_id = cotacaoId || null;
    logCtx.associado_id = associadoId || null;
    logCtx.modo_teste = !!modoTeste;
    logCtx.dados_esperados = dadosEsperados ?? null;

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL do documento é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validação de segurança para requisições públicas
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const allowedBuckets = ['cotacoes-docs', 'contratos-documentos', 'documentos'];
    const isAllowedUrl = allowedBuckets.some(bucket => 
      url.startsWith(`${SUPABASE_URL}/storage/v1/object/public/${bucket}/`)
    );

    if (!isAuthenticated && !isAllowedUrl) {
      console.warn(`[OCR][${reqId}] Blocked public request with external URL:`, url);
      return new Response(
        JSON.stringify({ 
          error: 'URL não permitida para requisições públicas',
          code: 'INVALID_URL',
          details: 'Apenas URLs do storage do projeto são permitidas sem autenticação'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log estruturado de entrada — `urlHash` evita expor URL completa em massa
    const urlHash = await sha1Hex(url).then(h => h.slice(0, 12)).catch(() => 'no-hash');
    const activeCfg = await getActiveAIConfig().catch(() => ({ provider: 'lovable', model: 'unknown' }));
    logCtx.arquivo_url_hash = urlHash;
    logCtx.provider = activeCfg.provider;
    logCtx.modelo = activeCfg.model;
    console.log(`[OCR][in] ${JSON.stringify({
      reqId,
      tipoEsperado: tipoEsperado || 'auto',
      urlHash,
      isAuthenticated,
      hasCpfEsperado: !!cpfEsperado,
      hasNomeEsperado: !!nomeEsperado,
      provider_global: activeCfg.provider,
      model_global: activeCfg.model,
    })}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Serviço de OCR não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construir prompt com contexto de tipo esperado
    let userPrompt = '';
    if (tipoEsperado) {
      const tipoLabels: Record<string, string> = {
        cnh: 'CNH (Carteira Nacional de Habilitação)',
        crlv: 'CRLV (Certificado de Registro e Licenciamento de Veículo)',
        rg: 'RG ou CIN (Carteira de Identidade — RG antigo ou nova Carteira de Identidade Nacional)',
        comprovante_residencia: 'Comprovante de Residência',
        laudo_vistoria: 'Laudo de Vistoria',
        nota_fiscal_veiculo: 'Nota Fiscal de Veículo',
        atpv_e: 'ATPV-e / CRV Digital (Autorização para Transferência de Propriedade de Veículo)',
      };
      const tipoLabel = tipoLabels[tipoEsperado] || tipoEsperado;
      userPrompt = `Este documento é um(a) ${tipoLabel}. Extraia todas as informações do tipo ${tipoEsperado}. Se o documento não corresponder ao tipo esperado, indique no campo motivo.`;
    } else {
      userPrompt = 'Analise este documento e extraia todas as informações. DETECTE AUTOMATICAMENTE o tipo do documento.';
    }
    
    if (cpfEsperado) {
      userPrompt += ` CPF esperado no cadastro: ${cpfEsperado}. Verifique se confere.`;
    }
    if (nomeEsperado) {
      userPrompt += `

⚠️ VERIFICAÇÃO CRÍTICA DE TITULARIDADE ⚠️
Nome do associado no cadastro: "${nomeEsperado}"
Se for COMPROVANTE DE RESIDÊNCIA: compare OBRIGATORIAMENTE o nome do titular com este nome.
- REPROVE se os nomes não corresponderem (permitindo abreviações válidas como "M. Silva" para "Mario Silva").
- Se mesmo sobrenome mas primeiro nome diferente, sugira REVISAR (possível cônjuge).
- Se nome ilegível, sugira REVISAR.
- Inclua o campo "validacao_titularidade" na resposta com os detalhes da comparação.`;
    }

    // (log de URL substituído por [OCR][in] com urlHash, evitando exposição em massa)

    // Carrega configuração do motor de OCR (singleton, com cache)
    const engineCfg = await getOcrEngineConfig();
    const resolved = await resolveEngine(engineCfg);
    logCtx.engine = resolved.engine;
    logCtx.primary_model = resolved.primary;
    logCtx.secondary_model = resolved.secondary;
    console.log(`[OCR][engine] ${JSON.stringify({ reqId, ...resolved, configured: engineCfg.engine })}`);

    // Baixar arquivo e converter para base64
    const isPdfUrl = url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('.pdf?') || url.toLowerCase().includes('.pdf_');
    const isDataUri = url.startsWith('data:');
    let contentParts: any[];
    let extractedPdfText = '';
    let rasterizedImages: Array<{ dataUri: string; page: number; width: number; height: number; bytes: number }> = [];
    let pdfBytesForMistral: Uint8Array | null = null;
    let publicUrlForMistral: string | null = null;

    if (isDataUri) {
      console.log('Data URI detected, sending directly...');
      contentParts = [
        { type: 'text', text: userPrompt },
        { type: 'image_url', image_url: { url } },
      ];
    } else {
      const fileType = isPdfUrl ? 'PDF' : 'image';
      console.log(`${fileType} detected, downloading...`);
      try {
        const fileResponse = await fetch(url);
        if (!fileResponse.ok) {
          throw new Error(`Failed to download ${fileType}: ${fileResponse.status}`);
        }
        const fileBuffer = await fileResponse.arrayBuffer();
        const uint8Array = new Uint8Array(fileBuffer);
        
        // Converter para base64
        let base64 = '';
        const chunkSize = 8192;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.slice(i, i + chunkSize);
          base64 += String.fromCharCode(...chunk);
        }
        base64 = btoa(base64);
        
        const mimeType = isPdfUrl 
          ? 'application/pdf' 
          : (fileResponse.headers.get('content-type') || 'image/jpeg');
        const dataUri = `data:${mimeType};base64,${base64}`;

        // Para PDFs, tentar extrair texto nativo via unpdf (mais robusto que
        // o extrator regex antigo; funciona em edge runtime sem worker).
        let unpdfScore = 0;
        if (isPdfUrl) {
          try {
            const u = await extractPdfTextUnpdf(uint8Array);
            if (u.ok && u.text && u.text.length > 50) {
              extractedPdfText = u.text;
              unpdfScore = scoreExtractedText(u.text, tipoEsperado ?? undefined);
            } else {
              // fallback ao extrator antigo (regex sobre bytes brutos)
              const pdfText = await extractTextFromPDFBuffer(uint8Array);
              if (pdfText && pdfText.length > 50) {
                extractedPdfText = pdfText;
                unpdfScore = scoreExtractedText(pdfText, tipoEsperado ?? undefined);
              }
            }
          } catch (pdfErr) {
            console.warn(`[OCR][${reqId}] Falha ao extrair texto nativo do PDF:`, pdfErr);
          }
        }

        // Heurística de qualidade: arquivos pequenos costumam ser fotos comprimidas/baixa nitidez
        const bytes = fileBuffer.byteLength;
        const isLikelyLowQuality = !isPdfUrl && (bytes < 80_000 || bytes > 4_500_000);
        const isPdfScanned = isPdfUrl && !extractedPdfText;

        // ───────────── ROTEADOR HEURÍSTICO DE OCR ─────────────
        // Decide o método primário e a cascata de fallbacks com base em:
        // tipo de arquivo, qualidade do texto nativo, tipo de doc esperado,
        // engine configurada e disponibilidade de chaves.
        // Mistral REMOVIDO do pipeline (2026-04-30): hasMistralKey forçado a false
        // para que o roteador nunca selecione 'mistral-ocr' em nenhuma cascata.
        const hasMistralKey = false;
        const hasAnthropicKey = !!Deno.env.get('ANTHROPIC_API_KEY');
        var routerDecision = routeOcr({
          isPdf: isPdfUrl,
          isDataUri,
          bytes,
          nativeText: extractedPdfText,
          nativeTextScore: unpdfScore,
          expectedDocType: tipoEsperado ?? null,
          configuredEngine: engineCfg.engine as any,
          hasMistralKey,
          hasAnthropicKey,
        });
        console.log(`[OCR][router] ${JSON.stringify({
          reqId,
          primary: routerDecision.primary,
          fallbacks: routerDecision.fallbacks,
          critical: routerDecision.critical,
          reason: routerDecision.reason,
          unpdfScore: unpdfScore.toFixed(2),
        })}`);
        logCtx.router_primary = routerDecision.primary;
        logCtx.router_fallbacks = routerDecision.fallbacks;
        logCtx.router_reason = routerDecision.reason;
        logCtx.unpdf_score = Number(unpdfScore.toFixed(2));

        // Guarda PDF para Mistral (que aceita PDF nativo via /v1/ocr) — usado
        // se o roteador escolher mistral-ocr OU se for fallback.
        if (isPdfUrl && (routerDecision.primary === 'mistral-ocr' || routerDecision.fallbacks.includes('mistral-ocr'))) {
          pdfBytesForMistral = uint8Array;
          publicUrlForMistral = isAllowedUrl ? url : null; // Mistral prefere URL pública
        }

        // RASTERIZAÇÃO PDF→JPEG: ativada quando o roteador escolhe raster-vlm.
        // Quando raster-vlm é PRIMARY, confiamos na decisão do roteador (que já
        // analisou o unpdfScore) e rasterizamos sem segunda checagem — só assim
        // a CNH digital SENATRAN (que tem 440 chars de texto-lixo) é lida via
        // imagem com alta confiança em vez de cair em texto nativo inútil.
        const isRasterPrimary = routerDecision.primary === 'raster-vlm';
        const isRasterFallback = routerDecision.fallbacks.includes('raster-vlm');
        const wantsRaster = isRasterPrimary || isRasterFallback;
        if (
          isPdfUrl &&
          wantsRaster &&
          engineCfg.pdf_rasterizar &&
          (isRasterPrimary || shouldRasterizePdf(extractedPdfText))
        ) {
          const tRaster = Date.now();
          try {
            // Novo padrão: 150 DPI (era 200). Reduz tamanho ~40% mantendo
            // legibilidade pra OCR de documento brasileiro padrão A4.
            const initialScale = (engineCfg.pdf_dpi ?? 150) / 72; // PDF user-unit = 1/72 polegada
            let pages = await rasterizePdfPages(uint8Array, { maxPages: 3, scale: initialScale });

            // Aplica cascata de redução em cada página, medindo SEMPRE em base64
            // (que é o que Anthropic/Gemini efetivamente recebem no payload):
            //   1) JPEG q=85 no tamanho atual
            //   2) Reduz dimensões pela METADE e tenta de novo (até MIN_DIM)
            //   3) Se ainda passar de 4MB em base64, descarta a página
            const shrunkPages = await Promise.all(pages.map(async (p) => {
              try {
                const r = await shrinkImageBase64(p.pngBase64, p.mime, MAX_IMAGE_BASE64_BYTES);
                return {
                  page: p.page,
                  base64: r.base64,
                  mime: r.mime,
                  width: r.width || p.width,
                  height: r.height || p.height,
                  bytes: r.bytes,
                  base64Bytes: r.base64Bytes,
                  shrunk: r.shrunk,
                  tooLarge: r.tooLarge,
                };
              } catch (e) {
                console.warn(`[OCR][shrink] page ${p.page} falhou (${(e as Error)?.message}) — usando original`);
                const b64Len = p.pngBase64.length;
                return { page: p.page, base64: p.pngBase64, mime: p.mime, width: p.width, height: p.height, bytes: p.bytes, base64Bytes: b64Len, shrunk: false, tooLarge: b64Len > MAX_IMAGE_BASE64_BYTES };
              }
            }));

            // Fallback final: páginas que ainda estouraram em base64 são re-rasterizadas
            // em escala progressivamente menor pelo PDFium (caso o decoder do shrink
            // tenha falhado). Última opção: descartar a página.
            for (let i = 0; i < shrunkPages.length; i++) {
              const sp = shrunkPages[i];
              if (!sp.tooLarge && sp.base64Bytes <= MAX_IMAGE_BASE64_BYTES) continue;
              const pageNum = sp.page;
              let scale = initialScale;
              for (let attempt = 0; attempt < 4; attempt++) {
                scale = scale * 0.5; // pela metade a cada tentativa
                const reraster = await rasterizePdfPages(uint8Array, { pages: [pageNum], scale });
                if (!reraster.length) break;
                const rr = reraster[0];
                const b64Len = rr.pngBase64.length;
                console.log(`[OCR][raster-fallback] ${JSON.stringify({ reqId, page: pageNum, attempt: attempt + 1, scale: scale.toFixed(2), bytesRaw: rr.bytes, base64Bytes: b64Len, w: rr.width, h: rr.height })}`);
                if (b64Len <= MAX_IMAGE_BASE64_BYTES) {
                  shrunkPages[i] = {
                    page: rr.page, base64: rr.pngBase64, mime: rr.mime,
                    width: rr.width, height: rr.height, bytes: rr.bytes, base64Bytes: b64Len, shrunk: true, tooLarge: false,
                  };
                  break;
                }
              }
              if (shrunkPages[i].tooLarge || shrunkPages[i].base64Bytes > MAX_IMAGE_BASE64_BYTES) {
                console.warn(`[OCR][raster-fallback] ${JSON.stringify({ reqId, page: pageNum, dropped: true, finalBase64Bytes: shrunkPages[i].base64Bytes })}`);
                shrunkPages[i] = { ...shrunkPages[i], base64: '', bytes: 0, base64Bytes: 0 };
              }
            }
            const validPages = shrunkPages.filter((p) => p.base64.length > 0);

            rasterizedImages = validPages.map((p) => ({
              dataUri: `data:${p.mime};base64,${p.base64}`,
              page: p.page,
              width: p.width,
              height: p.height,
              bytes: p.bytes,
            }));
            console.log(`[OCR][rasterize] ${JSON.stringify({
              reqId, pages: validPages.length, dropped: shrunkPages.length - validPages.length, ms: Date.now() - tRaster,
              dpi: engineCfg.pdf_dpi ?? 150,
              sizes: validPages.map((p) => `${p.width}x${p.height} ${p.mime} raw=${Math.round(p.bytes/1024)}KB b64=${Math.round(p.base64Bytes/1024)}KB${p.shrunk ? ' shrunk' : ''}`),
            })}`);
            logCtx.pdf_rasterizado = validPages.length > 0;
            logCtx.pdf_paginas_rasterizadas = validPages.length;
          } catch (rErr) {
            console.warn(`[OCR][${reqId}] rasterização PDF falhou — usando PDF original:`, (rErr as Error)?.message);
            logCtx.pdf_rasterizado = false;
          }
        }

        console.log(`[OCR][file] ${JSON.stringify({
          reqId,
          mime: mimeType,
          bytes,
          isPdf: isPdfUrl,
          hasNativeText: !!extractedPdfText,
          nativeTextLen: extractedPdfText.length,
          unpdfScore: unpdfScore.toFixed(2),
          isLikelyLowQuality,
          isPdfScanned,
          rasterizedPages: rasterizedImages.length,
        })}`);
        logCtx.mime = mimeType;
        logCtx.bytes = bytes;
        logCtx.is_pdf = isPdfUrl;
        logCtx.has_native_text = !!extractedPdfText;
        logCtx.native_text_len = extractedPdfText.length;

        // Reforço de prompt para documentos de baixa qualidade
        const lowQualityHint = (isLikelyLowQuality || isPdfScanned)
          ? `\n\nATENÇÃO QUALIDADE BAIXA: ${isPdfScanned ? 'PDF escaneado sem camada de texto.' : 'imagem com possível baixa nitidez.'} Use OCR rigoroso letra-a-letra. Em campos numéricos críticos (CPF, placa, CEP, datas, RG), se houver QUALQUER dúvida na leitura, retorne null e marque \`confianca\` < 0.7. NÃO INVENTE dígitos.`
          : '';

        // Decide qual mídia mandar para a IA:
        //   - se rasterizamos: mandamos as imagens das páginas (substitui o PDF "vazio")
        //   - senão: mandamos o arquivo original (PDF ou imagem)
        const mediaParts = rasterizedImages.length > 0
          ? rasterizedImages.map((img) => ({ type: 'image_url' as const, image_url: { url: img.dataUri } }))
          : [{ type: 'image_url' as const, image_url: { url: dataUri } }];

        const promptText = extractedPdfText
          ? `${userPrompt}${lowQualityHint}\n\n--- TEXTO EXTRAÍDO DO PDF (use como referência principal para dados textuais como CPF, nome, números) ---\n${extractedPdfText.length > 3000 ? extractedPdfText.substring(0, 3000) + '...' : extractedPdfText}\n--- FIM DO TEXTO ---\n\n${rasterizedImages.length > 0 ? `${rasterizedImages.length} página(s) do PDF foram rasterizadas em alta resolução e estão anexadas como imagem. Use AS IMAGENS como fonte primária; o texto acima é só fallback.` : 'A imagem do documento também está anexada. Use o texto extraído como fonte primária para campos numéricos (CPF, RG, etc.) e a imagem para confirmar layout e campos visuais.'}`
          : userPrompt + lowQualityHint;

        contentParts = [
          { type: 'text', text: promptText },
          ...mediaParts,
        ];
      } catch (downloadError) {
        console.error(`Failed to download ${fileType}:`, downloadError);
        return new Response(
          JSON.stringify({ error: `Erro ao baixar o documento para processamento.` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const ocrStartedAt = Date.now();
    // Helper: resposta de erro 200 com fallback flag (não quebra UI)
    const ocrFallbackResponse = async (motivo: string, extra: Record<string, unknown> = {}) => {
      // Se temos texto nativo do PDF, devolve um payload mínimo "revisar" — UI mantém upload
      const baseDados = extractedPdfText
        ? { texto_extraido: extractedPdfText.substring(0, 4000) }
        : {};
      const payload = {
        sucesso: false,
        fallback: true,
        tipo_detectado: tipoEsperado || 'desconhecido',
        dados: { ...baseDados, ...extra },
        legivel: !!extractedPdfText,
        valido: false,
        sugestao: 'revisar',
        motivo,
        confianca: extractedPdfText ? 0.4 : 0,
      };
      await persistOcrLog(logCtx, {
        result: payload,
        status: 'falha',
        motivo,
        sucesso: false,
      });
      return new Response(
        JSON.stringify(payload),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    };

    // Função encapsulada de uma "passada" de OCR contra a IA com logs estruturados.
    // Retorna { result, raw } se sucesso, ou null se falha (já loga + repassa fallback).
    type OcrPass = { result: any; raw: string; durationMs: number; finishReason?: string; usage?: any };
    const runOcrPass = async (model: string, parts: any[], label: string): Promise<OcrPass | null> => {
      const MAX_TOKENS = 8192;
      const requestPayloadSummary = {
        reqId,
        label,
        model,
        max_tokens: MAX_TOKENS,
        parts: parts.length,
        block_types: parts.map((p: any) => p?.type),
        hasNativeText: !!extractedPdfText,
      };
      console.log(`[OCR][ai_request] ${JSON.stringify(requestPayloadSummary)}`);

      const t0 = Date.now();
      let resp: Response;
      try {
        resp = await callAIGatewayWithRetry({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: parts },
          ],
          max_tokens: MAX_TOKENS,
          temperature: 0,
        }, LOVABLE_API_KEY, label);
      } catch (gwErr) {
        console.error(`[OCR][ai_response] ${JSON.stringify({
          reqId, label, model, status: 0, latencyMs: Date.now() - t0,
          error: String((gwErr as Error)?.message ?? gwErr).slice(0, 300),
        })}`);
        return null;
      }

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        console.error(`[OCR][ai_response] ${JSON.stringify({
          reqId, label, model, status: resp.status, latencyMs: Date.now() - t0,
          error: errText.slice(0, 300),
        })}`);
        return null;
      }

      let dataObj: any;
      let rawText: string;
      try {
        rawText = await resp.text();
        if (!rawText || rawText.trim() === '') {
          console.error(`[OCR][ai_response] ${JSON.stringify({
            reqId, label, model, status: resp.status, latencyMs: Date.now() - t0, error: 'empty body',
          })}`);
          return null;
        }
        dataObj = JSON.parse(rawText);
      } catch (e) {
        console.error(`[OCR][ai_response] ${JSON.stringify({
          reqId, label, model, status: resp.status, latencyMs: Date.now() - t0,
          error: 'parse-failed: ' + String((e as Error)?.message ?? e).slice(0, 200),
        })}`);
        return null;
      }

      const contentStr = dataObj?.choices?.[0]?.message?.content ?? '';
      const finishReason = dataObj?.choices?.[0]?.finish_reason;
      const usage = dataObj?.usage;
      // Detecção de truncamento: openai/gemini = 'length', anthropic = 'max_tokens'
      const wasTruncated = finishReason === 'length' || finishReason === 'max_tokens';

      console.log(`[OCR][ai_response] ${JSON.stringify({
        reqId, label, model, status: resp.status,
        latencyMs: Date.now() - t0,
        finish_reason: finishReason,
        truncated: wasTruncated,
        usage,
        content_chars: contentStr.length,
      })}`);

      if (!contentStr) return null;

      // Parse JSON do conteúdo
      let parsed: any;
      try {
        let clean = contentStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        clean = clean.replace(/:\s*_[A-Z_]+_\s*([,}\]])/g, ': null$1');
        parsed = JSON.parse(clean);
      } catch {
        // Se foi truncado, NÃO confiar no reparo — marcar como falha para retry
        if (wasTruncated) {
          console.error(`[OCR][${reqId}] resposta truncada (${label}) — descartando reparo regex e marcando para retry`);
          return null;
        }
        const repaired = tryRepairTruncatedJSON(contentStr);
        if (repaired) {
          console.warn(`[OCR][${reqId}] JSON reparado após truncamento (${label})`);
          parsed = repaired;
        } else {
          console.error(`[OCR][${reqId}] parse falhou (${label}), conteúdo:`, contentStr.slice(0, 500));
          return null;
        }
      }

      // Marcador de truncamento no resultado para o caller decidir retry
      if (wasTruncated && parsed && typeof parsed === 'object') {
        parsed.__truncated = true;
      }

      return { result: parsed, raw: contentStr, durationMs: Date.now() - t0, finishReason, usage };
    };

    // ============================================================
    // EXECUÇÃO DAS PASSADAS
    //
    // 3 caminhos:
    //   A) engine=mistral → /v1/ocr + pixtral-large para estruturar
    //   B) engine=anthropic|google → callAI direto com modelo escolhido
    //   C) dupla leitura para CNH/CRLV (passada B com modelo secundário)
    // ============================================================

    // Helper interno: roda uma passada com o modelo escolhido (engine != mistral)
    const runEnginePass = async (
      modelId: string, label: string, providerOverride?: 'anthropic'|'google'|'lovable',
    ): Promise<{ result: any; raw: string; durationMs: number; finishReason?: string; usage?: any } | null> => {
      // Para anthropic, callAI já roteia para Anthropic direto.
      // Para google, mandamos via Lovable Gateway (funciona com modelos google/*).
      const provider = providerOverride ?? (resolved.engine === 'anthropic' ? 'anthropic' : 'lovable');
      const t0 = Date.now();
      try {
        const r = await callAI({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contentParts },
          ],
          max_tokens: 8192,
          temperature: 0,
          override: { provider, model: modelId },
          fallbackToLovable: true,
        });
        if (!r.ok) {
          console.error(`[OCR][engine-pass] ${JSON.stringify({ reqId, label, model: modelId, status: r.status, error: r.errorMessage?.slice(0,200) })}`);
          return null;
        }
        const contentStr = r.data?.choices?.[0]?.message?.content ?? '';
        if (!contentStr) return null;
        let parsed: any;
        try {
          const clean = contentStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          parsed = JSON.parse(clean);
        } catch {
          const repaired = tryRepairTruncatedJSON(contentStr);
          if (!repaired) return null;
          parsed = repaired;
        }
        return {
          result: parsed, raw: contentStr,
          durationMs: Date.now() - t0,
          finishReason: r.data?.choices?.[0]?.finish_reason,
          usage: r.data?.usage,
        };
      } catch (e) {
        console.error(`[OCR][engine-pass] ${JSON.stringify({ reqId, label, model: modelId, error: String((e as Error)?.message ?? e).slice(0,200) })}`);
        return null;
      }
    };

    // Helper interno: roda Mistral OCR (PDF/image) + Pixtral para estruturar
    const runMistralPass = async (label: string): Promise<{ result: any; raw: string; durationMs: number; usage?: any } | null> => {
      const t0 = Date.now();
      // Mistral aceita URL (preferível) ou data-uri. Para PDF, usa /v1/ocr.
      let target: { type: 'document_url' | 'image_url'; url: string };
      if (isPdfUrl) {
        if (publicUrlForMistral) target = { type: 'document_url', url: publicUrlForMistral };
        else if (pdfBytesForMistral) {
          const b64 = btoa(String.fromCharCode(...new Uint8Array(pdfBytesForMistral.subarray(0, 0)))) // noop placeholder
            ? '' : '';
          // data-URI fallback
          let s = '';
          const arr = pdfBytesForMistral;
          for (let i = 0; i < arr.length; i += 8192) s += String.fromCharCode(...arr.subarray(i, i + 8192));
          target = { type: 'document_url', url: `data:application/pdf;base64,${btoa(s)}` };
        } else target = { type: 'document_url', url };
      } else {
        target = { type: 'image_url', url };
      }

      // IMPORTANTE: Mistral OCR só aceita modelos Mistral. Se a engine ativa for
      // anthropic/google, resolved.primary é um modelo dessas — não pode ser
      // enviado pra /v1/ocr (gera 400 Invalid Model). Forçamos o default.
      const mistralModel = (resolved.engine === 'mistral' && /^(mistral|pixtral)/i.test(resolved.primary))
        ? resolved.primary
        : 'mistral-ocr-latest';
      const ocr = await runMistralOcr({ ...target, model: mistralModel });
      if (!ocr.ok) {
        console.error(`[OCR][mistral] ${JSON.stringify({ reqId, label, status: ocr.status, error: ocr.error })}`);
        return null;
      }
      const md = ocr.result?.markdown ?? '';
      console.log(`[OCR][mistral] ${JSON.stringify({ reqId, label, pages: ocr.result?.pages.length, markdownChars: md.length })}`);
      if (!md.trim()) return null;

      // Estruturar markdown via Pixtral usando o mesmo system prompt JSON
      const px = await callPixtralChat({
        // Mesma proteção: Pixtral só aceita modelos Mistral.
        model: (resolved.engine === 'mistral' && /^(mistral|pixtral)/i.test(resolved.secondary ?? ''))
          ? (resolved.secondary as string)
          : 'pixtral-large-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${userPrompt}\n\n--- TEXTO EXTRAÍDO PELO MISTRAL OCR (markdown) ---\n${md}\n--- FIM ---` },
        ],
        max_tokens: 4096,
        temperature: 0,
      });
      if (!px.ok) {
        console.error(`[OCR][pixtral-structure] ${JSON.stringify({ reqId, label, status: px.status, error: px.error })}`);
        return null;
      }
      const contentStr = px.data?.choices?.[0]?.message?.content ?? '';
      let parsed: any;
      try {
        const clean = contentStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(clean);
      } catch {
        const repaired = tryRepairTruncatedJSON(contentStr);
        if (!repaired) return null;
        parsed = repaired;
      }
      return { result: parsed, raw: contentStr, durationMs: Date.now() - t0, usage: px.data?.usage };
    };

    // ── Passada A (principal) — segue cascata do roteador ───────────
    // Helper: roda um único método.
    const runMethod = async (method: OcrMethod, label: string) => {
      switch (method) {
        case 'mistral-ocr':
          return await runMistralPass(label);
        case 'text-llm': {
          // Estrutura SOMENTE o texto nativo via LLM (sem visão).
          // Vantagem: muito mais barato e exato quando há texto rico.
          if (!extractedPdfText || extractedPdfText.length < 80) return null;
          const provider = resolved.engine === 'anthropic' ? 'anthropic' : 'lovable';
          const model = resolved.engine === 'anthropic' ? resolved.primary : 'google/gemini-2.5-pro';
          const t0 = Date.now();
          const r = await callAI({
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `${userPrompt}\n\n--- TEXTO EXTRAÍDO DO PDF (camada nativa) ---\n${extractedPdfText.slice(0, 30_000)}\n--- FIM ---` },
            ],
            max_tokens: 8192,
            temperature: 0,
            override: { provider, model },
            fallbackToLovable: true,
          });
          if (!r.ok) {
            console.error(`[OCR][text-llm] ${JSON.stringify({ reqId, label, status: r.status, error: r.errorMessage?.slice(0,200) })}`);
            return null;
          }
          const contentStr = r.data?.choices?.[0]?.message?.content ?? '';
          if (!contentStr) return null;
          let parsed: any;
          try {
            const clean = contentStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            parsed = JSON.parse(clean);
          } catch {
            const repaired = tryRepairTruncatedJSON(contentStr);
            if (!repaired) return null;
            parsed = repaired;
          }
          return {
            result: parsed, raw: contentStr,
            durationMs: Date.now() - t0,
            finishReason: r.data?.choices?.[0]?.message ? 'stop' : undefined,
            usage: r.data?.usage,
          };
        }
        case 'raster-vlm':
        case 'image-vlm':
        default:
          return await runEnginePass(resolved.primary, label);
      }
    };

    // Avalia se o resultado de uma passada é "bom o suficiente" pra parar a cascata.
    const isGoodEnough = (r: any): boolean => {
      if (!r?.result) return false;
      const conf = Number(r.result?.confianca ?? 0);
      if (r.result?.legivel === false) return false;
      if (r.result?.sucesso === false) return false;
      // Pra crítico (CNH/CRLV) exigimos confiança maior antes de pular fallback
      const minConf = routerDecision.critical ? 0.7 : 0.55;
      return Number.isFinite(conf) && conf >= minConf;
    };

    const cascade: { method: OcrMethod; label: string }[] = [
      { method: routerDecision.primary, label: `main-${routerDecision.primary}` },
      ...routerDecision.fallbacks.map((m, i) => ({ method: m, label: `fallback${i + 1}-${m}` })),
    ];

    let firstPassResolved: any = null;
    let usedMethod: OcrMethod = routerDecision.primary;
    for (const step of cascade) {
      console.log(`[OCR][cascade] ${JSON.stringify({ reqId, try: step.label })}`);
      const r = await runMethod(step.method, step.label);
      if (r) {
        usedMethod = step.method;
        firstPassResolved = r;
        if (isGoodEnough(r)) {
          console.log(`[OCR][cascade] ${JSON.stringify({ reqId, accepted: step.label, conf: r.result?.confianca })}`);
          break;
        }
        console.warn(`[OCR][cascade] ${JSON.stringify({ reqId, weak: step.label, conf: r.result?.confianca, sugestao: r.result?.sugestao })}`);
        // Mantém esse resultado mas tenta o próximo da cascata pra ver se melhora.
      } else {
        console.warn(`[OCR][cascade] ${JSON.stringify({ reqId, failed: step.label })}`);
      }
    }

    if (!firstPassResolved) {
      // Fallback de emergência final: Lovable Gateway com Gemini Pro
      console.warn(`[OCR][${reqId}] cascata inteira falhou, fallback final Lovable/Gemini`);
      const fb = await runEnginePass('google/gemini-2.5-pro', 'fallback-emergency', 'lovable');
      if (!fb) {
        return await ocrFallbackResponse('Erro ao processar documento com IA. Documento enviado para revisão manual.');
      }
      logCtx.fallback_emergency = true;
      logCtx.modelo = 'google/gemini-2.5-pro';
      firstPassResolved = fb;
      usedMethod = 'image-vlm';
    }
    logCtx.router_used_method = usedMethod;

    logCtx.usage = firstPassResolved.usage ?? null;
    logCtx.modelo = resolved.primary;
    logCtx.truncated = firstPassResolved.finishReason === 'length' || firstPassResolved.finishReason === 'max_tokens';

    let result = firstPassResolved.result;
    let usedRetry = false;

    // ── DUPLA LEITURA (CNH/CRLV) ────────────────────────────────
    const tipoDetectadoLower = String(result?.tipo_detectado ?? tipoEsperado ?? '').toLowerCase();
    const tipoParaDupla = ['cnh', 'crlv'].includes(tipoDetectadoLower) ? tipoDetectadoLower : null;
    const aplicaDupla = !!tipoParaDupla && engineCfg.dupla_leitura_tipos.includes(tipoParaDupla);

    if (aplicaDupla) {
      console.log(`[OCR][dupla-leitura] ${JSON.stringify({ reqId, tipo: tipoParaDupla, secondary: resolved.secondary })}`);
      // Passada B: usa motor diferente quando primário é mistral; senão, secondary do mesmo motor
      const passB = resolved.engine === 'mistral'
        ? await runEnginePass(resolved.secondary || 'claude-sonnet-4-5', 'dupla-B-anthropic', 'anthropic')
        : await runEnginePass(resolved.secondary || resolved.primary, 'dupla-B-secondary');

      if (passB) {
        const cmp = compareCriticalFields(firstPassResolved.result, passB.result, tipoParaDupla);
        const allMatch = cmp.matches === cmp.total && cmp.total > 0;
        const cpfPlacaDiverge = cmp.mismatches.some((m) => ['cpf', 'placa'].includes(m.field));
        const muitasDiv = cmp.mismatches.length >= 2;

        logCtx.dupla_leitura = true;
        logCtx.divergencias = cmp.mismatches.length ? cmp.mismatches : null;

        console.log(`[OCR][dupla-leitura][result] ${JSON.stringify({ reqId, ...cmp, allMatch, cpfPlacaDiverge })}`);

        if (allMatch) {
          // Concordância total → boost de confiança
          result.confianca = Math.min(1, Math.max(Number(result.confianca ?? 0.8), Number(passB.result.confianca ?? 0.8)) + 0.1);
        } else if (cpfPlacaDiverge || muitasDiv) {
          // Divergência crítica → tenta desempate por CHECKSUM antes de jogar pra revisão.
          // Caso clássico: Sonnet lê CPF correto (passa dígito verificador) e Opus
          // alucina dígitos diferentes (não passa checksum). Confiar no que valida
          // matematicamente é melhor que descartar ambas as leituras.
          const cpfA = String(firstPassResolved.result?.dados?.cpf ?? '').replace(/\D/g, '');
          const cpfB = String(passB.result?.dados?.cpf ?? '').replace(/\D/g, '');
          const aValidCpf = cpfA.length === 11 && validateCPF(cpfA);
          const bValidCpf = cpfB.length === 11 && validateCPF(cpfB);

          // Tiebreaker #1 — MRZ da CNH-e: a 1ª linha do MRZ ("I<BRA<9 dígitos><check>")
          // contém os 9 dígitos do nº de registro + 1 dígito verificador ICAO 9303.
          // Quem casar com uma MRZ matematicamente VÁLIDA tem leitura visual fiel
          // (impossível alucinar uma MRZ que passe no checksum por acaso).
          //
          // Fontes do MRZ, em ordem de confiança:
          //   1) texto nativo do PDF (extractedPdfText) — verdade absoluta quando existe
          //      (raro em CNH-e SENATRAN: o documento real é imagem embutida).
          //   2) campo mrz_registro retornado pela IA (passada A ou B) — só vale se
          //      passar no checksum ICAO 9303.
          let tiebreakerMrz: 'A' | 'B' | null = null;
          let mrzLogCtx: any = null;
          if (tipoParaDupla === 'cnh') {
            const mrzNativeLine = extractMrzLine(extractedPdfText);
            const mrzALine = extractMrzLine(firstPassResolved.result?.dados?.mrz_registro);
            const mrzBLine = extractMrzLine(passB.result?.dados?.mrz_registro);
            const mrzNativeValid = !!mrzNativeLine && validateMrzCheckDigit(mrzNativeLine);
            const mrzAValid = !!mrzALine && validateMrzCheckDigit(mrzALine);
            const mrzBValid = !!mrzBLine && validateMrzCheckDigit(mrzBLine);

            // Escolhe a MRZ "autoritária": nativa válida > A==B válidos > qualquer válido
            let mrzAuthoritative = '';
            let mrzSource: 'native' | 'A' | 'B' | null = null;
            if (mrzNativeValid) {
              mrzAuthoritative = mrzNativeLine;
              mrzSource = 'native';
            } else if (mrzAValid && mrzBValid && mrzALine === mrzBLine) {
              mrzAuthoritative = mrzALine;
              mrzSource = 'A'; // empate confirmado, marca como A por convenção
            } else if (mrzAValid && !mrzBValid) {
              mrzAuthoritative = mrzALine;
              mrzSource = 'A';
            } else if (!mrzAValid && mrzBValid) {
              mrzAuthoritative = mrzBLine;
              mrzSource = 'B';
            }

            if (mrzAuthoritative) {
              const mrzKey = getRegistroFromMrz(mrzAuthoritative);
              const regA = String(firstPassResolved.result?.dados?.numero_registro ?? '').replace(/\D/g, '');
              const regB = String(passB.result?.dados?.numero_registro ?? '').replace(/\D/g, '');
              const aMatchesMrz = mrzKey.length === 9 && regA.length >= 9 && regA.slice(0, 9) === mrzKey;
              const bMatchesMrz = mrzKey.length === 9 && regB.length >= 9 && regB.slice(0, 9) === mrzKey;
              if (aMatchesMrz && !bMatchesMrz) tiebreakerMrz = 'A';
              else if (!aMatchesMrz && bMatchesMrz) tiebreakerMrz = 'B';
              mrzLogCtx = {
                mrzNativeFound: !!mrzNativeLine,
                mrzNativeValid,
                mrzAFound: !!mrzALine,
                mrzAValid,
                mrzBFound: !!mrzBLine,
                mrzBValid,
                mrzSource,
                mrzAuthoritative,
                mrzKey,
                regA,
                regB,
                tiebreakerMrz,
              };
            } else {
              mrzLogCtx = {
                mrzNativeFound: !!mrzNativeLine,
                mrzNativeValid,
                mrzAFound: !!mrzALine,
                mrzAValid,
                mrzBFound: !!mrzBLine,
                mrzBValid,
                mrzSource: null,
                tiebreakerMrz: null,
                reason: 'no-valid-mrz',
              };
            }
            console.log(`[OCR][dupla-leitura][mrz] ${JSON.stringify({ reqId, ...mrzLogCtx })}`);
          }


          // Tiebreaker #2 — CPF checksum (mantém comportamento antigo)
          const tiebreakerCpf =
            aValidCpf && !bValidCpf ? 'A' :
            !aValidCpf && bValidCpf ? 'B' : null;

          // MRZ tem prioridade sobre CPF checksum (ambos podem passar checksum
          // por coincidência; MRZ é leitura mecânica direta da imagem).
          const tiebreaker = tiebreakerMrz ?? tiebreakerCpf;

          if (tiebreaker === 'A') {
            console.log(`[OCR][dupla-leitura][tiebreaker] ${JSON.stringify({ reqId, winner: 'A', reason: tiebreakerMrz ? 'mrz' : 'cpf-checksum', cpfA, cpfB })}`);
            // A venceu → mantém dados de A
            result.sugestao = 'revisar';
            result.confianca = Math.min(1, Math.max(Number(result.confianca ?? 0.85), 0.9));
            result.divergencias = cmp.mismatches;
          } else if (tiebreaker === 'B') {
            console.log(`[OCR][dupla-leitura][tiebreaker] ${JSON.stringify({ reqId, winner: 'B', reason: tiebreakerMrz ? 'mrz' : 'cpf-checksum', cpfA, cpfB })}`);
            // B venceu → adota dados de B
            Object.assign(result, passB.result);
            result.sugestao = 'revisar';
            result.confianca = Math.min(1, Math.max(Number(passB.result.confianca ?? 0.85), 0.9));
            result.divergencias = cmp.mismatches;
          } else {
            // Sem tiebreaker (ambos válidos OU ambos inválidos) → revisão manual
            result.sugestao = 'revisar';
            result.confianca = Math.min(Number(result.confianca ?? 0.5), 0.5);
            result.divergencias = cmp.mismatches;
          }
        } else {
          // 1 divergência leve → marca pra revisão mas mantém dados primários
          result.sugestao = result.sugestao === 'aprovar' ? 'revisar' : result.sugestao;
          result.divergencias = cmp.mismatches;
        }
      } else {
        console.warn(`[OCR][dupla-leitura][${reqId}] passada B falhou — mantendo só passada A`);
      }
    }

    // Heurística antiga de retry (mantida para casos não-dupla-leitura)
    const confianca = Number(result?.confianca ?? 1);
    const lowQualityResult =
      !aplicaDupla && (
        result?.legivel === false ||
        result?.sucesso === false ||
        result?.sugestao === 'revisar' ||
        (Number.isFinite(confianca) && confianca < 0.6)
      );

    if (lowQualityResult) {
      console.log(`[OCR][retry] ${JSON.stringify({
        reqId,
        motivo: { confianca, legivel: result?.legivel, sugestao: result?.sugestao, sucesso: result?.sucesso },
        retry_engine: resolved.engine,
        retry_model: resolved.secondary,
      })}`);
      const secondPass = resolved.engine === 'mistral'
        ? await runEnginePass('claude-sonnet-4-5', 'retry-low-confidence', 'anthropic')
        : await runEnginePass(resolved.secondary || resolved.primary, 'retry-low-confidence');
      if (secondPass) {
        const c2 = Number(secondPass.result?.confianca ?? 0);
        const betterByConfidence = Number.isFinite(c2) && c2 > confianca;
        const promotedToApprove = secondPass.result?.sugestao === 'aprovar' && result?.sugestao !== 'aprovar';
        if (betterByConfidence || promotedToApprove) {
          result = secondPass.result;
          usedRetry = true;
          logCtx.used_retry = true;
          logCtx.modelo = resolved.secondary;
          logCtx.usage = secondPass.usage ?? logCtx.usage;
        }
      }
    }

    const ocrDurationMs = Date.now() - ocrStartedAt;
    console.log(`[OCR][confidence] ${JSON.stringify({
      reqId,
      tipo_esperado: tipoEsperado || 'auto',
      tipo_detectado: result?.tipo_detectado,
      sucesso: result?.sucesso,
      sugestao: result?.sugestao,
      confianca: result?.confianca,
      legivel: result?.legivel,
      usedRetry,
      hasNativeText: !!extractedPdfText,
      nativeTextLen: extractedPdfText?.length || 0,
      durationMs: ocrDurationMs,
    })}`);

    // FUSÃO COM TEXTO NATIVO DO PDF (CNH-e digital tem layout estável)
    // Para PDFs com camada de texto, o texto extraído é 100% confiável.
    // Sobrepomos campos da IA com os do texto nativo quando disponíveis.
    // Coleta candidatos para auditoria/diagnóstico
    if (extractedPdfText) {
      try {
        const cands = collectCPFCandidates(extractedPdfText)
          .map((c) => ({ cpf: formatCPF(c.digits), valido: c.valid, pos: c.index }))
          .slice(0, 20);
        if (cands.length) logCtx.cpf_candidatos = cands;
      } catch { /* noop */ }
    }

    if (result?.tipo_detectado === 'cnh' && result.dados && extractedPdfText) {
      const nativeFields = extractCNHFromText(extractedPdfText);
      if (Object.keys(nativeFields).length > 0) {
        console.log(`[OCR][${reqId}] Texto nativo extraiu ${Object.keys(nativeFields).length} campo(s) da CNH:`, Object.keys(nativeFields));
        // Captura metadados de CPF antes do merge consumir/limpar (não vão para dados finais)
        if (nativeFields.__cpf_fonte) logCtx.cpf_fonte = nativeFields.__cpf_fonte;
        if (nativeFields.__cpf_contexto) logCtx.cpf_contexto = nativeFields.__cpf_contexto;

        result.dados = mergeNativeOverAI(result.dados, nativeFields, reqId);
        logCtx.used_native_fallback = true;
        if (nativeFields.cpf) {
          logCtx.cpf_corrigido_via = nativeFields.__cpf_fonte || 'native';
        }
      }
    }
    // Para outros tipos (RG, Comprovante, NF, ATPV-e, CRLV) extraímos só o CPF
    // do titular/comprador quando aplicável — usando ancoragem ao rótulo.
    if (result?.dados && extractedPdfText && result.tipo_detectado !== 'cnh') {
      const anchored = extractAnchoredCPFFromText(extractedPdfText);
      const nativeCpf = anchored.cpf || extractValidCPFFromText(extractedPdfText);
      if (nativeCpf) {
        if (anchored.cpf) {
          logCtx.cpf_fonte = 'native_anchored';
          logCtx.cpf_contexto = anchored.contexto || null;
        } else {
          logCtx.cpf_fonte = 'native_first_valid';
        }
        const dados = result.dados as Record<string, any>;
        for (const field of ['cpf', 'cpf_titular', 'cpf_comprador', 'cpf_cnpj_comprador']) {
          if (field in dados) {
            const aiVal = dados[field];
            if (!aiVal || aiVal === 'ilegivel' || (typeof aiVal === 'string' && !validateCPF(aiVal.replace(/\D/g, '')))) {
              console.log(`[OCR][${reqId}] CPF nativo do PDF substitui ${field}: "${aiVal}" → "${nativeCpf}"`);
              dados[field] = nativeCpf;
              logCtx.used_native_fallback = true;
              logCtx.cpf_corrigido_via = anchored.cpf ? 'native_anchored' : 'native_first_valid';
            }
          }
        }
      }
    }

    // Validar CPF extraído por checksum quando for CNH
    if (result.tipo_detectado === 'cnh' && result.dados) {
      const cpfExtraido = result.dados.cpf;
      const precisaRetry = !cpfExtraido || cpfExtraido === null || 
        (cpfExtraido !== 'ilegivel' && !validateCPF(cpfExtraido.replace(/\D/g, '')));
      
      if (precisaRetry) {
        const motivoRetry = !cpfExtraido || cpfExtraido === null 
          ? 'CPF não encontrado na CNH' 
          : `CPF extraído (${cpfExtraido}) falhou na validação de dígito verificador`;
        console.log(`[OCR] ${motivoRetry}, tentando extração específica...`);
        
        // Prompt corretivo com tool calling para resposta estruturada
        const retrySystemPrompt = cpfExtraido && cpfExtraido !== null
          ? `TAREFA ÚNICA: Re-leia o CPF desta CNH brasileira.

A leitura anterior retornou "${cpfExtraido}", mas este CPF é MATEMATICAMENTE INVÁLIDO (falha no dígito verificador).

INSTRUÇÕES:
1. Localize o campo "CPF" ou "CPF/MF" no documento
2. Leia CADA DÍGITO individualmente, da esquerda para a direita
3. Preste atenção especial aos dígitos que podem ser confundidos: 1/7, 3/8, 5/6, 0/8, 4/9
4. Se não tiver certeza absoluta de algum dígito, use a função com cpf="ilegivel"
5. Se tiver certeza, use a função com o CPF no formato XXX.XXX.XXX-XX`
          : `TAREFA ÚNICA: Extraia o CPF desta CNH brasileira.

O CPF é um número de 11 dígitos no formato XXX.XXX.XXX-XX.

Locais comuns do CPF na CNH:
- Próximo ao nome do condutor
- Abaixo da foto
- Campo rotulado "CPF" ou "CPF/MF"

Use a função para retornar o CPF encontrado ou "ilegivel" se não conseguir ler.`;

        // Adicionar texto nativo COMPLETO como contexto principal
        // (CNH-e digital tem texto preciso — IA deve preferir ao OCR visual)
        let retryUserContent: any[] = [
          { type: 'text', text: 'Extraia o CPF desta CNH lendo dígito por dígito.' },
          contentParts[1], // imagem
        ];

        if (extractedPdfText) {
          // Manda até 6000 chars (CNH-e cabe inteira) — texto é a fonte primária
          const fullText = extractedPdfText.length > 6000
            ? extractedPdfText.substring(0, 6000)
            : extractedPdfText;
          retryUserContent = [
            { type: 'text', text: `Extraia o CPF desta CNH brasileira.\n\n⚠️ FONTE PRIMÁRIA: o texto abaixo foi extraído NATIVAMENTE do PDF (camada de texto, 100% precisa). Use-o como REFERÊNCIA PRINCIPAL para os dígitos do CPF. A imagem é apenas para confirmar o layout.\n\n--- TEXTO NATIVO DO PDF ---\n${fullText}\n--- FIM ---` },
            contentParts[1],
          ];
        }

        try {
          const retryResponse = await callAIGatewayWithRetry({
            model: OCR_RETRY_MODEL,
            messages: [
              { role: 'system', content: retrySystemPrompt },
              { role: 'user', content: retryUserContent },
            ],
            max_tokens: 200,
            temperature: 0,
            tools: [{
              type: 'function',
              function: {
                name: 'report_cpf',
                description: 'Reportar o CPF extraído da CNH',
                parameters: {
                  type: 'object',
                  properties: {
                    cpf: {
                      type: 'string',
                      description: 'CPF no formato XXX.XXX.XXX-XX ou "ilegivel" se não conseguir ler'
                    }
                  },
                  required: ['cpf'],
                  additionalProperties: false,
                }
              }
            }],
            tool_choice: { type: 'function', function: { name: 'report_cpf' } },
          }, LOVABLE_API_KEY, 'cpf-retry');

          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            
            // Tentar extrair CPF do tool call primeiro
            let retryCpf: string | null = null;
            
            const toolCall = retryData.choices?.[0]?.message?.tool_calls?.[0];
            if (toolCall?.function?.arguments) {
              try {
                const args = JSON.parse(toolCall.function.arguments);
                retryCpf = args.cpf || null;
                console.log('[OCR] CPF extraído via tool calling:', retryCpf);
              } catch {
                console.warn('[OCR] Falha ao parsear tool call arguments, tentando content...');
              }
            }
            
            // Fallback: tentar extrair do content (caso o modelo não use tool calling)
            if (!retryCpf) {
              const retryContent = retryData.choices?.[0]?.message?.content;
              if (retryContent) {
                retryCpf = extractCPFFromRaw(retryContent);
                console.log('[OCR] CPF extraído via content fallback:', retryCpf);
              }
            }

            if (retryCpf && retryCpf !== 'ilegivel') {
              if (validateCPF(retryCpf.replace(/\D/g, ''))) {
                console.log('[OCR] CPF válido extraído na segunda tentativa:', retryCpf);
                result.dados.cpf = retryCpf;
                logCtx.cpf_fonte = 'ia_retry';
              } else {
                console.log('[OCR] CPF da segunda tentativa também inválido:', retryCpf, '→ tentando correção por permutação');
                const cpfCorrigido = tryFixCPFByPermutation(retryCpf);
                if (cpfCorrigido) {
                  console.log(`[OCR] CPF corrigido por permutação: ${retryCpf} → ${cpfCorrigido}`);
                  result.dados.cpf = cpfCorrigido;
                  logCtx.cpf_fonte = 'permutacao';
                } else {
                  const cpfCorrigido1 = cpfExtraido ? tryFixCPFByPermutation(cpfExtraido) : null;
                  if (cpfCorrigido1) {
                    console.log(`[OCR] CPF corrigido por permutação (1ª tentativa): ${cpfExtraido} → ${cpfCorrigido1}`);
                    result.dados.cpf = cpfCorrigido1;
                    logCtx.cpf_fonte = 'permutacao';
                  } else {
                    result.dados.cpf = 'ilegivel';
                    logCtx.cpf_fonte = 'none';
                    result.motivo = (result.motivo || '') + ' CPF não pôde ser lido com precisão (dígito verificador inválido em ambas tentativas).';
                  }
                }
              }
            } else if (retryCpf === 'ilegivel') {
              console.log('[OCR] CPF marcado como ilegível na segunda tentativa');
              const cpfCorrigido = cpfExtraido ? tryFixCPFByPermutation(cpfExtraido) : null;
              if (cpfCorrigido) {
                console.log(`[OCR] CPF corrigido por permutação após ilegível: ${cpfExtraido} → ${cpfCorrigido}`);
                result.dados.cpf = cpfCorrigido;
                logCtx.cpf_fonte = 'permutacao';
              } else {
                result.dados.cpf = 'ilegivel';
                logCtx.cpf_fonte = 'none';
                result.motivo = (result.motivo || '') + ' CPF não pôde ser lido (documento danificado ou cortado).';
              }
            } else {
              const cpfCorrigido = cpfExtraido ? tryFixCPFByPermutation(cpfExtraido) : null;
              if (cpfCorrigido) {
                console.log(`[OCR] CPF corrigido por permutação (fallback): ${cpfExtraido} → ${cpfCorrigido}`);
                result.dados.cpf = cpfCorrigido;
                logCtx.cpf_fonte = 'permutacao';
              } else {
                result.dados.cpf = 'ilegivel';
                logCtx.cpf_fonte = 'none';
              }
            }
          } else {
            console.error('[OCR] Retry response not ok:', retryResponse.status);
            const cpfCorrigido = cpfExtraido ? tryFixCPFByPermutation(cpfExtraido) : null;
            if (cpfCorrigido) {
              result.dados.cpf = cpfCorrigido;
            } else {
              result.dados.cpf = 'ilegivel';
            }
          }
        } catch (retryError) {
          console.error('[OCR] Erro no retry de extração de CPF:', retryError);
          if (cpfExtraido && cpfExtraido !== 'ilegivel' && !validateCPF(cpfExtraido.replace(/\D/g, ''))) {
            const cpfCorrigido = tryFixCPFByPermutation(cpfExtraido);
            if (cpfCorrigido) {
              console.log(`[OCR] CPF corrigido por permutação após erro de rede: ${cpfExtraido} → ${cpfCorrigido}`);
              result.dados.cpf = cpfCorrigido;
            } else {
              result.dados.cpf = 'ilegivel';
            }
          }
        }
      } else if (cpfExtraido && cpfExtraido !== 'ilegivel') {
        console.log('[OCR] CPF extraído validado com sucesso:', cpfExtraido);
      }
    }

    // ============================================================
    // Validação universal de campos críticos por checksum + retry
    // ============================================================
    if (result?.dados && typeof result.dados === 'object') {
      const tipo = result.tipo_detectado;
      const d = result.dados as Record<string, any>;

      // Normalização de numero_motor (CRLV/NF): uppercase, trim, descartar inválidos
      const normalizeMotor = (val: any): string | null => {
        if (!val || typeof val !== 'string') return null;
        const cleaned = val.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '');
        if (cleaned.length < 5) return null;
        if (/^0+$/.test(cleaned.replace(/-/g, ''))) return null;
        return cleaned;
      };
      if (tipo === 'crlv' || tipo === 'nota_fiscal_veiculo' || tipo === 'atpv_e') {
        const motorRaw = d.numero_motor || d.motor;
        const motorNorm = normalizeMotor(motorRaw);
        if (motorNorm) {
          d.numero_motor = motorNorm;
          d.motor = motorNorm;
        } else if (motorRaw) {
          d.numero_motor = null;
          d.motor = null;
        }

        // ============================================================
        // Retentativa direcionada: extrair APENAS numero_motor com modelo mais forte
        // ============================================================
        const motorAusente = !d.numero_motor || d.numero_motor === 'ilegivel';
        if (motorAusente && contentParts && contentParts[1]) {
          console.log(`[OCR] numero_motor ausente em ${tipo} — disparando retry direcionado com ${OCR_RETRY_MODEL}`);
          try {
            const motorRetryPrompt = `TAREFA ÚNICA: Extraia APENAS o NÚMERO DO MOTOR deste documento de veículo brasileiro.

Procure ATIVAMENTE por estes rótulos no documento:
- "MOTOR Nº", "MOTOR N°", "Nº MOTOR", "N° MOTOR", "Nº DO MOTOR", "N° DO MOTOR"
- "MOTOR:", "MOTOR /SÉRIE", "MOTOR/SERIE"
- Em CRLV/CRV digitais o campo aparece logo abaixo ou ao lado de "CHASSI"

O número do motor tem geralmente 7-17 caracteres alfanuméricos (letras MAIÚSCULAS + dígitos, podendo conter hífen).

NÃO confunda com:
- Renavam (apenas dígitos, 9-11 chars)
- Chassi (17 chars exatos)
- Cilindradas (3-4 dígitos)

Use a função para retornar o número do motor encontrado, ou "ilegivel" se identificar o campo mas não conseguir lê-lo.`;

            const motorRetryUserContent: any[] = [
              { type: 'text', text: 'Extraia o número do motor deste documento.' },
              contentParts[1],
            ];
            if (extractedPdfText) {
              motorRetryUserContent[0] = {
                type: 'text',
                text: `Extraia o número do motor deste documento.\n\nTexto nativo do PDF (use como referência):\n${extractedPdfText.substring(0, 2000)}`,
              };
            }

            const motorRetryResp = await callAIGatewayWithRetry({
              model: OCR_RETRY_MODEL,
              messages: [
                { role: 'system', content: motorRetryPrompt },
                { role: 'user', content: motorRetryUserContent },
              ],
              max_tokens: 200,
              temperature: 0,
              tools: [{
                type: 'function',
                function: {
                  name: 'report_numero_motor',
                  description: 'Reportar o número do motor extraído do documento',
                  parameters: {
                    type: 'object',
                    properties: {
                      numero_motor: {
                        type: 'string',
                        description: 'Número do motor (alfanumérico, com hífen opcional) ou "ilegivel" se não conseguir ler',
                      },
                    },
                    required: ['numero_motor'],
                    additionalProperties: false,
                  },
                },
              }],
              tool_choice: { type: 'function', function: { name: 'report_numero_motor' } },
            }, LOVABLE_API_KEY, 'motor-retry');

            if (motorRetryResp.ok) {
              const motorRetryData = await motorRetryResp.json();
              const toolCall = motorRetryData.choices?.[0]?.message?.tool_calls?.[0];
              if (toolCall?.function?.arguments) {
                try {
                  const args = JSON.parse(toolCall.function.arguments);
                  const retryMotor = args.numero_motor;
                  if (retryMotor && retryMotor !== 'ilegivel') {
                    const norm = normalizeMotor(retryMotor);
                    if (norm) {
                      console.log(`[OCR] numero_motor recuperado via retry: "${retryMotor}" → "${norm}"`);
                      d.numero_motor = norm;
                      d.motor = norm;
                    }
                  } else if (retryMotor === 'ilegivel') {
                    d.numero_motor = 'ilegivel';
                    d.motor = 'ilegivel';
                    console.log('[OCR] numero_motor confirmado como ilegível na retentativa');
                  }
                } catch (e) {
                  console.warn('[OCR] Falha ao parsear tool call do retry de motor:', e);
                }
              }
            } else {
              console.warn('[OCR] Retry de numero_motor falhou:', motorRetryResp.status);
            }
          } catch (motorRetryErr) {
            console.warn('[OCR] Erro no retry de numero_motor:', motorRetryErr);
          }
        }

        // Validação leve: se ainda ausente após retry, marcar como revisar
        if (tipo === 'crlv' && (!d.numero_motor || d.numero_motor === 'ilegivel')) {
          result.motivo = (result.motivo || '') + ' Número do motor não foi extraído — preencha manualmente.';
          if (result.sugestao === 'aprovar') result.sugestao = 'revisar';
        }
      }

      // Mapa: campo → validador
      const fieldValidators: Array<{ tipos: string[]; field: string; validate: (v: string) => boolean; label: string }> = [
        { tipos: ['crlv', 'atpv_e', 'nota_fiscal_veiculo'], field: 'placa', validate: validatePlaca, label: 'Placa' },
        { tipos: ['crlv', 'atpv_e'], field: 'renavam', validate: validateRenavam, label: 'Renavam' },
        { tipos: ['crlv', 'atpv_e', 'nota_fiscal_veiculo'], field: 'chassi', validate: validateChassi, label: 'Chassi' },
        { tipos: ['atpv_e'], field: 'cpf_comprador', validate: (v) => validateCPF(v.replace(/\D/g, '')), label: 'CPF comprador' },
        { tipos: ['nota_fiscal_veiculo'], field: 'cpf_cnpj_comprador', validate: (v) => {
          const c = v.replace(/\D/g, '');
          return c.length === 11 ? validateCPF(c) : c.length === 14 ? validateCNPJ(c) : false;
        }, label: 'CPF/CNPJ comprador' },
      ];

      const checksumResults: Array<{ field: string; ok: boolean; value: any }> = [];

      for (const v of fieldValidators) {
        if (!v.tipos.includes(tipo)) continue;
        const raw = d[v.field];
        if (!raw || raw === 'ilegivel') {
          checksumResults.push({ field: v.field, ok: false, value: raw });
          continue;
        }

        // ==== CROSS-CHECK PLACA: sempre confronta com texto nativo do PDF ====
        // O OCR visual confunde 6↔G, 1↔I, 0↔O entre formato antigo e Mercosul.
        // O texto nativo do PDF (quando existe) é a fonte mais confiável.
        if (v.field === 'placa') {
          const ocrPlaca = String(raw).replace(/[^A-Z0-9]/gi, '').toUpperCase();
          const candidatosOCR = gerarCandidatosPlaca(ocrPlaca).filter(p => validatePlaca(p));

          if (extractedPdfText) {
            const candidatosNativos = extractCandidatesFromText(extractedPdfText, 'placa').filter(p => validatePlaca(p));

            // 1) Se o OCR e o texto nativo coincidem em algum candidato, usa-o.
            const match = candidatosOCR.find(c => candidatosNativos.includes(c));
            if (match && match !== ocrPlaca) {
              console.log(`[OCR] Placa cross-check OCR↔PDF: "${ocrPlaca}" → "${match}"`);
              d.placa = match;
            } else if (!match && candidatosNativos.length > 0) {
              // 2) Se não há intersecção, prioriza o texto nativo (sempre mais confiável que visão).
              const escolhida = candidatosNativos[0];
              if (escolhida !== ocrPlaca) {
                console.log(`[OCR] Placa sobrescrita pelo texto nativo do PDF: "${ocrPlaca}" → "${escolhida}"`);
                d.placa = escolhida;
              }
            }
          }

          // 2.5) CROSS-CHECK COM BANCO: para fotos sem texto nativo (JPG/PNG)
          // ou quando o cross-check com PDF não resolveu, tentar achar uma placa
          // entre os candidatos expandidos (incluindo swaps 6↔8, etc.) que já
          // exista em `veiculos`/`cotacoes` do CPF informado. Match único trava.
          try {
            const placaAtual = String(d.placa).replace(/[^A-Z0-9]/gi, '').toUpperCase();
            const todosCandidatos = gerarCandidatosPlaca(placaAtual)
              .filter(p => validatePlaca(p) && p !== placaAtual);

            if (todosCandidatos.length > 0 && cpfEsperado) {
              const cpfDigits = String(cpfEsperado).replace(/\D/g, '');
              if (cpfDigits.length === 11) {
                const sb = createClient(
                  Deno.env.get('SUPABASE_URL')!,
                  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!
                );

                const placasParaTestar = [placaAtual, ...todosCandidatos];

                // Veículos do associado (via profiles.cpf → veiculos.user_id)
                const { data: profileRows } = await sb
                  .from('profiles')
                  .select('user_id')
                  .eq('cpf', cpfDigits)
                  .limit(5);

                const userIds = (profileRows || []).map((r: any) => r.user_id).filter(Boolean);

                let placaConfirmada: string | null = null;

                if (userIds.length > 0) {
                  const { data: vRows } = await sb
                    .from('veiculos')
                    .select('placa')
                    .in('user_id', userIds)
                    .in('placa', placasParaTestar)
                    .limit(2);

                  if (vRows && vRows.length === 1) {
                    placaConfirmada = String(vRows[0].placa).toUpperCase();
                  }
                }

                // Fallback: cotações por CPF
                if (!placaConfirmada) {
                  const { data: cRows } = await sb
                    .from('cotacoes')
                    .select('placa')
                    .eq('cpf', cpfDigits)
                    .in('placa', placasParaTestar)
                    .limit(2);

                  if (cRows && cRows.length === 1) {
                    placaConfirmada = String(cRows[0].placa).toUpperCase();
                  }
                }

                if (placaConfirmada && placaConfirmada !== placaAtual) {
                  console.log(`[OCR] Placa confirmada via banco (CPF ${cpfDigits}): "${placaAtual}" → "${placaConfirmada}"`);
                  d.placa = placaConfirmada;
                }
              }
            }
          } catch (xErr) {
            console.warn('[OCR] Cross-check de placa com banco falhou (mantendo leitura):', xErr);
          }

          // 3) Fallback legado: prefere Mercosul se ainda não foi resolvido.
          const atual = String(d.placa);
          if (!validatePlaca(atual)) {
            const { placa: resolved, ajustada } = resolvePlacaPreferMercosul(atual);
            if (ajustada && validatePlaca(resolved)) {
              console.log(`[OCR] Placa ajustada por normalização Mercosul: "${atual}" → "${resolved}"`);
              d.placa = resolved;
            }
          }
        }


        // ==== SANEAMENTO CHASSI: tentar corrigir confusões O↔0, I↔1, Q↔0, S↔5 ====
        if (v.field === 'chassi') {
          const atual = String(d.chassi || '');
          if (!validateChassi(atual)) {
            const saneado = sanitizeChassiOCR(atual);
            if (saneado) {
              console.log(`[OCR] Chassi saneado por confusão de caracteres: "${atual}" → "${saneado}"`);
              d.chassi = saneado;
            }
          }
        }

        const currentVal = String(d[v.field]);
        const ok = v.validate(currentVal);
        checksumResults.push({ field: v.field, ok, value: d[v.field] });
        if (!ok) {
          console.warn(`[OCR] Validação falhou: ${v.label}="${currentVal}" inválido`);

          // Tentar recuperar do texto nativo do PDF
          if (extractedPdfText) {
            const candidates = extractCandidatesFromText(extractedPdfText, v.field);
            for (const cand of candidates) {
              if (v.validate(cand)) {
                console.log(`[OCR] ${v.label} corrigido via texto nativo: "${currentVal}" → "${cand}"`);
                d[v.field] = cand;
                checksumResults[checksumResults.length - 1] = { field: v.field, ok: true, value: cand };
                break;
              }
            }
          }

          // ==== RETRY DIRECIONADO PARA CHASSI ====
          // Espelha o retry de numero_motor: se ainda inválido, chama gemini-2.5-pro
          // pedindo APENAS o chassi com prompt focado.
          const stillInvalid = !v.validate(String(d[v.field] || ''));
          if (
            v.field === 'chassi' &&
            stillInvalid &&
            ['crlv', 'atpv_e', 'nota_fiscal_veiculo'].includes(tipo) &&
            contentParts && contentParts[1]
          ) {
            console.log(`[OCR] chassi inválido em ${tipo} — disparando retry direcionado com ${OCR_RETRY_MODEL}`);
            try {
              const chassiRetryPrompt = `TAREFA ÚNICA: Extraia APENAS o CHASSI (VIN) deste documento de veículo brasileiro.

Regras do chassi/VIN:
- EXATAMENTE 17 caracteres alfanuméricos
- Letras MAIÚSCULAS + dígitos
- NUNCA contém as letras I, O ou Q (são proibidas — se ler "O" geralmente é "0", se ler "I" geralmente é "1")
- Aparece com rótulo "CHASSI", "CHASSI Nº", "VIN", "N° DO CHASSI"

Procure ATIVAMENTE por esse campo no documento. Se ler 16 caracteres, releia com atenção — pode haver um separador ou caractere mascarado.

NÃO confunda com:
- Renavam (apenas dígitos, 9-11 chars)
- Número do motor (geralmente menor, com hífen)

Use a função para retornar o chassi encontrado, ou "ilegivel" se identificar o campo mas não conseguir lê-lo.`;

              const chassiRetryUserContent: any[] = [
                { type: 'text', text: 'Extraia o chassi (VIN) deste documento.' },
                contentParts[1],
              ];
              if (extractedPdfText) {
                chassiRetryUserContent[0] = {
                  type: 'text',
                  text: `Extraia o chassi (VIN) deste documento.\n\nTexto nativo do PDF (use como referência):\n${extractedPdfText.substring(0, 2000)}`,
                };
              }

              const chassiRetryResp = await callAIGatewayWithRetry({
                model: OCR_RETRY_MODEL,
                messages: [
                  { role: 'system', content: chassiRetryPrompt },
                  { role: 'user', content: chassiRetryUserContent },
                ],
                max_tokens: 200,
                temperature: 0,
                tools: [{
                  type: 'function',
                  function: {
                    name: 'report_chassi',
                    description: 'Reportar o chassi (VIN) extraído do documento',
                    parameters: {
                      type: 'object',
                      properties: {
                        chassi: {
                          type: 'string',
                          description: 'Chassi de 17 caracteres (sem I, O, Q) ou "ilegivel" se não conseguir ler',
                        },
                      },
                      required: ['chassi'],
                      additionalProperties: false,
                    },
                  },
                }],
                tool_choice: { type: 'function', function: { name: 'report_chassi' } },
              }, LOVABLE_API_KEY, 'chassi-retry');

              if (chassiRetryResp.ok) {
                const chassiRetryData = await chassiRetryResp.json();
                const toolCall = chassiRetryData.choices?.[0]?.message?.tool_calls?.[0];
                if (toolCall?.function?.arguments) {
                  try {
                    const args = JSON.parse(toolCall.function.arguments);
                    const retryChassi = args.chassi;
                    if (retryChassi && retryChassi !== 'ilegivel') {
                      const cleaned = String(retryChassi).replace(/[^A-Z0-9]/gi, '').toUpperCase();
                      const final = validateChassi(cleaned) ? cleaned : sanitizeChassiOCR(cleaned);
                      if (final) {
                        console.log(`[OCR] chassi recuperado via retry: "${retryChassi}" → "${final}"`);
                        d.chassi = final;
                        checksumResults[checksumResults.length - 1] = { field: 'chassi', ok: true, value: final };
                      }
                    }
                  } catch (e) {
                    console.warn('[OCR] Falha ao parsear tool call do retry de chassi:', e);
                  }
                }
              } else {
                console.warn('[OCR] Retry de chassi falhou:', chassiRetryResp.status);
              }
            } catch (chassiRetryErr) {
              console.warn('[OCR] Erro no retry de chassi:', chassiRetryErr);
            }
          }
        }
      }

      // Se houve falhas e não conseguimos corrigir, marcar como revisar
      const failedFields = checksumResults.filter(r => !r.ok && r.value && r.value !== 'ilegivel');
      if (failedFields.length > 0) {
        const names = failedFields.map(f => f.field).join(', ');
        result.motivo = (result.motivo || '') + ` Campos com checksum inválido: ${names}.`;
        if (result.sugestao === 'aprovar') result.sugestao = 'revisar';
      }

      // ============================================================
      // Confiança real (substitui fake 0.95)
      // ============================================================
      const totalChecks = checksumResults.length;
      const okChecks = checksumResults.filter(r => r.ok).length;
      const fromNativePdf = !!extractedPdfText && extractedPdfText.length > 50;

      let confidence = 0.7; // base visual
      if (fromNativePdf) confidence = 0.85;
      if (totalChecks > 0) {
        const checksumRatio = okChecks / totalChecks;
        confidence = (fromNativePdf ? 0.6 : 0.4) + checksumRatio * 0.4;
      }
      // Penalizar se houver campos null/ilegivel relevantes
      const nullishCount = Object.values(d).filter(v => v === null || v === 'ilegivel').length;
      const totalFields = Object.keys(d).length;
      if (totalFields > 0) {
        const completeness = 1 - nullishCount / totalFields;
        confidence = confidence * (0.7 + completeness * 0.3);
      }
      result.confianca = Math.max(0.1, Math.min(0.99, Number(confidence.toFixed(2))));
      result._fonte_dados = fromNativePdf ? 'pdf_nativo+visual' : 'visual';
      result._checksums = checksumResults;
    }

    // Status derivado para a tabela de logs
    const derivedStatus: 'sucesso' | 'revisar' | 'truncado' | 'falha' =
      logCtx.truncated
        ? 'truncado'
        : (result?.sugestao === 'aprovar' && result?.sucesso !== false)
          ? 'sucesso'
          : (result?.sugestao === 'reprovar' || result?.sucesso === false)
            ? 'falha'
            : 'revisar';
    await persistOcrLog(logCtx, {
      result,
      status: derivedStatus,
      sucesso: result?.sucesso ?? null,
      motivo: result?.motivo ?? null,
    });

    return new Response(
      JSON.stringify({ ...result, ocrLogId: logCtx.ocrLogId ?? null, scoreCampos: logCtx.dados_esperados ? (result?.scoreCampos ?? null) : null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in document-ocr function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    // Devolve 200 com fallback para que o uploader não exiba "Edge Function 500".
    // O documento ficará para revisão manual no fluxo de cotação.
    const payload = {
      sucesso: false,
      fallback: true,
      tipo_detectado: 'desconhecido',
      dados: {},
      legivel: false,
      valido: false,
      sugestao: 'revisar',
      motivo: `Erro inesperado no OCR: ${errorMessage}. Documento enviado para revisão manual.`,
      confianca: 0,
      error: errorMessage,
    };
    await persistOcrLog(logCtx, {
      result: payload,
      status: 'falha',
      sucesso: false,
      motivo: payload.motivo,
      erro: errorMessage,
    });
    return new Response(
      JSON.stringify({ ...payload, ocrLogId: logCtx.ocrLogId ?? null }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Extrai texto nativo de um PDF usando unpdf (sem worker, ideal para edge runtime).
 * Retorna string vazia se for PDF escaneado puro (apenas imagens) ou se falhar.
 */
async function sha1Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function extractTextFromPDFBuffer(buffer: Uint8Array): Promise<string> {
  try {
    // unpdf precisa de Uint8Array novo (não compartilhado com fetch buffer)
    const data = new Uint8Array(buffer);
    const pdf = await getDocumentProxy(data);
    const { text } = await extractText(pdf, { mergePages: true });
    if (!text) return '';
    // text pode vir como string ou string[] dependendo da versão
    const merged = Array.isArray(text) ? text.join('\n') : text;
    return merged.replace(/[ \t]+/g, ' ').trim();
  } catch (err) {
    console.warn('[OCR] unpdf falhou ao extrair texto:', err instanceof Error ? err.message : err);
    return '';
  }
}

/**
 * Extrai candidatos plausíveis para um campo a partir de texto bruto do PDF.
 * Usado quando o checksum do valor extraído pela IA falha.
 */
function extractCandidatesFromText(text: string, field: string): string[] {
  if (!text) return [];
  const out = new Set<string>();
  switch (field) {
    case 'placa': {
      const re = /\b([A-Z]{3}[-\s]?[0-9][A-Z0-9][0-9]{2})\b/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const cru = m[1].replace(/[-\s]/g, '').toUpperCase();
        out.add(cru);
        // Adiciona também a versão normalizada Mercosul como candidato alternativo
        const norm = normalizePlacaMercosul(cru);
        if (norm && norm !== cru) out.add(norm);
      }
      break;
    }
    case 'renavam': {
      const re = /\b(\d{9,11})\b/g;
      let m;
      while ((m = re.exec(text)) !== null) out.add(m[1].padStart(11, '0'));
      break;
    }
    case 'chassi': {
      const re = /\b([A-HJ-NPR-Z0-9]{17})\b/gi;
      let m;
      while ((m = re.exec(text)) !== null) out.add(m[1].toUpperCase());
      break;
    }
    case 'numero_motor':
    case 'motor': {
      // "MOTOR Nº ABC1234567" / "MOTOR: ABC-1234"
      const re = /MOTOR[^\w]{0,8}([A-Z0-9-]{6,17})/gi;
      let m;
      while ((m = re.exec(text)) !== null) {
        const cand = m[1].replace(/[^A-Z0-9-]/gi, '').toUpperCase();
        if (cand.length >= 6) out.add(cand);
      }
      break;
    }
    case 'cep': {
      const re = /\b(\d{5}-?\d{3})\b/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const c = m[1].replace(/\D/g, '');
        if (c.length === 8) out.add(`${c.slice(0, 5)}-${c.slice(5)}`);
      }
      break;
    }
    case 'cpf_comprador':
    case 'cpf_cnpj_comprador': {
      const reCpf = /\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/g;
      const reCnpj = /\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/g;
      let m;
      while ((m = reCpf.exec(text)) !== null) {
        const c = m[1].replace(/\D/g, '');
        out.add(`${c.slice(0,3)}.${c.slice(3,6)}.${c.slice(6,9)}-${c.slice(9,11)}`);
      }
      while ((m = reCnpj.exec(text)) !== null) {
        const c = m[1].replace(/\D/g, '');
        out.add(`${c.slice(0,2)}.${c.slice(2,5)}.${c.slice(5,8)}/${c.slice(8,12)}-${c.slice(12,14)}`);
      }
      break;
    }
  }
  return Array.from(out);
}
