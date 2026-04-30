/**
 * Pré-processa um arquivo selecionado pelo cliente ANTES do upload pro Storage,
 * garantindo que o pipeline de OCR receba apenas formatos efetivamente suportados
 * pela Anthropic/Gemini (JPEG, PNG, WebP, GIF, PDF).
 *
 * Regras:
 *   - HEIC/HEIF (foto padrão de iPhone moderno) → converte client-side pra JPEG q=0.9
 *     via heic2any (WASM). Nome do arquivo é preservado, só troca a extensão.
 *   - BMP, TIFF, JFIF e qualquer outro formato → REJEITA explicitamente com mensagem
 *     clara, em vez de subir e quebrar silenciosamente quando o adaptador da IA
 *     substituir por placeholder.
 *   - JPEG, PNG, WebP, GIF, PDF → passa direto.
 *
 * Retorna SEMPRE um File (eventualmente convertido) ou lança Error com mensagem
 * pronta pra exibir ao usuário.
 */

const SUPPORTED_DIRECT = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

// HEIC/HEIF têm vários MIMEs reportados por navegadores diferentes
const HEIC_MIMES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

const HEIC_EXTS = new Set(['heic', 'heif']);

// Extensões que deixamos passar quando MIME vem vazio (alguns browsers não preenchem)
const SUPPORTED_EXTS_DIRECT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf']);

function getExt(name: string): string {
  return (name.split('.').pop() || '').toLowerCase();
}

function swapExt(name: string, newExt: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? `${name.slice(0, idx)}.${newExt}` : `${name}.${newExt}`;
}

export interface PreprocessResult {
  file: File;
  converted: boolean;
  originalMime: string;
  originalName: string;
}

/**
 * Detecta HEIC/HEIF mesmo quando o navegador reporta MIME vazio
 * (comum no Chrome desktop, que não conhece o formato nativamente).
 */
export function isHeicLike(file: File): boolean {
  const mime = (file.type || '').toLowerCase();
  if (HEIC_MIMES.has(mime)) return true;
  if (HEIC_EXTS.has(getExt(file.name))) return true;
  return false;
}

export async function preprocessUploadFile(file: File): Promise<PreprocessResult> {
  const originalMime = file.type || '';
  const originalName = file.name;
  const ext = getExt(originalName);
  const mime = originalMime.toLowerCase();

  // 1) HEIC/HEIF → converte pra JPEG no navegador
  if (isHeicLike(file)) {
    try {
      // Import dinâmico — evita carregar o WASM (~200KB) até realmente precisar
      const heic2any = (await import('heic2any')).default;
      const blob = (await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.9,
      })) as Blob | Blob[];
      const finalBlob = Array.isArray(blob) ? blob[0] : blob;
      const newName = swapExt(originalName, 'jpeg');
      return {
        file: new File([finalBlob], newName, { type: 'image/jpeg', lastModified: Date.now() }),
        converted: true,
        originalMime: originalMime || 'image/heic',
        originalName,
      };
    } catch (e) {
      const msg = (e as Error)?.message || String(e);
      console.error('[preprocessUploadFile] HEIC conversion failed:', msg);
      throw new Error(
        'Não foi possível processar essa foto. Por favor, tente tirar a foto novamente ou converter pra JPEG antes de enviar.',
      );
    }
  }

  // 2) Formatos suportados diretos (por MIME ou por extensão quando MIME vazio)
  if (SUPPORTED_DIRECT.has(mime) || (!mime && SUPPORTED_EXTS_DIRECT.has(ext))) {
    return { file, converted: false, originalMime, originalName };
  }

  // 3) Tudo o mais (BMP, TIFF, JFIF, etc.) → rejeita explicitamente
  throw new Error('Formato não suportado. Por favor, envie a foto em JPEG, PNG ou PDF.');
}

/**
 * Lista de extensões/MIMEs aceitos pelo `<input accept="...">`.
 * Mantemos heic/heif na whitelist do input pra deixar o cliente
 * SELECIONAR o arquivo — a conversão acontece em seguida no preprocess.
 */
export const UPLOAD_ACCEPT_ATTR =
  'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.pdf';
