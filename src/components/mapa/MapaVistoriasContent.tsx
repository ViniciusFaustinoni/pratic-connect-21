import { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { RotaPolyline } from "@/components/mapa/RotaPolyline";
import L from "leaflet";
import { format, isSameDay, addDays, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Search,
  ClipboardCheck,
  Phone,
  Navigation,
  Locate,
  Calendar as CalendarIcon,
  MapPin,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  User,
  List,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { useVistoriasMapa, VistoriaMapa } from "@/hooks/useVistoriasMapa";
import { useVistoriadoresRealtime } from "@/hooks/useVistoriadoresRealtime";
import { TIPO_VISTORIA_LABELS } from "@/types/servicos-rota";
import { createColoredMarkerSvg, svgToDataUrl, createVistoriadorMarkerSvg, COR_VISTORIADOR } from "@/lib/rota-colors";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

// Cores para o mapa do coordenador - por status de conclusão
const COR_REALIZADA = '#10B981';   // Verde
const COR_A_REALIZAR = '#EF4444'; // Vermelho

// Status que indicam vistoria realizada
const STATUS_REALIZADOS = ['concluida', 'aprovada', 'reprovada', 'em_analise'];

/**
 * Retorna a cor baseada no status de conclusão
 */
function getCorPorStatus(status: string): string {
  if (STATUS_REALIZADOS.includes(status)) {
    return COR_REALIZADA;
  }
  return COR_A_REALIZAR;
}

// Cache de ícones por cor
const iconCache = new Map<string, L.Icon>();

function getColoredIcon(color: string): L.Icon {
  const cacheKey = `icon-${color}`;
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }
  
  const icon = new L.Icon({
    iconUrl: svgToDataUrl(createColoredMarkerSvg(color)),
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40],
  });
  
  iconCache.set(cacheKey, icon);
  return icon;
}

// Cache de ícones de vistoriador
const vistoriadorIconCache = new Map<string, L.Icon>();

function getVistoriadorIcon(color: string = COR_VISTORIADOR): L.Icon {
  const cacheKey = `vistoriador-${color}`;
  if (vistoriadorIconCache.has(cacheKey)) {
    return vistoriadorIconCache.get(cacheKey)!;
  }
  
  const icon = new L.Icon({
    iconUrl: svgToDataUrl(createVistoriadorMarkerSvg(color)),
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
  
  vistoriadorIconCache.set(cacheKey, icon);
  return icon;
}

// Componente para centralizar mapa
function FlyToPosition({ position, zoom = 15 }: { position: [number, number] | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, zoom, { duration: 1 });
    }
  }, [position, zoom, map]);
  return null;
}

