import { useEffect, useState } from 'react';

/**
 * Hook que monitora pressão de memória (JS heap) em celulares.
 *
 * Retorna `true` quando o heap está acima de 75% do limite — momento em
 * que o `imageCompressor` força perfil `low` e o app deve avisar o
 * instalador. Polla a cada 5s, sem custo perceptível.
 */
export function useMemoryPressure(thresholdPct = 0.75, intervalMs = 5000): boolean {
  const [critical, setCritical] = useState(false);

  useEffect(() => {
    const mem = (performance as unknown as {
      memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
    }).memory;
    if (!mem || !mem.jsHeapSizeLimit) return;

    const check = () => {
      try {
        const m = (performance as unknown as {
          memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
        }).memory;
        if (!m) return;
        setCritical(m.usedJSHeapSize / m.jsHeapSizeLimit > thresholdPct);
      } catch {
        /* ignore */
      }
    };
    check();
    const id = window.setInterval(check, intervalMs);
    return () => window.clearInterval(id);
  }, [thresholdPct, intervalMs]);

  return critical;
}
