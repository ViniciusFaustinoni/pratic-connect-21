import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Escuta o broadcast `force_logout` emitido pela edge `deslogar-todos-usuarios`.
 *
 * Ao receber, executa logout local imediato (limpa cache do React Query,
 * limpa storage do app, encerra a sessão local e redireciona para
 * `/login?reason=admin_logout`).
 *
 * A sessão do Diretor que disparou é preservada via `payload.by_id`:
 * se o evento foi emitido pelo próprio usuário corrente, é ignorado.
 *
 * Também é usado pelo interceptor 401 (rede de segurança offline) através
 * de `forceLocalLogout('session_expired')`.
 */

// Chaves de localStorage/sessionStorage que devem ser preservadas no logout
// forçado (preferências neutras de UI). Tudo o mais sai.
const PRESERVE_KEY_PATTERNS: RegExp[] = [
  /^theme$/i,
  /^vite-ui-theme$/i,
  /^color-scheme$/i,
];

function shouldPreserve(key: string): boolean {
  return PRESERVE_KEY_PATTERNS.some((re) => re.test(key));
}

function clearAppStorage(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && !shouldPreserve(k)) toRemove.push(k);
    }
    toRemove.forEach((k) => {
      try { localStorage.removeItem(k); } catch { /* noop */ }
    });
  } catch { /* noop */ }
  try {
    sessionStorage.clear();
  } catch { /* noop */ }
}

declare global {
  interface Window {
    __forceLogoutInFlight?: boolean;
  }
}

/**
 * Disparado tanto pelo broadcast Realtime quanto pelo interceptor 401.
 * Idempotente: garante que só roda uma vez por carregamento.
 */
export async function forceLocalLogout(
  reason: 'admin_logout' | 'session_expired',
  queryClient?: ReturnType<typeof useQueryClient>,
): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.__forceLogoutInFlight) return;
  window.__forceLogoutInFlight = true;

  try {
    queryClient?.clear();
  } catch { /* noop */ }

  clearAppStorage();

  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch { /* noop */ }

  // Replace para que voltar no navegador não retorne ao app autenticado
  window.location.replace(`/login?reason=${reason}`);
}

export function useForceLogoutListener(currentUserId: string | null | undefined): void {
  const queryClient = useQueryClient();
  const setupRef = useRef(false);

  useEffect(() => {
    if (setupRef.current) return;
    setupRef.current = true;

    const channel = supabase.channel('system-events');

    channel
      .on('broadcast', { event: 'force_logout' }, (msg) => {
        const payload = (msg?.payload ?? {}) as { by_id?: string };
        // Diretor que disparou mantém sessão
        if (payload.by_id && currentUserId && payload.by_id === currentUserId) {
          return;
        }
        void forceLocalLogout('admin_logout', queryClient);
      })
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch { /* noop */ }
      setupRef.current = false;
    };
  }, [queryClient, currentUserId]);
}
