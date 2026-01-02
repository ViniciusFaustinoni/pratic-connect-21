import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Clock, Wifi } from 'lucide-react';

export default function AppRastreamento() {
  // Mock data
  const trackerData = {
    online: true,
    ultimaPosicao: {
      lat: -23.5505,
      lng: -46.6333,
      endereco: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
      dataHora: new Date(),
    },
    velocidade: 0,
    ignicao: false,
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

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
              trackerData.online ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <Wifi className={`h-5 w-5 ${
                trackerData.online ? 'text-green-600' : 'text-red-600'
              }`} />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                Rastreador {trackerData.online ? 'Online' : 'Offline'}
              </p>
              <p className="text-sm text-muted-foreground">
                Última atualização: {formatDateTime(trackerData.ultimaPosicao.dataHora)}
              </p>
            </div>
          </div>
          <span className={`h-3 w-3 rounded-full ${
            trackerData.online ? 'animate-pulse bg-green-500' : 'bg-red-500'
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
              <p className="font-medium text-foreground">
                {trackerData.ultimaPosicao.endereco}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">Velocidade</p>
              <p className="text-lg font-bold text-foreground">
                {trackerData.velocidade} km/h
              </p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs text-muted-foreground">Ignição</p>
              <Badge variant={trackerData.ignicao ? 'default' : 'secondary'}>
                {trackerData.ignicao ? 'Ligada' : 'Desligada'}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Atualizado em {formatDateTime(trackerData.ultimaPosicao.dataHora)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
