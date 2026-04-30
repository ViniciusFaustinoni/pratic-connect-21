/**
 * Rasterização de PDF → PNG/JPEG em runtime Deno (edge).
 *
 * Usa @hyzyla/pdfium (PDFium compilado para WebAssembly) — funciona em Deno
 * sem dependências de sistema (poppler/imagemagick).
 *
 * Por que rasterizar antes de mandar pra IA?
 * - PDFs como CNH-e (SENATRAN/CDT) têm camada de texto vazia ou só com
 *   instruções genéricas; nome, CPF, validade ficam dentro de imagens
 *   embutidas. Modelos como Claude Sonnet 4.5 e Gemini 2.5 Pro leem MUITO
 *   melhor uma imagem nítida da página do que esse PDF "vazio".
 * - Mistral OCR aceita PDF nativo via /v1/ocr — não precisa rasterizar.
 */

// pdfium-wasm em Deno: usa import npm: (Deno 1.40+ / edge-runtime suportam)
import { PDFiumLibrary } from "npm:@hyzyla/pdfium@2.1.6";

let _libPromise: Promise<any> | null = null;
async function getLib() {
  if (!_libPromise) _libPromise = PDFiumLibrary.init();
  return _libPromise;
}

export interface RasterizedPage {
  page: number;
  /** PNG base64 puro (sem prefixo data:). PDFium devolve PNG. */
  pngBase64: string;
  /** Mime correto: "image/png". */
  mime: "image/png";
  width: number;
  height: number;
  bytes: number;
}

/**
 * Rasteriza páginas selecionadas de um PDF para PNG.
 *
 * @param pdfBytes  Bytes do PDF.
 * @param opts.pages  Lista 1-indexed de páginas a renderizar (default: 1..maxPages).
 * @param opts.maxPages  Limite (default 3) — protege custo/latência em PDFs longos.
 * @param opts.scale  Fator de escala vs. tamanho lógico do PDF (default 2.0 ≈ 200dpi para A4).
 */
export async function rasterizePdfPages(
  pdfBytes: Uint8Array,
  opts: { pages?: number[]; maxPages?: number; scale?: number } = {},
): Promise<RasterizedPage[]> {
  const scale = opts.scale ?? 2.0;
  const maxPages = opts.maxPages ?? 3;

  const lib = await getLib();
  const doc = await lib.loadDocument(pdfBytes);
  const out: RasterizedPage[] = [];

  try {
    const totalPages = doc.getPageCount();
    const targets = (opts.pages?.length
      ? opts.pages
      : Array.from({ length: Math.min(totalPages, maxPages) }, (_, i) => i + 1)
    ).filter((p) => p >= 1 && p <= totalPages);

    for (const pageNum of targets) {
      try {
        const page = doc.getPage(pageNum - 1);
        const image = await page.render({ scale, render: "bitmap" });
        // image.data é Uint8Array PNG
        const data: Uint8Array = image.data;
        out.push({
          page: pageNum,
          pngBase64: u8ToBase64(data),
          mime: "image/png",
          width: image.width,
          height: image.height,
          bytes: data.byteLength,
        });
      } catch (e) {
        console.warn(`[pdf-rasterize] page ${pageNum} failed:`, (e as Error)?.message ?? e);
      }
    }
  } finally {
    try { doc.destroy?.(); } catch { /* noop */ }
  }

  return out;
}

function u8ToBase64(arr: Uint8Array): string {
  let s = "";
  const chunk = 8192;
  for (let i = 0; i < arr.length; i += chunk) {
    s += String.fromCharCode(...(arr.subarray(i, i + chunk) as unknown as number[]));
  }
  return btoa(s);
}

/**
 * Decide se vale a pena rasterizar este PDF antes de enviar à IA.
 * Critérios baseados na qualidade do texto extraído nativamente.
 */
export function shouldRasterizePdf(nativeText: string): boolean {
  if (!nativeText || nativeText.length < 200) return true;
  const t = nativeText.toLowerCase();
  // CNH-e digital sempre cai aqui
  if (t.includes("assinador serpro") || t.includes("medida provisória nº 2200")) return true;
  // Texto curto demais para conter os campos estruturados esperados
  if (t.length < 600) return true;
  return false;
}
