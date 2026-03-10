import { useState, useEffect, useRef } from 'react';
import { getRouteOSRM, type RotaResult } from '@/services/routingService';

interface UseRotaRealResult {
  coordenadas: [number, number][];
  distanciaKm: number;
  tempoMinutos: number;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook para buscar rota real (ruas da cidade) entre dois pontos
 * Inclui debounce e cache para evitar chamadas excessivas
 */
export function useRotaReal(
  origem: [number, number] | null,
  destino: [number, number] | null
): UseRotaRealResult {
  const [result, setResult] = useState<UseRotaRealResult>({
    coordenadas: [],
    distanciaKm: 0,
    tempoMinutos: 0,
    isLoading: false,
    error: null,
  });
  
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Estabilizar coordenadas com toFixed(4) (~11m precisão)
  const origemKey = origem ? `${origem[0].toFixed(4)},${origem[1].toFixed(4)}` : '';
  const destinoKey = destino ? `${destino[0].toFixed(4)},${destino[1].toFixed(4)}` : '';
  
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    if (!origem || !destino) {
      setResult({
        coordenadas: [],
        distanciaKm: 0,
        tempoMinutos: 0,
        isLoading: false,
        error: null,
      });
      return;
    }
    
    // Mostrar linha reta enquanto carrega
    setResult(prev => ({
      ...prev,
      coordenadas: [origem, destino],
      isLoading: true,
      error: null,
    }));
    
    // Debounce de 500ms
    debounceRef.current = setTimeout(async () => {
      try {
        const rota = await getRouteOSRM(origem, destino);
        
        setResult({
          coordenadas: rota.coordenadas,
          distanciaKm: rota.distanciaKm,
          tempoMinutos: rota.tempoMinutos,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        console.error('[useRotaReal] Erro:', error);
        
        setResult({
          coordenadas: [origem, destino],
          distanciaKm: 0,
          tempoMinutos: 0,
          isLoading: false,
          error: 'Erro ao buscar rota',
        });
      }
    }, 500);
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [origemKey, destinoKey]);
  
  return result;
}
