import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MapContainer, TileLayer, Polyline, Marker, Popup, CircleMarker } from 'react-leaflet';
import { PolylineOSRM } from '@/components/mapa/PolylineOSRM';
import L from 'leaflet';
import { format, subHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Route, MapPin, Clock, Loader2, AlertTriangle, Maximize2, Car } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SalvarTrajetoButton } from './SalvarTrajetoButton';
import { ExportarTrajetoPDF } from './ExportarTrajetoPDF';
import { ConsultaTrajetoAvancada } from './ConsultaTrajetoAvancada';
import 'leaflet/dist/leaflet.css';

interface TrajetoColisaoCardProps {
  veiculoId: string;
  dataOcorrencia: string | null;
  localOcorrencia?: string | null;
  sinistroId?: string;
  snapshotExistente?: boolean;
  protocolo?: string;
  veiculo?: { placa: string; marca: string; modelo: string } | null;
  associado?: { nome: string } | null;
}

interface PontoParada {
  latitude: number;
  longitude: number;
  inicio: string;
  fim: string;
  duracao_minutos: number;
  endereco?: string;
}

// Ícone para local da colisão
const colisaoIcon = L.divIcon({
  className: 'colisao-marker',
  html: `<div style="width: 24px; height: 24px; background: #ef4444; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center;">
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path>
      <circle cx="7" cy="17" r="2"></circle>
      <circle cx="17" cy="17" r="2"></circle>
    </svg>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Ícone para parada
const paradaIcon = L.divIcon({
  className: 'parada-marker',
  html: `<div style="width: 12px; height: 12px; background: #f59e0b; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

export function TrajetoColisaoCard({ 
  veiculoId, 
  dataOcorrencia, 
  localOcorrencia,
  sinistroId,
  snapshotExistente = false,
  protocolo,
  veiculo,
  associado,
}: TrajetoColisaoCardProps) {
  const [fullscreenOpen, setFullscreenOpen] = useState(false);

  // Calcular período de 4h antes do sinistro (específico para colisão)
  const dataFim = dataOcorrencia ? new Date(dataOcorrencia) : new Date();
  const dataInicio = subHours(dataFim, 4);

  // Buscar rastreador do veículo
  const { data: rastreador } = useQuery({
    queryKey: ['veiculo-rastreador-colisao', veiculoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rastreadores')
        .select('id, codigo, plataforma')
        .eq('veiculo_id', veiculoId)
        .eq('status', 'instalado')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!veiculoId,
  });

  // Buscar histórico de trajeto (4h)
  const { data: historico, isLoading, error } = useQuery({
    queryKey: ['trajeto-colisao', rastreador?.id, dataInicio.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('rastreador-historico', {
        body: {
          rastreador_id: rastreador!.id,
          data_inicio: dataInicio.toISOString(),
          data_fim: dataFim.toISOString(),
        },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      return data;
    },
    enabled: !!rastreador?.id,
  });

  const trajeto = historico?.trajeto || [];
  const paradas: PontoParada[] = historico?.paradas || [];
  const polylinePositions = trajeto.map((p: any) => [p.latitude, p.longitude] as [number, number]);

  // Última posição conhecida (aproximação do local da colisão)
  const ultimaPosicao = trajeto.length > 0 ? trajeto[trajeto.length - 1] : null;

  const renderMap = (height: string) => (
    <MapContainer
      center={ultimaPosicao ? [ultimaPosicao.latitude, ultimaPosicao.longitude] : [-15.7801, -47.9292]}
      zoom={14}
      style={{ height, width: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {polylinePositions.length > 0 && (
        <>
          {/* Linha do trajeto com rota real */}
          <PolylineOSRM
            positions={polylinePositions}
            color="#ef4444" weight={3} opacity={0.8}
          />

          {/* Marcadores de parada */}
          {paradas.map((parada, idx) => (
            <Marker
              key={`parada-${idx}`}
              position={[parada.latitude, parada.longitude]}
              icon={paradaIcon}
            >
              <Popup>
                <div className="text-sm">
                  <strong className="text-amber-600">⏸ Parada</strong>
                  <p>{parada.duracao_minutos} minutos</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(parada.inicio), 'HH:mm', { locale: ptBR })} - {format(new Date(parada.fim), 'HH:mm', { locale: ptBR })}
                  </p>
                  {parada.endereco && <p className="text-xs mt-1">{parada.endereco}</p>}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Marcador do local da colisão (última posição) */}
          {ultimaPosicao && (
            <Marker
              position={[ultimaPosicao.latitude, ultimaPosicao.longitude]}
              icon={colisaoIcon}
            >
              <Popup>
                <div className="text-sm">
                  <strong className="text-red-600">🚗 Local da Colisão</strong>
                  <p>{format(new Date(ultimaPosicao.data_posicao), "dd/MM HH:mm", { locale: ptBR })}</p>
                  {localOcorrencia && <p className="text-xs mt-1">{localOcorrencia}</p>}
                </div>
              </Popup>
            </Marker>
          )}

          {/* Início do trajeto */}
          {trajeto.length > 1 && (
            <CircleMarker
              center={polylinePositions[0]}
              radius={6}
              pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1 }}
            >
              <Popup>
                <div className="text-sm">
                  <strong className="text-green-600">Início (4h antes)</strong>
                  <p>{format(new Date(trajeto[0].data_posicao), "dd/MM HH:mm", { locale: ptBR })}</p>
                </div>
              </Popup>
            </CircleMarker>
          )}
        </>
      )}
    </MapContainer>
  );

  if (!rastreador) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Car className="h-4 w-4 text-red-500" />
            Trajeto - 4h Antes da Colisão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Veículo sem rastreador instalado. Não é possível exibir o trajeto.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="h-4 w-4 text-red-500" />
              Trajeto - 4h Antes da Colisão
            </CardTitle>
            {trajeto.length > 0 && (
              <Button variant="ghost" size="icon" onClick={() => setFullscreenOpen(true)}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {format(dataInicio, "dd/MM HH:mm", { locale: ptBR })} - {format(dataFim, "dd/MM HH:mm", { locale: ptBR })}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Erro ao carregar trajeto</AlertDescription>
              </Alert>
            </div>
          ) : trajeto.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum trajeto encontrado no período</p>
              {historico?.mensagem && (
                <p className="text-xs mt-2">{historico.mensagem}</p>
              )}
            </div>
          ) : (
            <>
              {renderMap('200px')}
              <div className="p-3 border-t space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{trajeto.length} pontos</Badge>
                    {paradas.length > 0 && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                        {paradas.length} parada{paradas.length > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <Badge variant={historico?.fonte === 'api' ? 'default' : 'outline'}>
                    {historico?.fonte === 'api' ? '🟢 API' : '🟡 Local'}
                  </Badge>
                </div>
                {/* Botões de ação */}
                {sinistroId && rastreador && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <SalvarTrajetoButton
                      sinistroId={sinistroId}
                      rastreadorId={rastreador.id}
                      dataInicio={dataInicio}
                      dataFim={dataFim}
                      snapshotExistente={snapshotExistente}
                    />
                    <ExportarTrajetoPDF
                      protocolo={protocolo || sinistroId}
                      veiculo={veiculo}
                      associado={associado}
                      dataOcorrencia={dataOcorrencia || new Date().toISOString()}
                      localOcorrencia={localOcorrencia}
                      trajeto={trajeto}
                      paradas={paradas}
                    />
                    <ConsultaTrajetoAvancada
                      rastreadorId={rastreador.id}
                      dataOcorrencia={dataOcorrencia || new Date().toISOString()}
                      veiculoPlaca={veiculo?.placa}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal Fullscreen */}
      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent className="max-w-4xl h-[80vh] p-0 gap-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-red-500" />
              Trajeto Completo - 4h Antes da Colisão
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 p-4">
            {renderMap('calc(80vh - 120px)')}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
