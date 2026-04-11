import { useMemo, useEffect } from 'react';
import { Polyline, Popup } from 'react-leaflet';
import { useRotaReal } from '@/hooks/useRotaReal';
import { RotaInfoOverlay } from './RotaInfoOverlay';

interface RouteInfo {
  distanciaKm: number;
  tempoMinutos: number;
  coordenadas: [number, number][];
}

interface RotaPolylineProps {
  origem: [number, number];
  destino: [number, number];
  cor?: string;
  peso?: number;
  opacidade?: number;
  mostrarPopup?: boolean;
  popupContent?: React.ReactNode;
  mostrarInfoOverlay?: boolean;
  onRouteInfo?: (info: RouteInfo) => void;
}

/**
 * Componente que renderiza uma rota real (seguindo ruas) entre dois pontos
 * Mostra linha tracejada enquanto carrega, depois mostra rota real
 */
export function RotaPolyline({
  origem,
  destino,
  cor = '#3B82F6',
  peso = 4,
  opacidade = 0.8,
  mostrarPopup = false,
  popupContent,
  mostrarInfoOverlay = false,
  onRouteInfo,
}: RotaPolylineProps) {
  const { coordenadas, distanciaKm, isLoading } = useRotaReal(origem, destino);
  
  const isFallback = isLoading || coordenadas.length < 2;
  
  // Tempo estimado: 1 km = 1 min
  const tempoEstimado = Math.ceil(distanciaKm);

  // Notify parent of route info changes
  useEffect(() => {
    if (onRouteInfo && distanciaKm > 0) {
      onRouteInfo({ distanciaKm, tempoMinutos: tempoEstimado, coordenadas });
    }
  }, [distanciaKm, tempoEstimado, coordenadas, onRouteInfo]);
  
  const pathOptions = useMemo(() => ({
    color: cor,
    weight: isFallback ? peso - 1 : peso,
    opacity: isFallback ? opacidade * 0.5 : opacidade,
    dashArray: isFallback ? '10, 10' : undefined,
  }), [cor, peso, opacidade, isFallback]);
  
  const positions = isFallback ? [origem, destino] : coordenadas;
  
  if (!origem || !destino) return null;
  
  return (
    <>
      <Polyline positions={positions} pathOptions={pathOptions}>
        {mostrarPopup && (
          <Popup>
            <div className="text-xs">
              {popupContent || (
                <>
                  <p className="font-semibold">
                    {distanciaKm > 0 ? `${distanciaKm.toFixed(1)} km • ~${tempoEstimado} min` : 'Calculando...'}
                  </p>
                </>
              )}
            </div>
          </Popup>
        )}
      </Polyline>
      {mostrarInfoOverlay && !isFallback && distanciaKm > 0 && (
        <RotaInfoOverlay
          coordenadas={coordenadas}
          distanciaKm={distanciaKm}
          cor={cor}
        />
      )}
    </>
  );
}

export { useRotaReal } from '@/hooks/useRotaReal';
