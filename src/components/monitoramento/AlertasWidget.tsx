import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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
};

const severidadeConfig: Record<string, { bg: string; text: string; border: string }> = {
  critica: { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/30" },
  alta: { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-300" },
  media: { bg: "bg-warning/10", text: "text-warning", border: "border-warning/30" },
  baixa: { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-300" },
};

// =====================================================
// TIPOS
// =====================================================

interface Alerta {
  id: string;
  rastreador_id: string;
  tipo: string;
  severidade: string;
  mensagem: string;
  dados: Record<string, unknown>;
  status: string;
  created_at: string;
  rastreador_codigo: string;
  placa: string | null;
  associado_nome: string | null;
  associado_telefone: string | null;
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

interface AlertasWidgetProps {
  limite?: number;
  mostrarTodos?: boolean;
}

export function AlertasWidget({ limite = 10, mostrarTodos = false }: AlertasWidgetProps) {
  const queryClient = useQueryClient();

  // Query para buscar alertas
  const { data: alertas, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["alertas-ativos", limite],
    queryFn: async () => {
      let query = supabase
        .from("view_alertas_ativos")
        .select("*")
        .order("created_at", { ascending: false });

      if (!mostrarTodos) {
        query = query.limit(limite);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Alerta[];
    },
    refetchInterval: 60000, // Atualizar a cada minuto
  });

  // Query para contagem
  const { data: contagem } = useQuery({
    queryKey: ["alertas-contagem"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_alertas_contagem");
      if (error) throw error;
      return (data?.[0] || { abertos: 0, visualizados: 0, criticos: 0, total: 0 }) as Contagem;
    },
    refetchInterval: 60000,
  });

  // Mutation: Marcar como visualizado
  const marcarVisualizado = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("rastreador_alertas")
        .update({ status: "visualizado" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertas-ativos"] });
      queryClient.invalidateQueries({ queryKey: ["alertas-contagem"] });
    },
  });

  // Mutation: Marcar como tratado
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
      queryClient.invalidateQueries({ queryKey: ["alertas-ativos"] });
      queryClient.invalidateQueries({ queryKey: ["alertas-contagem"] });
    },
    onError: (error: Error) => {
      toast.error("Erro: " + error.message);
    },
  });

  // Mutation: Ignorar alerta
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
      queryClient.invalidateQueries({ queryKey: ["alertas-ativos"] });
      queryClient.invalidateQueries({ queryKey: ["alertas-contagem"] });
    },
  });

  // Abrir WhatsApp
  const abrirWhatsApp = (telefone: string | null) => {
    if (!telefone) {
      toast.error("Telefone não cadastrado");
      return;
    }
    const numero = telefone.replace(/\D/g, "");
    window.open(`https://wa.me/55${numero}`, "_blank");
  };

  // Contadores
  const totalAbertos = contagem?.abertos || 0;
  const totalCriticos = contagem?.criticos || 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-5 w-5 text-primary" />
            Alertas
            {totalAbertos > 0 && (
              <Badge variant="destructive" className="ml-1">
                {totalAbertos} {totalAbertos === 1 ? "novo" : "novos"}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => window.location.href = "/monitoramento/alertas"}
            >
              Ver todos
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* Contadores de severidade */}
        {totalCriticos > 0 && (
          <div className="flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="h-3 w-3" />
            {totalCriticos} alerta(s) crítico(s)
          </div>
        )}
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          {isLoading ? (
            // Loading
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 rounded-lg border p-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : !alertas || alertas.length === 0 ? (
            // Sem alertas
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BellOff className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-2 text-sm font-medium text-muted-foreground">Nenhum alerta ativo</p>
              <p className="text-xs text-muted-foreground">Todos os rastreadores estão OK</p>
            </div>
          ) : (
            // Lista de alertas
            <div className="space-y-3">
              {alertas.map((alerta) => {
                const tipo = tipoConfig[alerta.tipo] || tipoConfig.sem_comunicacao;
                const severidade = severidadeConfig[alerta.severidade] || severidadeConfig.media;
                const TipoIcon = tipo.icon;

                return (
                  <div
                    key={alerta.id}
                    className={`flex gap-3 rounded-lg border p-3 ${severidade.border} ${severidade.bg}`}
                  >
                    {/* Ícone */}
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${severidade.bg}`}>
                      <TipoIcon className={`h-4 w-4 ${severidade.text}`} />
                    </div>

                    {/* Conteúdo */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {alerta.placa || alerta.rastreador_codigo}
                        </span>
                        <Badge variant="outline" className={`text-xs ${severidade.text}`}>
                          {alerta.severidade}
                        </Badge>
                        {alerta.status === "aberto" && (
                          <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground truncate">
                        {alerta.associado_nome || "Sem associado"}
                      </p>

                      <p className="text-xs mt-1">{alerta.mensagem}</p>

                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(alerta.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>

                    {/* Ações */}
                    <div className="flex flex-col gap-1">
                      <TooltipProvider>
                        {/* WhatsApp */}
                        {alerta.associado_telefone && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => abrirWhatsApp(alerta.associado_telefone)}
                              >
                                <Phone className="h-3.5 w-3.5 text-green-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>WhatsApp</TooltipContent>
                          </Tooltip>
                        )}

                        {/* Marcar visualizado */}
                        {alerta.status === "aberto" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => marcarVisualizado.mutate(alerta.id)}
                                disabled={marcarVisualizado.isPending}
                              >
                                <Eye className="h-3.5 w-3.5 text-blue-600" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Marcar como visto</TooltipContent>
                          </Tooltip>
                        )}

                        {/* Marcar tratado */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => marcarTratado.mutate(alerta.id)}
                              disabled={marcarTratado.isPending}
                            >
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Marcar como tratado</TooltipContent>
                        </Tooltip>

                        {/* Ignorar */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => ignorarAlerta.mutate(alerta.id)}
                              disabled={ignorarAlerta.isPending}
                            >
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Ignorar</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
