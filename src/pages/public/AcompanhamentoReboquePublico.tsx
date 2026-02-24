import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Phone, Truck, MapPin, Clock, CheckCircle, ChevronDown, Loader2, XCircle, AlertTriangle, Car } from 'lucide-react';
import MapaRastreamentoReboque from '@/components/assistencia/MapaRastreamentoReboque';
import { useConfig0800 } from '@/hooks/useConfig0800';
import { cn } from '@/lib/utils';

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

interface StatusLogEntry {
  id: string;
  status: string;
  created_at: string;
  observacao?: string;
}

const statusLabelMap: Record<string, { label: string; emoji: string; desc: string }> = {
  a_caminho: { label: 'A caminho', emoji: '🚛', desc: 'O reboquista está indo até o seu veículo' },
  chegou_local: { label: 'No local', emoji: '📍', desc: 'O reboquista chegou ao local' },
  veiculo_carregado: { label: 'Veículo no guincho', emoji: '🚛', desc: 'Seu veículo está sendo transportado' },
  chegou_destino: { label: 'Chegou ao destino', emoji: '🏁', desc: 'Seu veículo foi entregue' },
  concluido: { label: 'Concluído', emoji: '✅', desc: 'Serviço finalizado com sucesso' },
};

const timelineSteps = ['a_caminho', 'chegou_local', 'veiculo_carregado', 'chegou_destino', 'concluido'];

