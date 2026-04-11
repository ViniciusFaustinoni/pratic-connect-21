import { useMemo } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';

interface RotaInfoOverlayProps {
  coordenadas: [number, number][];
  distanciaKm: number;
  cor?: string;
}

const invisibleIcon = L.divIcon({
  html: '',
  className: 'route-info-overlay',
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

/**
 * Overlay invisível no ponto médio da rota que exibe badge permanente com distância e tempo (1km/min)
 */
export function RotaInfoOverlay({ coordenadas, distanciaKm, cor = '#3B82F6' }: RotaInfoOverlayProps) {
  const pontoMedio = useMemo(() => {
    if (coordenadas.length < 2) return null;
    const mid = Math.floor(coordenadas.length / 2);
    return coordenadas[mid];
  }, [coordenadas]);

  const tempoMin = Math.ceil(distanciaKm); // 1 km = 1 min

  if (!pontoMedio || distanciaKm <= 0) return null;

  return (
    <Marker position={pontoMedio} icon={invisibleIcon} interactive={false}>
      <Tooltip permanent direction="center" className="route-info-tooltip">
        <span style={{
          backgroundColor: cor,
          color: 'white',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '10px',
          fontWeight: 700,
          whiteSpace: 'nowrap',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }}>
          {distanciaKm.toFixed(1)} km • ~{tempoMin} min
        </span>
      </Tooltip>
    </Marker>
  );
}
