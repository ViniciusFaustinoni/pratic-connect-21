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
  bytes: number;
  shrunk: boolean;
}

const MIN_DIM = 800;        // não reduz abaixo disso (ilegível pra OCR)
const QUALITY = 82;
const MAX_ITER = 6;

export async function shrinkImageBase64(
  pngOrJpegBase64: string,
  inputMime: string,
  maxBytes: number,
): Promise<ShrinkResult> {
  // Estima tamanho atual a partir do base64 (3/4 ratio)
  const currentBytes = Math.floor((pngOrJpegBase64.length * 3) / 4);

  // Curto-circuito: já cabe e é JPEG/PNG
  if (currentBytes <= maxBytes && (inputMime === "image/jpeg" || inputMime === "image/png")) {
    return {
      base64: pngOrJpegBase64,
      mime: inputMime as "image/jpeg" | "image/png",
      width: 0,
      height: 0,
      bytes: currentBytes,
      shrunk: false,
    };
  }

  // Decodifica
  const buf = base64ToU8(pngOrJpegBase64);
  let img = await decode(buf) as Image;
  let w = img.width;
  let h = img.height;

  // Tenta encode JPEG; se não couber, reduz dimensões iterativamente
  for (let i = 0; i < MAX_ITER; i++) {
    const jpegBytes = await img.encodeJPEG(QUALITY);
    if (jpegBytes.byteLength <= maxBytes || Math.min(w, h) <= MIN_DIM) {
      return {
        base64: u8ToBase64(jpegBytes),
        mime: "image/jpeg",
        width: w,
        height: h,
        bytes: jpegBytes.byteLength,
        shrunk: true,
      };
    }
    w = Math.max(MIN_DIM, Math.round(w * 0.85));
    h = Math.max(MIN_DIM, Math.round(h * 0.85));
    img = img.resize(w, h);
  }

  // Última tentativa: q=70 no menor tamanho atingido
  const last = await img.encodeJPEG(70);
  return {
    base64: u8ToBase64(last),
    mime: "image/jpeg",
    width: w,
    height: h,
    bytes: last.byteLength,
    shrunk: true,
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
