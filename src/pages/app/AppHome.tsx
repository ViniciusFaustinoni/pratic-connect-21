import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Car, 
  ReceiptText, 
  MapPin, 
  Phone,
  Wifi,
  WifiOff,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AppHome() {
  const { profile } = useAuth();
  const firstName = profile?.nome?.split(' ')[0] || 'Associado';

  // Mock data - will be replaced with real data
  const vehicle = {
    placa: 'ABC-1234',
    modelo: 'Fiat Uno 1.0',
    marca: 'Fiat',
  };

  const nextPayment = {
    valor: 189.90,
    vencimento: new Date(2026, 0, 15),
    diasRestantes: 13,
  };

  const trackerStatus = {
    online: true,
    ultimaComunicacao: new Date(),
  };

  return (
    <div className="space-y-4 p-4">
      {/* Welcome */}
      <div className="flex items-center gap-2">
        <span className="text-2xl">👋</span>
        <h1 className="text-xl font-bold text-foreground">Olá, {firstName}!</h1>
      </div>

      {/* Vehicle Card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Car className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold tracking-wider text-foreground">
              {vehicle.placa}
            </p>
            <p className="text-sm text-muted-foreground">
              {vehicle.marca} {vehicle.modelo}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </CardContent>
      </Card>

      {/* Next Payment Card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
                <Calendar className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Próximo vencimento</p>
                <p className="text-xl font-bold text-foreground">
                  R$ {nextPayment.valor.toFixed(2).replace('.', ',')}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
              Vence em {nextPayment.diasRestantes} dias
            </Badge>
          </div>
          <Button asChild className="mt-3 w-full" variant="outline">
            <Link to="/app/boletos">
              <ReceiptText className="mr-2 h-4 w-4" />
              Ver Boletos
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Tracker Status Card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            {trackerStatus.online ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <Wifi className="h-5 w-5 text-green-600" />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <WifiOff className="h-5 w-5 text-red-600" />
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Rastreador</p>
              <p className={`font-semibold ${trackerStatus.online ? 'text-green-600' : 'text-red-600'}`}>
                {trackerStatus.online ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${trackerStatus.online ? 'animate-pulse bg-green-500' : 'bg-red-500'}`} />
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        <Link to="/app/boletos">
          <Card className="border-0 shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col items-center gap-2 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <ReceiptText className="h-6 w-6 text-primary" />
              </div>
              <span className="text-center text-xs font-medium text-foreground">
                Boletos
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link to="/app/rastreamento">
          <Card className="border-0 shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col items-center gap-2 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <span className="text-center text-xs font-medium text-foreground">
                Rastrear
              </span>
            </CardContent>
          </Card>
        </Link>

        <Link to="/app/assistencia">
          <Card className="border-0 shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col items-center gap-2 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <Phone className="h-6 w-6 text-destructive" />
              </div>
              <span className="text-center text-xs font-medium text-foreground">
                Assistência
              </span>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Emergency Button */}
      <Card className="border-0 bg-destructive/5 shadow-sm">
        <CardContent className="p-4">
          <Button asChild variant="destructive" className="w-full">
            <Link to="/app/assistencia">
              <Phone className="mr-2 h-4 w-4" />
              Assistência 24h
            </Link>
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Guincho, chaveiro, pane seca e mais
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
