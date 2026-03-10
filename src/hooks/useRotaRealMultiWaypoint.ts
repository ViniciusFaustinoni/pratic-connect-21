import { useState, useEffect, useRef } from 'react';
import { getRouteOSRMMultiWaypoint, type RotaResult } from '@/services/routingService';

interface UseRotaRealMultiResult {
  coordenadasRota: [number, number][];
  distanciaKm: number;
  tempoMinutos: number;
  isLoading: boolean;
}

/**
 * Hook para converter pontos GPS brutos em rota real (seguindo ruas)
 * usando OSRM multi-waypoint. Inclui debounce e fallback.
 */
export function useRotaRealMultiWaypoint(
  pontosOriginais: [number, number][]
): UseRotaRealMultiResult {
  const [result, setResult] = useState<UseRotaRealMultiResult>({
    coordenadasRota: [],
    distanciaKm: 0,
    tempoMinutos: 0,
    isLoading: false,
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Chave estável baseada no número de pontos e primeiro/último ponto
  const stableKey = pontosOriginais.length > 1
    ? `${pontosOriginais.length}:${pontosOriginais[0][0].toFixed(4)},${pontosOriginais[0][1].toFixed(4)}->${pontosOriginais[pontosOriginais.length - 1][0].toFixed(4)},${pontosOriginais[pontosOriginais.length - 1][1].toFixed(4)}`
    : '';

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (pontosOriginais.length < 2) {
      setResult({ coordenadasRota: pontosOriginais, distanciaKm: 0, tempoMinutos: 0, isLoading: false });
      return;
    }

    // Mostrar pontos brutos enquanto carrega
    setResult(prev => ({
      ...prev,
      coordenadasRota: pontosOriginais,
      isLoading: true,
    }));

    debounceRef.current = setTimeout(async () => {
      try {
        const rota = await getRouteOSRMMultiWaypoint(pontosOriginais);
        setResult({
          coordenadasRota: rota.coordenadas,
          distanciaKm: rota.distanciaKm,
          tempoMinutos: rota.tempoMinutos,
          isLoading: false,
        });
      } catch {
        // Fallback: manter pontos brutos
        setResult({
          coordenadasRota: pontosOriginais,
          distanciaKm: 0,
          tempoMinutos: 0,
          isLoading: false,
        });
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [stableKey]);

  return result;
}
