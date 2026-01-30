// ============================================
// UTILITÁRIO: COMPRESSÃO DE IMAGENS
// Otimizado para dispositivos com baixa memória
// ============================================

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeKB?: number;
}

const DEFAULT_OPTIONS: Required<CompressOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.7,
  maxSizeKB: 800, // 800KB máximo
};

/**
 * Comprime uma imagem para reduzir uso de memória e tempo de upload.
 * Usa canvas para redimensionar e recomprimir a imagem.
 * 
 * @param file - Arquivo de imagem original
 * @param options - Opções de compressão
 * @returns Promise com o arquivo comprimido
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Se já for pequena o suficiente, retornar original
  if (file.size <= opts.maxSizeKB * 1024) {
    console.log(`[compressImage] Arquivo já pequeno: ${(file.size / 1024).toFixed(0)}KB`);
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Limpar recursos após uso
    const cleanup = () => {
      canvas.width = 0;
      canvas.height = 0;
      URL.revokeObjectURL(img.src);
    };

    img.onload = () => {
      try {
        if (!ctx) {
          cleanup();
          reject(new Error('Canvas não suportado'));
          return;
        }

        // Calcular dimensões mantendo proporção
        let { width, height } = img;
        
        if (width > opts.maxWidth) {
          height = Math.round((height * opts.maxWidth) / width);
          width = opts.maxWidth;
        }
        
        if (height > opts.maxHeight) {
          width = Math.round((width * opts.maxHeight) / height);
          height = opts.maxHeight;
        }

        // Desenhar no canvas
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // Converter para blob com compressão
        canvas.toBlob(
          (blob) => {
            cleanup();
            
            if (!blob) {
              reject(new Error('Falha ao comprimir imagem'));
              return;
            }

            // Criar novo arquivo
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            console.log(
              `[compressImage] Comprimido: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB (${Math.round((1 - compressedFile.size / file.size) * 100)}% redução)`
            );

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
      // Se falhar ao carregar, retornar original
      console.warn('[compressImage] Erro ao carregar imagem, usando original');
      resolve(file);
    };

    // Carregar imagem usando Object URL (mais eficiente que base64)
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Cria preview otimizado para exibição (sem guardar base64 na memória).
 * Retorna Object URL que DEVE ser revogado após uso.
 * 
 * @param file - Arquivo de imagem
 * @returns Object URL para preview
 */
export function createOptimizedPreview(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Limpa Object URL para liberar memória.
 * SEMPRE chamar quando preview não for mais necessário.
 * 
 * @param url - Object URL a revogar
 */
export function revokePreview(url: string | null): void {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

/**
 * Estima o uso de memória de um arquivo.
 * Útil para debugging.
 */
export function estimateMemoryUsage(file: File): string {
  const sizeKB = file.size / 1024;
  const sizeMB = sizeKB / 1024;
  
  if (sizeMB >= 1) {
    return `${sizeMB.toFixed(1)} MB`;
  }
  return `${sizeKB.toFixed(0)} KB`;
}
