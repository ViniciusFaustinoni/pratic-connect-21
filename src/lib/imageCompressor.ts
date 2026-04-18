// ============================================
// UTILITÁRIO: COMPRESSÃO DE IMAGENS
// Otimizado para dispositivos com baixa memória
// Aplica perfil adaptativo conforme deviceMemory.
// ============================================

import { getDeviceCapabilitySnapshot } from '@/hooks/useDeviceCapability';

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
    maxWidth: 1280,
    maxHeight: 1280,
    quality: 0.7,
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
  return {
    maxWidth: options.maxWidth ?? base.maxWidth,
    maxHeight: options.maxHeight ?? base.maxHeight,
    quality: options.quality ?? base.quality,
    maxSizeKB: options.maxSizeKB ?? base.maxSizeKB,
    skipThresholdKB: base.skipThresholdKB,
    profileLabel: base.profileLabel,
  };
}

/**
 * Comprime uma imagem para reduzir uso de memória e tempo de upload.
 * Usa canvas para redimensionar e recomprimir a imagem.
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const opts = resolveOptions(options);
  const cap = getDeviceCapabilitySnapshot();

  console.log(
    `[compressImage] Perfil ${opts.profileLabel} ativo: maxWidth=${opts.maxWidth} quality=${opts.quality} (deviceMemory=${cap.deviceMemory ?? '?'}GB, cores=${cap.hardwareConcurrency ?? '?'}, heap=${cap.usedHeapMB ?? '?'}MB)`
  );

  // Threshold dinâmico: em low-end, sempre processa para liberar o File original
  if (file.size <= opts.skipThresholdKB * 1024) {
    console.log(`[compressImage] Arquivo já pequeno: ${(file.size / 1024).toFixed(0)}KB`);
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const objectUrl = URL.createObjectURL(file);

    // Limpa recursos. CRÍTICO em low-end: zerar img.src força GC do bitmap decodificado.
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

        let { width, height } = img;

        if (width > opts.maxWidth) {
          height = Math.round((height * opts.maxWidth) / width);
          width = opts.maxWidth;
        }

        if (height > opts.maxHeight) {
          width = Math.round((width * opts.maxHeight) / height);
          height = opts.maxHeight;
        }

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
              `[compressImage] Comprimido: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB (${Math.round(
                (1 - compressedFile.size / file.size) * 100
              )}% redução, ${width}x${height})`
            );

            cleanup();
            resolve(compressedFile);
          },
          'image/jpeg',
          opts.quality
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
