// ============================================
// HOOK: DETECÇÃO DE CAPACIDADE DO DISPOSITIVO
// Permite degradar UX/processamento em low-end
// ============================================

import { useMemo } from 'react';

export interface DeviceCapability {
  /** Memória RAM aproximada em GB (Chrome/Android). undefined em browsers que não expõem. */
  deviceMemory: number | undefined;
  /** Núcleos lógicos da CPU. */
  hardwareConcurrency: number | undefined;
  /** True quando aparelho é considerado de baixo desempenho (Android Go, ~1-2GB RAM). */
  lowEnd: boolean;
  /** True quando aparelho é considerado intermediário (3-4GB). */
  midEnd: boolean;
  /** Heap JS atualmente em uso (Chrome) em MB, se disponível. */
  usedHeapMB: number | undefined;
  /** Foi restaurado de descarte (tab killed pelo SO). */
  wasDiscarded: boolean;
}

export function useDeviceCapability(): DeviceCapability {
  return useMemo(() => {
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : {};
    const deviceMemory: number | undefined = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : undefined;
    const hardwareConcurrency: number | undefined =
      typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : undefined;

    const lowEnd =
      (deviceMemory !== undefined && deviceMemory <= 2) ||
      (hardwareConcurrency !== undefined && hardwareConcurrency <= 4 && (deviceMemory ?? 99) <= 3);

    const midEnd =
      !lowEnd &&
      ((deviceMemory !== undefined && deviceMemory <= 4) ||
        (hardwareConcurrency !== undefined && hardwareConcurrency <= 6));

    let usedHeapMB: number | undefined;
    try {
      const perf = typeof performance !== 'undefined' ? (performance as any) : undefined;
      if (perf?.memory?.usedJSHeapSize) {
        usedHeapMB = Math.round(perf.memory.usedJSHeapSize / (1024 * 1024));
      }
    } catch {
      // ignore
    }

    const wasDiscarded =
      typeof document !== 'undefined' && (document as any).wasDiscarded === true;

    return {
      deviceMemory,
      hardwareConcurrency,
      lowEnd,
      midEnd,
      usedHeapMB,
      wasDiscarded,
    };
  }, []);
}

/** Versão não-reativa, útil em handlers (ex.: dentro de compressImage). */
export function getDeviceCapabilitySnapshot(): DeviceCapability {
  const nav = typeof navigator !== 'undefined' ? (navigator as any) : {};
  const deviceMemory: number | undefined = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : undefined;
  const hardwareConcurrency: number | undefined =
    typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : undefined;

  const lowEnd =
    (deviceMemory !== undefined && deviceMemory <= 2) ||
    (hardwareConcurrency !== undefined && hardwareConcurrency <= 4 && (deviceMemory ?? 99) <= 3);

  const midEnd =
    !lowEnd &&
    ((deviceMemory !== undefined && deviceMemory <= 4) ||
      (hardwareConcurrency !== undefined && hardwareConcurrency <= 6));

  let usedHeapMB: number | undefined;
  try {
    const perf = typeof performance !== 'undefined' ? (performance as any) : undefined;
    if (perf?.memory?.usedJSHeapSize) {
      usedHeapMB = Math.round(perf.memory.usedJSHeapSize / (1024 * 1024));
    }
  } catch {
    // ignore
  }

  const wasDiscarded =
    typeof document !== 'undefined' && (document as any).wasDiscarded === true;

  return { deviceMemory, hardwareConcurrency, lowEnd, midEnd, usedHeapMB, wasDiscarded };
}
