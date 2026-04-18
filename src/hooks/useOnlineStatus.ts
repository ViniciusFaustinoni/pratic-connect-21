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
    // Conta falhas consecutivas — só marca offline após 2 falhas seguidas (~60s).
    // Evita falso positivo em redes móveis com latência alta (5G/LTE em movimento).
    let failuresInARow = 0;
    const ping = async () => {
      if (!navigator.onLine) {
        if (!cancelled) setOnline(false);
        failuresInARow = 2;
        return;
      }
      try {
        const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
        const supabaseKey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!supabaseUrl || !supabaseKey) {
          // Sem config para verificar, confia no navigator
          if (!cancelled) setOnline(true);
          failuresInARow = 0;
          return;
        }
        const ctrl = new AbortController();
        // Timeout 10s — 5G em movimento pode ter latência alta no primeiro pacote.
        const t = setTimeout(() => ctrl.abort(), 10000);
        // Qualquer resposta HTTP (200/4xx/5xx) prova que há rede.
        await fetch(`${supabaseUrl}/auth/v1/health`, {
          method: 'GET',
          cache: 'no-store',
          signal: ctrl.signal,
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        });
        clearTimeout(t);
        failuresInARow = 0;
        if (!cancelled) setOnline(true);
      } catch {
        failuresInARow += 1;
        // Só marca offline após 2 falhas consecutivas — evita flicker em latência alta.
        if (failuresInARow >= 2 && !cancelled) setOnline(false);
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
