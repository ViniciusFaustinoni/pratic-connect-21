import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { format, subDays, subHours, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward,
  Calendar,
  MapPin,
  Navigation,
  Clock,
  Gauge,
  Route,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { useMyVehicles, useVeiculoHistorico } from '@/hooks/useMyData';
import type { DateRange } from 'react-day-picker';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons
const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const currentIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Component to fit map bounds
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  
  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [positions, map]);
  
  return null;
}

// Helper to format duration
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}min`;
}

export default function AppRastreamentoHistorico() {
  const navigate = useNavigate();
  const { data: vehicles, isLoading: loadingVehicles } = useMyVehicles();
  const vehicle = vehicles?.[0];

  // State for date range
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 1),
    to: new Date(),
  });
  
  // State for interval
  const [intervalo, setIntervalo] = useState<number>(15);
  
  // State for playback
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Fetch history data
  const { 
    data: historico, 
    isLoading: loadingHistorico, 
    error: errorHistorico,
    refetch 
  } = useVeiculoHistorico({
    veiculoId: vehicle?.id,
    dataInicio: dateRange?.from ? startOfDay(dateRange.from) : undefined,
    dataFim: dateRange?.to ? endOfDay(dateRange.to) : undefined,
    intervaloMinutos: intervalo,
    enabled: !!vehicle?.id && !!dateRange?.from && !!dateRange?.to,
  });

  const trajeto = historico?.trajeto || [];
  const resumo = historico?.resumo;

  // Map positions for polyline
  const positions = useMemo(() => 
    trajeto.map(p => [p.latitude, p.longitude] as [number, number]),
    [trajeto]
  );

  // Current position based on playback index
  const currentPosition = trajeto[currentIndex];

  // Playback effect
  useEffect(() => {
    if (!isPlaying || trajeto.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex(prev => {
        if (prev >= trajeto.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, trajeto.length, playbackSpeed]);

  // Reset index when trajeto changes
  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [trajeto]);

  const handlePlayPause = useCallback(() => {
    if (currentIndex >= trajeto.length - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, currentIndex, trajeto.length]);

  const handleSkipStart = useCallback(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
  }, []);

  const handleSkipEnd = useCallback(() => {
    setCurrentIndex(trajeto.length - 1);
    setIsPlaying(false);
  }, [trajeto.length]);

  const handleSliderChange = useCallback((value: number[]) => {
    setCurrentIndex(value[0]);
    setIsPlaying(false);
  }, []);

  // Quick period presets
  const handlePreset = (preset: string) => {
    const now = new Date();
    let from: Date;
    
    switch (preset) {
      case '24h':
        from = subHours(now, 24);
        break;
      case '3d':
        from = subDays(now, 3);
        break;
      case '7d':
        from = subDays(now, 7);
        break;
      default:
        return;
    }
    
    setDateRange({ from, to: now });
  };

  if (loadingVehicles) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Nenhum veículo encontrado</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-card">
        <Button variant="ghost" size="icon" onClick={() => navigate('/app/rastreamento')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-semibold">Histórico de Trajetos</h1>
          <p className="text-sm text-muted-foreground">
            {vehicle.marca} {vehicle.modelo} - {vehicle.placa}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 space-y-3 border-b bg-card">
        {/* Period presets */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handlePreset('24h')}
            className="flex-1"
          >
            24h
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handlePreset('3d')}
            className="flex-1"
          >
            3 dias
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handlePreset('7d')}
            className="flex-1"
          >
            7 dias
          </Button>
        </div>

        {/* Date range picker */}
        <DatePickerWithRange 
          date={dateRange} 
          onDateChange={setDateRange}
        />

        {/* Interval selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Intervalo:</span>
          <Select value={String(intervalo)} onValueChange={(v) => setIntervalo(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 min</SelectItem>
              <SelectItem value="15">15 min</SelectItem>
              <SelectItem value="30">30 min</SelectItem>
              <SelectItem value="60">1 hora</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {loadingHistorico ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : null}

        {errorHistorico ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 z-10">
            <AlertCircle className="h-8 w-8 text-destructive mb-2" />
            <p className="text-sm text-destructive">
              {errorHistorico instanceof Error ? errorHistorico.message : 'Erro ao carregar histórico'}
            </p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : null}

        {trajeto.length === 0 && !loadingHistorico && !errorHistorico ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 z-10">
            <Route className="h-12 w-12 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum trajeto encontrado no período</p>
          </div>
        ) : null}

        <MapContainer
          center={currentPosition ? [currentPosition.latitude, currentPosition.longitude] : [-18.9186, -48.2772]}
          zoom={13}
          className="h-full w-full"
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {positions.length > 0 && (
            <>
              <FitBounds positions={positions} />
              
              {/* Polyline - color by speed */}
              <Polyline 
                positions={positions}
                pathOptions={{ 
                  color: '#3b82f6',
                  weight: 4,
                  opacity: 0.8,
                }}
              />

              {/* Start marker */}
              <Marker position={positions[0]} icon={startIcon}>
                <Popup>
                  <div className="text-sm">
                    <strong>Início</strong>
                    <p>{format(new Date(trajeto[0].data_hora), "dd/MM HH:mm", { locale: ptBR })}</p>
                  </div>
                </Popup>
              </Marker>

              {/* End marker */}
              <Marker position={positions[positions.length - 1]} icon={endIcon}>
                <Popup>
                  <div className="text-sm">
                    <strong>Fim</strong>
                    <p>{format(new Date(trajeto[trajeto.length - 1].data_hora), "dd/MM HH:mm", { locale: ptBR })}</p>
                  </div>
                </Popup>
              </Marker>

              {/* Current position marker during playback */}
              {currentPosition && currentIndex > 0 && currentIndex < trajeto.length - 1 && (
                <Marker 
                  position={[currentPosition.latitude, currentPosition.longitude]} 
                  icon={currentIcon}
                >
                  <Popup>
                    <div className="text-sm space-y-1">
                      <p><strong>{format(new Date(currentPosition.data_hora), "dd/MM HH:mm:ss", { locale: ptBR })}</strong></p>
                      <p>Velocidade: {currentPosition.velocidade} km/h</p>
                      <p>Ignição: {currentPosition.ignicao ? 'Ligada' : 'Desligada'}</p>
                      {currentPosition.endereco && <p>{currentPosition.endereco}</p>}
                    </div>
                  </Popup>
                </Marker>
              )}
            </>
          )}
        </MapContainer>
      </div>

      {/* Summary Card */}
      {resumo && trajeto.length > 0 && (
        <Card className="mx-4 -mt-16 relative z-20 mb-4 shadow-lg">
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Route className="h-4 w-4" />
                  <span className="text-xs">Distância</span>
                </div>
                <p className="font-semibold">{resumo.distancia_total_km} km</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">Movimento</span>
                </div>
                <p className="font-semibold">{formatDuration(resumo.tempo_movimento_minutos)}</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                  <Gauge className="h-4 w-4" />
                  <span className="text-xs">Vel. Máx</span>
                </div>
                <p className="font-semibold">{resumo.velocidade_maxima_kmh} km/h</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Playback Controls */}
      {trajeto.length > 0 && (
        <div className="p-4 border-t bg-card space-y-3">
          {/* Current point info */}
          {currentPosition && (
            <div className="text-center text-sm text-muted-foreground">
              {format(new Date(currentPosition.data_hora), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
              {' • '}
              {currentPosition.velocidade} km/h
              {' • '}
              {currentPosition.ignicao ? 'Ligado' : 'Desligado'}
            </div>
          )}

          {/* Slider */}
          <Slider
            value={[currentIndex]}
            max={trajeto.length - 1}
            step={1}
            onValueChange={handleSliderChange}
            className="w-full"
          />

          {/* Play controls */}
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="icon" onClick={handleSkipStart}>
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button variant="default" size="icon" onClick={handlePlayPause}>
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" onClick={handleSkipEnd}>
              <SkipForward className="h-4 w-4" />
            </Button>
            
            {/* Speed selector */}
            <Select value={String(playbackSpeed)} onValueChange={(v) => setPlaybackSpeed(Number(v))}>
              <SelectTrigger className="w-20 ml-4">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">0.5x</SelectItem>
                <SelectItem value="1">1x</SelectItem>
                <SelectItem value="2">2x</SelectItem>
                <SelectItem value="4">4x</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Point counter */}
          <div className="text-center text-xs text-muted-foreground">
            Ponto {currentIndex + 1} de {trajeto.length}
          </div>
        </div>
      )}
    </div>
  );
}
