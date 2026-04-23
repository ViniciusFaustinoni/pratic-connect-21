import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Persistência local (localStorage) de rascunhos do cotador antes da cotação ser criada.
 *
 * - 100% client-side: nenhuma chamada a backend / Supabase.
 * - Chave por usuário + tipo de fluxo (normal | substituicao | inclusao | externa | etc).
 * - Expira automaticamente após 24h.
 * - Apenas o último rascunho por chave é mantido.
 */

const STORAGE_PREFIX = 'praticcar:cotador-draft';
const VERSION = 1;
const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const DEBOUNCE_MS = 800;

export type DraftPayload = Record<string, unknown>;

interface StoredDraft {
  savedAt: string; // ISO
  version: number;
  payload: DraftPayload;
}

export interface UseCotacaoDraftOptions {
  /** Identificador do tipo de fluxo (ex: 'novo', 'substituicao', 'inclusao', 'externa'). */
  tipo: string;
  /** Quando true, o hook fica desligado (ex: edição de cotação existente). */
  disabled?: boolean;
  /** Snapshot atual a salvar. Atualize via `setSnapshot` sempre que estado relevante mudar. */
  snapshot: DraftPayload | null;
  /** Heurística: só salva quando há algo de fato preenchido. */
  isMeaningful?: (snapshot: DraftPayload) => boolean;
}

export interface UseCotacaoDraftResult {
  /** Existe rascunho válido (não expirado) aguardando decisão do usuário? */
  hasDraft: boolean;
  /** Quando o rascunho foi salvo. */
  savedAt: Date | null;
  /** Recupera o payload salvo (não apaga). */
  getDraft: () => DraftPayload | null;
  /** Apaga o rascunho do storage. */
  discardDraft: () => void;
  /** Marca como "decidido" — esconde o banner sem apagar (se quiser apagar use `discardDraft`). */
  dismissBanner: () => void;
  /** Apaga o rascunho — usar após criar a cotação com sucesso. */
  clearOnSubmit: () => void;
}

function buildKey(userId: string | null | undefined, tipo: string): string {
  return `${STORAGE_PREFIX}:${userId || 'anon'}:${tipo}`;
}

function safeRead(key: string): StoredDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    if (!parsed || parsed.version !== VERSION || !parsed.savedAt) return null;
    const ageMs = Date.now() - new Date(parsed.savedAt).getTime();
    if (ageMs > TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function safeWrite(key: string, payload: DraftPayload) {
  try {
    const data: StoredDraft = {
      savedAt: new Date().toISOString(),
      version: VERSION,
      payload,
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Quota/privacy mode — ignorar silenciosamente.
  }
}

function safeRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function useCotacaoDraft(options: UseCotacaoDraftOptions): UseCotacaoDraftResult {
  const { tipo, disabled = false, snapshot, isMeaningful } = options;
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const key = buildKey(userId, tipo);

  // Verificação inicial (uma vez por mount/usuário/tipo)
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [initial, setInitial] = useState<StoredDraft | null>(() => (disabled ? null : safeRead(key)));

  // Re-checar quando key muda
  useEffect(() => {
    if (disabled) {
      setInitial(null);
      return;
    }
    setInitial(safeRead(key));
    setBannerDismissed(false);
  }, [key, disabled]);

  // Autosave com debounce
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    if (disabled) return;
    if (!snapshot) return;
    if (isMeaningful && !isMeaningful(snapshot)) return;

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      safeWrite(key, snapshot);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [snapshot, key, disabled, isMeaningful]);

  const getDraft = useCallback((): DraftPayload | null => {
    const fresh = safeRead(key);
    return fresh?.payload ?? null;
  }, [key]);

  const discardDraft = useCallback(() => {
    safeRemove(key);
    setInitial(null);
    setBannerDismissed(true);
  }, [key]);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
  }, []);

  const clearOnSubmit = useCallback(() => {
    safeRemove(key);
    setInitial(null);
    setBannerDismissed(true);
  }, [key]);

  return {
    hasDraft: !disabled && !bannerDismissed && !!initial,
    savedAt: initial ? new Date(initial.savedAt) : null,
    getDraft,
    discardDraft,
    dismissBanner,
    clearOnSubmit,
  };
}
