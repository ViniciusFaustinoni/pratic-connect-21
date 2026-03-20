import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle,
  Bell,
  BellOff,
  Check,
  Eye,
  Phone,
  RefreshCw,
  Radio,
  Battery,
  Gauge,
  MapPin,
  X,
  ShieldAlert,
  Car,
  Wrench,
  UserCheck,
  Link2,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import { LucideIcon } from "lucide-react";

// =====================================================
// CONFIGURAÇÃO DE TIPOS E CORES
// =====================================================

const tipoConfig: Record<string, { icon: LucideIcon; label: string }> = {
  sem_comunicacao: { icon: Radio, label: "Sem Comunicação" },
  bateria_baixa: { icon: Battery, label: "Bateria Baixa" },
  velocidade_alta: { icon: Gauge, label: "Velocidade Alta" },
  fora_cerca: { icon: MapPin, label: "Fora da Cerca" },
  panico: { icon: AlertTriangle, label: "Pânico" },
  violacao: { icon: AlertTriangle, label: "Violação" },
  desinstalacao: { icon: Unlink, label: "Desinstalação" },
  offline: { icon: Radio, label: "Offline" },
  veiculo_removido: { icon: Car, label: "Veículo Removido" },
  veiculo_criado: { icon: Car, label: "Veículo Criado" },
  os_atualizada: { icon: Wrench, label: "OS Atualizada" },
  os_concluida: { icon: Check, label: "OS Concluída" },
  os_removida: { icon: X, label: "OS Removida" },
  os_reaberta: { icon: Wrench, label: "OS Reaberta" },
  prestador_atualizado: { icon: UserCheck, label: "Prestador Atualizado" },
  ciencia_os: { icon: Eye, label: "Ciência de OS" },
  device_associado: { icon: Link2, label: "Device Associado" },
  device_atualizado: { icon: Link2, label: "Device Atualizado" },
  device_desassociado: { icon: Unlink, label: "Device Desassociado" },
};

const severidadeConfig: Record<string, { bg: string; text: string; border: string; label: string }> = {
  critica: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/30", label: "Crítica" },
  alta: { bg: "bg-orange-100 dark:bg-orange-900/20", text: "text-orange-800 dark:text-orange-300", border: "border-orange-300 dark:border-orange-700", label: "Alta" },
  media: { bg: "bg-warning/10", text: "text-warning", border: "border-warning/30", label: "Média" },
  baixa: { bg: "bg-blue-100 dark:bg-blue-900/20", text: "text-blue-800 dark:text-blue-300", border: "border-blue-300 dark:border-blue-700", label: "Baixa" },
};

// =====================================================
// TIPOS
// =====================================================

interface Alerta {
  id: string;
  rastreador_id: string | null;
  tipo: string;
  severidade: string;
  mensagem: string;
  dados: Record<string, unknown>;
  status: string;
  created_at: string;
  rastreador_codigo: string | null;
  placa: string | null;
  associado_nome: string | null;
  associado_telefone: string | null;
  associado_id: string | null;
  veiculo_id: string | null;
  horas_aberto: number;
}

interface Contagem {
  abertos: number;
  visualizados: number;
  criticos: number;
  total: number;
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export default function AlertasMonitoramento() {
  const queryClient = useQueryClient();
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroSeveridade, setFiltroSeveridade] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");

