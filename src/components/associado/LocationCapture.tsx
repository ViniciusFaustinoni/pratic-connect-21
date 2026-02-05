import { useState, useEffect } from 'react';
import { MapPin, Loader2, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export interface Coordenadas {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface LocationCaptureProps {
  onLocationCapture: (coords: Coordenadas) => void;
  coordenadas?: Coordenadas | null;
  disabled?: boolean;
}

export function LocationCapture({ onLocationCapture, coordenadas, disabled }: LocationCaptureProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Capturar localização automaticamente ao montar
  useEffect(() => {
    if (!coordenadas && !disabled) {
      handleGetLocation();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGetLocation = async () => {
    setIsLoading(true);
    setError(null);
    setPermissionDenied(false);

    // Verificar se geolocalização é suportada
    if (!navigator.geolocation) {
      setError('Seu navegador não suporta geolocalização. Use um navegador moderno.');
      setIsLoading(false);
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 0,
          }
        );
      });

      const { latitude, longitude, accuracy } = position.coords;
      console.log('[LocationCapture] Coordenadas capturadas:', { latitude, longitude, accuracy });
      
      onLocationCapture({ latitude, longitude, accuracy });
      setError(null);
      
    } catch (err) {
      console.error('[LocationCapture] Erro ao obter localização:', err);
      
      let errorMessage = 'Não foi possível obter sua localização';
      
      if (err instanceof GeolocationPositionError) {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = 'Você precisa permitir o acesso à localização para continuar a autovistoria.';
            setPermissionDenied(true);
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage = 'Localização indisponível. Verifique se o GPS está ativado no seu dispositivo.';
            break;
          case err.TIMEOUT:
            errorMessage = 'Tempo esgotado ao tentar obter localização. Tente novamente.';
            break;
        }
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Se já tem coordenadas, mostrar sucesso
  if (coordenadas) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-green-700 dark:text-green-400">Localização Capturada</p>
              <p className="text-xs text-muted-foreground truncate">
                {coordenadas.latitude.toFixed(6)}, {coordenadas.longitude.toFixed(6)}
                {coordenadas.accuracy && ` (±${Math.round(coordenadas.accuracy)}m)`}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleGetLocation}
              disabled={isLoading || disabled}
              className="flex-shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Se está carregando
  if (isLoading) {
    return (
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            </div>
            <div>
              <p className="font-medium text-blue-700 dark:text-blue-400">Obtendo localização...</p>
              <p className="text-xs text-muted-foreground">Por favor, aguarde e permita o acesso ao GPS</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Se tem erro ou não tem coordenadas
  return (
    <div className="space-y-3">
      {error && (
        <Alert variant={permissionDenied ? "destructive" : "default"}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{permissionDenied ? "Localização Obrigatória" : "Atenção"}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <Card className="border-orange-500/30 bg-orange-500/5">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                <MapPin className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-orange-700 dark:text-orange-400">Localização Obrigatória</p>
                <p className="text-xs text-muted-foreground">
                  Precisamos da sua localização para validar a autovistoria
                </p>
              </div>
            </div>
            
            <Button 
              onClick={handleGetLocation}
              disabled={isLoading || disabled}
              className="w-full"
            >
              <MapPin className="h-4 w-4 mr-2" />
              {permissionDenied ? 'Permitir Localização' : 'Capturar Localização'}
            </Button>
            
            {permissionDenied && (
              <p className="text-xs text-muted-foreground text-center">
                Caso tenha negado anteriormente, acesse as configurações do seu navegador para permitir o acesso à localização.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
