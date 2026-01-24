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
  
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastRequestRef = useRef<string>('');
  
  useEffect(() => {
    // Limpar timeout anterior
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Se não tiver origem ou destino, limpar resultado
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
    
    // Criar chave de requisição para evitar duplicatas
    const requestKey = `${origem.join(',')}->${destino.join(',')}`;
    
    // Se for a mesma requisição, não fazer nada
    if (requestKey === lastRequestRef.current) {
      return;
    }
    
    // Marcar como carregando imediatamente com fallback de linha reta
    setResult(prev => ({
      ...prev,
      coordenadas: [origem, destino], // Linha reta enquanto carrega
      isLoading: true,
      error: null,
    }));
    
    // Debounce de 500ms para evitar chamadas excessivas durante movimento
    debounceRef.current = setTimeout(async () => {
      lastRequestRef.current = requestKey;
      
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
        
        // Em caso de erro, manter linha reta
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
  }, [origem?.[0], origem?.[1], destino?.[0], destino?.[1]]);
  
  return result;
}
