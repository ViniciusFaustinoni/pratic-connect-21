import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  RefreshCw, 
  Webhook, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock,
  Activity,
  Link2,
  Link2Off,
  Car,
  Trash2,
  Signal
} from "lucide-react";
import { useSoftruckEventos, useEstatisticasWebhooks, useReprocessarEvento, type SoftruckEvento } from "@/hooks/useSoftruckEventos";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const TIPOS_EVENTO = [
  { value: "all", label: "Todos os eventos" },
  { value: "DEVICES.ASSOCIATED", label: "Device Associado" },
  { value: "DEVICES.DISASSOCIATED", label: "Device Desassociado" },
  { value: "VEHICLES.CREATED", label: "Veículo Criado" },
  { value: "VEHICLES.DELETED", label: "Veículo Removido" },
  { value: "DEVICE-EVENTS", label: "Eventos de Device" },
];

function getEventoIcon(tipo: string) {
  switch (tipo.toUpperCase()) {
    case "DEVICES.ASSOCIATED":
      return <Link2 className="h-4 w-4 text-green-500" />;
    case "DEVICES.DISASSOCIATED":
      return <Link2Off className="h-4 w-4 text-red-500" />;
    case "VEHICLES.CREATED":
      return <Car className="h-4 w-4 text-blue-500" />;
    case "VEHICLES.DELETED":
      return <Trash2 className="h-4 w-4 text-red-500" />;
    case "DEVICE-EVENTS":
    case "DEVICE_EVENTS":
      return <Signal className="h-4 w-4 text-yellow-500" />;
    default:
      return <Activity className="h-4 w-4 text-muted-foreground" />;
  }
}

function getSeveridadeBadge(evento: SoftruckEvento) {
  if (evento.erro_processamento) {
    return <Badge variant="destructive" className="text-xs">Erro</Badge>;
  }
  if (evento.alerta_gerado) {
    return <Badge variant="default" className="bg-orange-500 text-xs">Alerta</Badge>;
  }
  if (evento.processado) {
    return <Badge variant="secondary" className="text-xs">OK</Badge>;
  }
  return <Badge variant="outline" className="text-xs">Pendente</Badge>;
}

