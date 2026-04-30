import { describe, it, expect, vi } from 'vitest';
import { isHeicLike, preprocessUploadFile } from './preprocessUploadFile';

function makeFile(name: string, type: string, size = 100): File {
  const buf = new Uint8Array(size);
  return new File([buf], name, { type });
}

describe('preprocessUploadFile', () => {
  it('passa JPEG direto sem conversão', async () => {
    const f = makeFile('foto.jpg', 'image/jpeg');
    const r = await preprocessUploadFile(f);
    expect(r.converted).toBe(false);
    expect(r.file.type).toBe('image/jpeg');
    expect(r.file.name).toBe('foto.jpg');
  });

  it('passa PDF direto', async () => {
    const f = makeFile('cnh.pdf', 'application/pdf');
    const r = await preprocessUploadFile(f);
    expect(r.converted).toBe(false);
    expect(r.file.type).toBe('application/pdf');
  });

  it('passa PNG/WebP/GIF direto', async () => {
    for (const [name, type] of [
      ['a.png', 'image/png'],
      ['a.webp', 'image/webp'],
      ['a.gif', 'image/gif'],
    ] as const) {
      const r = await preprocessUploadFile(makeFile(name, type));
      expect(r.converted).toBe(false);
    }
  });

  it('rejeita BMP com mensagem clara', async () => {
    const f = makeFile('foto.bmp', 'image/bmp');
    await expect(preprocessUploadFile(f)).rejects.toThrow(/Formato não suportado/i);
  });

  it('rejeita TIFF com mensagem clara', async () => {
    const f = makeFile('scan.tiff', 'image/tiff');
    await expect(preprocessUploadFile(f)).rejects.toThrow(/Formato não suportado/i);
  });

  it('rejeita JFIF com mensagem clara', async () => {
    // JFIF normalmente é reportado como image/jpeg pelo browser quando vem
    // como .jfif, mas se o MIME for image/jfif explícito, rejeita.
    const f = makeFile('foto.jfif', 'image/jfif');
    await expect(preprocessUploadFile(f)).rejects.toThrow(/Formato não suportado/i);
  });

  it('isHeicLike detecta por extensão mesmo com MIME vazio', () => {
    expect(isHeicLike(makeFile('IMG_1234.HEIC', ''))).toBe(true);
    expect(isHeicLike(makeFile('IMG_1234.heif', ''))).toBe(true);
    expect(isHeicLike(makeFile('foto.jpg', 'image/jpeg'))).toBe(false);
  });

  it('isHeicLike detecta por MIME oficial', () => {
    expect(isHeicLike(makeFile('a', 'image/heic'))).toBe(true);
    expect(isHeicLike(makeFile('a', 'image/heif'))).toBe(true);
  });

  it('HEIC corrompido produz erro humanizado', async () => {
    // heic2any vai falhar tentando decodificar 100 bytes de zeros
    vi.stubGlobal('Worker', class { postMessage() {} terminate() {} });
    const f = makeFile('quebrado.heic', 'image/heic');
    await expect(preprocessUploadFile(f)).rejects.toThrow(
      /Não foi possível processar essa foto/i,
    );
  });
});
