import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { MapPin, Navigation, Phone, Truck, Clock, CheckCircle, XCircle, Loader2, MapPinOff, AlertTriangle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Haversine
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

// Custom marker icons
const vehicleIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41] });
const driverIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png', shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41] });

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length >= 2) {
      map.fitBounds(positions as L.LatLngBoundsExpression, { padding: [40, 40] });
    }
  }, [positions, map]);
  return null;
}

type PageState = 'loading' | 'location_request' | 'location_denied' | 'details' | 'accepting' | 'waiting' | 'confirmed' | 'not_assigned' | 'expired' | 'cancelled' | 'already_assigned' | 'error';

const statusLabels: Record<string, string> = {
  a_caminho: '🚛 A caminho',
  chegou_local: '📍 Cheguei no local',
  veiculo_carregado: '🚛 Veículo carregado',
  chegou_destino: '📍 Cheguei no destino',
  concluido: '✅ Serviço concluído',
};

const progressStatuses = ['a_caminho', 'chegou_local', 'veiculo_carregado', 'chegou_destino', 'concluido'];

export default function DespachoReboquistaPublico() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>('loading');
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);
  const [myLat, setMyLat] = useState<number | null>(null);
  const [myLng, setMyLng] = useState<number | null>(null);
  const [distancia, setDistancia] = useState<number | null>(null);
  const [valorCalc, setValorCalc] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(600);
  const [submitting, setSubmitting] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<string[]>([]);
  const [trackingActive, setTrackingActive] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Consultar dados
  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const res = await publicSupabase.functions.invoke('despacho-reboque-consultar', {
        body: { token },
      });
      if (res.error) throw new Error(res.error.message);
      const d = res.data;
      if (!d.success) throw new Error(d.error);
      setData(d);

      if (d.status === 'cancelado') { setState('cancelled'); return; }
      if (d.status === 'expirado' || d.convite_status === 'expirado') { setState('expired'); return; }
      if (d.status === 'ja_atribuido' || d.convite_status === 'nao_atribuido') { setState('not_assigned'); return; }
      if (d.status === 'atribuido_a_mim') {
        setState('confirmed');
        setCurrentProgress(d.status_log?.map((s: any) => s.status) || ['a_caminho']);
        return;
      }
      if (d.convite_status === 'aceito' && d.despacho_status === 'aguardando') { setState('waiting'); return; }
      if (d.convite_status === 'recusado') { setState('expired'); return; }

      // Ainda pode aceitar
      if (myLat !== null) { setState('details'); }
      else { setState('location_request'); }
    } catch (e: any) {
      setError(e.message);
      setState('error');
    }
  }, [token, myLat]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Timer
  useEffect(() => {
    if (!data?.hora_limite || !['details', 'waiting'].includes(state)) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((new Date(data.hora_limite).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) { clearInterval(interval); fetchData(); }
    }, 1000);
    return () => clearInterval(interval);
  }, [data?.hora_limite, state, fetchData]);

  // Realtime polling (fallback)
  useEffect(() => {
    if (state !== 'waiting') return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [state, fetchData]);

  // Realtime subscription for confirmed state
  useEffect(() => {
    if (state !== 'confirmed' || !data?.chamado_id) return;
    const channel = publicSupabase
      .channel('despacho-status-' + data.chamado_id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'despacho_reboque_status_log', filter: `chamado_id=eq.${data.chamado_id}` }, (payload) => {
        setCurrentProgress((prev) => [...prev, payload.new.status]);
      })
      .subscribe();
    return () => { publicSupabase.removeChannel(channel); };
  }, [state, data?.chamado_id]);

  // Request location
  const requestLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMyLat(pos.coords.latitude);
        setMyLng(pos.coords.longitude);
        if (data?.veiculo_lat && data?.veiculo_lng) {
          const d = haversineKm(pos.coords.latitude, pos.coords.longitude, data.veiculo_lat, data.veiculo_lng);
          const dist = Math.round(d * 100) / 100;
          setDistancia(dist);
          const vs = data.valor_saida || 0;
          const vk = data.valor_km || 0;
          setValorCalc(Math.round((vs + vk * dist) * 100) / 100);
        }
        setState('details');
      },
      () => setState('location_denied'),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  // Accept
  const handleAccept = async () => {
    if (!myLat || !myLng) return;
    setSubmitting(true);
    try {
      const res = await publicSupabase.functions.invoke('despacho-reboque-responder', {
        body: { token, acao: 'aceitar', latitude: myLat, longitude: myLng },
      });
      if (res.error) throw new Error(res.error.message);
      if (!res.data.success) throw new Error(res.data.error);
      setDistancia(res.data.distancia_km);
      setValorCalc(res.data.valor_calculado);
      setState('waiting');
    } catch (e: any) {
      setError(e.message);
      setState('error');
    } finally {
      setSubmitting(false);
    }
  };

  // Refuse
  const handleRefuse = async () => {
    setSubmitting(true);
    try {
      await publicSupabase.functions.invoke('despacho-reboque-responder', {
        body: { token, acao: 'recusar', latitude: myLat || 0, longitude: myLng || 0 },
      });
      setState('expired');
    } catch { setState('expired'); }
    finally { setSubmitting(false); }
  };

  // Update progress status
  const handleStatusUpdate = async (status: string) => {
    try {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        await publicSupabase.functions.invoke('despacho-reboque-status', {
          body: { token, status, latitude: pos.coords.latitude, longitude: pos.coords.longitude },
        });
        setCurrentProgress((prev) => [...prev, status]);
      }, async () => {
        await publicSupabase.functions.invoke('despacho-reboque-status', {
          body: { token, status },
        });
        setCurrentProgress((prev) => [...prev, status]);
      });
    } catch (e) { console.error(e); }
  };

  // Start tracking
  const startTracking = useCallback(() => {
    if (trackingActive || !token) return;
    setTrackingActive(true);
    const id = navigator.geolocation.watchPosition(
      (pos) => { setMyLat(pos.coords.latitude); setMyLng(pos.coords.longitude); },
      () => setTrackingActive(false),
      { enableHighAccuracy: true }
    );
    watchIdRef.current = id;

    trackingIntervalRef.current = setInterval(async () => {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        await publicSupabase.functions.invoke('despacho-reboque-tracking', {
          body: { token, latitude: pos.coords.latitude, longitude: pos.coords.longitude, velocidade: pos.coords.speed ? pos.coords.speed * 3.6 : null, precisao: pos.coords.accuracy },
        }).catch(() => {});
      });
    }, 20000);
  }, [trackingActive, token]);

  useEffect(() => {
    if (state === 'confirmed') startTracking();
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (trackingIntervalRef.current) clearInterval(trackingIntervalRef.current);
    };
  }, [state, startTracking]);

  const timerMin = Math.floor(timeLeft / 60);
  const timerSec = timeLeft % 60;
  const timerPercent = data?.hora_limite ? Math.max(0, (timeLeft / 600) * 100) : 0;

  // ============ RENDERS ============

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Erro</h2>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <Clock className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">Prazo Expirado</h2>
        <p className="text-muted-foreground">O prazo para aceitar este chamado expirou.</p>
      </div>
    );
  }

  if (state === 'cancelled') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <XCircle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-bold mb-2">Chamado Cancelado</h2>
        <p className="text-muted-foreground">Este chamado foi cancelado.</p>
      </div>
    );
  }

  if (state === 'not_assigned' || state === 'already_assigned') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <Truck className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold mb-2">Chamado já aceito</h2>
        <p className="text-muted-foreground">Este chamado já foi aceito por outro prestador. Obrigado pelo interesse!</p>
      </div>
    );
  }

  if (state === 'location_request') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
        <MapPin className="h-20 w-20 text-blue-400 mb-6" />
        <h1 className="text-2xl font-bold mb-3">Ativação de Localização Obrigatória</h1>
        <p className="text-slate-300 mb-8 max-w-sm">
          Para participar deste chamado, precisamos da sua localização para calcular a distância e o valor do serviço.
        </p>
        <Button size="lg" onClick={requestLocation} className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6">
          <Navigation className="h-5 w-5 mr-2" />
          Ativar Localização
        </Button>
      </div>
    );
  }

  if (state === 'location_denied') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center text-white">
        <MapPinOff className="h-20 w-20 text-red-400 mb-6" />
        <h1 className="text-2xl font-bold mb-3">Localização Necessária</h1>
        <p className="text-slate-300 mb-8 max-w-sm">
          Não é possível participar do chamado sem ativar a localização. Verifique as configurações do seu navegador e tente novamente.
        </p>
        <Button size="lg" onClick={requestLocation} className="bg-blue-600 hover:bg-blue-700">
          Tentar Novamente
        </Button>
      </div>
    );
  }

  if (state === 'waiting') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Aceite Registrado!</h2>
        <p className="text-muted-foreground mb-6">
          Aguardando confirmação... O sistema está avaliando os aceites de outros prestadores.
        </p>
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground">
          ⏰ Tempo restante: {String(timerMin).padStart(2, '0')}:{String(timerSec).padStart(2, '0')}
        </p>
        {valorCalc && (
          <p className="text-lg font-bold mt-4">Seu valor: {formatCurrency(valorCalc)}</p>
        )}
      </div>
    );
  }

  if (state === 'confirmed') {
    const lastStatus = currentProgress[currentProgress.length - 1] || 'a_caminho';
    const isConcluido = lastStatus === 'concluido';

    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="bg-green-600 text-white p-6 text-center">
          <CheckCircle className="h-12 w-12 mx-auto mb-2" />
          <h1 className="text-2xl font-bold">CHAMADO CONFIRMADO!</h1>
          <p>Você foi selecionado para este reboque!</p>
        </div>

        <div className="p-4 space-y-4">
          {/* Tracking indicator */}
          <div className="flex items-center gap-2 justify-center">
            <div className={`h-3 w-3 rounded-full ${trackingActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-sm">{trackingActive ? '📡 Localização ativa' : '📡 Localização pausada'}</span>
          </div>
          {trackingActive && (
            <p className="text-xs text-center text-muted-foreground">⚠️ Mantenha esta página aberta</p>
          )}

          {/* Veículo */}
          {data?.veiculo && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Veículo</CardTitle></CardHeader>
              <CardContent>
                <p className="font-bold text-lg">{data.veiculo.marca} {data.veiculo.modelo}</p>
                <p className="font-mono text-lg">{data.veiculo.placa}</p>
                {data.veiculo.cor && <p className="text-sm text-muted-foreground">Cor: {data.veiculo.cor}</p>}
              </CardContent>
            </Card>
          )}

          {/* Associado */}
          {data?.associado && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Associado</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="font-medium">{data.associado.nome}</p>
                {data.associado.telefone && (
                  <Button variant="outline" className="w-full" asChild>
                    <a href={`tel:+55${data.associado.telefone.replace(/\D/g, '')}`}>
                      <Phone className="h-4 w-4 mr-2" /> Ligar para o associado
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Mapa */}
          {data?.veiculo_lat && data?.veiculo_lng && (
            <Card>
              <CardContent className="p-0 h-48 rounded-lg overflow-hidden">
                <MapContainer center={[data.veiculo_lat, data.veiculo_lng]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[data.veiculo_lat, data.veiculo_lng]} icon={vehicleIcon} />
                  {myLat && myLng && <Marker position={[myLat, myLng]} icon={driverIcon} />}
                  {myLat && myLng && (
                    <FitBounds positions={[[myLat, myLng], [data.veiculo_lat, data.veiculo_lng]]} />
                  )}
                  {myLat && myLng && (
                    <Polyline positions={[[myLat, myLng], [data.veiculo_lat, data.veiculo_lng]]} color="blue" dashArray="5 10" />
                  )}
                </MapContainer>
              </CardContent>
            </Card>
          )}

          {/* Google Maps */}
          {data?.veiculo_lat && data?.veiculo_lng && (
            <Button variant="outline" className="w-full" asChild>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${data.veiculo_lat},${data.veiculo_lng}`} target="_blank" rel="noopener noreferrer">
                🗺️ Abrir no Google Maps
              </a>
            </Button>
          )}

          {/* Progress buttons */}
          {!isConcluido && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Progresso</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {progressStatuses.map((s) => {
                  const done = currentProgress.includes(s);
                  const isNext = !done && (progressStatuses.indexOf(s) === 0 || currentProgress.includes(progressStatuses[progressStatuses.indexOf(s) - 1]));
                  return (
                    <Button
                      key={s}
                      variant={done ? 'secondary' : isNext ? 'default' : 'outline'}
                      className="w-full justify-start"
                      disabled={done || !isNext}
                      onClick={() => handleStatusUpdate(s)}
                    >
                      {done ? '✅' : ''} {statusLabels[s]}
                    </Button>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {isConcluido && (
            <div className="text-center p-6">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold">Serviço Concluído!</h2>
              <p className="text-muted-foreground">Obrigado pelo atendimento.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // STATE: details
  const valorSaida = data?.valor_saida || 0;
  const valorKm = data?.valor_km || 0;
  const valorDistancia = distancia ? valorKm * distancia : 0;

  return (
    <div className="min-h-screen bg-background pb-40">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4 text-center">
        <h1 className="text-lg font-bold">🚛 Chamado de Reboque</h1>
        <p className="text-sm opacity-90">PraticCar</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Timer */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">⏰ Tempo restante</span>
              <span className="font-mono font-bold text-lg">
                {String(timerMin).padStart(2, '0')}:{String(timerSec).padStart(2, '0')}
              </span>
            </div>
            <Progress value={timerPercent} className="h-2" />
          </CardContent>
        </Card>

        {/* Veículo */}
        {data?.veiculo && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">🚗 Veículo</CardTitle></CardHeader>
            <CardContent>
              <p className="font-bold">{data.veiculo.marca} {data.veiculo.modelo} {data.veiculo.ano && `(${data.veiculo.ano})`}</p>
              <p className="font-mono">{data.veiculo.placa}</p>
              {data.veiculo.cor && <p className="text-sm text-muted-foreground">Cor: {data.veiculo.cor}</p>}
            </CardContent>
          </Card>
        )}

        {/* Mapa */}
        {data?.veiculo_lat && data?.veiculo_lng && myLat && myLng && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">📍 Localização</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="h-48 rounded-lg overflow-hidden">
                <MapContainer center={[data.veiculo_lat, data.veiculo_lng]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[data.veiculo_lat, data.veiculo_lng]} icon={vehicleIcon} />
                  <Marker position={[myLat, myLng]} icon={driverIcon} />
                  <FitBounds positions={[[myLat, myLng], [data.veiculo_lat, data.veiculo_lng]]} />
                  <Polyline positions={[[myLat, myLng], [data.veiculo_lat, data.veiculo_lng]]} color="blue" dashArray="5 10" />
                </MapContainer>
              </div>
              <div className="flex justify-between text-sm">
                <span>📍 Distância: <strong>{distancia?.toFixed(1)} km</strong></span>
              </div>
              {data.endereco_veiculo && (
                <p className="text-sm text-muted-foreground">{data.endereco_veiculo}{data.endereco_cidade ? `, ${data.endereco_cidade}` : ''}{data.endereco_uf ? `/${data.endereco_uf}` : ''}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Valor */}
        {valorCalc !== null && (
          <Card className="border-2 border-green-500 bg-green-50 dark:bg-green-950/30">
            <CardContent className="pt-6 text-center">
              <p className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">VALOR DESTE SERVIÇO</p>
              <p className="text-4xl font-bold text-green-700 dark:text-green-400 mb-4">
                💰 {formatCurrency(valorCalc)}
              </p>
              <div className="text-sm text-muted-foreground space-y-1 text-left">
                <p>Saída: {formatCurrency(valorSaida)}</p>
                <p>Distância: {distancia?.toFixed(1)} km × {formatCurrency(valorKm)}/km = {formatCurrency(valorDistancia)}</p>
                <hr className="my-2" />
                <p className="font-medium">Total: {formatCurrency(valorSaida)} + {formatCurrency(valorDistancia)}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sticky bottom buttons */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t space-y-2 z-50">
        <Button
          size="lg"
          className="w-full bg-green-600 hover:bg-green-700 text-lg py-6"
          onClick={handleAccept}
          disabled={submitting || timeLeft <= 0}
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle className="h-5 w-5 mr-2" />}
          ACEITAR CHAMADO {valorCalc ? `— ${formatCurrency(valorCalc)}` : ''}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={handleRefuse}
          disabled={submitting}
        >
          RECUSAR
        </Button>
      </div>
    </div>
  );
}
