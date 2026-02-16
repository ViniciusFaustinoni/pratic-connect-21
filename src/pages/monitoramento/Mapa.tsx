import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, CircleMarker } from "react-leaflet";
import L from "leaflet";
import { format, formatDistanceToNow, subHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Search,
  Car,
  Phone,
  Navigation,
  Gauge,
  Power,
  Clock,
  Locate,
  ClipboardCheck,
  RefreshCw,
  Route,
  List,
} from "lucide-react";
import { toast } from "sonner";
import { MapaVistoriasContent } from "@/components/mapa/MapaVistoriasContent";
import { useIsMobile } from "@/hooks/use-mobile";

// =====================================================
// FIX PARA ÍCONES DO LEAFLET
// =====================================================

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// =====================================================
// ÍCONES CUSTOMIZADOS POR STATUS
// =====================================================

const createCustomIcon = (color: string) => {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
};

const markerIcons = {
  online: createCustomIcon("green"),
  atencao: createCustomIcon("yellow"),
  offline: createCustomIcon("red"),
  sem_dados: createCustomIcon("grey"),
};

// =====================================================
// COMPONENTE PARA CENTRALIZAR MAPA
// =====================================================

interface FlyToProps {
  position: [number, number] | null;
  zoom?: number;
}

function FlyToPosition({ position, zoom = 15 }: FlyToProps) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(position, zoom, { duration: 1 });
    }
  }, [position, zoom, map]);

  return null;
}

// =====================================================
// TIPOS
// =====================================================

interface Veiculo {
  rastreador_id: string;
  codigo: string;
  plataforma: string;
  status: string;
  placa: string | null;
  marca: string | null;
  modelo: string | null;
  associado_nome: string | null;
  associado_telefone: string | null;
  latitude: number | null;
  longitude: number | null;
  velocidade: number | null;
  ignicao: boolean | null;
  ultima_comunicacao: string | null;
  horas_sem_comunicacao: number;
  status_comunicacao: string;
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export default function Mapa() {
  const isMobile = useIsMobile();
  // Estados
  const [abaAtiva, setAbaAtiva] = useState<string>("vistorias");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroBusca, setFiltroBusca] = useState("");
  const [posicaoSelecionada, setPosicaoSelecionada] = useState<[number, number] | null>(null);
  const [veiculoSelecionado, setVeiculoSelecionado] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [trajetoAtivo, setTrajetoAtivo] = useState<string | null>(null);
  const [pontosTrajetoAtivo, setPontosTrajetoAtivo] = useState<Array<{ latitude: number; longitude: number; velocidade: number; data_posicao: string }>>([]);
  const [trajetoLoading, setTrajetoLoading] = useState(false);

