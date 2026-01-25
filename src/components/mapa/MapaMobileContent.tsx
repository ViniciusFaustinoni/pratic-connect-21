import { useState, useEffect, useMemo } from "react";
import ReactDOM from "react-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { RotaPolyline } from "@/components/mapa/RotaPolyline";
import { useRotaReal } from "@/hooks/useRotaReal";
import L from "leaflet";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Phone,
  Navigation,
  MapPin,
  Route,
  Play,
  Clock,
  Wrench,
  ClipboardCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { useIniciarServico } from "@/hooks/useIniciarServico";
import { useTarefaAtual, TarefaAtual } from "@/hooks/useTarefaAtual";
import { TIPO_SERVICO_LABELS } from "@/hooks/useServicos";

// Componente para garantir que o mapa recalcule suas dimensões após montar
function MapResizer() {
  const map = useMap();
  
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    
    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);
  
  return null;
}

// Componente para ajustar bounds mostrando posição atual e tarefa
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

// Ícone destacado para a tarefa atribuída
function getTarefaIcon(color: string = '#3B82F6'): L.Icon {
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
  
  return new L.Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
    iconSize: [44, 60],
    iconAnchor: [22, 60],
    popupAnchor: [0, -60],
  });
}

// Componente para localização do usuário - usa portal para evitar conflitos com eventos do mapa
function UserLocationButton() {
  const map = useMap();
  const [isLocating, setIsLocating] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
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
  const { data: tarefa, isLoading: isLoadingTarefa } = useTarefaAtual();
  const { geoState, emServico } = useIniciarServico();

  // Posição atual do profissional (se disponível)
  const posicaoAtual = useMemo(() => {
    if (geoState.status === 'granted' && geoState.latitude && geoState.longitude) {
      return [geoState.latitude, geoState.longitude] as [number, number];
    }
    return null;
  }, [geoState]);

  // Posição da tarefa atribuída
  const posicaoTarefa = useMemo((): [number, number] | null => {
    if (tarefa?.endereco?.latitude && tarefa?.endereco?.longitude) {
      return [tarefa.endereco.latitude, tarefa.endereco.longitude];
    }
    return null;
  }, [tarefa]);

  // Buscar rota real (distância e tempo estimado)
  const rotaReal = useRotaReal(posicaoAtual, posicaoTarefa);

  // Navegar para execução
  const iniciarServico = (t: TarefaAtual) => {
    if (t.tipo === 'instalacao') {
      navigate(`/instalador/instalacao/${t.id}`);
    } else {
      navigate(`/vistoriador/vistoria-completa/${t.id}`);
    }
  };

  // Abrir WhatsApp
  const abrirWhatsApp = (telefone: string | null | undefined) => {
    if (!telefone) {
      toast.error("Telefone não cadastrado");
      return;
    }
    const numero = telefone.replace(/\D/g, "");
    window.open(`https://wa.me/55${numero}`, "_blank");
  };

  // Abrir Google Maps
  const abrirGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
  };

  const centroInicial: [number, number] = [-22.9068, -43.1729]; // Rio de Janeiro

  if (isLoadingTarefa) {
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
        <UserLocationButton />
        
        {/* Auto-ajuste de bounds para mostrar posição atual e tarefa */}
        <FitToBounds posicaoAtual={posicaoAtual} posicaoTarefa={posicaoTarefa} />

        {/* Rota real (seguindo ruas) entre minha posição e tarefa */}
        {posicaoAtual && posicaoTarefa && (
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

        {/* Marcador da tarefa atribuída */}
        {posicaoTarefa && tarefa && (
          <Marker
            position={posicaoTarefa}
            icon={getTarefaIcon(tarefa.tipo === 'instalacao' ? '#10B981' : '#3B82F6')}
          >
            <Popup>
              <div className="min-w-[220px]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm">{tarefa.veiculo.placa || "Sem placa"}</h3>
                  <Badge className="text-xs">
                    {tarefa.tipo === 'instalacao' ? 'Instalação' : TIPO_SERVICO_LABELS[tarefa.tipo]}
                  </Badge>
                </div>

                <div className="text-xs space-y-1 mb-3">
                  <p><strong>Cliente:</strong> {tarefa.cliente.nome || "-"}</p>
                  <p><strong>Veículo:</strong> {tarefa.veiculo.marca} {tarefa.veiculo.modelo}</p>
                  {tarefa.data_agendada && (
                    <p>
                      <strong>Agendada:</strong> {format(new Date(tarefa.data_agendada + 'T00:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                      {tarefa.hora_agendada && ` às ${tarefa.hora_agendada.slice(0, 5)}`}
                    </p>
                  )}
                  <p><strong>Local:</strong> {tarefa.endereco.bairro}, {tarefa.endereco.cidade}</p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {tarefa.cliente.telefone && (
                    <button
                      onClick={() => abrirWhatsApp(tarefa.cliente.telefone)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                    >
                      <Phone className="h-3 w-3" />
                      WhatsApp
                    </button>
                  )}
                  <button
                    onClick={() => abrirGoogleMaps(posicaoTarefa[0], posicaoTarefa[1])}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                  >
                    <Navigation className="h-3 w-3" />
                    Navegar
                  </button>
                  <button
                    onClick={() => iniciarServico(tarefa)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded text-xs hover:bg-primary/90"
                  >
                    <Play className="h-3 w-3" />
                    {tarefa.status === 'em_rota' || tarefa.status === 'em_andamento' ? 'Continuar' : 'Iniciar'}
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Botão de ação inferior */}
      <div className="absolute bottom-4 left-4 right-4 z-40">
        {tarefa ? (
          <Button
            className="w-full shadow-lg h-14 text-base gap-2"
            size="lg"
            onClick={() => iniciarServico(tarefa)}
          >
            {tarefa.tipo === 'instalacao' ? (
              <Wrench className="h-5 w-5" />
            ) : (
              <ClipboardCheck className="h-5 w-5" />
            )}
            <span className="font-semibold">
              {tarefa.tipo === 'instalacao' ? 'INSTALAÇÃO' : 'VISTORIA'} - {tarefa.veiculo.placa}
            </span>
            {rotaReal.distanciaKm > 0 && (
              <Badge variant="secondary" className="ml-1 gap-1">
                <Route className="h-3 w-3" />
                {rotaReal.distanciaKm < 1 
                  ? `${(rotaReal.distanciaKm * 1000).toFixed(0)}m`
                  : `${rotaReal.distanciaKm.toFixed(1)}km`
                }
              </Badge>
            )}
            {rotaReal.tempoMinutos > 0 && (
              <Badge variant="outline" className="ml-1 gap-1 bg-background/50">
                <Clock className="h-3 w-3" />
                ~{rotaReal.tempoMinutos}min
              </Badge>
            )}
          </Button>
        ) : emServico ? (
          <Button
            className="w-full shadow-lg h-14 text-base"
            size="lg"
            variant="secondary"
            disabled
          >
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Aguardando tarefa...
          </Button>
        ) : (
          <Button
            className="w-full shadow-lg h-14 text-base"
            size="lg"
            variant="outline"
            disabled
          >
            <MapPin className="h-5 w-5 mr-2" />
            Inicie o serviço para receber tarefas
          </Button>
        )}
      </div>
    </div>
  );
}
