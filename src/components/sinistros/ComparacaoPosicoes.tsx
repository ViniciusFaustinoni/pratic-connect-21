import { useMemo } from 'react';
import { MapPin, Navigation, AlertTriangle, Check, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ComparacaoPosicoesProps {
  latitudeInformada?: number | null;
  longitudeInformada?: number | null;
  rastreadorLat?: number | null;
  rastreadorLng?: number | null;
  rastreadorCapturadoEm?: string | null;
  localOcorrencia?: string | null;
}

// Calcular distância em km usando fórmula de Haversine
function calcularDistanciaKm(
  lat1: number, 
  lng1: number, 
  lat2: number, 
  lng2: number
): number {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Classificar distância
function classificarDistancia(distanciaKm: number): {
  status: 'ok' | 'atencao' | 'suspeito';
  label: string;
  cor: string;
} {
  if (distanciaKm < 0.5) {
    return { status: 'ok', label: 'Posições próximas', cor: 'bg-green-100 text-green-800' };
  }
  if (distanciaKm < 2) {
    return { status: 'atencao', label: 'Pequena divergência', cor: 'bg-yellow-100 text-yellow-800' };
  }
  return { status: 'suspeito', label: 'Divergência significativa', cor: 'bg-red-100 text-red-800' };
}

export function ComparacaoPosicoes({
  latitudeInformada,
  longitudeInformada,
  rastreadorLat,
  rastreadorLng,
  rastreadorCapturadoEm,
  localOcorrencia,
}: ComparacaoPosicoesProps) {
  const analise = useMemo(() => {
    const temInformada = latitudeInformada != null && longitudeInformada != null;
    const temRastreador = rastreadorLat != null && rastreadorLng != null;

    if (!temInformada && !temRastreador) {
      return { tipo: 'sem_dados' as const };
    }

    if (!temRastreador) {
      return { 
        tipo: 'apenas_informada' as const, 
        lat: latitudeInformada!, 
        lng: longitudeInformada! 
      };
    }

    if (!temInformada) {
      return { 
        tipo: 'apenas_rastreador' as const, 
        lat: rastreadorLat!, 
        lng: rastreadorLng!,
        capturado: rastreadorCapturadoEm,
      };
    }

    // Ambas disponíveis - calcular distância
    const distancia = calcularDistanciaKm(
      latitudeInformada!, 
      longitudeInformada!, 
      rastreadorLat!, 
      rastreadorLng!
    );
    const classificacao = classificarDistancia(distancia);

    return {
      tipo: 'comparacao' as const,
      informada: { lat: latitudeInformada!, lng: longitudeInformada! },
      rastreador: { lat: rastreadorLat!, lng: rastreadorLng! },
      capturado: rastreadorCapturadoEm,
      distanciaKm: distancia,
      classificacao,
    };
  }, [latitudeInformada, longitudeInformada, rastreadorLat, rastreadorLng, rastreadorCapturadoEm]);

  const formatarCoordenada = (lat: number, lng: number) => {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  };

  if (analise.tipo === 'sem_dados') {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Navigation className="h-4 w-4" />
            Posições GPS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Nenhuma posição GPS registrada para este sinistro
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Navigation className="h-4 w-4" />
          Posições GPS - Evidência
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Posição informada pelo usuário */}
        {(analise.tipo === 'comparacao' || analise.tipo === 'apenas_informada') && (
          <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Informada pelo Usuário</span>
            </div>
            <code className="text-xs bg-background px-2 py-1 rounded">
              {formatarCoordenada(
                analise.tipo === 'comparacao' ? analise.informada.lat : analise.lat,
                analise.tipo === 'comparacao' ? analise.informada.lng : analise.lng
              )}
            </code>
          </div>
        )}

        {/* Posição do rastreador */}
        {(analise.tipo === 'comparacao' || analise.tipo === 'apenas_rastreador') && (
          <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-green-500" />
              <div>
                <span className="text-sm font-medium">Rastreador GPS</span>
                {analise.capturado && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {format(new Date(analise.capturado), "dd/MM HH:mm", { locale: ptBR })}
                  </div>
                )}
              </div>
            </div>
            <code className="text-xs bg-background px-2 py-1 rounded">
              {formatarCoordenada(
                analise.tipo === 'comparacao' ? analise.rastreador.lat : analise.lat,
                analise.tipo === 'comparacao' ? analise.rastreador.lng : analise.lng
              )}
            </code>
          </div>
        )}

        {/* Comparação */}
        {analise.tipo === 'comparacao' && (
          <div className={`flex items-center justify-between p-3 rounded-md border ${
            analise.classificacao.status === 'ok' 
              ? 'border-green-200 bg-green-50' 
              : analise.classificacao.status === 'atencao'
                ? 'border-yellow-200 bg-yellow-50'
                : 'border-red-200 bg-red-50'
          }`}>
            <div className="flex items-center gap-2">
              {analise.classificacao.status === 'ok' ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className={`h-4 w-4 ${
                  analise.classificacao.status === 'atencao' ? 'text-yellow-600' : 'text-red-600'
                }`} />
              )}
              <div>
                <span className={`text-sm font-medium ${
                  analise.classificacao.status === 'ok' 
                    ? 'text-green-800' 
                    : analise.classificacao.status === 'atencao'
                      ? 'text-yellow-800'
                      : 'text-red-800'
                }`}>
                  {analise.classificacao.label}
                </span>
                <p className="text-xs text-muted-foreground">
                  Distância entre posições
                </p>
              </div>
            </div>
            <Badge className={analise.classificacao.cor}>
              {analise.distanciaKm < 1 
                ? `${Math.round(analise.distanciaKm * 1000)}m` 
                : `${analise.distanciaKm.toFixed(1)}km`}
            </Badge>
          </div>
        )}

        {/* Local de ocorrência informado */}
        {localOcorrencia && (
          <div className="text-xs text-muted-foreground pt-2 border-t">
            <span className="font-medium">Local informado:</span> {localOcorrencia}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
