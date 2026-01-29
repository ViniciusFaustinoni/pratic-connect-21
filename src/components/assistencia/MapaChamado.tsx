import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { RefreshCw, Satellite, MapPin, Navigation, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
const veiculoIcon = new L.DivIcon({
  html: `<div class="flex items-center justify-center w-10 h-10 bg-blue-500 rounded-full border-3 border-white shadow-lg animate-pulse">
    <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
    </svg>
  </div>`,
  className: 'custom-marker',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
});

const origemIcon = new L.DivIcon({
  html: `<div class="flex items-center justify-center w-8 h-8 bg-red-500 rounded-full border-2 border-white shadow-lg">
    <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>
  </div>`,
  className: 'custom-marker',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

interface MapaChamadoProps {
  origemLat?: number | null;
  origemLng?: number | null;
  origemEndereco?: string;
  rastreadorLat?: number | null;
  rastreadorLng?: number | null;
  rastreadorDataPosicao?: string | null;
  rastreadorEndereco?: string;
  velocidade?: number;
  ignicao?: boolean;
  tempoReal?: boolean;
  isLoading?: boolean;
  isRefetching?: boolean;
  onRefresh?: () => void;
  height?: string;
  showControls?: boolean;
}

// Componente para recentrar o mapa
function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export function MapaChamado({
  origemLat,
  origemLng,
  origemEndereco = 'Localização informada',
  rastreadorLat,
  rastreadorLng,
  rastreadorDataPosicao,
  rastreadorEndereco,
  velocidade = 0,
  ignicao = false,
  tempoReal = false,
  isLoading = false,
  isRefetching = false,
  onRefresh,
  height = 'h-64',
  showControls = true,
}: MapaChamadoProps) {
  const [showRastreador, setShowRastreador] = useState(true);

  const temRastreador = rastreadorLat && rastreadorLng;
  const temOrigem = origemLat && origemLng;

  // Centro do mapa: priorizar rastreador se disponível
  const centerLat = temRastreador ? rastreadorLat! : origemLat!;
  const centerLng = temRastreador ? rastreadorLng! : origemLng!;

  const formatarData = (data?: string | null) => {
    if (!data) return 'Desconhecido';
    return format(new Date(data), "dd/MM 'às' HH:mm", { locale: ptBR });
  };

  if (isLoading) {
    return <Skeleton className={cn('w-full rounded-lg', height)} />;
  }

  if (!temOrigem && !temRastreador) {
    return (
      <Card className={cn('flex flex-col items-center justify-center', height)}>
        <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Localização não disponível</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {/* Controles do mapa */}
      {showControls && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {temRastreador && (
              <Badge 
                variant={tempoReal ? 'default' : 'secondary'}
                className={cn(
                  'flex items-center gap-1',
                  tempoReal && 'bg-green-500 hover:bg-green-600'
                )}
              >
                {tempoReal ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {tempoReal ? 'Tempo Real' : 'Última Posição'}
              </Badge>
            )}
            {ignicao && (
              <Badge variant="outline" className="text-green-600 border-green-500">
                <Navigation className="h-3 w-3 mr-1" />
                {velocidade} km/h
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {temRastreador && temOrigem && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRastreador(!showRastreador)}
              >
                <Satellite className="h-4 w-4 mr-1" />
                {showRastreador ? 'Ver Origem' : 'Ver Rastreador'}
              </Button>
            )}
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isRefetching}
              >
                <RefreshCw className={cn('h-4 w-4 mr-1', isRefetching && 'animate-spin')} />
                Atualizar
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Mapa */}
      <div className={cn('rounded-lg overflow-hidden border', height)}>
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={15}
          className="h-full w-full"
          zoomControl={true}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Marcador da posição do rastreador */}
          {temRastreador && (
            <Marker position={[rastreadorLat!, rastreadorLng!]} icon={veiculoIcon}>
              <Popup>
                <div className="text-center min-w-[180px]">
                  <p className="font-semibold text-blue-600 flex items-center justify-center gap-1">
                    <Satellite className="h-4 w-4" />
                    Posição do Rastreador
                  </p>
                  {rastreadorEndereco && (
                    <p className="text-xs text-muted-foreground mt-1">{rastreadorEndereco}</p>
                  )}
                  <div className="mt-2 text-xs space-y-1">
                    <p>Velocidade: <strong>{velocidade} km/h</strong></p>
                    <p>Ignição: <strong>{ignicao ? 'Ligada' : 'Desligada'}</strong></p>
                    <p>Última atualização: <strong>{formatarData(rastreadorDataPosicao)}</strong></p>
                  </div>
                  <Badge 
                    variant={tempoReal ? 'default' : 'secondary'} 
                    className={cn('mt-2', tempoReal && 'bg-green-500')}
                  >
                    {tempoReal ? 'Tempo Real' : 'Cache'}
                  </Badge>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Marcador da origem informada */}
          {temOrigem && (
            <Marker position={[origemLat!, origemLng!]} icon={origemIcon}>
              <Popup>
                <div className="text-center min-w-[150px]">
                  <p className="font-semibold text-red-600 flex items-center justify-center gap-1">
                    <MapPin className="h-4 w-4" />
                    Local Informado
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{origemEndereco}</p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Recentrar no marcador selecionado */}
          <RecenterMap 
            lat={showRastreador && temRastreador ? rastreadorLat! : origemLat!}
            lng={showRastreador && temRastreador ? rastreadorLng! : origemLng!}
          />
        </MapContainer>
      </div>

      {/* Info adicional */}
      {rastreadorDataPosicao && (
        <p className="text-xs text-muted-foreground text-center">
          Última atualização do rastreador: {formatarData(rastreadorDataPosicao)}
        </p>
      )}
    </div>
  );
}
