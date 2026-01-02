import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useMyVehicles, useMyVehicleWithTracker } from '@/hooks/useMyData';
import { 
  Car, 
  ReceiptText, 
  MapPin, 
  Phone,
  Wifi,
  WifiOff,
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AppHome() {
  const { profile } = useAuth();
  const { data: vehicles, isLoading: vehiclesLoading } = useMyVehicles();
  const { data: tracker, isLoading: trackerLoading } = useMyVehicleWithTracker();
  
  const firstName = profile?.nome?.split(' ')[0] || 'Associado';
  const vehicle = vehicles?.[0];
  const isOnline = tracker?.status === 'instalado' && tracker?.ultima_comunicacao;

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
          {vehiclesLoading ? (
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : vehicle ? (
            <div className="flex-1">
              <p className="text-2xl font-bold tracking-wider text-foreground">
                {vehicle.placa}
              </p>
              <p className="text-sm text-muted-foreground">
                {vehicle.marca} {vehicle.modelo}
              </p>
            </div>
          ) : (
            <div className="flex-1">
              <p className="font-medium text-foreground">Nenhum veículo</p>
              <p className="text-sm text-muted-foreground">
                Veículo não cadastrado
              </p>
            </div>
          )}
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </CardContent>
      </Card>

      {/* Tracker Status Card */}
      <Card className="border-0 shadow-sm">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            {trackerLoading ? (
              <>
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </>
            ) : tracker ? (
              <>
                {isOnline ? (
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
                  <p className={`font-semibold ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                    {isOnline ? 'Online' : 'Offline'}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <WifiOff className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rastreador</p>
                  <p className="font-semibold text-muted-foreground">Não instalado</p>
                </div>
              </>
            )}
          </div>
          {tracker && (
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${isOnline ? 'animate-pulse bg-green-500' : 'bg-red-500'}`} />
            </div>
          )}
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
