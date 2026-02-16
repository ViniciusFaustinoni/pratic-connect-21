import { useMemo } from 'react';
import { MapPin, Navigation, AlertTriangle, Check, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import 'leaflet/dist/leaflet.css';

interface ComparacaoPosicoesProps {
  latitudeInformada?: number | null;
  longitudeInformada?: number | null;
  rastreadorLat?: number | null;
  rastreadorLng?: number | null;
  rastreadorCapturadoEm?: string | null;
  localOcorrencia?: string | null;
}

const rastreadorIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

const informadaIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

function calcularDistanciaKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function classificarDistancia(distanciaKm: number) {
  if (distanciaKm < 0.5) return { status: 'ok' as const, label: 'Posições próximas', cor: 'bg-green-100 text-green-800' };
  if (distanciaKm < 2) return { status: 'atencao' as const, label: 'Pequena divergência', cor: 'bg-yellow-100 text-yellow-800' };
  return { status: 'suspeito' as const, label: 'Divergência significativa', cor: 'bg-red-100 text-red-800' };
}

export function ComparacaoPosicoes({
  latitudeInformada, longitudeInformada, rastreadorLat, rastreadorLng, rastreadorCapturadoEm, localOcorrencia,
}: ComparacaoPosicoesProps) {
  const analise = useMemo(() => {
    const temInformada = latitudeInformada != null && longitudeInformada != null;
    const temRastreador = rastreadorLat != null && rastreadorLng != null;

    if (!temInformada && !temRastreador) return { tipo: 'sem_dados' as const };
    if (!temRastreador) return { tipo: 'apenas_informada' as const, lat: latitudeInformada!, lng: longitudeInformada! };
    if (!temInformada) return { tipo: 'apenas_rastreador' as const, lat: rastreadorLat!, lng: rastreadorLng!, capturado: rastreadorCapturadoEm };

    const distancia = calcularDistanciaKm(latitudeInformada!, longitudeInformada!, rastreadorLat!, rastreadorLng!);
    return {
      tipo: 'comparacao' as const,
      informada: { lat: latitudeInformada!, lng: longitudeInformada! },
      rastreador: { lat: rastreadorLat!, lng: rastreadorLng! },
      capturado: rastreadorCapturadoEm,
      distanciaKm: distancia,
      classificacao: classificarDistancia(distancia),
    };
  }, [latitudeInformada, longitudeInformada, rastreadorLat, rastreadorLng, rastreadorCapturadoEm]);

  const formatarCoordenada = (lat: number, lng: number) => `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

  // Calcular centro e bounds do mapa
  const mapConfig = useMemo(() => {
    if (analise.tipo === 'sem_dados') return null;
    if (analise.tipo === 'comparacao') {
      const centerLat = (analise.informada.lat + analise.rastreador.lat) / 2;
      const centerLng = (analise.informada.lng + analise.rastreador.lng) / 2;
      const bounds = L.latLngBounds(
        [analise.informada.lat, analise.informada.lng],
        [analise.rastreador.lat, analise.rastreador.lng]
      );
      return { center: [centerLat, centerLng] as [number, number], bounds };
    }
    const lat = analise.tipo === 'apenas_informada' ? analise.lat : analise.lat;
    const lng = analise.tipo === 'apenas_informada' ? analise.lng : analise.lng;
    return { center: [lat, lng] as [number, number], bounds: null };
  }, [analise]);

  if (analise.tipo === 'sem_dados') {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Navigation className="h-4 w-4" /> Posições GPS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>Nenhuma posição GPS registrada para este sinistro</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Navigation className="h-4 w-4" /> Posições GPS - Evidência
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Mini-mapa */}
        {mapConfig && (
          <div className="h-52 rounded-lg overflow-hidden border">
            <MapContainer
              center={mapConfig.center}
              zoom={mapConfig.bounds ? 13 : 15}
              bounds={mapConfig.bounds || undefined}
              boundsOptions={{ padding: [40, 40] }}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={false}
            >
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

              {/* Marcador rastreador (verde) */}
              {(analise.tipo === 'comparacao' || analise.tipo === 'apenas_rastreador') && (
                <Marker
                  position={[
                    analise.tipo === 'comparacao' ? analise.rastreador.lat : analise.lat,
                    analise.tipo === 'comparacao' ? analise.rastreador.lng : analise.lng,
                  ]}
                  icon={rastreadorIcon}
                />
              )}

              {/* Marcador informada (azul) */}
              {(analise.tipo === 'comparacao' || analise.tipo === 'apenas_informada') && (
                <Marker
                  position={[
                    analise.tipo === 'comparacao' ? analise.informada.lat : analise.lat,
                    analise.tipo === 'comparacao' ? analise.informada.lng : analise.lng,
                  ]}
                  icon={informadaIcon}
                />
              )}

              {/* Linha entre os dois pontos */}
              {analise.tipo === 'comparacao' && (
                <Polyline
                  positions={[
                    [analise.informada.lat, analise.informada.lng],
                    [analise.rastreador.lat, analise.rastreador.lng],
                  ]}
                  pathOptions={{ color: '#EF4444', weight: 2, dashArray: '6, 6' }}
                />
              )}
            </MapContainer>
          </div>
        )}

        {/* Legendas dos marcadores */}
        <div className="flex gap-3 text-xs text-muted-foreground">
          {(analise.tipo === 'comparacao' || analise.tipo === 'apenas_rastreador') && (
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Rastreador</span>
          )}
          {(analise.tipo === 'comparacao' || analise.tipo === 'apenas_informada') && (
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Informada</span>
          )}
        </div>

        {/* Posição informada */}
        {(analise.tipo === 'comparacao' || analise.tipo === 'apenas_informada') && (
          <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Informada pelo Usuário</span>
            </div>
            <code className="text-xs bg-background px-2 py-1 rounded">
              {formatarCoordenada(
                analise.tipo === 'comparacao' ? analise.informada.lat : analise.lat,
                analise.tipo === 'comparacao' ? analise.informada.lng : analise.lng
              )}
            </code>
          </div>
        )}

        {/* Posição do rastreador */}
        {(analise.tipo === 'comparacao' || analise.tipo === 'apenas_rastreador') && (
          <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-green-500" />
              <div>
                <span className="text-sm font-medium">Rastreador GPS</span>
                {analise.capturado && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(analise.capturado), "dd/MM HH:mm", { locale: ptBR })}
                  </div>
                )}
              </div>
            </div>
            <code className="text-xs bg-background px-2 py-1 rounded">
              {formatarCoordenada(
                analise.tipo === 'comparacao' ? analise.rastreador.lat : analise.lat,
                analise.tipo === 'comparacao' ? analise.rastreador.lng : analise.lng
              )}
            </code>
          </div>
        )}

        {/* Comparação */}
        {analise.tipo === 'comparacao' && (
          <div className={`flex items-center justify-between p-3 rounded-md border ${
            analise.classificacao.status === 'ok' ? 'border-green-200 bg-green-50'
              : analise.classificacao.status === 'atencao' ? 'border-yellow-200 bg-yellow-50'
              : 'border-red-200 bg-red-50'
          }`}>
            <div className="flex items-center gap-2">
              {analise.classificacao.status === 'ok' ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className={`h-4 w-4 ${analise.classificacao.status === 'atencao' ? 'text-yellow-600' : 'text-red-600'}`} />
              )}
              <div>
                <span className={`text-sm font-medium ${
                  analise.classificacao.status === 'ok' ? 'text-green-800'
                    : analise.classificacao.status === 'atencao' ? 'text-yellow-800' : 'text-red-800'
                }`}>
                  {analise.classificacao.label}
                </span>
                <p className="text-xs text-muted-foreground">Distância entre posições</p>
              </div>
            </div>
            <Badge className={analise.classificacao.cor}>
              {analise.distanciaKm < 1 ? `${Math.round(analise.distanciaKm * 1000)}m` : `${analise.distanciaKm.toFixed(1)}km`}
            </Badge>
          </div>
        )}

        {localOcorrencia && (
          <div className="text-xs text-muted-foreground pt-2 border-t">
            <span className="font-medium">Local informado:</span> {localOcorrencia}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