export function MapaVistoriasContent() {
  const isMobile = useIsMobile();
  const { data: vistorias, isLoading } = useVistoriasMapa();
  const { data: vistoriadores, isLoading: isLoadingVistoriadores } = useVistoriadoresRealtime();
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroBusca, setFiltroBusca] = useState("");
  const [filtroData, setFiltroData] = useState<Date | undefined>(new Date());
  const [posicaoSelecionada, setPosicaoSelecionada] = useState<[number, number] | null>(null);
  const [vistoriaSelecionada, setVistoriaSelecionada] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Vistoriadores em serviço
  const vistoriadoresEmServico = useMemo(() => {
    return vistoriadores?.filter(v => v.em_servico && v.latitude && v.longitude) || [];
  }, [vistoriadores]);

  // Filtrar vistorias
  const vistoriasFiltradas = useMemo(() => {
    if (!vistorias) return [];

    return vistorias.filter((v) => {
      if (filtroData) {
        if (!v.data_agendada) return false;
        const dataVistoria = new Date(v.data_agendada);
        const isDataSelecionada = isSameDay(dataVistoria, filtroData);
        const isAtrasada = dataVistoria < filtroData && 
          v.status !== 'concluida' && 
          v.status !== 'cancelada';
        if (!isDataSelecionada && !isAtrasada) return false;
      }

      if (filtroTipo !== "todos" && v.tipo_vistoria !== filtroTipo) return false;

      if (filtroStatus !== "todos") {
        const isRealizada = STATUS_REALIZADOS.includes(v.status);
        if (filtroStatus === "realizadas" && !isRealizada) return false;
        if (filtroStatus === "a_realizar" && isRealizada) return false;
      }

      if (filtroBusca) {
        const termo = filtroBusca.toLowerCase();
        const placa = v.veiculo_placa?.toLowerCase() || "";
        const associado = v.associado_nome?.toLowerCase() || "";
        const bairro = v.endereco_bairro?.toLowerCase() || "";

        if (!placa.includes(termo) && !associado.includes(termo) && !bairro.includes(termo)) {
          return false;
        }
      }

      return true;
    });
  }, [vistorias, filtroTipo, filtroStatus, filtroData, filtroBusca]);

  // Vistorias com coordenadas
  const vistoriasComCoordenadas = useMemo(() => {
    return vistoriasFiltradas.filter((v) => v.latitude && v.longitude);
  }, [vistoriasFiltradas]);

  // Contadores de status para exibição
  const contadores = useMemo(() => {
    const realizadas = vistoriasComCoordenadas.filter(v => STATUS_REALIZADOS.includes(v.status)).length;
    const aRealizar = vistoriasComCoordenadas.length - realizadas;
    return { realizadas, aRealizar };
  }, [vistoriasComCoordenadas]);

  // Calcular linhas de rota
  const linhasDeRota = useMemo(() => {
    if (!vistoriadoresEmServico.length || !vistoriasComCoordenadas.length) return [];
    
    return vistoriadoresEmServico.map(profissional => {
      const tarefasPendentes = vistoriasComCoordenadas.filter(v => 
        v.vistoriador_id === profissional.vistoriador_id &&
        !STATUS_REALIZADOS.includes(v.status)
      ).sort((a, b) => {
        const dataA = new Date(`${a.data_agendada}T${a.horario_agendado || '00:00'}`);
        const dataB = new Date(`${b.data_agendada}T${b.horario_agendado || '00:00'}`);
        return dataA.getTime() - dataB.getTime();
      });
      
      const proximaTarefa = tarefasPendentes[0];
      if (!proximaTarefa) return null;
      
      return {
        profissionalId: profissional.vistoriador_id,
        profissionalNome: profissional.vistoriador_nome,
        posicaoOrigem: [profissional.latitude, profissional.longitude] as [number, number],
        posicaoDestino: [proximaTarefa.latitude!, proximaTarefa.longitude!] as [number, number],
        tarefaId: proximaTarefa.id,
        tarefaPlaca: proximaTarefa.veiculo_placa,
      };
    }).filter(Boolean) as {
      profissionalId: string;
      profissionalNome: string;
      posicaoOrigem: [number, number];
      posicaoDestino: [number, number];
      tarefaId: string;
      tarefaPlaca: string | null;
    }[];
  }, [vistoriadoresEmServico, vistoriasComCoordenadas]);

  // Selecionar vistoria
  const selecionarVistoria = (vistoria: VistoriaMapa) => {
    if (vistoria.latitude && vistoria.longitude) {
      setPosicaoSelecionada([vistoria.latitude, vistoria.longitude]);
      setVistoriaSelecionada(vistoria.id);
      if (isMobile) setDrawerOpen(false);
    } else {
      toast.error("Vistoria sem coordenadas GPS");
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

  const centroInicial: [number, number] = [-22.9068, -43.1729];

  // Filtros sidebar content
  const renderFilters = () => (
    <>
      {/* Filtro de Data */}
      <div className="space-y-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !filtroData && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filtroData ? format(filtroData, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar dia"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filtroData}
              onSelect={setFiltroData}
              className="p-3 pointer-events-auto"
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>

        {/* Navegação rápida de data */}
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8"
            onClick={() => setFiltroData(addDays(filtroData || new Date(), -1))}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8"
            onClick={() => setFiltroData(new Date())}
          >
            Hoje
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8"
            onClick={() => setFiltroData(addDays(filtroData || new Date(), 1))}
          >
            Próximo
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {filtroData && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-muted-foreground"
            onClick={() => setFiltroData(undefined)}
          >
            <X className="h-3 w-3 mr-1" />
            Ver todas as datas
          </Button>
        )}
      </div>

      {/* Info de coordenadas */}
      <div className="flex gap-2 mt-2">
        <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
          {vistoriasComCoordenadas.length} no mapa
        </Badge>
        <Badge className="bg-muted text-muted-foreground">
          {vistoriasFiltradas.length - vistoriasComCoordenadas.length} sem GPS
        </Badge>
      </div>

      {/* Filtro de Tipo */}
      <Select value={filtroTipo} onValueChange={setFiltroTipo}>
        <SelectTrigger className="h-9 mt-3">
          <SelectValue placeholder="Filtrar por tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os tipos</SelectItem>
          <SelectItem value="instalacao">🔌 Instalação</SelectItem>
          <SelectItem value="saida">📤 Saída</SelectItem>
          <SelectItem value="sinistro">⚠️ Sinistro</SelectItem>
          <SelectItem value="periodica">🔄 Periódica</SelectItem>
          <SelectItem value="cancelamento">❌ Cancelamento</SelectItem>
          <SelectItem value="manutencao">🔧 Manutenção</SelectItem>
        </SelectContent>
      </Select>

      {/* Campo de Busca */}
      <div className="relative mt-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar placa, associado ou bairro..."
          value={filtroBusca}
          onChange={(e) => setFiltroBusca(e.target.value)}
          className="pl-9 h-9"
        />
      </div>
    </>
  );

  // Lista de vistorias
  const renderVistoriasList = () => (
    <>
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
      ) : vistoriasFiltradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <ClipboardCheck className="h-12 w-12 mb-2 opacity-50" />
          <p className="text-sm">Nenhuma vistoria pendente</p>
        </div>
      ) : (
        <div className="space-y-2">
          {vistoriasFiltradas.map((v) => {
            const color = getCorPorStatus(v.status);
            const isAtrasada = (() => {
              if (!filtroData || !v.data_agendada) return false;
              if (v.status === 'concluida' || v.status === 'cancelada') return false;
              const dataAgendada = new Date(v.data_agendada + 'T00:00:00');
              const filtroNormalizado = new Date(filtroData);
              filtroNormalizado.setHours(0, 0, 0, 0);
              return dataAgendada < filtroNormalizado;
            })();
            
            return (
              <div
                key={v.id}
                className={`p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                  vistoriaSelecionada === v.id ? "border-primary bg-primary/5" : ""
                } ${!v.latitude ? "opacity-60" : ""} ${isAtrasada ? "bg-orange-50 dark:bg-orange-950/20" : ""}`}
                onClick={() => selecionarVistoria(v)}
                style={{ borderLeftWidth: 4, borderLeftColor: color }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-sm truncate">
                        {v.veiculo_placa || "Sem placa"}
                      </span>
                      <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                        {TIPO_VISTORIA_LABELS[v.tipo_vistoria as keyof typeof TIPO_VISTORIA_LABELS] || v.tipo_vistoria}
                      </Badge>
                      {isAtrasada && (
                        <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-300">
                          Atrasada
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground truncate">
                      {v.associado_nome || "Sem associado"}
                    </p>

                    {v.endereco_bairro && (
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {v.endereco_bairro}, {v.endereco_cidade}
                      </p>
                    )}

                    {v.data_agendada && (
                      <p className={cn(
                        "text-xs mt-1 flex items-center gap-1",
                        isAtrasada ? "text-orange-600" : "text-muted-foreground"
                      )}>
                        <CalendarIcon className="h-3 w-3" />
                        {format(new Date(v.data_agendada), "dd/MM/yyyy", { locale: ptBR })}
                        {isAtrasada && " (pendente)"}
                      </p>
                    )}

                    {STATUS_REALIZADOS.includes(v.status) && (
                      <p className="text-xs mt-1 flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        Realizada
                      </p>
                    )}

                    {!v.latitude && (
                      <p className="text-xs text-orange-600 mt-1">⚠️ Sem coordenadas GPS</p>
                    )}
                  </div>

                  {v.latitude && v.longitude && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        selecionarVistoria(v);
                      }}
                    >
                      <Locate className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  // Mapa renderizado
  const renderMapa = () => (
    <MapContainer
      center={centroInicial}
      zoom={10}
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

      {/* Rotas reais */}
      {linhasDeRota.map((linha) => (
        <RotaPolyline
          key={`rota-${linha.profissionalId}`}
          origem={linha.posicaoOrigem}
          destino={linha.posicaoDestino}
          cor={COR_VISTORIADOR}
          peso={4}
          opacidade={0.7}
          mostrarPopup
          popupContent={
            <div className="text-xs">
              <p className="font-semibold">{linha.profissionalNome}</p>
              <p className="text-muted-foreground">→ {linha.tarefaPlaca || 'Próxima tarefa'}</p>
            </div>
          }
        />
      ))}

      {/* Marcadores de vistorias */}
      {vistoriasComCoordenadas.map((v) => {
        const markerColor = getCorPorStatus(v.status);
        const isRealizada = STATUS_REALIZADOS.includes(v.status);
        
        return (
          <Marker
            key={`marker-${v.id}-${markerColor}`}
            position={[v.latitude!, v.longitude!]}
            icon={getColoredIcon(markerColor)}
          >
            <Popup>
              <div className="min-w-[200px]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm">{v.veiculo_placa || "Sem placa"}</h3>
                  <span 
                    className="text-xs px-2 py-0.5 rounded text-white"
                    style={{ backgroundColor: markerColor }}
                  >
                    {isRealizada ? "Realizada" : "A Realizar"}
                  </span>
                </div>

                <div className="text-xs space-y-1 mb-2">
                  <p><strong>Tipo:</strong> {TIPO_VISTORIA_LABELS[v.tipo_vistoria as keyof typeof TIPO_VISTORIA_LABELS] || v.tipo_vistoria}</p>
                  <p><strong>Associado:</strong> {v.associado_nome || "-"}</p>
                  <p><strong>Veículo:</strong> {v.veiculo_marca} {v.veiculo_modelo}</p>
                  {v.data_agendada && (
                    <p><strong>Agendada:</strong> {format(new Date(v.data_agendada), "dd/MM/yyyy", { locale: ptBR })}</p>
                  )}
                  <p><strong>Local:</strong> {v.endereco_bairro}, {v.endereco_cidade}</p>
                  <p><strong>Status:</strong> {v.status}</p>
                  {v.vistoriador_nome ? (
                    <p><strong>Vistoriador:</strong> {v.vistoriador_nome}</p>
                  ) : (
                    <p className="text-orange-600"><strong>Vistoriador:</strong> Não atribuído</p>
                  )}
                </div>

                <div className="flex gap-2">
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
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Marcadores dos Vistoriadores em Campo */}
      {vistoriadoresEmServico.map((vistoriador) => (
        <Marker
          key={`vistoriador-${vistoriador.vistoriador_id}`}
          position={[vistoriador.latitude, vistoriador.longitude]}
          icon={getVistoriadorIcon()}
        >
          <Popup>
            <div className="min-w-[180px]">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-blue-600" />
                <h3 className="font-bold text-sm">{vistoriador.vistoriador_nome}</h3>
              </div>
              <div className="text-xs space-y-1 mb-2">
                <p className={`flex items-center gap-1 ${
                  vistoriador.status_operacional === 'em_andamento' ? 'text-blue-600' :
                  vistoriador.status_operacional === 'em_rota' ? 'text-purple-600' :
                  vistoriador.status_operacional === 'em_contato' ? 'text-amber-600' :
                  'text-green-600'
                }`}>
                  <span className={`w-2 h-2 rounded-full animate-pulse ${
                    vistoriador.status_operacional === 'em_andamento' ? 'bg-blue-500' :
                    vistoriador.status_operacional === 'em_rota' ? 'bg-purple-500' :
                    vistoriador.status_operacional === 'em_contato' ? 'bg-amber-500' :
                    'bg-green-500'
                  }`} />
                  {vistoriador.status_operacional === 'em_andamento' ? 'Realizando Tarefa' :
                   vistoriador.status_operacional === 'em_rota' ? 'Em Rota' :
                   vistoriador.status_operacional === 'em_contato' ? 'Em Contato com Associado' :
                   'Aguardando Atribuição'}
                </p>
                <p className="text-muted-foreground">
                  Atualizado: {formatDistanceToNow(new Date(vistoriador.updated_at), { 
                    addSuffix: true, 
                    locale: ptBR 
                  })}
                </p>
              </div>
              {vistoriador.telefone && (
                <button
                  onClick={() => abrirWhatsApp(vistoriador.telefone)}
                  className="flex items-center justify-center gap-1 w-full px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                >
                  <Phone className="h-3 w-3" />
                  Contatar
                </button>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );

  // Legenda flutuante
  const renderLegenda = () => (
    <div className={cn(
      "absolute z-[400] bg-background/95 backdrop-blur-sm rounded-lg shadow-lg border p-3",
      isMobile ? "top-2 right-2 text-xs" : "top-4 right-4"
    )}>
      <h4 className="font-semibold text-sm mb-3">Legenda</h4>
      <div className="space-y-2">
        <button
          onClick={() => setFiltroStatus(filtroStatus === "realizadas" ? "todos" : "realizadas")}
          className={cn(
            "w-full flex items-center gap-2 text-sm p-2 rounded-md transition-colors hover:bg-muted",
            filtroStatus === "realizadas" && "bg-primary/10 border border-primary/30"
          )}
        >
          <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: COR_REALIZADA }} />
          <span className="flex-1 text-left">Realizadas</span>
          <Badge variant="secondary" className="text-xs">{contadores.realizadas}</Badge>
        </button>
        <button
          onClick={() => setFiltroStatus(filtroStatus === "a_realizar" ? "todos" : "a_realizar")}
          className={cn(
            "w-full flex items-center gap-2 text-sm p-2 rounded-md transition-colors hover:bg-muted",
            filtroStatus === "a_realizar" && "bg-primary/10 border border-primary/30"
          )}
        >
          <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: COR_A_REALIZAR }} />
          <span className="flex-1 text-left">A Realizar</span>
          <Badge variant="secondary" className="text-xs">{contadores.aRealizar}</Badge>
        </button>
        
        <div className="border-t my-2" />
        
        <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50">
          <span 
            className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center" 
            style={{ backgroundColor: COR_VISTORIADOR }}
          >
            <User className="h-2.5 w-2.5 text-white" />
          </span>
          <span className="flex-1 text-left">Profissionais</span>
          <Badge variant="secondary" className="text-xs gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            {vistoriadoresEmServico.length}
          </Badge>
        </div>
        
        {linhasDeRota.length > 0 && (
          <div className="flex items-center gap-2 text-sm p-2 rounded-md">
            <div 
              className="w-4 h-0.5 flex-shrink-0" 
              style={{ 
                backgroundColor: COR_VISTORIADOR,
                borderStyle: 'dashed',
                borderWidth: '1px',
                borderColor: COR_VISTORIADOR,
              }} 
            />
            <span className="flex-1 text-left text-muted-foreground">Rotas ativas</span>
            <Badge variant="outline" className="text-xs">{linhasDeRota.length}</Badge>
          </div>
        )}
        
        {filtroStatus !== "todos" && (
          <button
            onClick={() => setFiltroStatus("todos")}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            Mostrar todas
          </button>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="relative h-full flex flex-col">
        {/* Mapa fullscreen */}
        <div className="flex-1 rounded-lg overflow-hidden relative">
          {renderMapa()}
          {renderLegenda()}
        </div>

        {/* Drawer para filtros + lista */}
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger asChild>
            <Button
              className="absolute bottom-4 left-4 z-[400] shadow-lg gap-2"
              size="sm"
            >
              <List className="h-4 w-4" />
              {vistoriasFiltradas.length} vistorias
            </Button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[80vh]">
            <DrawerHeader className="pb-2">
              <DrawerTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                Vistorias
                <Badge variant="secondary">{vistoriasFiltradas.length}</Badge>
              </DrawerTitle>
            </DrawerHeader>
            <ScrollArea className="px-4 pb-4 max-h-[65vh]">
              {renderFilters()}
              <div className="mt-4">
                {renderVistoriasList()}
              </div>
            </ScrollArea>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  // === LAYOUT DESKTOP ===
  return (
    <div className="flex h-full gap-4">
      {/* Sidebar */}
      <Card className="w-80 flex-shrink-0 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Vistorias</CardTitle>
            </div>
            <Badge variant="secondary">{vistoriasFiltradas.length}</Badge>
          </div>
          {renderFilters()}
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full px-4 pb-4">
            {renderVistoriasList()}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Mapa */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-red-600" />
            <CardTitle className="text-base">Mapa de Vistorias</CardTitle>
          </div>
          <Badge variant="outline" className="gap-1.5 text-xs">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Ao vivo
          </Badge>
        </CardHeader>

        <CardContent className="flex-1 p-0 relative">
          {renderMapa()}
          {renderLegenda()}
        </CardContent>
      </Card>
    </div>
  );
}
