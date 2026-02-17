import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { format, subHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

interface TrajetoLocalCardProps {
  veiculoId: string;
  dataOcorrencia: string | null;
  horasAnteriores?: number;
}

const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export function TrajetoLocalCard({ veiculoId, dataOcorrencia, horasAnteriores = 4 }: TrajetoLocalCardProps) {
  // 1. Buscar rastreador_id do veículo
  const rastreadorQuery = useQuery({
    queryKey: ['trajeto-local-rastreador', veiculoId],
    queryFn: async () => {
      const { data } = await supabase
        .from('rastreadores')
        .select('id')
        .eq('veiculo_id', veiculoId)
        .eq('status', 'instalado')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.id as string | null;
    },
    enabled: !!veiculoId,
  });

  // 2. Buscar posições do rastreador
  const posicoesQuery = useQuery({
    queryKey: ['trajeto-local-posicoes', rastreadorQuery.data, dataOcorrencia, horasAnteriores],
    queryFn: async () => {
      const rastreadorId = rastreadorQuery.data!;
      const dataRef = dataOcorrencia ? new Date(dataOcorrencia) : new Date();
      const dataInicio = subHours(dataRef, horasAnteriores).toISOString();
      const dataFim = dataRef.toISOString();

      const { data, error } = await supabase
        .from('rastreador_posicoes')
        .select('latitude, longitude, velocidade, data_posicao')
        .eq('rastreador_id', rastreadorId)
        .gte('data_posicao', dataInicio)
        .lte('data_posicao', dataFim)
        .order('data_posicao', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!rastreadorQuery.data,
  });

  const posicoes = posicoesQuery.data || [];

  const stats = useMemo(() => {
    if (!posicoes.length) return null;
    const velocidades = posicoes.filter(p => p.velocidade != null).map(p => p.velocidade!);
    const velMedia = velocidades.length ? velocidades.reduce((a, b) => a + b, 0) / velocidades.length : 0;
    const velMax = velocidades.length ? Math.max(...velocidades) : 0;
    return { velMedia, velMax, totalPontos: posicoes.length };
  }, [posicoes]);

  const polylinePoints = useMemo(() => 
    posicoes.map(p => [p.latitude, p.longitude] as [number, number]),
    [posicoes]
  );

  const isLoading = rastreadorQuery.isLoading || posicoesQuery.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando trajeto...</span>
      </div>
    );
  }

  if (!rastreadorQuery.data) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <AlertTriangle className="h-4 w-4" />
        Nenhum rastreador instalado neste veículo.
      </div>
    );
  }

  if (!posicoes.length) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <AlertTriangle className="h-4 w-4" />
        Sem dados de posição nas últimas {horasAnteriores}h antes do evento.
      </div>
    );
  }

  const primeiro = posicoes[0];
  const ultimo = posicoes[posicoes.length - 1];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{stats?.totalPontos} pontos</Badge>
        <Badge variant="outline">Vel. média: {stats?.velMedia.toFixed(0)} km/h</Badge>
        <Badge variant="outline">Vel. máx: {stats?.velMax.toFixed(0)} km/h</Badge>
      </div>

      <div className="h-64 rounded-lg overflow-hidden border">
        <MapContainer
          center={[ultimo.latitude, ultimo.longitude]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          
          <Polyline positions={polylinePoints} pathOptions={{ color: '#3B82F6', weight: 3 }} />
          
          <Marker position={[primeiro.latitude, primeiro.longitude]} icon={startIcon}>
            <Popup>
              <div className="text-xs">
                <p className="font-semibold">Início do trajeto</p>
                <p>{format(new Date(primeiro.data_posicao), "dd/MM HH:mm", { locale: ptBR })}</p>
                {primeiro.velocidade != null && <p>{primeiro.velocidade} km/h</p>}
              </div>
            </Popup>
          </Marker>

          <Marker position={[ultimo.latitude, ultimo.longitude]} icon={endIcon}>
            <Popup>
              <div className="text-xs">
                <p className="font-semibold">Fim do trajeto</p>
                <p>{format(new Date(ultimo.data_posicao), "dd/MM HH:mm", { locale: ptBR })}</p>
                {ultimo.velocidade != null && <p>{ultimo.velocidade} km/h</p>}
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      <p className="text-xs text-muted-foreground">
        Trajeto de {format(new Date(primeiro.data_posicao), "dd/MM HH:mm", { locale: ptBR })} até{' '}
        {format(new Date(ultimo.data_posicao), "dd/MM HH:mm", { locale: ptBR })}
      </p>
    </div>
  );
}
