import { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, GeoJSON } from "react-leaflet";
import L from "leaflet";
import { format, isSameDay, addDays } from "date-fns";
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
  Search,
  ClipboardCheck,
  Phone,
  Navigation,
  Locate,
  Calendar as CalendarIcon,
  MapPin,
  Route,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useVistoriasMapa, VistoriaMapa, agruparPorRota } from "@/hooks/useVistoriasMapa";
import { useRotasBairros } from "@/hooks/useRotasBairros";
import { TIPO_VISTORIA_LABELS } from "@/types/servicos-rota";
import { getRotaColor, SEM_ROTA_COLOR, createColoredMarkerSvg, svgToDataUrl } from "@/lib/rota-colors";
import { MapaRotasLegenda } from "./MapaRotasLegenda";
import { cn } from "@/lib/utils";
import { useBairrosGeoJSON } from "@/hooks/useBairrosGeoJSON";
import { normalizarNomeBairro } from "@/lib/bairros";

// Cor fixa vermelha para pinos de vistorias
const VISTORIA_PIN_COLOR = "#EF4444";

// Cache de ícones por cor - limpar para garantir atualização
const iconCache = new Map<string, L.Icon>();

// Limpar cache ao iniciar para forçar ícones vermelhos
iconCache.clear();

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

export function MapaVistoriasContent() {
  const { data: vistorias, isLoading } = useVistoriasMapa();
  const { data: bairrosGeoJSON } = useBairrosGeoJSON();
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroRota, setFiltroRota] = useState<string | null>(null);
  const [filtroBusca, setFiltroBusca] = useState("");
  const [filtroData, setFiltroData] = useState<Date | undefined>(new Date());
  const [posicaoSelecionada, setPosicaoSelecionada] = useState<[number, number] | null>(null);
  const [vistoriaSelecionada, setVistoriaSelecionada] = useState<string | null>(null);
  
  // Hook para buscar bairros das rotas - após filtroData ser declarado
  const { data: rotasBairros } = useRotasBairros(filtroData);

  // Obter lista de IDs de rotas únicas
  const rotasIds = useMemo(() => {
    if (!vistorias) return [];
    const ids = [...new Set(vistorias.map(v => v.rota_id).filter(Boolean))] as string[];
    return ids;
  }, [vistorias]);

  // Filtrar vistorias
  const vistoriasFiltradas = useMemo(() => {
    if (!vistorias) return [];

    return vistorias.filter((v) => {
      // Filtro por data - inclui vistorias do dia selecionado E vistorias atrasadas (não concluídas)
      if (filtroData) {
        if (!v.data_agendada) return false;
        const dataVistoria = new Date(v.data_agendada);
        const isDataSelecionada = isSameDay(dataVistoria, filtroData);
        
        // Considerar atrasada se: data anterior ao dia selecionado E status diferente de concluída/cancelada
        const isAtrasada = dataVistoria < filtroData && 
          v.status !== 'concluida' && 
          v.status !== 'cancelada';
        
        // Mostrar se é do dia selecionado OU se está atrasada
        if (!isDataSelecionada && !isAtrasada) return false;
      }

      if (filtroTipo !== "todos" && v.tipo_vistoria !== filtroTipo) return false;

      // Filtro por rota
      if (filtroRota !== null) {
        if (filtroRota === 'sem_rota') {
          if (v.rota_id !== null) return false;
        } else {
          if (v.rota_id !== filtroRota) return false;
        }
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
  }, [vistorias, filtroTipo, filtroRota, filtroData, filtroBusca]);

  // Vistorias com coordenadas
  const vistoriasComCoordenadas = useMemo(() => {
    return vistoriasFiltradas.filter((v) => v.latitude && v.longitude);
  }, [vistoriasFiltradas]);

  // Agrupar por rota para legenda e polylines
  const rotasAgrupadas = useMemo(() => {
    return agruparPorRota(vistoriasComCoordenadas);
  }, [vistoriasComCoordenadas]);

  // Criar legenda baseada nas ROTAS DO BANCO (não das vistorias filtradas)
  const rotasParaLegenda = useMemo(() => {
    if (!rotasBairros?.length) return rotasAgrupadas;
    
    // Usar rotas do banco como base para a legenda
    const rotasDoDb = rotasBairros.map(rota => ({
      rota_id: rota.rota_id,
      rota_codigo: rota.codigo,
      rota_cor: rota.cor,
      rota_regiao: rota.bairros.slice(0, 3).join(', '),
      vistoriador_nome: null as string | null,
      vistorias: vistoriasComCoordenadas.filter(v => v.rota_id === rota.rota_id),
    }));
    
    // Adicionar grupo "sem rota" se houver vistorias sem rota
    const semRota = rotasAgrupadas.find(r => !r.rota_id);
    if (semRota && semRota.vistorias.length > 0) {
      rotasDoDb.push(semRota);
    }
    
    return rotasDoDb;
  }, [rotasBairros, vistoriasComCoordenadas, rotasAgrupadas]);

  // Mapear bairros com cores de rotas para polígonos - FONTE: ROTAS (não vistorias)
  const bairrosComRota = useMemo(() => {
    const mapa = new Map<string, string>(); // bairro normalizado -> cor
    
    rotasBairros?.forEach((rota) => {
      rota.bairros.forEach((bairro) => {
        const bairroNormalizado = normalizarNomeBairro(bairro);
        if (!mapa.has(bairroNormalizado)) {
          mapa.set(bairroNormalizado, rota.cor);
        }
      });
    });
    
    // Debug log
    console.log('🗓️ Data filtro:', filtroData);
    console.log('📍 Rotas Bairros:', rotasBairros);
    console.log('🗺️ Bairros com Rota:', Array.from(mapa.entries()));
    
    return mapa;
  }, [rotasBairros, filtroData]);

  // Função de estilo para os polígonos dos bairros
  const styleBairro = useMemo(() => (feature: GeoJSON.Feature | undefined) => {
    if (!feature?.properties?.name) {
      return { fillOpacity: 0, weight: 0 };
    }
    
    const nomeOriginal = feature.properties.name;
    const nomeBairro = normalizarNomeBairro(nomeOriginal);
    const corRota = bairrosComRota.get(nomeBairro);
    
    // Debug: tentar variantes de normalização
    if (!corRota) {
      // Tentar encontrar match parcial
      for (const [bairroRota, cor] of bairrosComRota.entries()) {
        if (bairroRota.includes(nomeBairro) || nomeBairro.includes(bairroRota)) {
          console.log(`🔍 Match parcial: "${nomeOriginal}" -> "${bairroRota}"`);
          return {
            fillColor: cor,
            fillOpacity: 0.25,
            color: cor,
            weight: 2,
            opacity: 0.7,
          };
        }
      }
    }
    
    if (corRota) {
      return {
        fillColor: corRota,
        fillOpacity: 0.25,
        color: corRota,
        weight: 2,
        opacity: 0.7,
      };
    }
    
    // Bairro sem rota: transparente/invisível
    return {
      fillColor: "transparent",
      fillOpacity: 0,
      color: "#aaa",
      weight: 0.5,
      opacity: 0.2,
    };
  }, [bairrosComRota]);

  // Selecionar vistoria
  const selecionarVistoria = (vistoria: VistoriaMapa) => {
    if (vistoria.latitude && vistoria.longitude) {
      setPosicaoSelecionada([vistoria.latitude, vistoria.longitude]);
      setVistoriaSelecionada(vistoria.id);
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

  const centroInicial: [number, number] = [-22.9068, -43.1729]; // Rio de Janeiro

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

          {/* Filtro de Data */}
          <div className="mt-3 space-y-2">
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

            {/* Limpar filtro de data */}
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
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full px-4 pb-4">
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
                  const color = v.rota_cor || (v.rota_id 
                    ? getRotaColor(v.rota_id, rotasIds)
                    : SEM_ROTA_COLOR);
                  
                  // Verificar se está atrasada
                  const isAtrasada = filtroData && v.data_agendada && 
                    new Date(v.data_agendada) < filtroData && 
                    v.status !== 'concluida' && v.status !== 'cancelada';
                  
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

                          {/* Info da rota */}
                          {v.rota_id && (
                            <p className="text-xs mt-1 flex items-center gap-1" style={{ color }}>
                              <Route className="h-3 w-3" />
                              {v.rota_codigo || 'Rota atribuída'}
                              {v.vistoriador_nome && ` • ${v.vistoriador_nome}`}
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

            {/* Camada de polígonos dos bairros */}
            {bairrosGeoJSON && (
              <GeoJSON
                key={`bairros-${filtroData?.getTime() || 0}-${bairrosComRota.size}-${Array.from(bairrosComRota.keys()).join(',')}`}
                data={bairrosGeoJSON as GeoJSON.FeatureCollection}
                style={styleBairro}
                onEachFeature={(feature, layer) => {
                  const nome = feature.properties?.name || 'Desconhecido';
                  const normalizado = normalizarNomeBairro(nome);
                  const temRota = bairrosComRota.has(normalizado);
                  layer.bindTooltip(`${nome}${temRota ? ' ✓' : ''}`, { 
                    permanent: false,
                    className: temRota ? 'leaflet-tooltip-rota' : ''
                  });
                }}
              />
            )}

            {/* Polylines conectando pontos de cada rota */}
            {rotasAgrupadas.map((rota) => {
              if (!rota.rota_id) return null; // Não desenhar linha para sem rota
              
              const vistoriasComGps = rota.vistorias.filter(v => v.latitude && v.longitude);
              if (vistoriasComGps.length < 2) return null; // Precisa de pelo menos 2 pontos
              
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

            {/* Marcadores - Pinos vermelhos fixos para vistorias */}
            {vistoriasComCoordenadas.map((v) => {
              return (
                <Marker
                  key={`marker-${v.id}-red`}
                  position={[v.latitude!, v.longitude!]}
                  icon={getColoredIcon(VISTORIA_PIN_COLOR)}
                >
                  <Popup>
                    <div className="min-w-[200px]">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-sm">{v.veiculo_placa || "Sem placa"}</h3>
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                          {TIPO_VISTORIA_LABELS[v.tipo_vistoria as keyof typeof TIPO_VISTORIA_LABELS] || v.tipo_vistoria}
                        </span>
                      </div>

                      <div className="text-xs space-y-1 mb-2">
                        <p><strong>Associado:</strong> {v.associado_nome || "-"}</p>
                        <p><strong>Veículo:</strong> {v.veiculo_marca} {v.veiculo_modelo}</p>
                        {v.data_agendada && (
                          <p><strong>Agendada:</strong> {format(new Date(v.data_agendada), "dd/MM/yyyy", { locale: ptBR })}</p>
                        )}
                        <p><strong>Local:</strong> {v.endereco_bairro}, {v.endereco_cidade}</p>
                        
                        {/* Info da rota no popup */}
                        {v.rota_id && (
                          <p className="mt-1 pt-1 border-t">
                            <strong>Rota:</strong>{" "}
                            <span 
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-white text-xs"
                              style={{ backgroundColor: v.rota_cor || "#3B82F6" }}
                            >
                              {v.rota_codigo || 'Atribuída'}
                            </span>
                          </p>
                        )}
                        {v.vistoriador_nome && (
                          <p><strong>Vistoriador:</strong> {v.vistoriador_nome}</p>
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
          </MapContainer>

          {/* Legenda de Rotas - baseada nas rotas do banco */}
          <MapaRotasLegenda
            rotas={rotasParaLegenda}
            rotasIds={rotasBairros?.map(r => r.rota_id) || rotasIds}
            rotaSelecionada={filtroRota}
            onRotaClick={setFiltroRota}
            dataSelecionada={filtroData}
          />

          <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs text-muted-foreground border shadow-sm flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            {vistoriasComCoordenadas.length} vistorias • Tempo real
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
