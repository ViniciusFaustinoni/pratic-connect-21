import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
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
  ChevronDown,
  ChevronUp,
  WifiOff,
  Radio
} from 'lucide-react';
import { toast } from 'sonner';
import { useMyVehicleWithTracker, useMyVehicles } from '@/hooks/useMyData';
import { cn } from '@/lib/utils';

// Dados mock para demonstração
const dadosMock = {
  velocidade: 45,
  ignicao: true,
  endereco: "Rua das Flores, 123 - Centro, Uberlândia - MG",
  emMovimento: true,
  historico: [
    { id: "1", hora: "08:00", evento: "Saída de casa", tipo: "inicio" },
    { id: "2", hora: "08:45", evento: "Chegou no trabalho", tipo: "parada" },
    { id: "3", hora: "12:30", evento: "Saiu para almoço", tipo: "movimento" },
    { id: "4", hora: "13:15", evento: "Voltou ao trabalho", tipo: "parada" },
    { id: "5", hora: "17:00", evento: "Posição atual", tipo: "atual" }
  ]
};

export default function AppRastreamento() {
  const navigate = useNavigate();
  const { data: vehicles, isLoading: vehiclesLoading } = useMyVehicles();
  const { data: tracker, isLoading: trackerLoading, refetch } = useMyVehicleWithTracker();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [simulandoOffline, setSimulandoOffline] = useState(false);
  
  const isLoading = vehiclesLoading || trackerLoading;
  const vehicle = vehicles?.[0];
  const isOnline = !simulandoOffline && tracker?.status === 'instalado' && tracker?.ultima_comunicacao;

  // Tempo desde última atualização
  const [tempoDesdeAtualizacao, setTempoDesdeAtualizacao] = useState('');
  
  useEffect(() => {
    const calcularTempo = () => {
      if (!tracker?.ultima_comunicacao) {
        setTempoDesdeAtualizacao('--');
        return;
      }
      const agora = new Date();
      const ultima = new Date(tracker.ultima_comunicacao);
      const diffMs = agora.getTime() - ultima.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      
      if (diffMin < 1) setTempoDesdeAtualizacao('agora');
      else if (diffMin < 60) setTempoDesdeAtualizacao(`${diffMin} min`);
      else if (diffMin < 1440) setTempoDesdeAtualizacao(`${Math.floor(diffMin / 60)}h`);
      else setTempoDesdeAtualizacao(`${Math.floor(diffMin / 1440)}d`);
    };
    
    calcularTempo();
    const interval = setInterval(calcularTempo, 60000);
    return () => clearInterval(interval);
  }, [tracker?.ultima_comunicacao]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success('Posição atualizada');
    }, 1500);
  };

  const handleCentralizar = () => {
    toast.success('Mapa centralizado no veículo');
  };

  const handleReconectar = () => {
    toast.info('Tentando reconectar...');
    setTimeout(() => {
      setSimulandoOffline(false);
      toast.success('Rastreador reconectado!');
    }, 2000);
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background pb-20">
        {/* Header Skeleton */}
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </header>
        
        <div className="flex-1 space-y-4 p-4">
          <Skeleton className="h-[60vh] w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // Empty State - No vehicle or tracker
  if (!vehicle || !tracker) {
    return (
      <div className="flex min-h-screen flex-col bg-background pb-20">
        {/* Header */}
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/app/home')}
            aria-label="Voltar"
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

  const emMovimento = dadosMock.velocidade > 0;

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => navigate('/app/home')}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Rastreamento</h1>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={handleRefresh}
          disabled={isRefreshing}
          aria-label="Atualizar posição"
        >
          <RefreshCw className={cn("h-5 w-5", isRefreshing && "animate-spin")} />
        </Button>
      </header>

      <div className="flex-1 space-y-4 p-4">
        {/* Área do Mapa (Placeholder Visual) */}
        <div className="relative h-[60vh] overflow-hidden rounded-xl bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 shadow-sm">
          {/* Overlay Offline */}
          {!isOnline && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <WifiOff className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Rastreador offline</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Última posição conhecida: há 2 horas
              </p>
              <Button 
                className="mt-4" 
                onClick={handleReconectar}
              >
                Tentar reconectar
              </Button>
            </div>
          )}

          {/* Marcador Central com Pulso */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Círculo pulsante */}
            <div className="absolute h-24 w-24 animate-ping rounded-full bg-primary/20" />
            <div className="absolute h-16 w-16 rounded-full bg-primary/30" />
            
            {/* Ícone do carro */}
            <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg">
              <Car className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>

          {/* Badge AO VIVO / PARADO */}
          {isOnline && (
            <div className="absolute left-4 top-4 z-10">
              {emMovimento ? (
                <Badge className="animate-pulse gap-1.5 bg-destructive text-destructive-foreground">
                  <Radio className="h-3 w-3" />
                  AO VIVO
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                  PARADO
                </Badge>
              )}
            </div>
          )}

          {/* Botão Centralizar */}
          <Button
            size="icon"
            className="absolute bottom-4 right-4 z-10 h-12 w-12 rounded-full shadow-lg"
            onClick={handleCentralizar}
            aria-label="Centralizar no veículo"
          >
            <Crosshair className="h-5 w-5" />
          </Button>

          {/* Grid decorativo do mapa */}
          <div className="absolute inset-0 opacity-30">
            <div className="h-full w-full" style={{
              backgroundImage: 'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }} />
          </div>
        </div>

        {/* Card do Veículo */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Car className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{vehicle.marca} {vehicle.modelo}</span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {vehicle.placa}
                  </Badge>
                </div>
                <div className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{dadosMock.endereco}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards de Status */}
        <div className="grid grid-cols-3 gap-3">
          {/* Velocidade */}
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center p-4">
              <Gauge className="h-6 w-6 text-blue-500" />
              <span className="mt-2 text-2xl font-bold transition-all">
                {dadosMock.velocidade}
              </span>
              <span className="text-xs text-muted-foreground">km/h</span>
            </CardContent>
          </Card>

          {/* Ignição */}
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center p-4">
              <Power className={cn(
                "h-6 w-6",
                dadosMock.ignicao ? "text-green-500" : "text-muted-foreground"
              )} />
              <span className={cn(
                "mt-2 text-2xl font-bold",
                dadosMock.ignicao ? "text-green-600" : "text-muted-foreground"
              )}>
                {dadosMock.ignicao ? 'ON' : 'OFF'}
              </span>
              <span className="text-xs text-muted-foreground">Ignição</span>
            </CardContent>
          </Card>

          {/* Última Atualização */}
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center p-4">
              <Clock className="h-6 w-6 text-orange-500" />
              <span className="mt-2 text-2xl font-bold">
                {tempoDesdeAtualizacao || '5 min'}
              </span>
              <span className="text-xs text-muted-foreground">atrás</span>
            </CardContent>
          </Card>
        </div>

        {/* Histórico do Dia */}
        <Collapsible open={historicoAberto} onOpenChange={setHistoricoAberto}>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Route className="h-5 w-5 text-primary" />
                    <span className="font-semibold">Último trajeto (hoje)</span>
                  </div>
                  {historicoAberto ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>

              <div className="mt-4 space-y-0">
                {/* Mostrar sempre os 3 primeiros */}
                {dadosMock.historico.slice(0, 3).map((item, index) => (
                  <TimelineItem 
                    key={item.id} 
                    item={item} 
                    isLast={!historicoAberto && index === 2} 
                  />
                ))}

                {/* Restante do histórico (colapsável) */}
                <CollapsibleContent className="space-y-0">
                  {dadosMock.historico.slice(3).map((item, index) => (
                    <TimelineItem 
                      key={item.id} 
                      item={item} 
                      isLast={index === dadosMock.historico.length - 4} 
                    />
                  ))}
                </CollapsibleContent>
              </div>

              {!historicoAberto && dadosMock.historico.length > 3 && (
                <Button 
                  variant="ghost" 
                  className="mt-2 w-full text-sm"
                  onClick={() => setHistoricoAberto(true)}
                >
                  Ver histórico completo ({dadosMock.historico.length - 3} mais)
                </Button>
              )}
            </CardContent>
          </Card>
        </Collapsible>

        {/* Toggle para testar estado offline (dev only) */}
        {process.env.NODE_ENV === 'development' && (
          <Button 
            variant="outline" 
            size="sm"
            className="w-full opacity-50"
            onClick={() => setSimulandoOffline(!simulandoOffline)}
          >
            {simulandoOffline ? 'Simular Online' : 'Simular Offline'}
          </Button>
        )}
      </div>
    </div>
  );
}

// Componente do item da timeline
function TimelineItem({ 
  item, 
  isLast 
}: { 
  item: { id: string; hora: string; evento: string; tipo: string }; 
  isLast: boolean;
}) {
  const getColor = () => {
    switch (item.tipo) {
      case 'inicio': return 'bg-green-500';
      case 'atual': return 'bg-red-500 animate-pulse';
      default: return 'bg-blue-500';
    }
  };

  return (
    <div className="flex gap-3">
      {/* Linha e círculo */}
      <div className="flex flex-col items-center">
        <div className={cn("h-3 w-3 rounded-full", getColor())} />
        {!isLast && <div className="w-0.5 flex-1 bg-border" />}
      </div>
      
      {/* Conteúdo */}
      <div className={cn("pb-4", isLast && "pb-0")}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {item.hora}
          </span>
          {item.tipo === 'atual' && (
            <Badge variant="destructive" className="h-5 text-[10px]">
              Agora
            </Badge>
          )}
        </div>
        <p className="text-sm font-medium">{item.evento}</p>
      </div>
    </div>
  );
}