function formatTime(dt: string) {
  return new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function AcompanhamentoReboquePublico() {
  const { token } = useParams<{ token: string }>();
  const { telefone0800, telefone0800Link } = useConfig0800();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [distanciaKm, setDistanciaKm] = useState<number | null>(null);
  const [tempoMin, setTempoMin] = useState<number | null>(null);
  const [statusLog, setStatusLog] = useState<StatusLogEntry[]>([]);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const channelRef = useRef<any>(null);

  // Fetch data
  useEffect(() => {
    if (!token) return;
    const fetchData = async () => {
      try {
        const url = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/acompanhamento-reboque-consultar`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          body: JSON.stringify({ token }),
        });
        const json = await res.json();
        if (!json.success) {
          setError(json.error || 'Erro ao carregar');
        } else {
          setData(json);
          setStatusLog(json.status_log || []);
        }
      } catch {
        setError('Erro de conexão');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  // Realtime for status updates
  useEffect(() => {
    if (!data?.chamado_id) return;

    const channel = publicSupabase
      .channel(`acomp-status-${data.chamado_id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'despacho_reboque_status_log',
        filter: `chamado_id=eq.${data.chamado_id}`,
      }, (payload: any) => {
        setStatusLog(prev => [...prev, payload.new]);
      })
      .subscribe();

    channelRef.current = channel;
    return () => { publicSupabase.removeChannel(channel); };
  }, [data?.chamado_id]);

  const currentStatus = statusLog.length > 0 ? statusLog[statusLog.length - 1]?.status : 'a_caminho';
  const statusInfo = statusLabelMap[currentStatus] || statusLabelMap.a_caminho;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <p className="font-semibold">{error === 'Link inválido' ? 'Link inválido' : 'Erro'}</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data?.status === 'expirado') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
            <p className="font-semibold">Link expirado</p>
            <p className="text-sm text-muted-foreground">Este link de acompanhamento expirou. Acesse o App Pratic para acompanhar seu chamado.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data?.status === 'cancelado') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="pt-8 pb-6 space-y-4">
            <XCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="font-semibold">Chamado cancelado</p>
            <p className="text-sm text-muted-foreground">Este chamado de assistência foi cancelado.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Concluído → show summary
  if (data?.status === 'concluido' || currentStatus === 'concluido') {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 bg-primary text-primary-foreground px-4 py-3 text-center">
          <p className="text-sm font-semibold">✅ Serviço Concluído</p>
        </header>
        <div className="p-4 space-y-4">
          <Card>
            <CardContent className="pt-6 text-center space-y-3">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
              <p className="text-xl font-bold">Serviço concluído!</p>
              {data.prestador?.nome && <p className="text-sm text-muted-foreground">Prestador: {data.prestador.nome}</p>}
              {data.veiculo && <p className="text-sm text-muted-foreground">{data.veiculo.marca} {data.veiculo.modelo} — {data.veiculo.placa}</p>}
              {data.destino?.endereco && <p className="text-sm text-muted-foreground">Destino: {data.destino.endereco}</p>}
              <p className="text-xs text-muted-foreground mt-4">Obrigado por usar a Pratic Car!</p>
            </CardContent>
          </Card>

          <TimelineComponent steps={timelineSteps} statusLog={statusLog} currentStatus={currentStatus} open={true} />

          <Footer telefone0800={telefone0800} telefone0800Link={telefone0800Link} />
        </div>
      </div>
    );
  }

  // Active tracking
  const posVeiculo = data.veiculo_lat && data.veiculo_lng ? { lat: data.veiculo_lat, lng: data.veiculo_lng } : null;
  const posDestino = data.destino?.lat && data.destino?.lng ? { lat: data.destino.lat, lng: data.destino.lng } : null;
  const showDestino = currentStatus === 'veiculo_carregado' || currentStatus === 'chegou_destino';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-primary text-primary-foreground px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs opacity-80">Pratic Car</p>
            <p className="text-sm font-semibold">Acompanhe seu Reboque</p>
          </div>
          <Badge variant="secondary" className={cn("text-xs", currentStatus !== 'concluido' && "animate-pulse")}>
            {statusInfo.emoji} {statusInfo.label}
          </Badge>
        </div>
      </header>

      {/* Map (60% of viewport) */}
      <div className="flex-shrink-0">
        <MapaRastreamentoReboque
          chamadoId={data.chamado_id}
          posicaoVeiculo={posVeiculo}
          posicaoDestino={showDestino ? posDestino : null}
          nomeReboquista={data.prestador?.nome}
          telefoneReboquista={data.prestador?.telefone}
          altura="55vh"
          expandivel
          isPublic
          onPosicaoAtualizada={({ distanciaKm: d, tempoEstimadoMin: t }) => {
            setDistanciaKm(Math.round(d * 10) / 10);
            setTempoMin(t);
          }}
        />
      </div>

      {/* Info card */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Truck className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{statusInfo.desc}</p>
                {data.prestador?.nome && (
                  <p className="text-xs text-muted-foreground">Prestador: {data.prestador.nome}</p>
                )}
              </div>
            </div>

            {/* Distance / ETA */}
            {distanciaKm !== null && tempoMin !== null && currentStatus === 'a_caminho' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted rounded-lg p-3 text-center">
                  <MapPin className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-lg font-bold">{distanciaKm} km</p>
                  <p className="text-xs text-muted-foreground">Distância</p>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <Clock className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-lg font-bold">{tempoMin > 0 ? `~${tempoMin}` : '< 1'} min</p>
                  <p className="text-xs text-muted-foreground">Chegada estimada</p>
                </div>
              </div>
            )}

            {distanciaKm !== null && distanciaKm < 1 && currentStatus === 'a_caminho' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <p className="text-sm font-semibold text-green-700">🚛 Quase lá!</p>
              </div>
            )}

            {/* Call button */}
            {data.prestador?.telefone && (
              <Button
                className="w-full gap-2"
                variant="outline"
                onClick={() => window.location.href = `tel:${data.prestador.telefone}`}
              >
                <Phone className="h-4 w-4" />
                Ligar para o reboquista
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Vehicle info */}
        {data.veiculo && (
          <Card>
            <CardContent className="flex items-center gap-3 py-3">
              <Car className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">{data.veiculo.placa}</p>
                <p className="text-xs text-muted-foreground">{data.veiculo.marca} {data.veiculo.modelo}{data.veiculo.cor ? ` • ${data.veiculo.cor}` : ''}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        <TimelineComponent steps={timelineSteps} statusLog={statusLog} currentStatus={currentStatus} open={timelineOpen} onToggle={() => setTimelineOpen(!timelineOpen)} />

        <Footer telefone0800={telefone0800} telefone0800Link={telefone0800Link} />
      </div>
    </div>
  );
}

function TimelineComponent({ steps, statusLog, currentStatus, open, onToggle }: {
  steps: string[];
  statusLog: StatusLogEntry[];
  currentStatus: string;
  open: boolean;
  onToggle?: () => void;
}) {
  const currentIndex = steps.indexOf(currentStatus);
  const statusTimes: Record<string, string> = {};
  statusLog.forEach(s => { if (!statusTimes[s.status]) statusTimes[s.status] = s.created_at; });

  return (
    <Collapsible open={open} onOpenChange={onToggle}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <CardContent className="flex items-center justify-between py-3">
            <p className="font-medium text-sm">Histórico do atendimento</p>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            <div className="space-y-3">
              {steps.map((step, i) => {
                const info = statusLabelMap[step];
                const isDone = i < currentIndex;
                const isCurrent = i === currentIndex;
                const time = statusTimes[step];

                return (
                  <div key={step} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "h-6 w-6 rounded-full flex items-center justify-center text-xs flex-shrink-0",
                        isDone && "bg-green-500 text-white",
                        isCurrent && "bg-primary text-primary-foreground animate-pulse",
                        !isDone && !isCurrent && "bg-muted text-muted-foreground"
                      )}>
                        {isDone ? '✓' : info?.emoji || '○'}
                      </div>
                      {i < steps.length - 1 && <div className="w-0.5 h-4 bg-border mt-1" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm", (isDone || isCurrent) ? "font-medium" : "text-muted-foreground")}>
                        {info?.label || step}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {time ? formatTime(time) : '—:—'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function Footer({ telefone0800, telefone0800Link }: { telefone0800: string; telefone0800Link: string }) {
  return (
    <div className="text-center py-4 space-y-2">
      <p className="text-xs text-muted-foreground">Central de Assistência</p>
      <a href={`tel:${telefone0800Link}`} className="text-sm font-semibold text-primary">
        📞 {telefone0800}
      </a>
      <p className="text-xs text-muted-foreground">Em caso de emergência, ligue para a central</p>
    </div>
  );
}
