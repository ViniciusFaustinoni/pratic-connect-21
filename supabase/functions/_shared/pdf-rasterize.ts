/**
 * Rasteriza páginas de PDF para JPEG em runtime Deno (edge).
 * Usa @hyzyla/pdfium (PDFium compilado para WebAssembly).
 *
 * Por que rasterizar antes de mandar pra IA?
 * - PDFs como CNH-e (SENATRAN/CDT) têm camada de texto vazia ou só com instruções:
 *   nome, CPF, validade, fotos ficam dentro de imagens embutidas.
 * - Modelos como Claude e Gemini leem MUITO melhor uma imagem nítida da página
 *   do que um PDF com texto inútil + 5 imagens em baixa resolução.
 * - Mistral OCR não precisa: aceita PDF nativo via /v1/ocr.
 */

import { getDocument, OPS } from "https://esm.sh/pdfjs-serverless@0.5.0";

export interface RasterizedPage {
  page: number;
  jpegBase64: string;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Rasteriza páginas selecionadas de um PDF para JPEG.
 *
 * IMPLEMENTAÇÃO: usa pdfjs-serverless (PDF.js sem worker, otimizado para
 * runtimes serverless/Deno). Como pdfjs-serverless NÃO renderiza para canvas
 * out-of-the-box no Deno, fazemos um pipeline alternativo:
 *
 *   1. Extrair OperatorList da página (lista de ops PDF.js).
 *   2. Para CNH/CRLV digitais (caso típico) onde a página inteira é uma
 *      composição de imagens embutidas, extraímos as imagens e empilhamos.
 *
 * MAS na prática a forma mais robusta em edge runtime é usar a API
 * `getDocument` + `page.getOperatorList()` + identificar os XObjects de
 * imagem. Para casos que não dão match (PDFs vetoriais), fallback retorna
 * vazio e o caller manda o PDF original.
 *
 * Para máxima compatibilidade, este helper retorna:
 *   - imagens embutidas da primeira página relevante (com >= um XObject Image)
 *   - cada imagem convertida para JPEG base64
 *
 * Caller decide como apresentar à IA (tipicamente: várias `image_url` blocks).
 */
export async function rasterizePdfPages(
  pdfBytes: Uint8Array,
  opts: { pages?: number[]; maxPages?: number; minImageBytes?: number } = {},
): Promise<RasterizedPage[]> {
  const minImageBytes = opts.minImageBytes ?? 8_000; // descarta ícones/logos pequenos
  const maxPages = opts.maxPages ?? 3;

  const loadingTask = getDocument({
    data: pdfBytes,
    useSystemFonts: false,
    disableFontFace: true,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const targetPages = (opts.pages?.length ? opts.pages : Array.from({ length: Math.min(totalPages, maxPages) }, (_, i) => i + 1))
    .filter((p) => p >= 1 && p <= totalPages);

  const out: RasterizedPage[] = [];

  for (const pageNum of targetPages) {
    try {
      const page = await pdf.getPage(pageNum);
      const opList = await page.getOperatorList();
      const viewport = page.getViewport({ scale: 1 });

      // Coletar XObjects do tipo imagem
      const objs = page.objs as any;
      const commonObjs = page.commonObjs as any;

      for (let i = 0; i < opList.fnArray.length; i++) {
        const op = opList.fnArray[i];
        if (op !== OPS.paintImageXObject && op !== OPS.paintJpegXObject) continue;
        const args = opList.argsArray[i];
        const objName = args?.[0];
        if (!objName) continue;

        // Resolver objeto (síncrono se já estiver no cache, senão promise)
        const imgObj = await new Promise<any>((resolve) => {
          try {
            objs.get(objName, (val: any) => resolve(val));
          } catch {
            try { commonObjs.get(objName, (val: any) => resolve(val)); }
            catch { resolve(null); }
          }
        });
        if (!imgObj) continue;

        const data: Uint8Array | undefined = imgObj.data ?? imgObj.bitmap?.data;
        const width: number = imgObj.width ?? 0;
        const height: number = imgObj.height ?? 0;
        if (!data || !width || !height) continue;

        // JPEG embutido? (`paintJpegXObject` => bytes JÁ são JPEG)
        if (op === OPS.paintJpegXObject) {
          if (data.byteLength < minImageBytes) continue;
          out.push({
            page: pageNum,
            jpegBase64: u8ToBase64(data),
            width, height,
            bytes: data.byteLength,
          });
          continue;
        }

        // RGBA/RGB raw → empacotar como BMP (não temos encoder JPEG nativo em Deno).
        // Fallback: ignora rasters não-JPEG; captura só JPEGs embutidos
        // (que é o caso real de CNH-e e CRLV digital).
      }
    } catch (e) {
      console.warn(`[pdf-rasterize] página ${pageNum} falhou:`, (e as Error)?.message ?? e);
    }
  }

  return out;
}

function u8ToBase64(arr: Uint8Array): string {
  let s = "";
  const chunk = 8192;
  for (let i = 0; i < arr.length; i += chunk) {
    s += String.fromCharCode(...arr.slice(i, i + chunk));
  }
  return btoa(s);
}

/**
 * Decide se vale a pena rasterizar este PDF antes de enviar à IA.
 * Critérios:
 *  - PDF com pouco texto nativo (< 200 chars) é forte candidato
 *  - PDF com placeholders/instruções tipo "Assinador Serpro" é candidato
 */
export function shouldRasterizePdf(nativeText: string): boolean {
  if (!nativeText || nativeText.length < 200) return true;
  const t = nativeText.toLowerCase();
  if (t.includes("assinador serpro") || t.includes("medida provisória nº 2200")) return true;
  if (t.length < 600) return true; // texto curto demais p/ extrair dados estruturados
  return false;
}
