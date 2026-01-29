import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Car, MapPin, RefreshCw, Clock, AlertCircle, 
  CheckCircle, Truck, Wrench, Phone 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom vehicle icon
const veiculoIcon = new L.DivIcon({
  html: `<div class="flex items-center justify-center w-12 h-12 bg-blue-500 rounded-full border-3 border-white shadow-xl animate-pulse">
    <svg class="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
    </svg>
  </div>`,
  className: 'custom-marker',
  iconSize: [48, 48],
  iconAnchor: [24, 48],
});

const statusConfig: Record<string, { icon: React.ElementType; label: string; cor: string }> = {
  aberto: { icon: Clock, label: 'Aguardando', cor: 'bg-yellow-500' },
  aguardando_prestador: { icon: Phone, label: 'Acionando Prestador', cor: 'bg-orange-500' },
  prestador_despachado: { icon: Truck, label: 'Despachado', cor: 'bg-blue-500' },
  prestador_a_caminho: { icon: Truck, label: 'A Caminho', cor: 'bg-blue-600' },
  em_atendimento: { icon: Wrench, label: 'Em Atendimento', cor: 'bg-purple-500' },
  concluido: { icon: CheckCircle, label: 'Concluído', cor: 'bg-green-500' },
};

// Auto-update map position component
function AutoUpdateMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, map]);
  return null;
}

export default function TrackingAssistencia() {
  const { id } = useParams<{ id: string }>();
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Query para buscar dados do chamado (público, sem autenticação)
  const { data: chamado, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['tracking-chamado', id],
    queryFn: async () => {
      // Buscar chamado básico
      const { data: chamadoData, error: chamadoError } = await supabase
        .from('chamados_assistencia')
        .select(`
          id, protocolo, status, tipo_servico,
          origem_endereco, origem_lat, origem_lng,
          rastreador_lat, rastreador_lng, rastreador_posicao_capturada_em, rastreador_endereco,
          prestador_nome, prestador_telefone,
          data_abertura,
          veiculo:veiculos(id, placa, marca, modelo)
        `)
        .eq('id', id!)
        .maybeSingle();

      if (chamadoError) throw chamadoError;
      if (!chamadoData) throw new Error('Chamado não encontrado');

      // Se tem veículo, tentar buscar posição atualizada do rastreador
      let posicaoAtualizada = null;
      if (chamadoData.veiculo?.id) {
        try {
          const { data: posicaoResult } = await supabase.functions.invoke('posicao-veiculo', {
            body: { veiculo_id: chamadoData.veiculo.id },
          });
          if (posicaoResult?.success && posicaoResult?.posicao) {
            posicaoAtualizada = posicaoResult.posicao;
          }
        } catch {
          // Ignora erro - usa posição salva
        }
      }

      setLastUpdate(new Date());

      return {
        ...chamadoData,
        posicaoTempoReal: posicaoAtualizada,
      };
    },
    enabled: !!id,
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  // Determinar posição a exibir (prioridade: tempo real > salva > origem)
  const posicaoLat = chamado?.posicaoTempoReal?.latitude ?? chamado?.rastreador_lat ?? chamado?.origem_lat;
  const posicaoLng = chamado?.posicaoTempoReal?.longitude ?? chamado?.rastreador_lng ?? chamado?.origem_lng;
  const velocidade = chamado?.posicaoTempoReal?.velocidade ?? 0;
  const ignicao = chamado?.posicaoTempoReal?.ignicao ?? false;
  const endereco = chamado?.posicaoTempoReal?.endereco ?? chamado?.rastreador_endereco ?? chamado?.origem_endereco;

  const temPosicaoTempoReal = !!chamado?.posicaoTempoReal;
  const statusInfo = chamado?.status ? statusConfig[chamado.status] : null;
  const StatusIcon = statusInfo?.icon || Clock;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-4">
        <div className="max-w-lg mx-auto space-y-4">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (!chamado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="pt-6">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Chamado não encontrado</h2>
            <p className="text-muted-foreground">
              O link pode ter expirado ou o chamado foi cancelado.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!posicaoLat || !posicaoLng) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-yellow-100 flex items-center justify-center p-4">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="pt-6">
            <MapPin className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Localização indisponível</h2>
            <p className="text-muted-foreground">
              Não foi possível obter a posição do veículo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('h-10 w-10 rounded-full flex items-center justify-center text-white', statusInfo?.cor || 'bg-gray-500')}>
              <StatusIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">{chamado.protocolo}</p>
              <p className="text-xs text-muted-foreground">{statusInfo?.label}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={cn('h-4 w-4 mr-1', isRefetching && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {/* Status Badge */}
        <div className="flex items-center justify-center gap-2">
          {temPosicaoTempoReal ? (
            <Badge className="bg-green-500 animate-pulse">📡 Posição em Tempo Real</Badge>
          ) : chamado.rastreador_lat ? (
            <Badge variant="secondary">📍 Última Posição Conhecida</Badge>
          ) : (
            <Badge variant="outline">📍 Localização Informada</Badge>
          )}
        </div>

        {/* Mapa */}
        <Card className="overflow-hidden">
          <div className="h-80">
            <MapContainer
              center={[posicaoLat, posicaoLng]}
              zoom={15}
              className="h-full w-full"
              zoomControl={true}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={[posicaoLat, posicaoLng]} icon={veiculoIcon}>
                <Popup>
                  <div className="text-center">
                    <p className="font-semibold flex items-center justify-center gap-1">
                      <Car className="h-4 w-4" />
                      {chamado.veiculo?.placa || 'Veículo'}
                    </p>
                    {chamado.veiculo && (
                      <p className="text-xs text-muted-foreground">
                        {chamado.veiculo.marca} {chamado.veiculo.modelo}
                      </p>
                    )}
                    {velocidade > 0 && (
                      <p className="text-sm mt-1">🚗 {velocidade} km/h</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {ignicao ? '🟢 Motor ligado' : '🔴 Motor desligado'}
                    </p>
                  </div>
                </Popup>
              </Marker>
              <AutoUpdateMap lat={posicaoLat} lng={posicaoLng} />
            </MapContainer>
          </div>
        </Card>

        {/* Informações */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Informações do Atendimento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-muted-foreground">Veículo</p>
                <p className="font-medium">{chamado.veiculo?.placa || 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Velocidade</p>
                <p className="font-medium">{velocidade} km/h</p>
              </div>
              <div>
                <p className="text-muted-foreground">Motor</p>
                <p className="font-medium">{ignicao ? 'Ligado' : 'Desligado'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Atualizado</p>
                <p className="font-medium">{format(lastUpdate, 'HH:mm:ss', { locale: ptBR })}</p>
              </div>
            </div>

            {endereco && (
              <div className="pt-2 border-t">
                <p className="text-muted-foreground">Endereço</p>
                <p className="font-medium">{endereco}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Botão abrir no Google Maps */}
        <Button
          className="w-full"
          onClick={() => window.open(`https://www.google.com/maps?q=${posicaoLat},${posicaoLng}`, '_blank')}
        >
          <MapPin className="h-4 w-4 mr-2" />
          Abrir no Google Maps
        </Button>

        {/* Footer */}
        <p className="text-xs text-center text-muted-foreground">
          Atualização automática a cada 30 segundos
        </p>
      </div>
    </div>
  );
}
