// ============================================
// UTILITÁRIO: COMPRESSÃO DE IMAGENS
// Otimizado para dispositivos com baixa memória.
//
// Estratégia em ordem de preferência (todas com perfil adaptativo
// por deviceMemory):
//   1. createImageBitmap(file, { resizeWidth, resizeHeight }) +
//      OffscreenCanvas → decodifica JÁ no tamanho final, peak RAM
//      cai ~10× (não materializa o RGBA da imagem original).
//   2. createImageBitmap + Canvas DOM (quando OffscreenCanvas
//      não está disponível, ex.: Safari antigo).
//   3. Fallback <img> + Canvas (último recurso, alto peak RAM).
//
// IMPORTANTE: nenhum chamador deve passar maxWidth/maxHeight maior
// do que o perfil — isso anula a proteção em Android low-end.
// ============================================

import { getDeviceCapabilitySnapshot } from '@/hooks/useDeviceCapability';

// ----- Mutex global: serializa compressões para não competir pelo heap -----
let compressionChain: Promise<unknown> = Promise.resolve();
function runSerialized<T>(task: () => Promise<T>): Promise<T> {
  const next = compressionChain.then(task, task);
  // Não propagar rejeição para a próxima entrada da fila
  compressionChain = next.catch(() => undefined);
  return next;
}

// ----- Detecção de pressão de memória -----
function isMemoryCritical(): boolean {
  try {
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    if (!mem || !mem.jsHeapSizeLimit) return false;
    return mem.usedJSHeapSize / mem.jsHeapSizeLimit > 0.75;
  } catch {
    return false;
  }
}

function downgradeProfile(p: 'low' | 'mid' | 'high'): 'low' | 'mid' | null {
  if (p === 'high') return 'mid';
  if (p === 'mid') return 'low';
  return null;
}

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeKB?: number;
  /** Força perfil específico, ignorando detecção automática. */
  profile?: 'low' | 'mid' | 'high';
}

interface ResolvedOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  maxSizeKB: number;
  skipThresholdKB: number;
  profileLabel: string;
}

const PROFILES = {
  low: {
    maxWidth: 960,
    maxHeight: 960,
    quality: 0.6,
    maxSizeKB: 500,
    skipThresholdKB: 250,
    profileLabel: 'low-end',
  },
  mid: {
    maxWidth: 1280,
    maxHeight: 1280,
    quality: 0.7,
    maxSizeKB: 700,
    skipThresholdKB: 400,
    profileLabel: 'mid-end',
  },
  high: {
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 0.72,
    maxSizeKB: 800,
    skipThresholdKB: 500,
    profileLabel: 'high-end',
  },
} as const;

function resolveOptions(options: CompressOptions): ResolvedOptions {
  const cap = getDeviceCapabilitySnapshot();
  const profileKey =
    options.profile ?? (cap.lowEnd ? 'low' : cap.midEnd ? 'mid' : 'high');
  const base = PROFILES[profileKey];
  // Cap explícito: nunca permite override acima do perfil.
  // Isso evita que chamadores antigos com `maxWidth: 1920` derrubem
  // a proteção low-end.
  const maxWidth = Math.min(options.maxWidth ?? base.maxWidth, base.maxWidth);
  const maxHeight = Math.min(options.maxHeight ?? base.maxHeight, base.maxHeight);
  return {
    maxWidth,
    maxHeight,
    quality: options.quality ?? base.quality,
    maxSizeKB: options.maxSizeKB ?? base.maxSizeKB,
    skipThresholdKB: base.skipThresholdKB,
    profileLabel: base.profileLabel,
  };
}

function computeFitSize(
  srcW: number,
  srcH: number,
  maxW: number,
  maxH: number,
): { width: number; height: number } {
  let width = srcW;
  let height = srcH;
  if (width > maxW) {
    height = Math.round((height * maxW) / width);
    width = maxW;
  }
  if (height > maxH) {
    width = Math.round((width * maxH) / height);
    height = maxH;
  }
  return { width, height };
}

async function blobFromCanvas(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  quality: number,
): Promise<Blob | null> {
  if ('convertToBlob' in canvas) {
    try {
      return await (canvas as OffscreenCanvas).convertToBlob({
        type: 'image/jpeg',
        quality,
      });
    } catch {
      return null;
    }
  }
  return new Promise<Blob | null>((resolve) => {
    (canvas as HTMLCanvasElement).toBlob(
      (b) => resolve(b),
      'image/jpeg',
      quality,
    );
  });
}

