import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, RefreshCw, CheckCircle2, AlertTriangle, Clock, Gauge, Power, PowerOff, Satellite } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useRastreadorTempoReal } from '@/hooks/useRastreadorPosicao';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons for Leaflet bundled
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function getMarkerIcon(ignicao: boolean) {
  const color = ignicao ? '#22c55e' : '#3b82f6';
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 32px; height: 32px; background: ${color};
        border: 3px solid white; border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        display:flex; align-items:center; justify-content:center;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="white" stroke-width="2"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
}

const FRESHNESS_LIMIT_MIN = 10; // minutos

interface VerificarSinalRastreadorProps {
  rastreadorId: string;
  imei?: string | null;
  confirmado: boolean;
  onConfirmar: (confirmado: boolean) => void;
}

export function VerificarSinalRastreador({
  rastreadorId,
  imei,
  confirmado,
  onConfirmar,
}: VerificarSinalRastreadorProps) {
  // Sem auto-refresh: a busca é manual (on-demand strategy)
  const { posicao, atualizarManual, isLoading } = useRastreadorTempoReal(rastreadorId, false);
  const [jaBuscou, setJaBuscou] = useState(false);

  // Dispara busca automática na primeira renderização para já mostrar tentativa
  useEffect(() => {
    if (!jaBuscou && rastreadorId) {
      setJaBuscou(true);
      atualizarManual.mutate(rastreadorId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rastreadorId]);

  // Quando muda o rastreador, reseta confirmação
  useEffect(() => {
    onConfirmar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rastreadorId]);

  const buscando = atualizarManual.isPending || isLoading;
  const hasPosition = !!(posicao?.latitude && posicao?.longitude);

  const idadeMin = posicao?.data_posicao
    ? (Date.now() - new Date(posicao.data_posicao).getTime()) / 60000
    : Infinity;
  const posicaoFresca = hasPosition && idadeMin <= FRESHNESS_LIMIT_MIN;

  const position: [number, number] = hasPosition
    ? [posicao!.latitude, posicao!.longitude]
    : [-15.7801, -47.9292];

  const podeConfirmar = posicaoFresca;

  return (
    <Card
      className={cn(
        'border-2',
        confirmado ? 'border-green-600 bg-slate-800' : 'border-amber-500 bg-slate-800'
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <Satellite className="h-5 w-5 text-blue-400" />
          Verificar Sinal do Rastreador
          {confirmado && <CheckCircle2 className="h-4 w-4 text-green-400" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-300">
          Confirme visualmente que o rastreador instalado está enviando sua posição.
          {imei && <span className="block text-slate-400 mt-1">IMEI: {imei}</span>}
        </p>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => atualizarManual.mutate(rastreadorId)}
            disabled={buscando}
            className="bg-blue-600 hover:bg-blue-700"
            size="sm"
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', buscando && 'animate-spin')} />
            {hasPosition ? 'Atualizar posição' : 'Buscar posição agora'}
          </Button>
          {hasPosition && (
            <Badge variant={posicaoFresca ? 'default' : 'secondary'}>
              {posicaoFresca ? '🟢 Sinal recente' : '🟡 Posição antiga'}
            </Badge>
          )}
        </div>

        {!hasPosition && !buscando && (
          <div className="rounded-md bg-amber-950/40 p-3 text-sm text-amber-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              Nenhuma posição recebida ainda. Aguarde alguns segundos e tente novamente.
              Verifique se o rastreador está ligado e com sinal.
            </div>
          </div>
        )}

        {hasPosition && (
          <>
            <div
              className="overflow-hidden rounded-md border border-slate-600"
              style={{ height: 280 }}
            >
              <MapContainer
                key={`${position[0]}-${position[1]}`}
                center={position}
                zoom={16}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  attribution="Tiles &copy; Esri"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
                <TileLayer url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png" />
                <Marker position={position} icon={getMarkerIcon(!!posicao?.ignicao)}>
                  <Popup>
                    <div className="text-sm">
                      <strong>Posição do veículo</strong>
                      <p className="mt-1">Velocidade: {posicao?.velocidade ?? 0} km/h</p>
                      <p>Ignição: {posicao?.ignicao ? 'Ligada' : 'Desligada'}</p>
                      {posicao?.endereco && (
                        <p className="mt-1 text-xs">{posicao.endereco}</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-md bg-slate-900/60 p-3 text-center">
              <div className="flex flex-col items-center gap-1">
                <Gauge className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-semibold text-white">{posicao?.velocidade ?? 0}</span>
                <span className="text-[10px] text-slate-400">km/h</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                {posicao?.ignicao ? (
                  <Power className="h-4 w-4 text-green-400" />
                ) : (
                  <PowerOff className="h-4 w-4 text-slate-400" />
                )}
                <span className="text-xs font-medium text-white">
                  {posicao?.ignicao ? 'Ligado' : 'Desligado'}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Clock className="h-4 w-4 text-orange-400" />
                <span className="text-[10px] text-white text-center leading-tight">
                  {posicao?.data_posicao
                    ? formatDistanceToNow(new Date(posicao.data_posicao), {
                        addSuffix: true,
                        locale: ptBR,
                      })
                    : '—'}
                </span>
              </div>
            </div>

            {posicao?.endereco && (
              <div className="flex items-start gap-2 rounded-md bg-slate-900/60 p-2 text-xs text-slate-300">
                <MapPin className="h-3.5 w-3.5 mt-0.5 text-blue-400 flex-shrink-0" />
                <span>{posicao.endereco}</span>
              </div>
            )}

            {!posicaoFresca && (
              <div className="rounded-md bg-amber-950/40 p-3 text-xs text-amber-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  A última posição é de mais de {FRESHNESS_LIMIT_MIN} minutos atrás.
                  Atualize para confirmar que o rastreador está comunicando agora.
                </div>
              </div>
            )}

            <div
              className={cn(
                'flex items-start gap-3 rounded-md border p-3',
                podeConfirmar
                  ? 'border-green-600 bg-green-950/30'
                  : 'border-slate-600 bg-slate-900/40 opacity-70'
              )}
            >
              <Checkbox
                id="confirma-posicao"
                checked={confirmado}
                disabled={!podeConfirmar}
                onCheckedChange={(v) => onConfirmar(!!v)}
                className="mt-0.5"
              />
              <Label
                htmlFor="confirma-posicao"
                className="text-sm text-white leading-snug cursor-pointer"
              >
                Confirmo que o pino do mapa corresponde à localização do veículo e que o
                rastreador está funcionando.
              </Label>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
