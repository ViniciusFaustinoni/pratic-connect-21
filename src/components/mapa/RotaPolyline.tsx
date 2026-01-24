import { useMemo } from 'react';
import { Polyline, Popup } from 'react-leaflet';
import { useRotaReal } from '@/hooks/useRotaReal';

interface RotaPolylineProps {
  origem: [number, number];
  destino: [number, number];
  cor?: string;
  peso?: number;
  opacidade?: number;
  mostrarPopup?: boolean;
  popupContent?: React.ReactNode;
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
}: RotaPolylineProps) {
  const { coordenadas, distanciaKm, tempoMinutos, isLoading } = useRotaReal(origem, destino);
  
  // Se ainda está carregando ou não tem coordenadas, mostrar linha tracejada
  const isFallback = isLoading || coordenadas.length < 2;
  
  const pathOptions = useMemo(() => ({
    color: cor,
    weight: isFallback ? peso - 1 : peso,
    opacity: isFallback ? opacidade * 0.5 : opacidade,
    dashArray: isFallback ? '10, 10' : undefined,
  }), [cor, peso, opacidade, isFallback]);
  
  const positions = isFallback ? [origem, destino] : coordenadas;
  
  if (!origem || !destino) return null;
  
  return (
    <Polyline positions={positions} pathOptions={pathOptions}>
      {mostrarPopup && (
        <Popup>
          <div className="text-xs">
            {popupContent || (
              <>
                <p className="font-semibold">
                  {distanciaKm > 0 ? `${distanciaKm.toFixed(1)} km` : 'Calculando...'}
                </p>
                {tempoMinutos > 0 && (
                  <p className="text-muted-foreground">~{tempoMinutos} min</p>
                )}
              </>
            )}
          </div>
        </Popup>
      )}
    </Polyline>
  );
}

/**
 * Hook utilitário para usar dados da rota em outros componentes
 */
export { useRotaReal } from '@/hooks/useRotaReal';