  // Query alertas
  const { data: alertas, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["alertas-monitoramento", mostrarTodos, filtroTipo, filtroSeveridade, filtroStatus],
    queryFn: async () => {
      // Buscar da view para alertas ativos ou direto da tabela para todos
      if (!mostrarTodos) {
        let query = supabase
          .from("view_alertas_ativos")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);

        if (filtroTipo !== "todos") query = query.eq("tipo", filtroTipo);
        if (filtroSeveridade !== "todos") query = query.eq("severidade", filtroSeveridade);
        if (filtroStatus !== "todos") query = query.eq("status", filtroStatus);

        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as Alerta[];
      } else {
        let query = supabase
          .from("rastreador_alertas")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);

        if (filtroTipo !== "todos") query = query.eq("tipo", filtroTipo);
        if (filtroSeveridade !== "todos") query = query.eq("severidade", filtroSeveridade);
        if (filtroStatus !== "todos") query = query.eq("status", filtroStatus);

        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as unknown as Alerta[];
      }
    },
    refetchInterval: 30000,
  });

  // Contagem
  const { data: contagem } = useQuery({
    queryKey: ["alertas-contagem"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_alertas_contagem");
      if (error) throw error;
      return (data?.[0] || { abertos: 0, visualizados: 0, criticos: 0, total: 0 }) as Contagem;
    },
    refetchInterval: 30000,
  });

  // Mutations
  const marcarVisualizado = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("rastreador_alertas")
        .update({ status: "visualizado" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertas-monitoramento"] });
      queryClient.invalidateQueries({ queryKey: ["alertas-contagem"] });
    },
  });

  const marcarTratado = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("rastreador_alertas")
        .update({
          status: "tratado",
          tratado_por: user?.id,
          tratado_em: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alerta marcado como tratado");
      queryClient.invalidateQueries({ queryKey: ["alertas-monitoramento"] });
      queryClient.invalidateQueries({ queryKey: ["alertas-contagem"] });
    },
    onError: (error: Error) => toast.error("Erro: " + error.message),
  });

  const ignorarAlerta = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("rastreador_alertas")
        .update({
          status: "ignorado",
          tratado_por: user?.id,
          tratado_em: new Date().toISOString(),
          observacao_tratamento: "Ignorado pelo operador",
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alerta ignorado");
      queryClient.invalidateQueries({ queryKey: ["alertas-monitoramento"] });
      queryClient.invalidateQueries({ queryKey: ["alertas-contagem"] });
    },
  });

  const abrirWhatsApp = (telefone: string | null) => {
    if (!telefone) {
      toast.error("Telefone não cadastrado");
      return;
    }
    const numero = telefone.replace(/\D/g, "");
    window.open(`https://wa.me/55${numero}`, "_blank");
  };

  const totalAbertos = contagem?.abertos || 0;
  const totalCriticos = contagem?.criticos || 0;
  const totalVisualizados = contagem?.visualizados || 0;
  const totalGeral = contagem?.total || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" />
            Alertas de Monitoramento
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Todos os alertas recebidos via webhook e monitoramento automático
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <ShieldAlert className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalAbertos}</p>
                <p className="text-xs text-muted-foreground">Abertos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCriticos}</p>
                <p className="text-xs text-muted-foreground">Críticos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                <Eye className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalVisualizados}</p>
                <p className="text-xs text-muted-foreground">Visualizados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalGeral}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="filtro-tipo" className="text-sm whitespace-nowrap">Tipo:</Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger id="filtro-tipo" className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {Object.entries(tipoConfig).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="filtro-severidade" className="text-sm whitespace-nowrap">Severidade:</Label>
              <Select value={filtroSeveridade} onValueChange={setFiltroSeveridade}>
                <SelectTrigger id="filtro-severidade" className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas</SelectItem>
                  {Object.entries(severidadeConfig).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="filtro-status" className="text-sm whitespace-nowrap">Status:</Label>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger id="filtro-status" className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="aberto">Aberto</SelectItem>
                  <SelectItem value="visualizado">Visualizado</SelectItem>
                  <SelectItem value="tratado">Tratado</SelectItem>
                  <SelectItem value="ignorado">Ignorado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Switch
                id="mostrar-todos"
                checked={mostrarTodos}
                onCheckedChange={setMostrarTodos}
              />
              <Label htmlFor="mostrar-todos" className="text-sm">Mostrar tratados/ignorados</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de alertas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {alertas?.length || 0} alerta(s) encontrado(s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100dvh-480px)] min-h-[300px]">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex gap-3 rounded-lg border p-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !alertas || alertas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BellOff className="h-16 w-16 text-muted-foreground/30" />
                <p className="mt-4 text-lg font-medium text-muted-foreground">Nenhum alerta encontrado</p>
                <p className="text-sm text-muted-foreground">Ajuste os filtros ou aguarde novos alertas</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alertas.map((alerta) => {
                  const tipo = tipoConfig[alerta.tipo] || { icon: Bell, label: alerta.tipo };
                  const severidade = severidadeConfig[alerta.severidade] || severidadeConfig.media;
                  const TipoIcon = tipo.icon;
                  const isTratado = alerta.status === "tratado" || alerta.status === "ignorado";

                  return (
                    <div
                      key={alerta.id}
                      className={`flex gap-4 rounded-lg border p-4 transition-colors ${severidade.border} ${severidade.bg} ${isTratado ? "opacity-60" : ""}`}
                    >
                      {/* Ícone */}
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${severidade.bg}`}>
                        <TipoIcon className={`h-5 w-5 ${severidade.text}`} />
                      </div>

                      {/* Conteúdo */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">
                            {alerta.placa || alerta.rastreador_codigo || "Sem identificação"}
                          </span>
                          <Badge variant="outline" className={`text-xs ${severidade.text}`}>
                            {severidade.label}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {tipo.label}
                          </Badge>
                          {alerta.status === "aberto" && (
                            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                          )}
                          {isTratado && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              {alerta.status}
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground mt-0.5">
                          {alerta.associado_nome || "Sem associado"}
                        </p>

                        <p className="text-sm mt-1">{alerta.mensagem}</p>

                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(alerta.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>

                      {/* Ações */}
                      {!isTratado && (
                        <div className="flex flex-col gap-1">
                          <TooltipProvider>
                            {alerta.associado_telefone && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => abrirWhatsApp(alerta.associado_telefone)}
                                  >
                                    <Phone className="h-4 w-4 text-green-600" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>WhatsApp</TooltipContent>
                              </Tooltip>
                            )}

                            {alerta.status === "aberto" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => marcarVisualizado.mutate(alerta.id)}
                                    disabled={marcarVisualizado.isPending}
                                  >
                                    <Eye className="h-4 w-4 text-blue-600" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Marcar como visto</TooltipContent>
                              </Tooltip>
                            )}

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => marcarTratado.mutate(alerta.id)}
                                  disabled={marcarTratado.isPending}
                                >
                                  <Check className="h-4 w-4 text-green-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Marcar como tratado</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => ignorarAlerta.mutate(alerta.id)}
                                  disabled={ignorarAlerta.isPending}
                                >
                                  <X className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ignorar</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
