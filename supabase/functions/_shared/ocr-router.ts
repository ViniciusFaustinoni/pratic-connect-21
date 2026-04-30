/**
 * Roteador heurístico de OCR.
 *
 * Decide qual método usar (e em qual ordem cair em fallback) para cada
 * documento, com base em:
 *   - Tipo de arquivo (PDF nativo vs imagem)
 *   - Presença/qualidade de texto nativo (unpdf score)
 *   - Tipo de documento esperado (CNH/CRLV exigem máxima precisão)
 *   - Engine configurada na tabela ocr_engine_config
 *   - Disponibilidade de chaves (Mistral/Anthropic)
 *
 * Métodos:
 *   - "text-llm"   → texto bruto + LLM textual (mais barato, mais preciso quando há texto rico)
 *   - "mistral-ocr"→ Mistral /v1/ocr (excelente em PDFs nativos)
 *   - "raster-vlm" → rasterizar PDF→PNG e mandar pro modelo multimodal (Sonnet/Gemini)
 *   - "image-vlm"  → mandar imagem direto pro modelo multimodal
 *
 * O resultado é uma cascata ordenada (primary, ...fallbacks).
 */

export type OcrMethod = "text-llm" | "mistral-ocr" | "raster-vlm" | "image-vlm";

export interface RouterInputs {
  isPdf: boolean;
  isDataUri: boolean;
  /** bytes do arquivo bruto (para heurística de tamanho). */
  bytes: number;
  /** Texto nativo extraído (unpdf). Vazio se não há ou não é PDF. */
  nativeText: string;
  /** Score 0–1 da qualidade do texto nativo (unpdf). */
  nativeTextScore: number;
  /** Tipo de documento esperado (cnh, crlv, rg, comprovante...). */
  expectedDocType?: string | null;
  /** Engine configurada na tabela. 'auto' = decidir aqui. */
  configuredEngine: "auto" | "global" | "mistral" | "anthropic" | "google";
  /** Disponibilidade de chaves. */
  hasMistralKey: boolean;
  hasAnthropicKey: boolean;
}

export interface RouterDecision {
  /** Método primário a tentar. */
  primary: OcrMethod;
  /** Cascata em caso de falha/baixa confiança. */
  fallbacks: OcrMethod[];
  /** Razão da escolha (vai pro log). */
  reason: string;
  /** Sinaliza se esse documento é "crítico" (CNH/CRLV) → exige dupla leitura. */
  critical: boolean;
}

const CRITICAL_TYPES = new Set(["cnh", "crlv"]);

export function routeOcr(input: RouterInputs): RouterDecision {
  const critical = !!input.expectedDocType && CRITICAL_TYPES.has(input.expectedDocType.toLowerCase());

  // ── Modo legado: respeita engine configurada explicitamente ──────────
  if (input.configuredEngine !== "auto") {
    if (input.configuredEngine === "mistral" && input.hasMistralKey) {
      return {
        primary: input.isPdf ? "mistral-ocr" : "image-vlm",
        fallbacks: input.isPdf ? ["raster-vlm", "image-vlm"] : ["raster-vlm"],
        reason: `engine=mistral (manual) | ${input.isPdf ? "PDF" : "image"}`,
        critical,
      };
    }
    // anthropic/google/global → vai direto pra multimodal
    return {
      primary: input.isPdf ? (input.nativeTextScore >= 0.7 ? "text-llm" : "raster-vlm") : "image-vlm",
      fallbacks: input.isPdf ? ["raster-vlm", "image-vlm"] : ["raster-vlm"],
      reason: `engine=${input.configuredEngine} (manual)`,
      critical,
    };
  }

  // ── MODO AUTO ────────────────────────────────────────────────────────
  // Imagens: sempre multimodal direto (não tem texto pra extrair).
  if (!input.isPdf) {
    return {
      primary: "image-vlm",
      fallbacks: ["raster-vlm"],
      reason: "auto | image input → VLM direto",
      critical,
    };
  }

  // PDFs com texto nativo MUITO RICO → text-llm é mais barato e preciso.
  // Não usamos pra documentos críticos (CNH/CRLV podem ter campos só visuais como foto).
  if (input.nativeTextScore >= 0.75 && !critical) {
    return {
      primary: "text-llm",
      fallbacks: input.hasMistralKey ? ["mistral-ocr", "raster-vlm"] : ["raster-vlm"],
      reason: `auto | PDF c/ texto rico (score=${input.nativeTextScore.toFixed(2)}) → text-llm`,
      critical,
    };
  }

  // PDFs com texto razoável → text-llm primeiro, mas com fallback agressivo
  if (input.nativeTextScore >= 0.5 && !critical) {
    return {
      primary: "text-llm",
      fallbacks: input.hasMistralKey ? ["mistral-ocr", "raster-vlm"] : ["raster-vlm", "image-vlm"],
      reason: `auto | PDF c/ texto médio (score=${input.nativeTextScore.toFixed(2)}) → text-llm + fallback VLM`,
      critical,
    };
  }

  // PDFs "vazios" (CNH-e digital, scans, formulários): preferir Mistral OCR
  // se disponível; senão rasterizar e usar VLM.
  if (input.hasMistralKey) {
    return {
      primary: "mistral-ocr",
      fallbacks: ["raster-vlm", "image-vlm"],
      reason: `auto | PDF s/ texto útil (score=${input.nativeTextScore.toFixed(2)}) → Mistral OCR`,
      critical,
    };
  }

  return {
    primary: "raster-vlm",
    fallbacks: ["image-vlm"],
    reason: `auto | PDF s/ texto útil (score=${input.nativeTextScore.toFixed(2)}), sem Mistral → rasterizar+VLM`,
    critical,
  };
}
