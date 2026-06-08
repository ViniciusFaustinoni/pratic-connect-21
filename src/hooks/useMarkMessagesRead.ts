import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Dispara `whatsapp-mark-read` para o provedor (Evolution/Meta) quando o
 * operador efetivamente VÊ uma mensagem de entrada (via IntersectionObserver
 * acoplado no ChatPanel) ou quando a janela ganha foco com pendentes.
 *
 * Bufferiza os ids num intervalo curto (default 800ms) para evitar uma
 * chamada por bolha quando o operador rola rápido.
 */
export function useMarkMessagesRead(telefone: string | null) {
  const pendingRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Set<string>>(new Set());

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!telefone) {
      pendingRef.current.clear();
      return;
    }
    const ids = Array.from(pendingRef.current).filter((id) => !inFlightRef.current.has(id));
    if (ids.length === 0) return;
    pendingRef.current.clear();
    ids.forEach((id) => inFlightRef.current.add(id));

    try {
      await supabase.functions.invoke('whatsapp-mark-read', {
        body: { telefone, message_ids: ids },
      });
    } catch (e) {
      // best-effort: se falhou, libera para nova tentativa em outro flush
      ids.forEach((id) => inFlightRef.current.delete(id));
      // eslint-disable-next-line no-console
      console.warn('[useMarkMessagesRead] invoke falhou:', e);
      return;
    }
    // Sucesso: deixa marcado em inFlightRef para não re-disparar na sessão
  }, [telefone]);

  const enqueue = useCallback((messageId: string | null | undefined) => {
    if (!messageId) return;
    if (inFlightRef.current.has(messageId)) return;
    pendingRef.current.add(messageId);
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      void flush();
    }, 800);
  }, [flush]);

  // Reseta cache de inFlight ao trocar de conversa
  useEffect(() => {
    pendingRef.current.clear();
    inFlightRef.current.clear();
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [telefone]);

  // Flush ao focar a janela / ao desmontar
  useEffect(() => {
    const onFocus = () => { void flush(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      void flush();
    };
  }, [flush]);

  return { enqueue, flush };
}
