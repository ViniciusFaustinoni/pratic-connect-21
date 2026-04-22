// Helper resiliente para upload de vídeos para o Supabase Storage.
// Implementa retry com backoff exponencial, indicador de progresso real
// (via XMLHttpRequest direto contra /storage/v1/object) e mensagens de
// erro específicas mapeadas para texto amigável ao usuário.
//
// Uso:
//   await uploadVideoWithRetry({
//     supabaseUrl, anonKey, accessToken,
//     bucket: 'vistoria-videos',
//     path: `${vistoriaId}/video_360.mp4`,
//     file,
//     upsert: true,
//     onProgress: (pct) => setProgress(pct),
//   });
//
// O helper NÃO grava nada em tabelas — apenas faz o upload binário e devolve
// o path final para o chamador montar a URL pública / atualizar o banco.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface UploadVideoOptions {
  /** Cliente Supabase usado apenas para descobrir URL e session (opcional). */
  supabase?: SupabaseClient<any, any, any>;
  /** URL base do projeto Supabase (https://xxxx.supabase.co). */
  supabaseUrl?: string;
  /** Chave pública (anon) — fallback quando não há sessão autenticada. */
  anonKey?: string;
  /** Token de acesso JWT (override manual). Se ausente, usa supabase.auth.getSession(). */
  accessToken?: string;
  bucket: string;
  path: string;
  file: File | Blob;
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
  /** Callback chamada com inteiro 0-100 conforme bytes são enviados. */
  onProgress?: (percent: number) => void;
  /** Número máximo de tentativas (default 3). */
  maxAttempts?: number;
}

export class VideoUploadError extends Error {
  /** Mensagem amigável para exibir ao usuário (já traduzida). */
  userMessage: string;
  /** Código HTTP, se disponível. */
  status?: number;
  /** Causa original. */
  cause?: unknown;

  constructor(userMessage: string, options: { status?: number; cause?: unknown; technical?: string } = {}) {
    super(options.technical || userMessage);
    this.name = 'VideoUploadError';
    this.userMessage = userMessage;
    this.status = options.status;
    this.cause = options.cause;
  }
}

const DEFAULT_MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1000, 3000, 8000];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Mapeia erros HTTP/rede para mensagens amigáveis em PT-BR. */
function mapErrorToUserMessage(status: number | undefined, body: string, networkError?: boolean): string {
  if (networkError) {
    return 'Conexão instável. Verifique sua internet e tente novamente.';
  }
  if (status === 413 || /payload too large|exceeded the maximum allowed size/i.test(body)) {
    return 'Vídeo muito grande. Grave um vídeo mais curto (até 1 minuto).';
  }
  if (status === 401 || /jwt expired|invalid jwt|unauthorized/i.test(body)) {
    return 'Sua sessão expirou. Recarregue a página e tente novamente.';
  }
  if (status === 415 || /mime type .* not allowed|invalid mime/i.test(body)) {
    return 'Formato de vídeo não suportado. Grave novamente usando o botão da câmera.';
  }
  if (status === 403) {
    return 'Sem permissão para enviar este vídeo. Recarregue a página e tente novamente.';
  }
  if (status && status >= 500) {
    return 'Servidor indisponível no momento. Tentaremos novamente em instantes.';
  }
  return 'Erro ao enviar vídeo. Tente novamente.';
}

/** Erros transitórios que valem retry. */
function isRetryable(status: number | undefined, networkError: boolean): boolean {
  if (networkError) return true;
  if (!status) return true;
  if (status >= 500) return true;
  if (status === 408 || status === 429) return true;
  return false;
}

interface SingleAttemptResult {
  ok: boolean;
  status: number;
  body: string;
  networkError: boolean;
}

