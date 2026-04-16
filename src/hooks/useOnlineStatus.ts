import { useEffect, useState } from 'react';

/**
 * Detecção robusta de conexão.
 * `navigator.onLine` mente em alguns Androids — confirma com um ping leve
 * ao endpoint público do Supabase a cada 30s.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let cancelled = false;
    const ping = async () => {
      if (!navigator.onLine) {
        if (!cancelled) setOnline(false);
        return;
      }
      try {
        const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
        if (!supabaseUrl) return;
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
          method: 'GET',
          cache: 'no-store',
          signal: ctrl.signal,
        });
        clearTimeout(t);
        if (!cancelled) setOnline(res.ok);
      } catch {
        if (!cancelled) setOnline(false);
      }
    };

    ping();
    const interval = setInterval(ping, 30_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return online;
}
