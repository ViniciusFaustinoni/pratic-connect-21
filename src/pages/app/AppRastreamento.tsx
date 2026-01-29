import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { 
  ArrowLeft, 
  RefreshCw, 
  Car, 
  MapPin, 
  Gauge, 
  Power, 
  Clock,
  Crosshair,
  Route,
  WifiOff,
  Radio,
  Navigation,
  Signal,
  History,
  ShieldAlert,
  CreditCard
} from 'lucide-react';
import { toast } from 'sonner';
import { useMyVehicleWithTracker, useMyVehicles, useVeiculoPosicao, useMyAssociado } from '@/hooks/useMyData';
import { cn } from '@/lib/utils';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Component to fly map to position
function FlyToPosition({ position, zoom }: { position: [number, number]; zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (position[0] && position[1]) {
      map.flyTo(position, zoom, { duration: 1 });
    }
  }, [position, zoom, map]);
  
  return null;
}

// Custom marker icon based on ignition status
function getMarkerIcon(ignicao: boolean, emMovimento: boolean) {
  const color = emMovimento ? '#22c55e' : ignicao ? '#eab308' : '#ef4444';
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      ">
        <div style="
          position: absolute;
          width: 48px;
          height: 48px;
          background: ${color}40;
          border-radius: 50%;
          animation: pulse 2s infinite;
        "></div>
        <div style="
          width: 36px;
          height: 36px;
          background: ${color};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px ${color}60;
          z-index: 1;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18 10H6l-2.5 1.1C2.7 11.3 2 12.1 2 13v3c0 .6.4 1 1 1h2"/>
            <circle cx="7" cy="17" r="2"/>
            <circle cx="17" cy="17" r="2"/>
          </svg>
        </div>
      </div>
      <style>
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
      </style>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}