function EventoCard({ evento }: { evento: SoftruckEvento }) {
  const [expanded, setExpanded] = useState(false);
  const reprocessar = useReprocessarEvento();

  const handleReprocessar = async () => {
    try {
      await reprocessar.mutateAsync(evento.id);
      toast.success("Evento reprocessado com sucesso");
    } catch (error) {
      toast.error("Erro ao reprocessar evento");
    }
  };

  return (
    <div 
      className="border rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {getEventoIcon(evento.evento_tipo)}
          <span className="font-medium text-sm truncate">{evento.evento_tipo}</span>
          {getSeveridadeBadge(evento)}
        </div>
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(new Date(evento.created_at), { 
            addSuffix: true, 
            locale: ptBR 
          })}
        </div>
      </div>

      {evento.placa && (
        <div className="mt-1 text-xs text-muted-foreground">
          Placa: <span className="font-medium">{evento.placa}</span>
        </div>
      )}

      {evento.imei && (
        <div className="text-xs text-muted-foreground">
          IMEI: <span className="font-mono">{evento.imei}</span>
        </div>
      )}

      {expanded && (
        <div className="mt-3 space-y-2 text-xs">
          <div className="bg-muted rounded p-2">
            <div className="font-medium mb-1">Payload:</div>
            <pre className="overflow-auto max-h-40 text-[10px]">
              {JSON.stringify(evento.payload, null, 2)}
            </pre>
          </div>

          <div className="flex items-center justify-between text-muted-foreground">
            <span>IP: {evento.ip_origem || "N/A"}</span>
            <span>{format(new Date(evento.created_at), "dd/MM/yyyy HH:mm:ss")}</span>
          </div>

          {evento.erro_processamento && (
            <div className="bg-destructive/10 text-destructive rounded p-2">
              <div className="font-medium">Erro:</div>
              <div>{evento.erro_processamento}</div>
            </div>
          )}

          {!evento.processado && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={(e) => {
                e.stopPropagation();
                handleReprocessar();
              }}
              disabled={reprocessar.isPending}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${reprocessar.isPending ? 'animate-spin' : ''}`} />
              Reprocessar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function SoftruckWebhooksPanel() {
  const [tipoFiltro, setTipoFiltro] = useState("all");
  const queryClient = useQueryClient();

  const { data: eventos, isLoading: loadingEventos } = useSoftruckEventos({
    limite: 50,
    tipoEvento: tipoFiltro === "all" ? undefined : tipoFiltro,
  });

  const { data: stats, isLoading: loadingStats } = useEstatisticasWebhooks();

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ["softruck-eventos"] });
    toast.success("Dados atualizados");
  };

  const webhookUrl = `https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/softruck-webhook`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Webhooks Softruck</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={refreshData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
        </div>
        <CardDescription>
          Recebimento de eventos em tempo real da plataforma Softruck
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats Grid */}
        {loadingStats ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-muted rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="bg-muted rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.processados}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <CheckCircle className="h-3 w-3" /> Processados
              </div>
            </div>
            <div className="bg-muted rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-600">{stats.erros}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <XCircle className="h-3 w-3" /> Erros
              </div>
            </div>
            <div className="bg-muted rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.alertasGerados}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Alertas
              </div>
            </div>
            <div className="bg-muted rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.ultimas24h}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" /> Últimas 24h
              </div>
            </div>
          </div>
        )}

        <Tabs defaultValue="eventos">
          <TabsList>
            <TabsTrigger value="eventos">Eventos</TabsTrigger>
            <TabsTrigger value="config">Configuração</TabsTrigger>
          </TabsList>

          <TabsContent value="eventos" className="space-y-3 mt-3">
            {/* Filter */}
            <div className="flex items-center gap-2">
              <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_EVENTO.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Events List */}
            <ScrollArea className="h-[400px]">
              {loadingEventos ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : eventos && eventos.length > 0 ? (
                <div className="space-y-2 pr-3">
                  {eventos.map((evento) => (
                    <EventoCard key={evento.id} evento={evento} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <Webhook className="h-8 w-8 mb-2 opacity-50" />
                  <p>Nenhum evento recebido</p>
                  <p className="text-xs">Configure o webhook no painel Softruck</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="config" className="space-y-4 mt-3">
            <div className="rounded-lg border p-4 space-y-3">
              <h4 className="font-medium">URL do Webhook</h4>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted p-2 rounded text-xs font-mono break-all">
                  {webhookUrl}
                </code>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    toast.success("URL copiada!");
                  }}
                >
                  Copiar
                </Button>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <h4 className="font-medium">Eventos Suportados</h4>
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-green-500" />
                  <span className="font-mono text-xs">DEVICES.ASSOCIATED</span>
                  <span className="text-muted-foreground">- Dispositivo vinculado</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link2Off className="h-4 w-4 text-red-500" />
                  <span className="font-mono text-xs">DEVICES.DISASSOCIATED</span>
                  <span className="text-muted-foreground">- Dispositivo desvinculado</span>
                </div>
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-blue-500" />
                  <span className="font-mono text-xs">VEHICLES.CREATED</span>
                  <span className="text-muted-foreground">- Veículo criado</span>
                </div>
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-red-500" />
                  <span className="font-mono text-xs">VEHICLES.DELETED</span>
                  <span className="text-muted-foreground">- Veículo removido</span>
                </div>
                <div className="flex items-center gap-2">
                  <Signal className="h-4 w-4 text-yellow-500" />
                  <span className="font-mono text-xs">device-events</span>
                  <span className="text-muted-foreground">- Status do dispositivo</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">Configuração no Painel Softruck</p>
                  <p className="text-amber-700 dark:text-amber-300 mt-1">
                    Para receber eventos, configure a URL do webhook no painel administrativo 
                    da Softruck e selecione os eventos desejados.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