function singleUpload(opts: {
  url: string;
  token: string;
  apikey: string;
  file: File | Blob;
  contentType: string;
  cacheControl: string;
  upsert: boolean;
  onProgress?: (percent: number) => void;
}): Promise<SingleAttemptResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', opts.url, true);
    xhr.setRequestHeader('Authorization', `Bearer ${opts.token}`);
    xhr.setRequestHeader('apikey', opts.apikey);
    xhr.setRequestHeader('x-upsert', opts.upsert ? 'true' : 'false');
    xhr.setRequestHeader('cache-control', opts.cacheControl);
    if (opts.contentType) {
      xhr.setRequestHeader('content-type', opts.contentType);
    }

    if (opts.onProgress && xhr.upload) {
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable && ev.total > 0) {
          const pct = Math.min(99, Math.round((ev.loaded / ev.total) * 100));
          opts.onProgress?.(pct);
        }
      };
    }

    xhr.onload = () => {
      const ok = xhr.status >= 200 && xhr.status < 300;
      if (ok) opts.onProgress?.(100);
      resolve({
        ok,
        status: xhr.status,
        body: xhr.responseText || '',
        networkError: false,
      });
    };

    xhr.onerror = () => {
      resolve({ ok: false, status: 0, body: 'network error', networkError: true });
    };

    xhr.ontimeout = () => {
      resolve({ ok: false, status: 0, body: 'timeout', networkError: true });
    };

    // Timeout generoso por tentativa (5 min) — vídeos grandes em 4G podem demorar.
    xhr.timeout = 5 * 60 * 1000;

    xhr.send(opts.file);
  });
}

export async function uploadVideoWithRetry(opts: UploadVideoOptions): Promise<{ path: string }> {
  const {
    supabase,
    supabaseUrl: urlOverride,
    anonKey: anonOverride,
    accessToken: tokenOverride,
    bucket,
    path,
    file,
    contentType,
    cacheControl = '3600',
    upsert = true,
    onProgress,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
  } = opts;

  // Resolve URL e chave anon — preferimos o override, depois o cliente, depois envs.
  const supabaseUrl =
    urlOverride ||
    (supabase as any)?.supabaseUrl ||
    (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_URL : undefined);
  const anonKey =
    anonOverride ||
    (supabase as any)?.supabaseKey ||
    (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY : undefined);

  if (!supabaseUrl || !anonKey) {
    throw new VideoUploadError('Configuração de upload indisponível. Recarregue a página e tente novamente.', {
      technical: 'Missing supabaseUrl or anonKey for video upload',
    });
  }

  // Resolve token: override > sessão atual do cliente > anon
  let token = tokenOverride;
  if (!token && supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token || undefined;
    } catch (e) {
      console.warn('[videoUpload] não foi possível obter sessão:', e);
    }
  }
  if (!token) token = anonKey;

  const finalContentType =
    contentType ||
    (file as File).type ||
    'video/mp4';

  const url = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;

  let lastError: SingleAttemptResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[videoUpload] tentativa ${attempt}/${maxAttempts} — ${bucket}/${path} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
    onProgress?.(0);

    const result = await singleUpload({
      url,
      token,
      apikey: anonKey,
      file,
      contentType: finalContentType,
      cacheControl,
      upsert,
      onProgress,
    });

    if (result.ok) {
      console.log(`[videoUpload] sucesso na tentativa ${attempt}`);
      return { path };
    }

    lastError = result;
    console.warn(`[videoUpload] falhou tentativa ${attempt}: status=${result.status} body=${result.body.slice(0, 200)}`);

    // Erros não-retryable: aborta imediatamente
    if (!isRetryable(result.status, result.networkError)) {
      break;
    }

    // Aguarda backoff antes da próxima tentativa (se houver)
    if (attempt < maxAttempts) {
      await sleep(BACKOFF_MS[attempt - 1] ?? 8000);
    }
  }

  const userMessage = mapErrorToUserMessage(
    lastError?.status,
    lastError?.body || '',
    lastError?.networkError ?? false
  );
  throw new VideoUploadError(userMessage, {
    status: lastError?.status,
    technical: `videoUpload failed after ${maxAttempts} attempts: ${lastError?.status} ${lastError?.body?.slice(0, 200)}`,
  });
}