export default function AppRastreamento() {
  const navigate = useNavigate();
  const { data: associado, isLoading: associadoLoading } = useMyAssociado();
  const { data: vehicles, isLoading: vehiclesLoading } = useMyVehicles();
  const { data: tracker, isLoading: trackerLoading, refetch } = useMyVehicleWithTracker();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [veiculoSelecionado, setVeiculoSelecionado] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  
  const isLoading = vehiclesLoading || trackerLoading || associadoLoading;
  const vehicle = veiculoSelecionado 
    ? vehicles?.find(v => v.id === veiculoSelecionado) 
    : vehicles?.[0];
  
  // Hook de posição em tempo real via Edge Function
  const { 
    posicao, 
    tempoReal, 
    offline, 
    refetch: refetchPosicao,
    atualizarManual 
  } = useVeiculoPosicao(vehicle?.id);
  
  // Position data
  const latitude = posicao?.latitude ?? tracker?.ultima_posicao_lat ?? -18.9186;
  const longitude = posicao?.longitude ?? tracker?.ultima_posicao_lng ?? -48.2772;
  const velocidade = posicao?.velocidade ?? 0;
  const ignicao = posicao?.ignicao ?? false;
  const endereco = posicao?.endereco_aproximado ?? 'Endereço não disponível';
  
  const hasValidPosition = latitude !== null && longitude !== null && latitude !== 0 && longitude !== 0;
  const isOnline = posicao?.status_rastreador === 'online' || (tracker?.status === 'instalado' && !offline);
  const emMovimento = velocidade > 0;
  
  // Detectar estado de aguardando primeira posição
  const aguardandoPrimeiraPosicao = tracker?.status === 'instalado' && 
    !tracker?.ultima_comunicacao && 
    !posicao?.latitude;
  
  // Calcular horas sem comunicação
  const ultimaCom = posicao?.data_hora || tracker?.ultima_comunicacao;
  const horasSemCom = ultimaCom 
    ? Math.floor((Date.now() - new Date(ultimaCom).getTime()) / (1000 * 60 * 60)) 
    : null;

  // Time since last update
  const [tempoDesdeAtualizacao, setTempoDesdeAtualizacao] = useState('');
  
  useEffect(() => {
    const calcularTempo = () => {
      const ultimaCom = posicao?.data_hora || tracker?.ultima_comunicacao;
      if (!ultimaCom) {
        setTempoDesdeAtualizacao('--');
        return;
      }
      const agora = new Date();
      const ultima = new Date(ultimaCom);
      const diffMs = agora.getTime() - ultima.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      
      if (diffMin < 1) setTempoDesdeAtualizacao('agora');
      else if (diffMin < 60) setTempoDesdeAtualizacao(`há ${diffMin} min`);
      else if (diffMin < 1440) setTempoDesdeAtualizacao(`há ${Math.floor(diffMin / 60)}h`);
      else setTempoDesdeAtualizacao(`há ${Math.floor(diffMin / 1440)}d`);
    };
    
    calcularTempo();
    const interval = setInterval(calcularTempo, 60000);
    return () => clearInterval(interval);
  }, [posicao?.data_hora, tracker?.ultima_comunicacao]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetch(), refetchPosicao()]);
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('Posição atualizada');
    }, 1000);
  };

  const abrirNoGoogleMaps = () => {
    if (hasValidPosition) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
        '_blank'
      );
    } else {
      toast.error('Coordenadas não disponíveis');
    }
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </header>
        <Skeleton className="flex-1" />
      </div>
    );
  }

  // Estado de Bloqueio por Inadimplência
  const associadoBloqueado = associado?.status === 'suspenso' || 
                              associado?.status === 'inadimplente' || 
                              associado?.bloqueado === true;

  if (associadoBloqueado) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/app/home')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Rastreamento</h1>
          <div className="w-10" />
        </header>

        <div className="flex flex-1 items-center justify-center p-4">
          <Card className="w-full max-w-sm border-destructive/20 shadow-lg">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                <ShieldAlert className="h-10 w-10 text-destructive" />
              </div>
              <h3 className="mt-6 text-xl font-bold text-destructive">
                Acesso Bloqueado
              </h3>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                Seu acesso ao rastreamento está temporariamente suspenso 
                devido a pendências financeiras.
              </p>
              {associado?.motivo_bloqueio && (
                <p className="mt-2 text-xs text-muted-foreground italic">
                  Motivo: {associado.motivo_bloqueio}
                </p>
              )}
              <div className="mt-6 flex flex-col gap-3 w-full">
                <Button 
                  className="w-full"
                  onClick={() => navigate('/app/boletos')}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Ver Boletos Pendentes
                </Button>
                <Button 
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate('/app/home')}
                >
                  Voltar ao Início
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Empty State
  if (!vehicle || !tracker) {
    return (
      <div className="flex h-screen flex-col bg-background">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/app/home')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Rastreamento</h1>
          <div className="w-10" />
        </header>

        <div className="flex flex-1 items-center justify-center p-4">
          <Card className="w-full border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <WifiOff className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">
                {!vehicle ? 'Nenhum veículo cadastrado' : 'Rastreador não instalado'}
              </h3>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {!vehicle 
                  ? 'Você precisa ter um veículo cadastrado para usar o rastreamento'
                  : 'Aguarde a instalação do rastreador no seu veículo'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background px-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/app/home')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Rastreamento</h1>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("h-5 w-5", isRefreshing && "animate-spin")} />
        </Button>
      </header>

      {/* Vehicle Selector */}
      {vehicles && vehicles.length > 1 && (
        <div className="border-b bg-background px-4 py-2 z-10">
          <Select 
            value={veiculoSelecionado || vehicle?.id} 
            onValueChange={setVeiculoSelecionado}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione o veículo" />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    <span className="font-mono">{v.placa}</span>
                    <span className="text-muted-foreground">- {v.marca} {v.modelo}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Map Container */}
      <div className="flex-1 relative">
        {/* Aguardando Primeira Posição Overlay */}
        {aguardandoPrimeiraPosicao && (
          <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Radio className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Rastreador ativado</h3>
            <p className="mt-1 text-sm text-muted-foreground text-center px-8">
              Aguardando primeira posição GPS do dispositivo...
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Isso pode levar alguns minutos após a instalação
            </p>
            <Button className="mt-4" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
              Verificar agora
            </Button>
          </div>
        )}

        {/* Sem Comunicação Prolongada Overlay */}
        {!aguardandoPrimeiraPosicao && horasSemCom !== null && horasSemCom >= 4 && (
          <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <WifiOff className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Sem comunicação</h3>
            <p className="mt-1 text-sm text-muted-foreground text-center px-8">
              O rastreador não comunica há {horasSemCom}h. Verifique o dispositivo.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Última posição: {tempoDesdeAtualizacao}
            </p>
            <Button className="mt-4" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
              Tentar reconectar
            </Button>
          </div>
        )}

        {/* Offline Overlay (curto período) */}
        {!aguardandoPrimeiraPosicao && !isOnline && (horasSemCom === null || horasSemCom < 4) && (
          <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
              <WifiOff className="h-8 w-8 text-accent" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">Rastreador offline</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Última posição: {tempoDesdeAtualizacao}
            </p>
            <Button className="mt-4" onClick={handleRefresh}>
              Tentar reconectar
            </Button>
          </div>
        )}

        {hasValidPosition ? (
          <MapContainer
            center={[latitude, longitude]}
            zoom={15}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker 
              position={[latitude, longitude]} 
              icon={getMarkerIcon(ignicao, emMovimento)}
            />
            <FlyToPosition position={[latitude, longitude]} zoom={15} />
          </MapContainer>
        ) : (
          <div className="flex h-full items-center justify-center bg-muted">
            <p className="text-muted-foreground">Posição não disponível</p>
          </div>
        )}

        {/* Live Badge */}
        {isOnline && (
          <div className="absolute left-4 top-4 z-[1000]">
            {emMovimento ? (
              <Badge className="animate-pulse gap-1.5 bg-primary text-primary-foreground shadow-lg">
                <Radio className="h-3 w-3" />
                EM MOVIMENTO
              </Badge>
            ) : ignicao ? (
              <Badge className="gap-1.5 bg-accent text-accent-foreground shadow-lg">
                <Power className="h-3 w-3" />
                LIGADO
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1.5 shadow-lg">
                <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                PARADO
              </Badge>
            )}
          </div>
        )}

        {/* Center Button */}
        <Button
          size="icon"
          className="absolute bottom-32 right-4 z-[1000] h-12 w-12 rounded-full shadow-lg"
          onClick={() => toast.success('Mapa centralizado')}
        >
          <Crosshair className="h-5 w-5" />
        </Button>
      </div>

      {/* Bottom Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} modal={false}>
        <DrawerContent className="max-h-[60vh]">
          <DrawerHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Car className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <DrawerTitle className="font-mono text-lg">{vehicle.placa}</DrawerTitle>
                  <Badge variant={isOnline ? "default" : "secondary"} className="text-xs">
                    <Signal className="h-3 w-3 mr-1" />
                    {isOnline ? 'Online' : 'Offline'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{vehicle.marca} {vehicle.modelo}</p>
              </div>
            </div>
          </DrawerHeader>

          <div className="px-4 pb-6 space-y-4">
            {/* Address */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <span className="text-sm">{endereco}</span>
                <p className="text-xs text-muted-foreground mt-1">
                  <Clock className="h-3 w-3 inline mr-1" />
                  Atualizado {tempoDesdeAtualizacao}
                </p>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-0 shadow-sm bg-muted/30">
                <CardContent className="flex flex-col items-center justify-center p-3">
                  <Gauge className="h-5 w-5 text-primary" />
                  <span className="mt-1 text-xl font-bold">{velocidade}</span>
                  <span className="text-xs text-muted-foreground">km/h</span>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-muted/30">
                <CardContent className="flex flex-col items-center justify-center p-3">
                  <Power className={cn(
                    "h-5 w-5",
                    ignicao ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "mt-1 text-xl font-bold",
                    ignicao ? "text-primary" : "text-muted-foreground"
                  )}>
                    {ignicao ? 'ON' : 'OFF'}
                  </span>
                  <span className="text-xs text-muted-foreground">Ignição</span>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-muted/30">
                <CardContent className="flex flex-col items-center justify-center p-3">
                  <Signal className={cn(
                    "h-5 w-5",
                    isOnline ? "text-primary" : "text-destructive"
                  )} />
                  <span className={cn(
                    "mt-1 text-xl font-bold",
                    isOnline ? "text-primary" : "text-destructive"
                  )}>
                    {isOnline ? '●' : '○'}
                  </span>
                  <span className="text-xs text-muted-foreground">Sinal</span>
                </CardContent>
              </Card>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1 gap-2"
                onClick={() => navigate('/app/rastreamento/historico')}
              >
                <History className="h-4 w-4" />
                Histórico
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 gap-2"
                onClick={abrirNoGoogleMaps}
                disabled={!hasValidPosition}
              >
                <Navigation className="h-4 w-4" />
                Google Maps
              </Button>
            </div>

            {/* Refresh Button */}
            <Button 
              className="w-full gap-2" 
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              Atualizar Posição
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
