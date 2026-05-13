import { useEffect, useState } from 'react';

const CURRENT: string =
  typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

interface BuildVersionState {
  current: string;
  latest: string | null;
  isStale: boolean;
}

/**
 * Lê /version.json (gerado no build) e compara com a versão embutida no bundle
 * do usuário. Permite identificar discretamente se todos estão na mesma build.
 */
export function useBuildVersion(): BuildVersionState {
  const [latest, setLatest] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchLatest = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json?.buildId) setLatest(String(json.buildId));
      } catch {
        // silencioso
      }
    };

    fetchLatest();
    const interval = window.setInterval(fetchLatest, 5 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchLatest();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return {
    current: CURRENT,
    latest,
    isStale: !!latest && latest !== CURRENT,
  };
}