/** Tenta caminho moderno: createImageBitmap com resize no decode. */
async function compressViaImageBitmap(
  file: File,
  opts: ResolvedOptions,
): Promise<File | null> {
  if (typeof createImageBitmap !== 'function') return null;
  let probe: ImageBitmap | null = null;
  let bitmap: ImageBitmap | null = null;
  try {
    // Decodifica em tamanho mínimo só pra ler dimensões reais
    // (resizeWidth=1 evita materializar o bitmap inteiro).
    probe = await createImageBitmap(file);
    const { width, height } = computeFitSize(
      probe.width,
      probe.height,
      opts.maxWidth,
      opts.maxHeight,
    );
    probe.close?.();
    probe = null;

    // Re-decodifica já no tamanho final.
    bitmap = await createImageBitmap(file, {
      resizeWidth: width,
      resizeHeight: height,
      resizeQuality: 'medium',
    });

    let canvas: HTMLCanvasElement | OffscreenCanvas;
    let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(width, height);
      ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
    } else {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      ctx = canvas.getContext('2d');
    }
    if (!ctx) {
      bitmap.close?.();
      return null;
    }
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, width, height);
    bitmap.close?.();
    bitmap = null;

    const blob = await blobFromCanvas(canvas, opts.quality);
    // Libera memória do canvas
    if ('width' in canvas) {
      try {
        (canvas as HTMLCanvasElement).width = 0;
        (canvas as HTMLCanvasElement).height = 0;
      } catch {
        // ignore
      }
    }
    if (!blob) return null;
    const compressed = new File([blob], file.name, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
    console.log(
      `[compressImage] (bitmap) ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB @ ${width}x${height}`,
    );
    return compressed;
  } catch (err) {
    try {
      probe?.close?.();
    } catch {
      // ignore
    }
    try {
      bitmap?.close?.();
    } catch {
      // ignore
    }
    console.warn('[compressImage] bitmap path falhou, fallback:', err);
    return null;
  }
}

/** Fallback legado: <img> + Canvas (alto peak RAM). */
function compressViaImgCanvas(
  file: File,
  opts: ResolvedOptions,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      try {
        canvas.width = 0;
        canvas.height = 0;
      } catch {
        // ignore
      }
      try {
        img.src = '';
      } catch {
        // ignore
      }
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // ignore
      }
    };

    img.onload = () => {
      try {
        if (!ctx) {
          cleanup();
          reject(new Error('Canvas não suportado'));
          return;
        }
        const { width, height } = computeFitSize(
          img.width,
          img.height,
          opts.maxWidth,
          opts.maxHeight,
        );
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              cleanup();
              reject(new Error('Falha ao comprimir imagem'));
              return;
            }
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            console.log(
              `[compressImage] (canvas) ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB @ ${width}x${height}`,
            );
            cleanup();
            resolve(compressedFile);
          },
          'image/jpeg',
          opts.quality,
        );
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    img.onerror = () => {
      cleanup();
      console.warn('[compressImage] Erro ao carregar imagem, usando original');
      resolve(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Comprime uma imagem para reduzir uso de memória e tempo de upload.
 * Aplica perfil adaptativo (low/mid/high) por deviceMemory e usa o
 * caminho de menor peak RAM disponível.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  const opts = resolveOptions(options);
  const cap = getDeviceCapabilitySnapshot();

  console.log(
    `[compressImage] Perfil ${opts.profileLabel} (deviceMemory=${cap.deviceMemory ?? '?'}GB, cores=${cap.hardwareConcurrency ?? '?'}, heap=${cap.usedHeapMB ?? '?'}MB) max=${opts.maxWidth}x${opts.maxHeight} q=${opts.quality}`,
  );

  if (file.size <= opts.skipThresholdKB * 1024) {
    console.log(
      `[compressImage] Arquivo já pequeno: ${(file.size / 1024).toFixed(0)}KB`,
    );
    return file;
  }

  // 1) Caminho moderno (peak RAM baixo)
  const fast = await compressViaImageBitmap(file, opts);
  if (fast) return fast;

  // 2) Fallback compatível
  try {
    return await compressViaImgCanvas(file, opts);
  } catch (err) {
    console.warn('[compressImage] Fallback falhou, retornando original:', err);
    return file;
  }
}

/**
 * Cria preview otimizado para exibição (sem guardar base64 na memória).
 * Retorna Object URL que DEVE ser revogado após uso.
 */
export function createOptimizedPreview(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Limpa Object URL para liberar memória.
 * SEMPRE chamar quando preview não for mais necessário.
 */
export function revokePreview(url: string | null): void {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

/** Estima o uso de memória de um arquivo. */
export function estimateMemoryUsage(file: File): string {
  const sizeKB = file.size / 1024;
  const sizeMB = sizeKB / 1024;
  if (sizeMB >= 1) return `${sizeMB.toFixed(1)} MB`;
  return `${sizeKB.toFixed(0)} KB`;
}
