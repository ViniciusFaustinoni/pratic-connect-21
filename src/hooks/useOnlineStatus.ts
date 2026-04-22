import { useEffect, useState } from 'react';

/**
 * Detecção robusta de conexão.
 * `navigator.onLine` mente em alguns Androids — confirma com um ping leve
 * a um asset estático do mesmo origem (favicon) a cada 30s.
 *
 * IMPORTANTE: NÃO usamos endpoints do Supabase aqui. Headers como `apikey` /
 * `Authorization` disparam preflight CORS (OPTIONS), que falha em algumas
 * redes móveis e WebViews Android, fazendo o app aparecer "offline" mesmo
 * com 5G/LTE perfeitamente conectado. Um GET simples no `/favicon.ico` do
 * próprio domínio é same-origin → sem CORS, sempre 200 quando há rede.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    let cancelled = false;
    // Conta falhas consecutivas — só marca offline após 2 falhas seguidas (~60s).
    // Evita falso positivo em redes móveis com latência alta (5G/LTE em movimento).
    let failuresInARow = 0;

    const handleOnline = () => {
      // Reseta contador e marca online imediatamente — sem esperar próximo ping.
      failuresInARow = 0;
      if (!cancelled) setOnline(true);
    };
    const handleOffline = () => {
      failuresInARow = 2;
      if (!cancelled) setOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const ping = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (!cancelled) setOnline(false);
        failuresInARow = 2;
        return;
      }
      try {
        const ctrl = new AbortController();
        // Timeout 10s — 5G em movimento pode ter latência alta no primeiro pacote.
        const t = setTimeout(() => ctrl.abort(), 10000);
        // GET simples mesmo origem → sem preflight CORS, sem credenciais, sem headers customizados.
        // Cache-buster evita resposta cacheada do SW/disk.
        const res = await fetch(`/favicon.ico?cb=${Date.now()}`, {
          method: 'GET',
          cache: 'no-store',
          signal: ctrl.signal,
          credentials: 'omit',
        });
        clearTimeout(t);
        // Qualquer resposta HTTP (200/404/etc) prova que há rede até o servidor.
        if (res) {
          failuresInARow = 0;
          if (!cancelled) setOnline(true);
          if (typeof console !== 'undefined') {
            // Log discreto (debug); ajuda a diagnosticar casos futuros.
            // console.debug('[useOnlineStatus] ping ok', res.status);
          }
        }
      } catch (err: any) {
        failuresInARow += 1;
        console.warn(
          '[useOnlineStatus] ping falhou:',
          err?.name || 'Error',
          err?.message || '',
          `(falhas consecutivas: ${failuresInARow})`
        );
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
