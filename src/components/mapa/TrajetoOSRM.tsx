import { useMemo } from 'react';
import { Polyline, CircleMarker, Popup } from 'react-leaflet';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRotaRealMultiWaypoint } from '@/hooks/useRotaRealMultiWaypoint';

interface PontoTrajeto {
  latitude: number;
  longitude: number;
  velocidade: number;
  data_posicao: string;
}

interface TrajetoOSRMProps {
  pontos: PontoTrajeto[];
  cor?: string;
  peso?: number;
}

/**
 * Renderiza trajeto usando OSRM para rota real seguindo ruas.
 * Mostra linha tracejada enquanto carrega, depois rota sólida.
 */
export function TrajetoOSRM({ pontos, cor = '#8b5cf6', peso = 4 }: TrajetoOSRMProps) {
  const pontosLatLng = useMemo(
    () => pontos.map(p => [p.latitude, p.longitude] as [number, number]),
    [pontos]
  );

  const { coordenadasRota, isLoading } = useRotaRealMultiWaypoint(pontosLatLng);

  if (pontos.length < 2) return null;

  return (
    <>
      <Polyline
        positions={coordenadasRota}
        pathOptions={{
          color: cor,
          weight: isLoading ? peso - 1 : peso,
          opacity: isLoading ? 0.5 : 0.85,
          dashArray: isLoading ? '10, 10' : undefined,
        }}
      />
      <CircleMarker
        center={[pontos[0].latitude, pontos[0].longitude]}
        radius={7}
        pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1 }}
      >
        <Popup>
          <div className="text-xs">
            <strong className="text-green-600">Início do trajeto</strong>
            <p>{format(new Date(pontos[0].data_posicao), "dd/MM HH:mm", { locale: ptBR })}</p>
          </div>
        </Popup>
      </CircleMarker>
      <CircleMarker
        center={[pontos[pontos.length - 1].latitude, pontos[pontos.length - 1].longitude]}
        radius={7}
        pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }}
      >
        <Popup>
          <div className="text-xs">
            <strong className="text-red-600">Fim do trajeto</strong>
            <p>{format(new Date(pontos[pontos.length - 1].data_posicao), "dd/MM HH:mm", { locale: ptBR })}</p>
          </div>
        </Popup>
      </CircleMarker>
    </>
  );
}
