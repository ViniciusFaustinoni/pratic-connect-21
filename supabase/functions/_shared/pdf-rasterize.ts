/**
 * Rasterização de PDF → JPEG em runtime Deno (edge).
 *
 * Usa @hyzyla/pdfium (PDFium compilado para WebAssembly) para extrair o bitmap
 * raw das páginas e ImageScript para encodar como JPEG real (decodificável
 * por Anthropic/Gemini).
 *
 * IMPORTANTE: a versão anterior usava render: "bitmap" e tratava image.data
 * como se fosse PNG válido — não é. É um bitmap raw RGBA/BGRA cru. Anthropic
 * recusava com "Could not process image" e ImageScript com "Unsupported image
 * type". Agora rodamos render com callback que constrói JPEG real.
 *
 * Por que rasterizar antes de mandar pra IA?
 * - PDFs como CNH-e (SENATRAN/CDT) têm camada de texto vazia ou só com
 *   instruções genéricas; nome, CPF, validade ficam dentro de imagens
 *   embutidas. Modelos como Claude Sonnet 4.5 e Gemini 2.5 Pro leem MUITO
 *   melhor uma imagem nítida da página do que esse PDF "vazio".
 */

import { PDFiumLibrary } from "npm:@hyzyla/pdfium@2.1.6";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

let _libPromise: Promise<any> | null = null;
async function getLib() {
  if (!_libPromise) _libPromise = PDFiumLibrary.init();
  return _libPromise;
}

export interface RasterizedPage {
  page: number;
  /** JPEG base64 puro (sem prefixo data:). */
  pngBase64: string; // nome mantido por compatibilidade com callers
  /** Mime correto: agora SEMPRE "image/jpeg" (era "image/png"). */
  mime: "image/jpeg";
  width: number;
  height: number;
  bytes: number;
}

/**
 * Render callback para PDFium: recebe bitmap BGRA cru e devolve JPEG.
 * PDFium retorna BGRA por padrão — convertemos para RGBA antes de encodar.
 */
async function bitmapToJpeg(opts: { width: number; height: number; data: Uint8Array }, quality: number): Promise<Uint8Array> {
  const { width, height, data } = opts;
  // BGRA → RGBA in-place (cópia para não mutar buffer interno do PDFium)
  const rgba = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    rgba[i]     = data[i + 2]; // R ← B
    rgba[i + 1] = data[i + 1]; // G
    rgba[i + 2] = data[i];     // B ← R
    rgba[i + 3] = data[i + 3]; // A
  }
  const img = new Image(width, height);
  // ImageScript expõe .bitmap como Uint8ClampedArray (RGBA contínuo)
  (img as any).bitmap = new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  return await img.encodeJPEG(quality);
}

/**
 * Rasteriza páginas selecionadas de um PDF para JPEG.
 *
 * @param pdfBytes  Bytes do PDF.
 * @param opts.pages  Lista 1-indexed de páginas a renderizar (default: 1..maxPages).
 * @param opts.maxPages  Limite (default 3) — protege custo/latência em PDFs longos.
 * @param opts.scale  Fator de escala vs. tamanho lógico do PDF (default 2.0 ≈ 200dpi para A4).
 * @param opts.quality  Qualidade JPEG (default 82).
 */
export async function rasterizePdfPages(
  pdfBytes: Uint8Array,
  opts: { pages?: number[]; maxPages?: number; scale?: number; quality?: number } = {},
): Promise<RasterizedPage[]> {
  const scale = opts.scale ?? 2.0;
  const maxPages = opts.maxPages ?? 3;
  const quality = opts.quality ?? 82;

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
        // Render callback recebe bitmap BGRA cru e produz JPEG real.
        const image = await page.render({
          scale,
          render: (renderOpts: any) => bitmapToJpeg(renderOpts, quality),
        });
        const data: Uint8Array = image.data;
        out.push({
          page: pageNum,
          pngBase64: u8ToBase64(data),
          mime: "image/jpeg",
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
 * Heurística: vale rasterizar este PDF? Sim quando o texto extraído nativo
 * é insuficiente para inferir os campos críticos.
 */
export function shouldRasterizePdf(extractedText: string): boolean {
  const t = (extractedText ?? "").trim();
  if (!t) return true;
  // Texto muito curto ou só com headers/disclaimers → rasterizar
  if (t.length < 200) return true;
  return false;
}
