/**
 * Reduz uma imagem (PNG ou JPEG) para caber em um TETO DE BASE64
 * (e não bytes raw), pois Anthropic e Gemini medem o limite de 5MB
 * sobre a string base64 transportada no payload JSON.
 *
 * Estratégia escalonada (sem configuração externa):
 *   1. Mede o tamanho que a imagem teria em base64 (~1.37x bytes raw).
 *   2. Se já cabe e é JPEG, devolve como está.
 *   3. Reencoda como JPEG q=85 (PNG comprime mal pra documento).
 *   4. Se ainda passar, reduz a resolução pela METADE e tenta novamente.
 *   5. Não reduz abaixo de 800px no menor lado (ilegível pra OCR).
 *   6. Se mesmo assim não couber, devolve a última tentativa marcada
 *      como `tooLarge=true` para o caller decidir descartar.
 */

import { Image, decode } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

export interface ShrinkResult {
  base64: string;          // sem prefixo data:
  mime: "image/jpeg" | "image/png";
  width: number;
  height: number;
  bytes: number;           // bytes raw (binário)
  base64Bytes: number;     // tamanho real da string base64 (o que a IA mede)
  shrunk: boolean;
  tooLarge: boolean;       // true se nem a última tentativa coube
}

const MIN_DIM = 800;        // não reduz abaixo disso (ilegível pra OCR)
const QUALITY = 85;         // JPEG q=85 é o ponto doce pra documento
const MAX_ITER = 5;         // 5 reduções pela metade = 1/32 do original

/**
 * @param maxBase64Bytes  Teto medido sobre a string base64 (não sobre bytes raw).
 *                        Use 4_000_000 (4MB) pra Anthropic/Gemini.
 */
export async function shrinkImageBase64(
  pngOrJpegBase64: string,
  inputMime: string,
  maxBase64Bytes: number,
): Promise<ShrinkResult> {
  // Curto-circuito: já é JPEG e o base64 atual já cabe
  if (inputMime === "image/jpeg" && pngOrJpegBase64.length <= maxBase64Bytes) {
    const rawBytes = Math.floor((pngOrJpegBase64.length * 3) / 4);
    return {
      base64: pngOrJpegBase64,
      mime: "image/jpeg",
      width: 0,
      height: 0,
      bytes: rawBytes,
      base64Bytes: pngOrJpegBase64.length,
      shrunk: false,
      tooLarge: false,
    };
  }

  // Decodifica
  const buf = base64ToU8(pngOrJpegBase64);
  let img = await decode(buf) as Image;
  let w = img.width;
  let h = img.height;

  // Tentativa 1: reencoda JPEG q=85 no tamanho original
  // Tentativas seguintes: reduz dimensões PELA METADE
  for (let i = 0; i < MAX_ITER; i++) {
    const jpegBytes = await img.encodeJPEG(QUALITY);
    const b64 = u8ToBase64(jpegBytes);
    if (b64.length <= maxBase64Bytes) {
      return {
        base64: b64,
        mime: "image/jpeg",
        width: w,
        height: h,
        bytes: jpegBytes.byteLength,
        base64Bytes: b64.length,
        shrunk: i > 0 || inputMime !== "image/jpeg",
        tooLarge: false,
      };
    }
    // Não couber e já estamos no mínimo → desiste mantendo última versão
    if (Math.min(w, h) <= MIN_DIM) {
      return {
        base64: b64,
        mime: "image/jpeg",
        width: w,
        height: h,
        bytes: jpegBytes.byteLength,
        base64Bytes: b64.length,
        shrunk: true,
        tooLarge: true,
      };
    }
    w = Math.max(MIN_DIM, Math.round(w / 2));
    h = Math.max(MIN_DIM, Math.round(h / 2));
    img = img.resize(w, h);
  }

  const last = await img.encodeJPEG(QUALITY);
  const lastB64 = u8ToBase64(last);
  return {
    base64: lastB64,
    mime: "image/jpeg",
    width: w,
    height: h,
    bytes: last.byteLength,
    base64Bytes: lastB64.length,
    shrunk: true,
    tooLarge: lastB64.length > maxBase64Bytes,
  };
}

function base64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
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
