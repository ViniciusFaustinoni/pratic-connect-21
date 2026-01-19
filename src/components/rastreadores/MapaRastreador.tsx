import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { RefreshCw, Clock, Gauge, Power, PowerOff, Navigation, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRastreadorTempoReal } from '@/hooks/useRastreadorPosicao';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapaRastreadorProps {
  rastreadorId: string;
  altura?: string;
  mostrarControles?: boolean;
}

// Component to fly to position
function FlyToPosition({ position, zoom }: { position: [number, number]; zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (position[0] && position[1]) {
      map.flyTo(position, zoom, { duration: 1 });
    }
  }, [map, position, zoom]);
  
  return null;
}

// Custom marker icon based on ignition status
function getMarkerIcon(ignicao: boolean) {
  const color = ignicao ? '#22c55e' : '#ef4444';
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
          <circle cx="7" cy="17" r="2"/>
          <circle cx="17" cy="17" r="2"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

export function MapaRastreador({
  rastreadorId,
  altura = '400px',
  mostrarControles = true
}: MapaRastreadorProps) {
  const {
    posicao,
    veiculo,
    tempoReal,
    mensagem,
    isLoading,
    isRefetching,
    atualizarManual
  } = useRastreadorTempoReal(rastreadorId);

  const [mapReady, setMapReady] = useState(false);

  if (isLoading) {
    return <Skeleton className="w-full" style={{ height: altura }} />;
  }

  const hasPosition = posicao?.latitude && posicao?.longitude;
  const position: [number, number] = hasPosition
    ? [posicao.latitude, posicao.longitude]
    : [-15.7801, -47.9292]; // Brazil center

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">
              {veiculo?.placa || 'Rastreamento'}
            </CardTitle>
            {veiculo?.modelo && (
              <span className="text-sm text-muted-foreground">
                ({veiculo.modelo})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {tempoReal !== undefined && (
              <Badge variant={tempoReal ? 'default' : 'secondary'}>
                {tempoReal ? '🟢 Tempo Real' : '🟡 Última Posição'}
              </Badge>
            )}

            {mostrarControles && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => atualizarManual.mutate(rastreadorId)}
                disabled={atualizarManual.isPending || isRefetching}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${(atualizarManual.isPending || isRefetching) ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {mensagem && !tempoReal && (
          <Alert className="m-4 mb-0">
            <AlertDescription>{mensagem}</AlertDescription>
          </Alert>
        )}

        {!hasPosition ? (
          <div className="flex flex-col items-center justify-center text-muted-foreground" style={{ height: altura }}>
            <MapPin className="h-12 w-12 mb-2 opacity-50" />
            <p>Sem posição disponível</p>
          </div>
        ) : (
          <>
            <div style={{ height: altura }}>
              <MapContainer
                center={position}
                zoom={15}
                style={{ height: '100%', width: '100%' }}
                whenReady={() => setMapReady(true)}
              >
                <TileLayer
                  attribution='Tiles &copy; Esri'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
                  attribution=""
                />
                
                {mapReady && <FlyToPosition position={position} zoom={15} />}
                
                <Marker position={position} icon={getMarkerIcon(posicao.ignicao)}>
                  <Popup>
                    <div className="text-sm">
                      <strong>{veiculo?.placa}</strong>
                      {veiculo?.modelo && <p className="text-xs text-gray-500">{veiculo.modelo}</p>}
                      <p className="mt-1">Velocidade: {posicao.velocidade} km/h</p>
                      <p>Ignição: {posicao.ignicao ? 'Ligada' : 'Desligada'}</p>
                      {posicao.endereco && <p className="mt-1 text-xs">{posicao.endereco}</p>}
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            </div>

            {/* Info Panel */}
            <div className="p-4 border-t bg-muted/30">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="flex flex-col items-center gap-1">
                  <Gauge className="h-5 w-5 text-blue-500" />
                  <span className="text-lg font-semibold">{posicao.velocidade}</span>
                  <span className="text-xs text-muted-foreground">km/h</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  {posicao.ignicao ? (
                    <Power className="h-5 w-5 text-green-500" />
                  ) : (
                    <PowerOff className="h-5 w-5 text-red-500" />
                  )}
                  <span className="text-sm font-medium">
                    {posicao.ignicao ? 'Ligado' : 'Desligado'}
                  </span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <Navigation className="h-5 w-5 text-purple-500" />
                  <span className="text-lg font-semibold">
                    {posicao.direcao ? `${posicao.direcao}°` : '-'}
                  </span>
                  <span className="text-xs text-muted-foreground">direção</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <Clock className="h-5 w-5 text-orange-500" />
                  <span className="text-xs font-medium">
                    {posicao.data_posicao
                      ? formatDistanceToNow(new Date(posicao.data_posicao), {
                          addSuffix: true,
                          locale: ptBR
                        })
                      : 'Sem sinal'}
                  </span>
                </div>
              </div>

              {posicao.endereco && (
                <div className="mt-3 pt-3 border-t text-sm text-muted-foreground text-center">
                  📍 {posicao.endereco}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
