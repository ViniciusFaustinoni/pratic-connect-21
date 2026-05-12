// ============================================
// Helper: URL transformada do Supabase Storage
// Reduz drasticamente o uso de RAM ao exibir fotos em low-end
// (Moto G 15, Android Go etc.) — converte URLs `object/public`
// em `render/image/public` com width/height/quality.
// ============================================

const RX_PUBLIC = /^(https?:\/\/[^/]+)\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/i;

export type ResizeMode = 'cover' | 'contain' | 'fill';

export interface TransformOpts {
  width?: number;
  height?: number;
  quality?: number;
  resize?: ResizeMode;
}

export const THUMB: TransformOpts = { width: 96, height: 96, quality: 60, resize: 'cover' };
export const PREVIEW: TransformOpts = { width: 960, height: 720, quality: 75, resize: 'contain' };
export const FULL: TransformOpts = { width: 1600, height: 1600, quality: 80, resize: 'contain' };

/**
 * Converte uma URL pública do Supabase Storage em URL com transform
 * (resize/quality no servidor). Devolve a URL original quando:
 *  - URL é vazia/blob:/data:/http externo
 *  - O padrão `object/public` não é encontrado
 */
export function transformedUrl(url?: string | null, opts: TransformOpts = {}): string {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:')) return url;
  const m = url.match(RX_PUBLIC);
  if (!m) return url;
  const [, base, bucket, rest] = m;
  const [pathOnly, originalQs] = rest.split('?');
  const qs = new URLSearchParams();
  if (opts.width) qs.set('width', String(opts.width));
  if (opts.height) qs.set('height', String(opts.height));
  if (opts.quality) qs.set('quality', String(opts.quality));
  if (opts.resize) qs.set('resize', opts.resize);
  if (originalQs) {
    new URLSearchParams(originalQs).forEach((v, k) => {
      if (!qs.has(k)) qs.set(k, v);
    });
  }
  return `${base}/storage/v1/render/image/public/${bucket}/${pathOnly}?${qs.toString()}`;
}
