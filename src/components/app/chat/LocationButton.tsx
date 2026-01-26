import { useState } from 'react';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface LocationButtonProps {
  onLocationCapture: (latitude: number, longitude: number) => void;
  disabled?: boolean;
}

export function LocationButton({ onLocationCapture, disabled }: LocationButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetLocation = async () => {
    setIsLoading(true);
    setError(null);

    // Verificar se geolocalização é suportada
    if (!navigator.geolocation) {
      setError('Seu navegador não suporta geolocalização');
      setIsLoading(false);
      toast.error('Geolocalização não suportada');
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

      const { latitude, longitude } = position.coords;
      console.log('[LocationButton] Coordenadas capturadas:', latitude, longitude);
      
      // Chamar callback com as coordenadas
      onLocationCapture(latitude, longitude);
      
    } catch (err) {
      console.error('[LocationButton] Erro ao obter localização:', err);
      
      let errorMessage = 'Não foi possível obter sua localização';
      
      if (err instanceof GeolocationPositionError) {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = 'Permissão de localização negada. Por favor, permita o acesso à sua localização.';
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage = 'Localização indisponível. Verifique se o GPS está ativado.';
            break;
          case err.TIMEOUT:
            errorMessage = 'Tempo esgotado ao tentar obter localização.';
            break;
        }
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="my-2">
      <Button
        onClick={handleGetLocation}
        disabled={disabled || isLoading}
        variant="default"
        className="w-full gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Obtendo localização...
          </>
        ) : (
          <>
            <MapPin className="h-4 w-4" />
            📍 Usar minha localização
          </>
        )}
      </Button>
      
      {error && (
        <div className="flex items-center gap-2 mt-2 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
