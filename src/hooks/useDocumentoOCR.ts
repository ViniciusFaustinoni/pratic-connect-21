import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OCRResult {
  tipo: string;
  nome: string | null;
  cpf: string | null;
  validade: string | null;
  legivel: boolean;
  valido: boolean;
  sugestao: 'aprovar' | 'reprovar' | 'revisar';
  motivo: string;
  confianca: number;
}

interface OCRRequest {
  url: string;
  tipoEsperado?: string;
  cpfEsperado?: string;
  nomeEsperado?: string;
}

const OCR_TIMEOUT_MS = 90_000;
const OCR_MAX_ATTEMPTS = 2;

/**
 * Invoca document-ocr com timeout (AbortController) e até 2 tentativas em
 * falhas de rede/timeout. NÃO retenta em erros de aplicação retornados pelo
 * Supabase (ex.: 4xx/5xx com payload), pois indicam problema legítimo.
 */
export async function invokeDocumentOCR(req: OCRRequest): Promise<OCRResult | null> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= OCR_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);
    try {
      const { data, error } = await supabase.functions.invoke('document-ocr', {
        body: req,
        // signal: AbortController é suportado pelo fetch interno do supabase-js
        ...(({ signal: controller.signal } as unknown) as Record<string, unknown>),
      });
      clearTimeout(timeoutId);
      if (error) {
        // Erro retornado pela função (não-transitório); não retenta
        throw error;
      }
      return data as OCRResult;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastErr = err;
      const isAbort = err?.name === 'AbortError' || controller.signal.aborted;
      const isNetwork = err?.message?.toLowerCase?.().includes('failed to fetch') ||
                        err?.message?.toLowerCase?.().includes('network');
      const shouldRetry = (isAbort || isNetwork) && attempt < OCR_MAX_ATTEMPTS;
      if (!shouldRetry) {
        console.error(`[OCR] tentativa ${attempt}/${OCR_MAX_ATTEMPTS} falhou definitivamente:`, err);
        throw err;
      }
      console.warn(`[OCR] tentativa ${attempt}/${OCR_MAX_ATTEMPTS} falhou (${isAbort ? 'timeout' : 'rede'}), retry...`);
      // Pequeno backoff antes do retry
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Falha desconhecida no OCR');
}

export function useDocumentoOCR() {
  return useMutation({
    mutationFn: invokeDocumentOCR,
  });
}
