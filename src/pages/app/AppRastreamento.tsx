import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Navigation, Clock, Wifi, WifiOff } from 'lucide-react';
import { useMyVehicleWithTracker, useMyVehicles } from '@/hooks/useMyData';

export default function AppRastreamento() {
  const { data: vehicles, isLoading: vehiclesLoading } = useMyVehicles();
  const { data: tracker, isLoading: trackerLoading } = useMyVehicleWithTracker();
  
  const isLoading = vehiclesLoading || trackerLoading;
  const vehicle = vehicles?.[0];
  const isOnline = tracker?.status === 'instalado' && tracker?.ultima_comunicacao;

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Rastreamento</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe a localização do seu veículo
          </p>
        </div>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <Skeleton className="h-64 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!vehicle || !tracker) {
    return (
      <div className="space-y-4 p-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Rastreamento</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe a localização do seu veículo
          </p>
        </div>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <WifiOff className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold text-foreground">
              {!vehicle ? 'Nenhum veículo cadastrado' : 'Rastreador não instalado'}
            </h3>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              {!vehicle 
                ? 'Você precisa ter um veículo cadastrado para usar o rastreamento'
                : 'Aguarde a instalação do rastreador no seu veículo'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Rastreamento</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe a localização do seu veículo
        </p>
      </div>

      {/* Status Card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
              isOnline ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-600" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-600" />
              )}
            </div>
            <div>
              <p className="font-semibold text-foreground">
                Rastreador {isOnline ? 'Online' : 'Offline'}
              </p>
              <p className="text-sm text-muted-foreground">
                Última atualização: {formatDateTime(tracker.ultima_comunicacao)}
              </p>
            </div>
          </div>
          <span className={`h-3 w-3 rounded-full ${
            isOnline ? 'animate-pulse bg-green-500' : 'bg-red-500'
          }`} />
        </CardContent>
      </Card>

      {/* Map Placeholder */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="flex h-64 items-center justify-center rounded-lg bg-muted">
            <div className="text-center">
              <MapPin className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                Mapa indisponível no momento
              </p>
              <p className="text-xs text-muted-foreground">
                Integração com mapa em desenvolvimento
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location Info */}
      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Navigation className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Última localização</p>
              {tracker.ultima_posicao_lat && tracker.ultima_posicao_lng ? (
                <p className="font-medium text-foreground">
                  Lat: {tracker.ultima_posicao_lat.toFixed(4)}, Lng: {tracker.ultima_posicao_lng.toFixed(4)}
                </p>
              ) : (
                <p className="font-medium text-muted-foreground">
                  Posição não disponível
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">Código</p>
              <p className="font-mono text-sm font-bold text-foreground">
                {tracker.codigo}
              </p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant={tracker.status === 'instalado' ? 'default' : 'secondary'}>
                {tracker.status === 'instalado' ? 'Instalado' : tracker.status}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Atualizado em {formatDateTime(tracker.ultima_comunicacao)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
