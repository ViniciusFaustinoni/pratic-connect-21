/**
 * Extração rápida de texto nativo de PDFs usando `unpdf`.
 *
 * `unpdf` é um wrapper serverless-friendly do PDF.js, sem dependências de
 * sistema (canvas, node-fetch). Funciona nativamente em Deno/edge.
 *
 * Uso: tentar PRIMEIRO antes de rasterizar/OCR. Se devolver texto rico,
 * pode-se pular a rota multimodal por completo (estruturação textual via LLM
 * é mais barata e mais precisa que OCR de imagem).
 */
import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

export interface UnpdfResult {
  ok: boolean;
  text: string;
  pages: number;
  /** Texto por página (1-indexed via array). */
  perPage: string[];
  error?: string;
}

export async function extractPdfTextUnpdf(pdfBytes: Uint8Array): Promise<UnpdfResult> {
  try {
    const pdf = await getDocumentProxy(pdfBytes);
    const { text, totalPages } = await extractText(pdf, { mergePages: false });
    const perPage: string[] = Array.isArray(text) ? text : [String(text ?? "")];
    return {
      ok: true,
      text: perPage.join("\n\n").trim(),
      pages: totalPages,
      perPage,
    };
  } catch (e) {
    return {
      ok: false,
      text: "",
      pages: 0,
      perPage: [],
      error: (e as Error)?.message ?? String(e),
    };
  }
}

/**
 * Heurística de "qualidade" do texto extraído por unpdf.
 * Retorna score 0–1 indicando o quanto esse texto é aproveitável para
 * estruturação puramente textual (sem precisar de visão).
 */
export function scoreExtractedText(text: string, expectedDocType?: string): number {
  if (!text) return 0;
  const t = text.trim();
  if (t.length < 80) return 0;

  // Caso clássico CNH-e digital: PDF tem só instruções do Serpro
  const lower = t.toLowerCase();
  if (lower.includes("assinador serpro") || lower.includes("medida provisória nº 2200")) {
    // Texto institucional, mas pode conter dados úteis se >1000 chars
    if (t.length < 1500) return 0.05;
  }

  // Densidade de tokens "úteis" (alfanuméricos com pelo menos 2 chars)
  const tokens = t.split(/\s+/).filter((w) => /[A-Za-z0-9À-ÿ]{2,}/.test(w));
  const density = tokens.length / Math.max(1, t.length / 100);
  // Densidade típica de texto rico ≈ 12-25 tokens/100 chars
  const densityScore = Math.min(1, density / 15);

  // Bônus por tamanho razoável
  const sizeScore = Math.min(1, t.length / 2000);

  // Bônus por presença de marcadores típicos do tipo esperado
  let docBonus = 0;
  if (expectedDocType) {
    const expects: Record<string, RegExp[]> = {
      cnh:    [/REGISTRO\s*N/i, /VALIDADE/i, /CATEGORIA/i, /CPF/i, /HABILITAÇÃO/i],
      crlv:   [/RENAVAM/i, /CHASSI/i, /PLACA/i, /CRLV/i, /CRV/i],
      rg:     [/REGISTRO GERAL/i, /SSP/i, /FILIAÇÃO/i, /NATURALIDADE/i],
      comprovante_residencia: [/ENDEREÇO/i, /LOGRADOURO/i, /CEP/i, /TITULAR/i, /FATURA/i, /VENCIMENTO/i],
    };
    const pats = expects[expectedDocType.toLowerCase()] ?? [];
    const hits = pats.filter((p) => p.test(t)).length;
    docBonus = pats.length ? (hits / pats.length) * 0.3 : 0;
  }

  return Math.min(1, 0.4 * densityScore + 0.3 * sizeScore + docBonus);
}