  // Carregar trajeto de um veículo (últimas 4h)
  const carregarTrajeto = useCallback(async (rastreadorId: string) => {
    if (trajetoAtivo === rastreadorId) {
      // Toggle off
      setTrajetoAtivo(null);
      setPontosTrajetoAtivo([]);
      return;
    }
    setTrajetoLoading(true);
    try {
      const quatroHorasAtras = subHours(new Date(), 4).toISOString();
      const { data, error } = await supabase
        .from('rastreador_posicoes')
        .select('latitude, longitude, velocidade, data_posicao')
        .eq('rastreador_id', rastreadorId)
        .gte('data_posicao', quatroHorasAtras)
        .order('data_posicao', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) {
        toast.info('Nenhum ponto de trajeto nas últimas 4 horas');
        return;
      }
      setPontosTrajetoAtivo(data);
      setTrajetoAtivo(rastreadorId);
    } catch (err: any) {
      toast.error('Erro ao carregar trajeto: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setTrajetoLoading(false);
    }
  }, [trajetoAtivo]);

  // Velocidade média do trajeto ativo
  const velocidadeMediaTrajeto = useMemo(() => {
    const emMovimento = pontosTrajetoAtivo.filter(p => p.velocidade > 0);
    if (emMovimento.length === 0) return 0;
    return Math.round(emMovimento.reduce((acc, p) => acc + p.velocidade, 0) / emMovimento.length);
  }, [pontosTrajetoAtivo]);

  // Query para buscar veículos com posição
  const { data: veiculos, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["mapa-veiculos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_rastreadores_posicao")
        .select("*")
        .order("ultima_comunicacao", { ascending: false, nullsFirst: false });

      if (error) throw error;
      return (data || []) as Veiculo[];
    },
    refetchInterval: 30000,
    enabled: abaAtiva === "veiculos",
  });

  // Mutation para atualizar posição individual do rastreador
  const atualizarPosicao = useMutation({
    mutationFn: async (rastreadorId: string) => {
      const { data, error } = await supabase.functions.invoke('rastreador-posicao', {
        body: { rastreador_id: rastreadorId }
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao buscar posição');
      return data;
    },
    onSuccess: () => {
      refetch();
      toast.success('Posição atualizada!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar posição');
    }
  });

  // Filtrar veículos
  const veiculosFiltrados = useMemo(() => {
    if (!veiculos) return [];

    return veiculos.filter((v) => {
      if (filtroStatus !== "todos" && v.status_comunicacao !== filtroStatus) {
        return false;
      }

      if (filtroBusca) {
        const termo = filtroBusca.toLowerCase();
        const placa = v.placa?.toLowerCase() || "";
        const associado = v.associado_nome?.toLowerCase() || "";
        const codigo = v.codigo?.toLowerCase() || "";

        if (!placa.includes(termo) && !associado.includes(termo) && !codigo.includes(termo)) {
          return false;
        }
      }

      return true;
    });
  }, [veiculos, filtroStatus, filtroBusca]);

  // Contadores por status
  const contadores = useMemo(() => {
    if (!veiculos) return { online: 0, atencao: 0, offline: 0, sem_dados: 0 };

    return veiculos.reduce(
      (acc, v) => {
        const status = v.status_comunicacao as keyof typeof acc;
        if (acc[status] !== undefined) {
          acc[status]++;
        }
        return acc;
      },
      { online: 0, atencao: 0, offline: 0, sem_dados: 0 }
    );
  }, [veiculos]);

  // Centro inicial do mapa (Brasil)
  const centroInicial: [number, number] = [-15.7801, -47.9292];

  // Selecionar veículo
  const selecionarVeiculo = (veiculo: Veiculo) => {
    if (veiculo.latitude && veiculo.longitude) {
      setPosicaoSelecionada([veiculo.latitude, veiculo.longitude]);
      setVeiculoSelecionado(veiculo.rastreador_id);
      if (isMobile) setDrawerOpen(false);
    } else {
      toast.error("Veículo sem posição GPS");
    }
  };

  // Abrir WhatsApp
  const abrirWhatsApp = (telefone: string | null) => {
    if (!telefone) {
      toast.error("Telefone não cadastrado");
      return;
    }
    const numero = telefone.replace(/\D/g, "");
    window.open(`https://wa.me/55${numero}`, "_blank");
  };

  // Abrir Google Maps
  const abrirGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case "atencao":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "offline":
        return "bg-red-500/10 text-red-600 border-red-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "online":
        return "Online";
      case "atencao":
        return "Atenção";
      case "offline":
        return "Offline";
      default:
        return "Sem dados";
    }
  };

  const getStatusTooltip = (status: string, horasSemComunicacao: number) => {
    const horas = Math.floor(horasSemComunicacao);
    const minutos = Math.round((horasSemComunicacao - horas) * 60);
    
    const tempoFormatado = horas > 0 
      ? `${horas}h${minutos > 0 ? ` ${minutos}min` : ''}`
      : `${minutos}min`;

    switch (status) {
      case "online":
        return `Comunicação recente (há ${tempoFormatado})`;
      case "atencao":
        return `Sem comunicação há ${tempoFormatado}\n(entre 1h e 24h = Atenção)`;
      case "offline":
        return `Sem comunicação há ${tempoFormatado}\n(mais de 24h = Offline)`;
      default:
        return "Nenhum dado de posição recebido";
    }
  };

  // Conteúdo da lista de veículos (reutilizado no sidebar e drawer)
  const renderVeiculosList = () => (
    <>
      {/* Contadores de Status */}
      <div className="flex gap-2 flex-wrap">
        <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20">
          {contadores.online} online
        </Badge>
        <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/20">
          {contadores.atencao} atenção
        </Badge>
        <Badge className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20">
          {contadores.offline} offline
        </Badge>
      </div>

      {/* Filtro de Status */}
      <Select value={filtroStatus} onValueChange={setFiltroStatus}>
        <SelectTrigger className="h-9 mt-3">
          <SelectValue placeholder="Filtrar por status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os status</SelectItem>
          <SelectItem value="online">🟢 Online</SelectItem>
          <SelectItem value="atencao">🟡 Atenção</SelectItem>
          <SelectItem value="offline">🔴 Offline</SelectItem>
          <SelectItem value="sem_dados">⚪ Sem dados</SelectItem>
        </SelectContent>
      </Select>

      {/* Campo de Busca */}
      <div className="relative mt-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar placa ou associado..."
          value={filtroBusca}
          onChange={(e) => setFiltroBusca(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Lista */}
      <div className="mt-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-3 border rounded-lg">
                <Skeleton className="h-5 w-24 mb-2" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            ))}
          </div>
        ) : veiculosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Car className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">Nenhum veículo encontrado</p>
          </div>
        ) : (
          <div className="space-y-2">
            {veiculosFiltrados.map((v) => (
              <div
                key={v.rastreador_id}
                className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                  veiculoSelecionado === v.rastreador_id ? "border-primary bg-primary/5" : ""
                }`}
                onClick={() => selecionarVeiculo(v)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm truncate">
                        {v.placa || "Sem placa"}
                      </span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge className={`text-xs cursor-help ${getStatusBadgeClass(v.status_comunicacao)}`}>
                              {getStatusLabel(v.status_comunicacao)}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs whitespace-pre-line">
                            {getStatusTooltip(v.status_comunicacao, v.horas_sem_comunicacao)}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    <p className="text-xs text-muted-foreground truncate">
                      {v.marca} {v.modelo}
                    </p>

                    <p className="text-xs text-muted-foreground truncate">
                      {v.associado_nome || "Sem associado"}
                    </p>

                    {v.latitude && (
                      <div className="flex items-center gap-3 mt-2 text-xs">
                        <span className="flex items-center gap-1">
                          <Gauge className="h-3 w-3" />
                          {v.velocidade || 0} km/h
                        </span>
                        <span className="flex items-center gap-1">
                          <Power className="h-3 w-3" />
                          {v.ignicao ? "Ligado" : "Desligado"}
                        </span>
                      </div>
                    )}

                    {v.ultima_comunicacao && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(v.ultima_comunicacao), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Atualizar localização"
                      onClick={(e) => {
                        e.stopPropagation();
                        atualizarPosicao.mutate(v.rastreador_id);
                      }}
                      disabled={atualizarPosicao.isPending && atualizarPosicao.variables === v.rastreador_id}
                    >
                      <RefreshCw className={`h-4 w-4 ${atualizarPosicao.isPending && atualizarPosicao.variables === v.rastreador_id ? 'animate-spin' : ''}`} />
                    </Button>
                    {v.latitude && v.longitude && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Localizar no mapa"
                        onClick={(e) => {
                          e.stopPropagation();
                          selecionarVeiculo(v);
                        }}
                      >
                        <Locate className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );

  // Mapa de veículos
  const renderMapaVeiculos = () => (
    <MapContainer
      center={centroInicial}
      zoom={4}
      className="h-full w-full"
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='Tiles &copy; Esri'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
        attribution=""
      />

      <FlyToPosition position={posicaoSelecionada} />

      {veiculosFiltrados.map((v) => {
        if (!v.latitude || !v.longitude) return null;

        const icon = markerIcons[v.status_comunicacao as keyof typeof markerIcons] || markerIcons.sem_dados;

        return (
          <Marker
            key={v.rastreador_id}
            position={[v.latitude, v.longitude]}
            icon={icon}
          >
            <Popup>
              <div className="min-w-[200px]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm">{v.placa || "Sem placa"}</h3>
                  <span className="text-xs">
                    {v.status_comunicacao === "online"
                      ? "🟢 Online"
                      : v.status_comunicacao === "atencao"
                      ? "🟡 Atenção"
                      : "🔴 Offline"}
                  </span>
                </div>

                <div className="text-xs space-y-1 mb-2">
                  <p>
                    <strong>Veículo:</strong> {v.marca} {v.modelo}
                  </p>
                  <p>
                    <strong>Associado:</strong> {v.associado_nome || "-"}
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs mb-2">
                  <span className="flex items-center gap-1">
                    <Gauge className="h-3 w-3" />
                    {v.velocidade || 0} km/h
                  </span>
                  <span className="flex items-center gap-1">
                    <Power className="h-3 w-3" />
                    {v.ignicao ? "Ligado" : "Desligado"}
                  </span>
                </div>

                {v.ultima_comunicacao && (
                  <p className="text-xs text-gray-500 mb-3">
                    Última comunicação:{" "}
                    {format(new Date(v.ultima_comunicacao), "dd/MM/yyyy HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                )}

                <div className="flex gap-2 flex-wrap">
                  {v.associado_telefone && (
                    <button
                      onClick={() => abrirWhatsApp(v.associado_telefone)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                    >
                      <Phone className="h-3 w-3" />
                      WhatsApp
                    </button>
                  )}
                  <button
                    onClick={() => abrirGoogleMaps(v.latitude!, v.longitude!)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                  >
                    <Navigation className="h-3 w-3" />
                    Google Maps
                  </button>
                  <button
                    onClick={() => carregarTrajeto(v.rastreador_id)}
                    disabled={trajetoLoading}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs text-white ${
                      trajetoAtivo === v.rastreador_id
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-purple-600 hover:bg-purple-700'
                    }`}
                  >
                    <Route className="h-3 w-3" />
                    {trajetoAtivo === v.rastreador_id ? 'Fechar Trajeto' : 'Ver Trajeto'}
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Trajeto ativo - Polyline */}
      {trajetoAtivo && pontosTrajetoAtivo.length > 1 && (
        <>
          <Polyline
            positions={pontosTrajetoAtivo.map(p => [p.latitude, p.longitude] as [number, number])}
            pathOptions={{ color: '#8b5cf6', weight: 4, opacity: 0.85 }}
          />
          {/* Início do trajeto */}
          <CircleMarker
            center={[pontosTrajetoAtivo[0].latitude, pontosTrajetoAtivo[0].longitude]}
            radius={7}
            pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1 }}
          >
            <Popup>
              <div className="text-xs">
                <strong className="text-green-600">Início do trajeto</strong>
                <p>{format(new Date(pontosTrajetoAtivo[0].data_posicao), "dd/MM HH:mm", { locale: ptBR })}</p>
              </div>
            </Popup>
          </CircleMarker>
          {/* Fim do trajeto */}
          <CircleMarker
            center={[pontosTrajetoAtivo[pontosTrajetoAtivo.length - 1].latitude, pontosTrajetoAtivo[pontosTrajetoAtivo.length - 1].longitude]}
            radius={7}
            pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }}
          >
            <Popup>
              <div className="text-xs">
                <strong className="text-red-600">Fim do trajeto</strong>
                <p>{format(new Date(pontosTrajetoAtivo[pontosTrajetoAtivo.length - 1].data_posicao), "dd/MM HH:mm", { locale: ptBR })}</p>
              </div>
            </Popup>
          </CircleMarker>
        </>
      )}
    </MapContainer>
  );

  // Badge de trajeto ativo
  const renderTrajetoBadge = () => {
    if (!trajetoAtivo || pontosTrajetoAtivo.length === 0) return null;
    return (
      <div className="absolute top-4 right-4 z-[400] bg-background/95 backdrop-blur-sm px-3 py-2 rounded-lg border shadow-sm text-xs space-y-1">
        <div className="flex items-center gap-2 font-medium">
          <Route className="h-3.5 w-3.5 text-purple-500" />
          Trajeto (4h)
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-xs">{pontosTrajetoAtivo.length} pontos</Badge>
          <Badge variant="secondary" className="text-xs">Vel. média: {velocidadeMediaTrajeto} km/h</Badge>
        </div>
        <button
          onClick={() => { setTrajetoAtivo(null); setPontosTrajetoAtivo([]); }}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Fechar trajeto
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-2 md:p-4">
      {/* Tabs de navegação */}
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="flex flex-col h-full">
        <TabsList className="w-fit mb-2 md:mb-4">
          <TabsTrigger value="vistorias" className="gap-2 text-xs md:text-sm">
            <ClipboardCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Vistorias Pendentes</span>
            <span className="sm:hidden">Vistorias</span>
          </TabsTrigger>
          <TabsTrigger value="veiculos" className="gap-2 text-xs md:text-sm">
            <Car className="h-4 w-4" />
            <span className="hidden sm:inline">Veículos em Tempo Real</span>
            <span className="sm:hidden">Veículos</span>
          </TabsTrigger>
        </TabsList>

        {/* Aba de Veículos */}
        <TabsContent value="veiculos" className="flex-1 mt-0">
          {isMobile ? (
            /* === LAYOUT MOBILE === */
            <div className="relative h-full flex flex-col">
              {/* Mapa fullscreen */}
              <div className="flex-1 rounded-lg overflow-hidden relative">
                {renderMapaVeiculos()}
                {renderTrajetoBadge()}

                {/* Badge flutuante no mapa */}
                <div className="absolute bottom-4 left-4 z-[400] bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs text-muted-foreground border shadow-sm flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  {veiculosFiltrados.filter(v => v.latitude).length} veículos
                </div>
              </div>

              {/* Drawer para lista de veículos */}
              <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                <DrawerTrigger asChild>
                  <Button
                    className="absolute bottom-4 right-4 z-[400] shadow-lg gap-2"
                    size="sm"
                  >
                    <List className="h-4 w-4" />
                    {veiculosFiltrados.length} veículos
                  </Button>
                </DrawerTrigger>
                <DrawerContent className="max-h-[75vh]">
                  <DrawerHeader className="pb-2">
                    <DrawerTitle className="flex items-center gap-2">
                      <Car className="h-5 w-5 text-primary" />
                      Veículos
                      <Badge variant="secondary">{veiculosFiltrados.length}</Badge>
                    </DrawerTitle>
                  </DrawerHeader>
                  <ScrollArea className="px-4 pb-4 max-h-[60vh]">
                    {renderVeiculosList()}
                  </ScrollArea>
                </DrawerContent>
              </Drawer>
            </div>
          ) : (
            /* === LAYOUT DESKTOP === */
            <div className="flex h-full gap-4">
              {/* SIDEBAR - Lista de Veículos */}
              <Card className="w-80 flex-shrink-0 flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Car className="h-5 w-5 text-primary" />
                      <CardTitle className="text-base">Veículos</CardTitle>
                    </div>
                    <Badge variant="secondary">{veiculosFiltrados.length}</Badge>
                  </div>
                  {renderVeiculosList()}
                </CardHeader>

                <CardContent className="flex-1 overflow-hidden p-0">
                  {/* Empty - list is rendered inside CardHeader via renderVeiculosList */}
                </CardContent>
              </Card>

              {/* MAPA DE VEÍCULOS */}
              <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="pb-2 flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Navigation className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base">Mapa em Tempo Real</CardTitle>
                  </div>
                  <Badge variant="outline" className="gap-1.5 text-xs">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    Ao vivo
                  </Badge>
                </CardHeader>

                <CardContent className="flex-1 p-0 relative">
                  {renderMapaVeiculos()}
                  {renderTrajetoBadge()}

                  <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs text-muted-foreground border shadow-sm flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    {veiculosFiltrados.filter(v => v.latitude).length} veículos • Tempo real
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Aba de Vistorias */}
        <TabsContent value="vistorias" className="flex-1 mt-0">
          <MapaVistoriasContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
