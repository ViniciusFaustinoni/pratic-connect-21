import { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { getHojeBrasilia } from "@/lib/date-utils";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import { RotaPolyline } from "@/components/mapa/RotaPolyline";
import { useRotaReal } from "@/hooks/useRotaReal";
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
import { useIniciarServico } from "@/hooks/useIniciarServico";

// Status que indicam que o serviço foi finalizado
const STATUS_FINALIZADOS = ['concluida', 'cancelada', 'aprovada', 'reprovada', 'em_analise'];

// Status que indicam tarefa pendente (ainda não iniciada ou em rota)
const STATUS_PENDENTES = ['pendente', 'agendada', 'em_rota'];

// Status que indicam tarefa em andamento
const STATUS_EM_ANDAMENTO = ['em_andamento'];

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

// Ícone destacado para próxima tarefa (maior e com efeito glow)
function getProximaTarefaIcon(color: string): L.Icon {
  const cacheKey = `proxima-${color}`;
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 48" width="44" height="60">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <path filter="url(#glow)" fill="${color}" stroke="#fff" stroke-width="2.5" 
        d="M16 0C7.2 0 0 7.2 0 16c0 12 16 32 16 32s16-20 16-32C32 7.2 24.8 0 16 0z"/>
      <circle fill="#fff" cx="16" cy="16" r="9"/>
      <circle fill="${color}" cx="16" cy="16" r="5"/>
    </svg>
  `;
  
  const icon = new L.Icon({
    iconUrl: svgToDataUrl(svg),
    iconSize: [44, 60],
    iconAnchor: [22, 60],
    popupAnchor: [0, -60],
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

// Componente para ajustar bounds mostrando posição atual e próxima tarefa
function FitToBounds({ 
  posicaoAtual, 
  posicaoTarefa 
}: { 
  posicaoAtual: [number, number] | null; 
  posicaoTarefa: [number, number] | null 
}) {
  const map = useMap();
  
  useEffect(() => {
    if (posicaoAtual && posicaoTarefa) {
      const bounds = L.latLngBounds([posicaoAtual, posicaoTarefa]);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    } else if (posicaoAtual) {
      map.flyTo(posicaoAtual, 15, { duration: 1 });
    } else if (posicaoTarefa) {
      map.flyTo(posicaoTarefa, 15, { duration: 1 });
    }
  }, [posicaoAtual, posicaoTarefa, map]);
  
  return null;
}

// Componente para garantir que o mapa recalcule suas dimensões após montar
function MapResizer() {
  const map = useMap();
  
  useEffect(() => {
    // Pequeno delay para garantir que o container tenha dimensões
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    
    // Recalcula também quando a janela redimensiona
    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);
  
  return null;
}

// Ícone de localização atual do profissional (pulsante azul)
function getMinhaLocalizacaoIcon(): L.DivIcon {
  const html = `
    <div class="minha-localizacao-marker-container">
      <div class="pulse-ring"></div>
      <div class="marker-dot"></div>
    </div>
  `;
  
  return L.divIcon({
    html,
    className: 'minha-localizacao-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// Função para calcular distância Haversine entre dois pontos
function calcularDistanciaKm(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * 
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Componente para localização do usuário - usa portal para evitar conflitos com eventos do mapa
function UserLocationButton() {
  const map = useMap();
  const [isLocating, setIsLocating] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Encontrar o container do mapa e criar o portal fora da área de eventos
    const mapContainer = map.getContainer();
    const existingBtn = mapContainer.querySelector('.user-location-btn-container');
    if (existingBtn) {
      existingBtn.remove();
    }
    
    const btnContainer = document.createElement('div');
    btnContainer.className = 'user-location-btn-container';
    btnContainer.style.cssText = 'position: absolute; top: 16px; right: 16px; z-index: 1000;';
    mapContainer.appendChild(btnContainer);
    setContainer(btnContainer);
    
    return () => {
      btnContainer.remove();
    };
  }, [map]);

  const handleLocate = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
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

  if (!container) return null;

  // Usar ReactDOM.createPortal seria ideal, mas para simplificar usamos renderização direta
  return ReactDOM.createPortal(
    <button
      type="button"
      className="h-10 w-10 rounded-full shadow-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center"
      onClick={handleLocate}
      disabled={isLocating}
      style={{ touchAction: 'manipulation' }}
    >
      <Navigation className={cn("h-5 w-5", isLocating && "animate-pulse")} />
    </button>,
    container
  );
}

export function MapaMobileContent() {
  const navigate = useNavigate();
  // Filtrar apenas serviços do usuário logado (vistoriador/instalador)
  const { data: vistorias, isLoading } = useVistoriasMapa({ filtrarPorUsuario: true });
  const { geoState, emServico } = useIniciarServico();
  const [filtroData, setFiltroData] = useState<Date>(() => getHojeBrasilia());
  const [filtroBusca, setFiltroBusca] = useState("");
  const [posicaoSelecionada, setPosicaoSelecionada] = useState<[number, number] | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Posição atual do profissional (se disponível)
  const posicaoAtual = useMemo(() => {
    if (geoState.status === 'granted' && geoState.latitude && geoState.longitude) {
      return [geoState.latitude, geoState.longitude] as [number, number];
    }
    return null;
  }, [geoState]);

  // Obter lista de IDs de rotas únicas
  const rotasIds = useMemo(() => {
    if (!vistorias) return [];
    const ids = [...new Set(vistorias.map(v => v.rota_id).filter(Boolean))] as string[];
    return ids;
  }, [vistorias]);

  // Verificar se uma vistoria é atrasada (compara com HOJE, não com o filtro)
  const isAtrasada = (v: VistoriaMapa) => {
    if (!v.data_agendada) return false;
    if (STATUS_FINALIZADOS.includes(v.status)) return false;
    
    const dataAgendadaStr = v.data_agendada.slice(0, 10);
    const dataVistoria = new Date(dataAgendadaStr + 'T00:00:00');
    const hoje = getHojeBrasilia();
    
    return dataVistoria < hoje;
  };

  // Verificar se o filtro é hoje ou futuro
  const isHojeOuFuturo = useMemo(() => {
    const filtroNormalizado = new Date(filtroData);
    filtroNormalizado.setHours(0, 0, 0, 0);
    const hoje = getHojeBrasilia();
    return filtroNormalizado >= hoje;
  }, [filtroData]);

  // Filtrar vistorias e identificar próxima tarefa
  const { vistoriasFiltradas, proximaTarefa } = useMemo(() => {
    if (!vistorias) return { vistoriasFiltradas: [], proximaTarefa: null as VistoriaMapa | null };

    const filtroNormalizado = new Date(filtroData);
    filtroNormalizado.setHours(0, 0, 0, 0);
    const hoje = getHojeBrasilia();

    // Filtrar tarefas do dia selecionado
    const tarefasDoFiltro = vistorias.filter((v) => {
      if (!v.data_agendada) return false;
      const dataAgendadaStr = v.data_agendada.slice(0, 10);
      const dataVistoria = new Date(dataAgendadaStr + 'T00:00:00');
      return isSameDay(dataVistoria, filtroNormalizado);
    });

    // Se for dia anterior, mostrar apenas tarefas daquele dia (finalizadas ou não)
    if (filtroNormalizado < hoje) {
      // Aplicar filtro de busca
      let resultado = tarefasDoFiltro;
      if (filtroBusca) {
        const termo = filtroBusca.toLowerCase();
        resultado = resultado.filter(v => {
          const placa = v.veiculo_placa?.toLowerCase() || "";
          const associado = v.associado_nome?.toLowerCase() || "";
          const bairro = v.endereco_bairro?.toLowerCase() || "";
          return placa.includes(termo) || associado.includes(termo) || bairro.includes(termo);
        });
      }
      return { vistoriasFiltradas: resultado, proximaTarefa: null as VistoriaMapa | null };
    }

    // Para HOJE ou futuro: incluir atrasadas de dias anteriores
    const tarefasAtrasadas = vistorias.filter((v) => {
      if (!v.data_agendada) return false;
      const dataAgendadaStr = v.data_agendada.slice(0, 10);
      const dataVistoria = new Date(dataAgendadaStr + 'T00:00:00');
      return dataVistoria < hoje && !STATUS_FINALIZADOS.includes(v.status);
    });

    // Combinar e ordenar: atrasadas primeiro, depois por horário
    const todasTarefas = [...tarefasAtrasadas, ...tarefasDoFiltro].sort((a, b) => {
      const aAtrasada = isAtrasada(a);
      const bAtrasada = isAtrasada(b);
      if (aAtrasada && !bAtrasada) return -1;
      if (!aAtrasada && bAtrasada) return 1;
      return (a.horario_agendado || '').localeCompare(b.horario_agendado || '');
    });

    // Aplicar filtro de busca
    let tarefasFiltradas = todasTarefas;
    if (filtroBusca) {
      const termo = filtroBusca.toLowerCase();
      tarefasFiltradas = tarefasFiltradas.filter(v => {
        const placa = v.veiculo_placa?.toLowerCase() || "";
        const associado = v.associado_nome?.toLowerCase() || "";
        const bairro = v.endereco_bairro?.toLowerCase() || "";
        return placa.includes(termo) || associado.includes(termo) || bairro.includes(termo);
      });
    }

    // Identificar a próxima tarefa pendente (não finalizada)
    const proxima = todasTarefas.find(v => 
      STATUS_PENDENTES.includes(v.status) || STATUS_EM_ANDAMENTO.includes(v.status)
    ) || null;

    return { 
      vistoriasFiltradas: tarefasFiltradas, 
      proximaTarefa: proxima 
    };
  }, [vistorias, filtroData, filtroBusca]);

  // Determinar quais vistorias mostrar no mapa
  const vistoriasParaMapa = useMemo(() => {
    if (isHojeOuFuturo) {
      // HOJE ou FUTURO: Mostrar APENAS a próxima tarefa
      return proximaTarefa && proximaTarefa.latitude && proximaTarefa.longitude 
        ? [proximaTarefa] 
        : [];
    } else {
      // DIA ANTERIOR: Mostrar todas com coordenadas
      return vistoriasFiltradas.filter(v => v.latitude && v.longitude);
    }
  }, [isHojeOuFuturo, proximaTarefa, vistoriasFiltradas]);

  // Agrupar por rota para polylines (apenas para dias anteriores)
  const rotasAgrupadas = useMemo(() => {
    if (isHojeOuFuturo) return []; // Sem polylines para hoje/futuro
    return agruparPorRota(vistoriasParaMapa);
  }, [isHojeOuFuturo, vistoriasParaMapa]);

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

  // Posição da tarefa para FitBounds e rota
  const posicaoTarefa = useMemo((): [number, number] | null => {
    if (proximaTarefa?.latitude && proximaTarefa?.longitude) {
      return [proximaTarefa.latitude, proximaTarefa.longitude];
    }
    return null;
  }, [proximaTarefa]);

  // Buscar rota real para próxima tarefa (distância e tempo estimado)
  const rotaReal = useRotaReal(posicaoAtual, posicaoTarefa);
  
  // Distância para próxima tarefa (usa rota real se disponível, senão Haversine)
  const distanciaParaProximaTarefa = useMemo(() => {
    if (rotaReal.distanciaKm > 0) {
      return rotaReal.distanciaKm;
    }
    if (!posicaoAtual || !proximaTarefa?.latitude || !proximaTarefa?.longitude) {
      return null;
    }
    return calcularDistanciaKm(
      posicaoAtual[0],
      posicaoAtual[1],
      proximaTarefa.latitude,
      proximaTarefa.longitude
    );
  }, [posicaoAtual, proximaTarefa, rotaReal.distanciaKm]);

  // Contadores para UI
  const tarefasPendentes = vistoriasFiltradas.filter(v => 
    STATUS_PENDENTES.includes(v.status) || STATUS_EM_ANDAMENTO.includes(v.status)
  ).length;
  
  const tarefasAtrasadas = vistoriasFiltradas.filter(v => isAtrasada(v)).length;

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
        {/* Camada satélite (Esri World Imagery) - Estilo Google Earth */}
        <TileLayer
          attribution='Tiles &copy; Esri'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        {/* Camada de labels para nomes de ruas */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
          attribution=""
        />

        <MapResizer />
        <FlyToPosition position={posicaoSelecionada} />
        <UserLocationButton />
        
        {/* Auto-ajuste de bounds para mostrar posição atual e próxima tarefa */}
        {isHojeOuFuturo && !posicaoSelecionada && (
          <FitToBounds posicaoAtual={posicaoAtual} posicaoTarefa={posicaoTarefa} />
        )}

        {/* Rota real (seguindo ruas) entre minha posição e próxima tarefa */}
        {isHojeOuFuturo && posicaoAtual && posicaoTarefa && (
          <RotaPolyline
            origem={posicaoAtual}
            destino={posicaoTarefa}
            cor="#3B82F6"
            peso={5}
            opacidade={0.85}
          />
        )}

        {/* Marcador da minha posição atual */}
        {posicaoAtual && (
          <Marker
            position={posicaoAtual}
            icon={getMinhaLocalizacaoIcon()}
            zIndexOffset={1000}
          >
            <Popup>
              <div className="text-center">
                <p className="font-semibold text-sm">Minha Posição</p>
                {geoState.accuracy && (
                  <p className="text-xs text-muted-foreground">
                    Precisão: {geoState.accuracy.toFixed(0)}m
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Polylines conectando pontos de cada rota (apenas para dias anteriores) */}
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
        {vistoriasParaMapa.map((v) => {
          const markerColor = v.rota_cor || SEM_ROTA_COLOR;
          const tipoServico = getTipoServico(v);
          const atrasada = isAtrasada(v);
          const isProxima = isHojeOuFuturo && proximaTarefa?.id === v.id;
          
          return (
            <Marker
              key={`marker-${v.id}`}
              position={[v.latitude!, v.longitude!]}
              icon={isProxima ? getProximaTarefaIcon(markerColor) : getColoredIcon(markerColor)}
            >
              <Popup>
                <div className="min-w-[220px]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-sm">{v.veiculo_placa || "Sem placa"}</h3>
                    <div className="flex gap-1">
                      {isProxima && (
                        <span className="text-xs px-2 py-0.5 rounded bg-primary text-primary-foreground">
                          Próxima
                        </span>
                      )}
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
      <div className="absolute top-4 left-4 right-16 z-40">
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
              onClick={() => setFiltroData(getHojeBrasilia())}
            >
              <CalendarIcon className="h-3 w-3 mr-1.5" />
              {isSameDay(filtroData, getHojeBrasilia()) 
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
            className="absolute bottom-4 left-4 right-4 z-40 shadow-lg"
            size="lg"
          >
            <List className="h-4 w-4 mr-2" />
            {isHojeOuFuturo ? (
              <>
                {proximaTarefa ? (
                  <>
                    Próxima tarefa
                    {distanciaParaProximaTarefa !== null && (
                      <Badge variant="secondary" className="ml-2">
                        {distanciaParaProximaTarefa < 1 
                          ? `${(distanciaParaProximaTarefa * 1000).toFixed(0)}m`
                          : `${distanciaParaProximaTarefa.toFixed(1)}km`
                        }
                      </Badge>
                    )}
                    {tarefasPendentes > 1 && (
                      <span className="ml-1 opacity-80 text-xs">
                        (+{tarefasPendentes - 1})
                      </span>
                    )}
                  </>
                ) : (
                  "Sem tarefas pendentes"
                )}
                {tarefasAtrasadas > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {tarefasAtrasadas} atrasadas
                  </Badge>
                )}
              </>
            ) : (
              <>
                {vistoriasFiltradas.length} serviços
              </>
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
                  const isProxima = isHojeOuFuturo && proximaTarefa?.id === v.id;

                  return (
                    <div
                      key={v.id}
                      className={cn(
                        "p-3 rounded-lg border bg-card transition-colors cursor-pointer hover:bg-accent",
                        atrasada && "border-orange-500/50 bg-orange-500/5",
                        isProxima && "border-primary ring-2 ring-primary/30 bg-primary/5"
                      )}
                      onClick={() => selecionarVistoria(v)}
                    >
                      {/* Badge de Próxima Tarefa com distância e tempo */}
                      {isProxima && (
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <Badge className="bg-primary text-primary-foreground">
                            <Play className="h-3 w-3 mr-1" />
                            Próxima Tarefa
                          </Badge>
                          {distanciaParaProximaTarefa && (
                            <Badge variant="outline" className="gap-1">
                              <Route className="h-3 w-3" />
                              {distanciaParaProximaTarefa.toFixed(1)} km
                            </Badge>
                          )}
                          {rotaReal.tempoMinutos > 0 && (
                            <Badge variant="outline" className="gap-1">
                              <Clock className="h-3 w-3" />
                              ~{rotaReal.tempoMinutos} min
                            </Badge>
                          )}
                        </div>
                      )}
                      
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
