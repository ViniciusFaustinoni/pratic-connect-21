import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Route, Play, Pause, SkipForward, SkipBack, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRastreadorHistoricoAPI, type TrajetoPonto } from '@/hooks/useRastreadorHistoricoAPI';
import 'leaflet/dist/leaflet.css';

interface MapaHistoricoProps {
  rastreadorId: string;
  altura?: string;
}

// Componente para ajustar bounds do mapa
function FitBounds({ pontos }: { pontos: TrajetoPonto[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (pontos.length > 0) {
      const bounds = L.latLngBounds(
        pontos.map(p => [p.latitude, p.longitude] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [pontos, map]);
  
  return null;
}

// Ícone customizado para marcador atual
const createCurrentIcon = () => L.divIcon({
  className: 'custom-marker',
  html: `<div style="width: 16px; height: 16px; background: hsl(var(--primary)); border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const createStartIcon = () => L.divIcon({
  className: 'custom-marker',
  html: `<div style="width: 12px; height: 12px; background: #22c55e; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const createEndIcon = () => L.divIcon({
  className: 'custom-marker',
  html: `<div style="width: 12px; height: 12px; background: #ef4444; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

export function MapaHistorico({ rastreadorId, altura = '400px' }: MapaHistoricoProps) {
  const [dataInicio, setDataInicio] = useState<Date>(subDays(new Date(), 1));
  const [dataFim, setDataFim] = useState<Date>(new Date());
  const [posicaoAtual, setPosicaoAtual] = useState(0);
  const [reproduzindo, setReproduzindo] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const { data, isLoading, error } = useRastreadorHistoricoAPI({
    rastreadorId,
    dataInicio,
    dataFim,
  });

  const trajeto = data?.trajeto || [];

  // Reprodução automática
  useEffect(() => {
    if (reproduzindo && trajeto.length > 0) {
      intervalRef.current = setInterval(() => {
        setPosicaoAtual((prev) => {
          if (prev >= trajeto.length - 1) {
            setReproduzindo(false);
            return prev;
          }
          return prev + 1;
        });
      }, 200);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [reproduzindo, trajeto.length]);

  // Reset posição quando trajeto muda
  useEffect(() => {
    setPosicaoAtual(0);
    setReproduzindo(false);
  }, [trajeto]);

  const pontoAtual = trajeto[posicaoAtual];
  const polylinePositions = trajeto.map(p => [p.latitude, p.longitude] as [number, number]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height: altura }}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Erro ao carregar histórico: {error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Route className="h-4 w-4" />
            Histórico de Trajetos
          </CardTitle>

          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Calendar className="h-4 w-4 mr-2" />
                  {format(dataInicio, 'dd/MM', { locale: ptBR })} - {format(dataFim, 'dd/MM', { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarPicker
                  mode="range"
                  selected={{ from: dataInicio, to: dataFim }}
                  onSelect={(range) => {
                    if (range?.from) setDataInicio(range.from);
                    if (range?.to) setDataFim(range.to);
                  }}
                  locale={ptBR}
                  numberOfMonths={1}
                />
              </PopoverContent>
            </Popover>

            <Badge variant="secondary">
              {trajeto.length} pontos
            </Badge>

            {data?.fonte && (
              <Badge variant={data.fonte === 'api' ? 'default' : 'outline'}>
                {data.fonte === 'api' ? '🟢 API' : '🟡 Local'}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Mapa */}
        <div style={{ height: altura }}>
          <MapContainer
            center={[-15.7801, -47.9292]}
            zoom={4}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {trajeto.length > 0 && (
              <>
                <FitBounds pontos={trajeto} />
                
                {/* Linha do trajeto */}
                <Polyline
                  positions={polylinePositions}
                  pathOptions={{ color: 'hsl(221.2, 83.2%, 53.3%)', weight: 3, opacity: 0.8 }}
                />

                {/* Marcador início */}
                <Marker
                  position={[trajeto[0].latitude, trajeto[0].longitude]}
                  icon={createStartIcon()}
                />

                {/* Marcador fim */}
                <Marker
                  position={[trajeto[trajeto.length - 1].latitude, trajeto[trajeto.length - 1].longitude]}
                  icon={createEndIcon()}
                />

                {/* Marcador posição atual */}
                {pontoAtual && (
                  <Marker
                    position={[pontoAtual.latitude, pontoAtual.longitude]}
                    icon={createCurrentIcon()}
                  />
                )}
              </>
            )}
          </MapContainer>
        </div>

        {/* Controles de reprodução */}
        {trajeto.length > 0 && (
          <div className="p-4 border-t space-y-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPosicaoAtual(0)}
                disabled={posicaoAtual === 0}
              >
                <SkipBack className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setReproduzindo(!reproduzindo)}
              >
                {reproduzindo ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setPosicaoAtual(trajeto.length - 1)}
                disabled={posicaoAtual === trajeto.length - 1}
              >
                <SkipForward className="h-4 w-4" />
              </Button>

              <div className="flex-1 px-2">
                <Slider
                  value={[posicaoAtual]}
                  max={trajeto.length - 1}
                  step={1}
                  onValueChange={([value]) => setPosicaoAtual(value)}
                />
              </div>

              <span className="text-sm text-muted-foreground min-w-[60px] text-right">
                {posicaoAtual + 1} / {trajeto.length}
              </span>
            </div>

            {/* Info do ponto atual */}
            {pontoAtual && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Data/Hora:</span>
                  <p className="font-medium">
                    {format(new Date(pontoAtual.data_posicao), "dd/MM HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Velocidade:</span>
                  <p className="font-medium">{pontoAtual.velocidade} km/h</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Ignição:</span>
                  <p className="font-medium">{pontoAtual.ignicao ? '🟢 Ligada' : '🔴 Desligada'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Coordenadas:</span>
                  <p className="font-medium text-xs">
                    {pontoAtual.latitude.toFixed(5)}, {pontoAtual.longitude.toFixed(5)}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {!isLoading && trajeto.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            <Route className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum trajeto encontrado no período selecionado.</p>
          </div>
        )}

        {data?.mensagem && data.fonte === 'local' && (
          <div className="px-4 pb-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{data.mensagem}</AlertDescription>
            </Alert>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
