import { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { format, isSameDay, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Search,
  Phone,
  Navigation,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Route,
  Calendar as CalendarIcon,
  List,
  Play,
  AlertCircle,
  Clock,
  Wrench,
  ClipboardCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useVistoriasMapa, VistoriaMapa, agruparPorRota } from "@/hooks/useVistoriasMapa";
import { TIPO_VISTORIA_LABELS } from "@/types/servicos-rota";
import { getRotaColor, SEM_ROTA_COLOR, createColoredMarkerSvg, svgToDataUrl } from "@/lib/rota-colors";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

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

// Componente para localização do usuário
function UserLocationButton() {
  const map = useMap();
  const [isLocating, setIsLocating] = useState(false);

  const handleLocate = () => {
    setIsLocating(true);
    map.locate({ setView: true, maxZoom: 16 });
    
    map.once('locationfound', () => {
      setIsLocating(false);
      toast.success("Localização encontrada!");
    });
    
    map.once('locationerror', () => {
      setIsLocating(false);
      toast.error("Não foi possível obter sua localização");
    });
  };

  return (
    <Button
      size="icon"
      variant="secondary"
      className="absolute top-4 right-4 z-[1000] h-10 w-10 rounded-full shadow-lg"
      onClick={handleLocate}
      disabled={isLocating}
    >
      <Navigation className={cn("h-5 w-5", isLocating && "animate-pulse")} />
    </Button>
  );
}

export function MapaMobileContent() {
  const navigate = useNavigate();
  // Filtrar apenas serviços do usuário logado (vistoriador/instalador)
  const { data: vistorias, isLoading } = useVistoriasMapa({ filtrarPorUsuario: true });
  const [filtroData, setFiltroData] = useState<Date>(new Date());
  const [filtroBusca, setFiltroBusca] = useState("");
  const [posicaoSelecionada, setPosicaoSelecionada] = useState<[number, number] | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Obter lista de IDs de rotas únicas
  const rotasIds = useMemo(() => {
    if (!vistorias) return [];
    const ids = [...new Set(vistorias.map(v => v.rota_id).filter(Boolean))] as string[];
    return ids;
  }, [vistorias]);

  // Status que não devem ser considerados atrasados
  const statusNaoAtrasados = ['concluida', 'cancelada', 'aprovada', 'reprovada', 'em_analise', 'em_rota'];

  // Filtrar vistorias por data e busca
  const vistoriasFiltradas = useMemo(() => {
    if (!vistorias) return [];

    // Normalizar data do filtro para meia-noite local
    const filtroNormalizado = new Date(filtroData);
    filtroNormalizado.setHours(0, 0, 0, 0);

    return vistorias.filter((v) => {
      // Filtro por data - inclui vistorias do dia selecionado E vistorias atrasadas
      if (!v.data_agendada) return false;
      
      // Normalizar data da vistoria para meia-noite local (funciona com ISO e "YYYY-MM-DD HH:mm")
      const dataAgendadaStr = v.data_agendada.slice(0, 10); // "2026-01-23"
      const dataVistoria = new Date(dataAgendadaStr + 'T00:00:00');
      
      const isDataSelecionada = isSameDay(dataVistoria, filtroNormalizado);
      
      // Considerar atrasada se: data anterior ao dia selecionado E status diferente dos finais
      const isAtrasada = dataVistoria < filtroNormalizado && !statusNaoAtrasados.includes(v.status);
      
      if (!isDataSelecionada && !isAtrasada) return false;

      // Filtro por busca
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
  }, [vistorias, filtroData, filtroBusca]);

  // Vistorias com coordenadas
  const vistoriasComCoordenadas = useMemo(() => {
    return vistoriasFiltradas.filter((v) => v.latitude && v.longitude);
  }, [vistoriasFiltradas]);

  // Agrupar por rota para polylines
  const rotasAgrupadas = useMemo(() => {
    return agruparPorRota(vistoriasComCoordenadas);
  }, [vistoriasComCoordenadas]);

  // Identificar se é vistoria ou instalação
  const getTipoServico = (v: VistoriaMapa) => {
    if (v.tipo_servico === 'instalacao') return 'instalacao';
    return 'vistoria';
  };

  // Navegar para execução
  const iniciarServico = (v: VistoriaMapa) => {
    const tipo = getTipoServico(v);
    if (tipo === 'instalacao') {
      navigate(`/instalador/instalacao/${v.id}`);
    } else {
      navigate(`/vistoriador/vistoria-completa/${v.id}`);
    }
  };

  // Selecionar vistoria
  const selecionarVistoria = (vistoria: VistoriaMapa) => {
    if (vistoria.latitude && vistoria.longitude) {
      setPosicaoSelecionada([vistoria.latitude, vistoria.longitude]);
      setDrawerOpen(false);
    } else {
      toast.error("Serviço sem coordenadas GPS");
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

  // Verificar se é atrasada
  const isAtrasada = (v: VistoriaMapa) => {
    if (!v.data_agendada) return false;
    if (statusNaoAtrasados.includes(v.status)) return false;
    
    // Normalizar data da vistoria para meia-noite local (funciona com ISO e "YYYY-MM-DD HH:mm")
    const dataAgendadaStr = v.data_agendada.slice(0, 10); // "2026-01-23"
    const dataVistoria = new Date(dataAgendadaStr + 'T00:00:00');
    
    // Normalizar data do filtro para meia-noite local
    const filtroNormalizado = new Date(filtroData);
    filtroNormalizado.setHours(0, 0, 0, 0);
    
    return dataVistoria < filtroNormalizado;
  };

  const centroInicial: [number, number] = [-22.9068, -43.1729]; // Rio de Janeiro

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-muted">
        <div className="text-center space-y-3">
          <Skeleton className="h-12 w-12 rounded-full mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {/* Mapa */}
      <MapContainer
        center={centroInicial}
        zoom={11}
        className="h-full w-full"
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        <FlyToPosition position={posicaoSelecionada} />
        <UserLocationButton />

        {/* Polylines conectando pontos de cada rota */}
        {rotasAgrupadas.map((rota) => {
          if (!rota.rota_id) return null;
          
          const vistoriasComGps = rota.vistorias.filter(v => v.latitude && v.longitude);
          if (vistoriasComGps.length < 2) return null;
          
          const positions = vistoriasComGps.map(v => [v.latitude!, v.longitude!] as [number, number]);
          const color = rota.rota_cor || getRotaColor(rota.rota_id, rotasIds);
          
          return (
            <Polyline
              key={`line-${rota.rota_id}`}
              positions={positions}
              pathOptions={{
                color,
                weight: 3,
                opacity: 0.6,
                dashArray: '8, 8',
              }}
            />
          );
        })}

        {/* Marcadores */}
        {vistoriasComCoordenadas.map((v) => {
          const markerColor = v.rota_cor || SEM_ROTA_COLOR;
          const tipoServico = getTipoServico(v);
          const atrasada = isAtrasada(v);
          
          return (
            <Marker
              key={`marker-${v.id}`}
              position={[v.latitude!, v.longitude!]}
              icon={getColoredIcon(markerColor)}
            >
              <Popup>
                <div className="min-w-[220px]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-sm">{v.veiculo_placa || "Sem placa"}</h3>
                    <div className="flex gap-1">
                      {atrasada && (
                        <span className="text-xs px-2 py-0.5 rounded bg-orange-500 text-white">
                          Atrasada
                        </span>
                      )}
                      <span 
                        className="text-xs px-2 py-0.5 rounded text-white"
                        style={{ backgroundColor: markerColor }}
                      >
                        {tipoServico === 'instalacao' ? 'Instalação' : 
                          TIPO_VISTORIA_LABELS[v.tipo_vistoria as keyof typeof TIPO_VISTORIA_LABELS] || v.tipo_vistoria}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs space-y-1 mb-3">
                    <p><strong>Associado:</strong> {v.associado_nome || "-"}</p>
                    <p><strong>Veículo:</strong> {v.veiculo_marca} {v.veiculo_modelo}</p>
                    {v.data_agendada && (
                      <p className={cn(atrasada && "text-orange-600")}>
                        <strong>Agendada:</strong> {format(new Date(v.data_agendada), "dd/MM/yyyy", { locale: ptBR })}
                        {atrasada && " (pendente)"}
                      </p>
                    )}
                    <p><strong>Local:</strong> {v.endereco_bairro}, {v.endereco_cidade}</p>
                    
                    {v.rota_codigo && (
                      <p className="mt-1 pt-1 border-t">
                        <strong>Rota:</strong>{" "}
                        <span 
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-white text-xs"
                          style={{ backgroundColor: v.rota_cor || "#3B82F6" }}
                        >
                          {v.rota_codigo}
                        </span>
                      </p>
                    )}
                  </div>

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
                      Navegar
                    </button>
                    <button
                      onClick={() => iniciarServico(v)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded text-xs hover:bg-primary/90"
                    >
                      <Play className="h-3 w-3" />
                      Iniciar
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Controles de data flutuantes no topo */}
      <div className="absolute top-4 left-4 right-16 z-[1000]">
        <div className="bg-background/95 backdrop-blur-sm rounded-lg shadow-lg border p-2">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setFiltroData(addDays(filtroData, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-8 text-xs font-medium"
              onClick={() => setFiltroData(new Date())}
            >
              <CalendarIcon className="h-3 w-3 mr-1.5" />
              {isSameDay(filtroData, new Date()) 
                ? "Hoje" 
                : format(filtroData, "dd/MM", { locale: ptBR })}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setFiltroData(addDays(filtroData, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom Sheet com lista */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger asChild>
          <Button
            className="absolute bottom-4 left-4 right-4 z-[1000] shadow-lg"
            size="lg"
          >
            <List className="h-4 w-4 mr-2" />
            {vistoriasFiltradas.length} serviços
            {vistoriasFiltradas.filter(v => isAtrasada(v)).length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {vistoriasFiltradas.filter(v => isAtrasada(v)).length} atrasados
              </Badge>
            )}
          </Button>
        </DrawerTrigger>
        
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Meus Serviços - {format(filtroData, "dd/MM", { locale: ptBR })}
            </DrawerTitle>
          </DrawerHeader>
          
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por placa, nome ou bairro..."
                value={filtroBusca}
                onChange={(e) => setFiltroBusca(e.target.value)}
                className="pl-9 h-10"
              />
              {filtroBusca && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setFiltroBusca("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <ScrollArea className="flex-1 px-4 pb-4 max-h-[60vh]">
            {vistoriasFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <MapPin className="h-12 w-12 mb-2 opacity-50" />
                <p className="text-sm">Nenhum serviço encontrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {vistoriasFiltradas.map((v) => {
                  const tipoServico = getTipoServico(v);
                  const color = v.rota_cor || SEM_ROTA_COLOR;
                  const atrasada = isAtrasada(v);

                  return (
                    <div
                      key={v.id}
                      className={cn(
                        "p-3 rounded-lg border bg-card transition-colors cursor-pointer hover:bg-accent",
                        atrasada && "border-orange-500/50 bg-orange-500/5"
                      )}
                      onClick={() => selecionarVistoria(v)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Ícone com cor da rota */}
                        <div 
                          className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${color}20` }}
                        >
                          {tipoServico === 'instalacao' ? (
                            <Wrench className="h-5 w-5" style={{ color }} />
                          ) : (
                            <ClipboardCheck className="h-5 w-5" style={{ color }} />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">
                              {v.veiculo_placa || "Sem placa"}
                            </span>
                            {atrasada && (
                              <Badge variant="outline" className="text-orange-600 border-orange-500 text-[10px] px-1.5">
                                <AlertCircle className="h-3 w-3 mr-0.5" />
                                Atrasada
                              </Badge>
                            )}
                          </div>
                          
                          <p className="text-xs text-muted-foreground truncate">
                            {v.associado_nome}
                          </p>
                          
                          <div className="flex items-center gap-2 mt-1">
                            <Badge 
                              variant="secondary" 
                              className="text-[10px] px-1.5"
                              style={{ backgroundColor: `${color}20`, color }}
                            >
                              {tipoServico === 'instalacao' ? 'Instalação' : 
                                TIPO_VISTORIA_LABELS[v.tipo_vistoria as keyof typeof TIPO_VISTORIA_LABELS] || v.tipo_vistoria}
                            </Badge>
                            
                            {v.endereco_bairro && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 truncate">
                                <MapPin className="h-3 w-3" />
                                {v.endereco_bairro}
                              </span>
                            )}
                          </div>
                          
                          {v.horario_agendado && (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                              <Clock className="h-3 w-3" />
                              {v.horario_agendado}
                            </p>
                          )}
                        </div>

                        {/* Ações */}
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (v.latitude && v.longitude) {
                                abrirGoogleMaps(v.latitude, v.longitude);
                              }
                            }}
                            disabled={!v.latitude || !v.longitude}
                          >
                            <Navigation className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirWhatsApp(v.associado_telefone);
                            }}
                            disabled={!v.associado_telefone}
                          >
                            <Phone className="h-4 w-4 text-green-600" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
