import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { RotaPolyline } from "@/components/mapa/RotaPolyline";
import L from "leaflet";
import { format, isSameDay, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  ClipboardCheck,
  Phone,
  Navigation,
  Locate,
  MapPin,
  X as XIcon,
  CheckCircle2,
  User,
  List,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { useVistoriasMapa, VistoriaMapa } from "@/hooks/useVistoriasMapa";
import { useVistoriadoresRealtime, VistoriadorLocalizacao } from "@/hooks/useVistoriadoresRealtime";
import { TIPO_VISTORIA_LABELS } from "@/types/servicos-rota";
import { createColoredMarkerSvg, svgToDataUrl, createVistoriadorMarkerSvg, COR_VISTORIADOR } from "@/lib/rota-colors";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useConfigAtribuicaoManual, useAtribuirServicoManual } from "@/hooks/useAtribuicaoManual";
import { useDesatribuirServico } from "@/hooks/useDesatribuirServico";
import { usePermissions } from "@/hooks/usePermissions";

const COR_REALIZADA = '#10B981';
const COR_A_REALIZAR = '#EF4444';
const COR_DRAGGABLE = '#F59E0B';
const STATUS_REALIZADOS = ['concluida', 'aprovada', 'reprovada', 'em_analise'];

function getCorPorStatus(status: string): string {
  if (STATUS_REALIZADOS.includes(status)) return COR_REALIZADA;
  return COR_A_REALIZAR;
}

const iconCache = new Map<string, L.Icon>();
function getColoredIcon(color: string, draggable = false): L.Icon {
  const cacheKey = `icon-${color}-${draggable}`;
  if (iconCache.has(cacheKey)) return iconCache.get(cacheKey)!;
  const icon = new L.Icon({
    iconUrl: svgToDataUrl(createColoredMarkerSvg(color)),
    iconSize: draggable ? [38, 48] : [32, 40],
    iconAnchor: draggable ? [19, 48] : [16, 40],
    popupAnchor: [0, draggable ? -48 : -40],
  });
  iconCache.set(cacheKey, icon);
  return icon;
}

function getDraggableIcon(color: string): L.DivIcon {
  return L.divIcon({
    html: `
      <div style="position:relative;cursor:grab;">
        <img src="${svgToDataUrl(createColoredMarkerSvg(color))}" width="38" height="48" style="filter: drop-shadow(0 0 6px ${color}80);" />
        <div style="position:absolute;top:-8px;right:-8px;background:#F59E0B;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><circle cx="8" cy="4" r="2"/><circle cx="16" cy="4" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="20" r="2"/><circle cx="16" cy="20" r="2"/></svg>
        </div>
      </div>
    `,
    className: 'draggable-marker-icon',
    iconSize: [38, 48],
    iconAnchor: [19, 48],
    popupAnchor: [0, -48],
  });
}

const vistoriadorIconCache = new Map<string, L.Icon>();
function getVistoriadorIcon(color: string = COR_VISTORIADOR): L.Icon {
  const cacheKey = `vistoriador-${color}`;
  if (vistoriadorIconCache.has(cacheKey)) return vistoriadorIconCache.get(cacheKey)!;
  const icon = new L.Icon({
    iconUrl: svgToDataUrl(createVistoriadorMarkerSvg(color)),
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
  vistoriadorIconCache.set(cacheKey, icon);
  return icon;
}

function FlyToPosition({ position, zoom = 15 }: { position: [number, number] | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, zoom, { duration: 1 });
  }, [position, zoom, map]);
  return null;
}

export function MapaVistoriasContent() {
  const isMobile = useIsMobile();
  const { data: vistorias, isLoading } = useVistoriasMapa();
  const { data: vistoriadores, isLoading: isLoadingVistoriadores } = useVistoriadoresRealtime();
  const { data: atribuicaoManualAtiva } = useConfigAtribuicaoManual();
  const atribuirMutation = useAtribuirServicoManual();
  const desatribuirMutation = useDesatribuirServico();
  const { isDiretor, isCoordenadorMonitoramento, isAdminMaster, isDesenvolvedor } = usePermissions();

  const podeCancelarAtribuicao = isDiretor || isCoordenadorMonitoramento || isAdminMaster || isDesenvolvedor;

  const [filtroBusca, setFiltroBusca] = useState("");
  const [posicaoSelecionada, setPosicaoSelecionada] = useState<[number, number] | null>(null);
  const [vistoriaSelecionada, setVistoriaSelecionada] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Drag-and-drop state
  const [dragConfirmation, setDragConfirmation] = useState<{
    servicoId: string;
    servicoPlaca: string | null;
    profissionalId: string;
    profissionalNome: string;
  } | null>(null);

  // Cancel confirmation state
  const [cancelConfirmation, setCancelConfirmation] = useState<{
    servicoId: string;
    servicoPlaca: string | null;
    profissionalNome: string | null;
  } | null>(null);

  const vistoriadoresRef = useRef<VistoriadorLocalizacao[]>([]);

  useEffect(() => {
    vistoriadoresRef.current = vistoriadores?.filter(v => v.em_servico && v.latitude && v.longitude) || [];
  }, [vistoriadores]);

  const vistoriadoresEmServico = useMemo(() => {
    return vistoriadores?.filter(v => v.em_servico && v.latitude && v.longitude) || [];
  }, [vistoriadores]);

  // Filter: today + overdue, no date picker
  const hoje = useMemo(() => new Date(), []);

  const vistoriasFiltradas = useMemo(() => {
    if (!vistorias) return [];
    return vistorias.filter((v) => {
      if (!v.data_agendada) return false;
      const dataVistoria = new Date(v.data_agendada + 'T00:00:00');
      const hojeNorm = new Date(hoje);
      hojeNorm.setHours(0, 0, 0, 0);
      const isHoje = isSameDay(dataVistoria, hojeNorm);
      const isAtrasada = dataVistoria < hojeNorm && v.status !== 'concluida' && v.status !== 'cancelada';
      if (!isHoje && !isAtrasada) return false;

      if (filtroBusca) {
        const termo = filtroBusca.toLowerCase();
        const placa = v.veiculo_placa?.toLowerCase() || "";
        const associado = v.associado_nome?.toLowerCase() || "";
        const bairro = v.endereco_bairro?.toLowerCase() || "";
        if (!placa.includes(termo) && !associado.includes(termo) && !bairro.includes(termo)) return false;
      }
      return true;
    });
  }, [vistorias, hoje, filtroBusca]);

  const vistoriasComCoordenadas = useMemo(() => {
    return vistoriasFiltradas.filter((v) => v.latitude && v.longitude);
  }, [vistoriasFiltradas]);

  const contadores = useMemo(() => {
    const realizadas = vistoriasComCoordenadas.filter(v => STATUS_REALIZADOS.includes(v.status)).length;
    const aRealizar = vistoriasComCoordenadas.length - realizadas;
    return { realizadas, aRealizar };
  }, [vistoriasComCoordenadas]);

  const linhasDeRota = useMemo(() => {
    if (!vistoriadoresEmServico.length || !vistoriasComCoordenadas.length) return [];
    return vistoriadoresEmServico.map(profissional => {
      const tarefasPendentes = vistoriasComCoordenadas.filter(v =>
        v.vistoriador_id === profissional.vistoriador_id && !STATUS_REALIZADOS.includes(v.status)
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
    }).filter(Boolean) as any[];
  }, [vistoriadoresEmServico, vistoriasComCoordenadas]);

  const selecionarVistoria = (vistoria: VistoriaMapa) => {
    if (vistoria.latitude && vistoria.longitude) {
      setPosicaoSelecionada([vistoria.latitude, vistoria.longitude]);
      setVistoriaSelecionada(vistoria.id);
      if (isMobile) setDrawerOpen(false);
    } else {
      toast.error("Vistoria sem coordenadas GPS");
    }
  };

  const abrirWhatsApp = (telefone: string | null) => {
    if (!telefone) { toast.error("Telefone não cadastrado"); return; }
    window.open(`https://wa.me/55${telefone.replace(/\D/g, "")}`, "_blank");
  };

  const abrirGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
  };

  const distanciaMetros = useCallback((lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  const handleMarkerDragEnd = useCallback((vistoria: VistoriaMapa, event: L.DragEndEvent) => {
    const marker = event.target as L.Marker;
    const dropPos = marker.getLatLng();
    const RAIO_PROXIMIDADE = 500;
    let tecnicoMaisProximo: VistoriadorLocalizacao | null = null;
    let menorDistancia = Infinity;
    for (const tec of vistoriadoresRef.current) {
      const dist = distanciaMetros(dropPos.lat, dropPos.lng, tec.latitude, tec.longitude);
      if (dist < RAIO_PROXIMIDADE && dist < menorDistancia) {
        menorDistancia = dist;
        tecnicoMaisProximo = tec;
      }
    }
    if (vistoria.latitude && vistoria.longitude) marker.setLatLng([vistoria.latitude, vistoria.longitude]);
    if (tecnicoMaisProximo) {
      setDragConfirmation({
        servicoId: vistoria.id,
        servicoPlaca: vistoria.veiculo_placa,
        profissionalId: tecnicoMaisProximo.vistoriador_id,
        profissionalNome: tecnicoMaisProximo.vistoriador_nome,
      });
    } else {
      toast.error('Solte o pin sobre um técnico para atribuir', { description: 'Arraste o serviço até o marcador azul de um técnico no mapa.', duration: 3000 });
    }
  }, [distanciaMetros]);

  const confirmarAtribuicaoDrag = useCallback(() => {
    if (!dragConfirmation) return;
    atribuirMutation.mutate({ servicoId: dragConfirmation.servicoId, profissionalId: dragConfirmation.profissionalId });
    setDragConfirmation(null);
  }, [dragConfirmation, atribuirMutation]);

  const confirmarCancelamento = useCallback(() => {
    if (!cancelConfirmation) return;
    desatribuirMutation.mutate(cancelConfirmation.servicoId);
    setCancelConfirmation(null);
  }, [cancelConfirmation, desatribuirMutation]);

  const centroInicial: [number, number] = [-22.9068, -43.1729];

  // Sidebar filters (simplified - no date, no type filter)
  const renderFilters = () => (
    <>
      <div className="flex gap-2">
        <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
          {vistoriasComCoordenadas.length} no mapa
        </Badge>
        <Badge className="bg-muted text-muted-foreground">
          {vistoriasFiltradas.length - vistoriasComCoordenadas.length} sem GPS
        </Badge>
      </div>
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
          <p className="text-sm">Nenhum serviço pendente</p>
        </div>
      ) : (
        <div className="space-y-2">
          {vistoriasFiltradas.map((v) => {
            const color = getCorPorStatus(v.status);
            const hojeNorm = new Date();
            hojeNorm.setHours(0, 0, 0, 0);
            const isAtrasada = v.data_agendada
              ? new Date(v.data_agendada + 'T00:00:00') < hojeNorm && v.status !== 'concluida' && v.status !== 'cancelada'
              : false;

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
                      <span className="font-semibold text-sm truncate">{v.veiculo_placa || "Sem placa"}</span>
                      <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                        {TIPO_VISTORIA_LABELS[v.tipo_vistoria as keyof typeof TIPO_VISTORIA_LABELS] || v.tipo_vistoria}
                      </Badge>
                      {isAtrasada && (
                        <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-300">Atrasada</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{v.associado_nome || "Sem associado"}</p>
                    {v.endereco_bairro && (
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />{v.endereco_bairro}, {v.endereco_cidade}
                      </p>
                    )}
                    {v.vistoriador_nome ? (
                      <p className="text-xs mt-1 flex items-center gap-1 text-blue-600">
                        <User className="h-3 w-3" />{v.vistoriador_nome}
                      </p>
                    ) : (
                      <p className="text-xs text-orange-600 mt-1">⚠️ Não atribuído</p>
                    )}
                    {STATUS_REALIZADOS.includes(v.status) && (
                      <p className="text-xs mt-1 flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-3 w-3" />Realizada
                      </p>
                    )}
                    {!v.latitude && <p className="text-xs text-orange-600 mt-1">⚠️ Sem coordenadas GPS</p>}
                  </div>
                  {v.latitude && v.longitude && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={(e) => { e.stopPropagation(); selecionarVistoria(v); }}>
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

  const renderMapa = () => (
    <MapContainer center={centroInicial} zoom={10} className="h-full w-full" style={{ height: "100%", width: "100%" }}>
      <TileLayer attribution='Tiles &copy; Esri' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png" attribution="" />
      <FlyToPosition position={posicaoSelecionada} />

      {/* Rotas reais */}
      {linhasDeRota.map((linha: any) => (
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
        const isDraggable = !!atribuicaoManualAtiva && !v.vistoriador_id && !isRealizada;

        return (
          <Marker
            key={`marker-${v.id}-${markerColor}-${isDraggable}`}
            position={[v.latitude!, v.longitude!]}
            icon={isDraggable ? getDraggableIcon(COR_A_REALIZAR) : getColoredIcon(markerColor)}
            draggable={isDraggable}
            eventHandlers={isDraggable ? { dragend: (e) => handleMarkerDragEnd(v, e) } : undefined}
          >
            <Popup>
              <div className="min-w-[200px]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm">{v.veiculo_placa || "Sem placa"}</h3>
                  <span className="text-xs px-2 py-0.5 rounded text-white" style={{ backgroundColor: isDraggable ? COR_DRAGGABLE : markerColor }}>
                    {isDraggable ? "Arraste →" : isRealizada ? "Realizada" : "A Realizar"}
                  </span>
                </div>
                {isDraggable && (
                  <div className="mb-2 p-1.5 rounded text-xs text-amber-800 bg-amber-50 border border-amber-200 flex items-center gap-1">
                    <GripVertical className="h-3 w-3" />Arraste até um técnico para atribuir
                  </div>
                )}
                <div className="text-xs space-y-1 mb-2">
                  <p><strong>Tipo:</strong> {TIPO_VISTORIA_LABELS[v.tipo_vistoria as keyof typeof TIPO_VISTORIA_LABELS] || v.tipo_vistoria}</p>
                  <p><strong>Associado:</strong> {v.associado_nome || "-"}</p>
                  <p><strong>Veículo:</strong> {v.veiculo_marca} {v.veiculo_modelo}</p>
                  {v.data_agendada && <p><strong>Agendada:</strong> {format(new Date(v.data_agendada), "dd/MM/yyyy", { locale: ptBR })}</p>}
                  <p><strong>Local:</strong> {v.endereco_bairro}, {v.endereco_cidade}</p>
                  <p><strong>Status:</strong> {v.status}</p>
                  {v.vistoriador_nome ? (
                    <p><strong>Vistoriador:</strong> {v.vistoriador_nome}</p>
                  ) : (
                    <p className="text-orange-600"><strong>Vistoriador:</strong> Não atribuído</p>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {v.associado_telefone && (
                    <button onClick={() => abrirWhatsApp(v.associado_telefone)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                      <Phone className="h-3 w-3" />WhatsApp
                    </button>
                  )}
                  <button onClick={() => abrirGoogleMaps(v.latitude!, v.longitude!)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
                    <Navigation className="h-3 w-3" />Google Maps
                  </button>
                  {/* Cancelar atribuição */}
                  {podeCancelarAtribuicao && v.vistoriador_id && !isRealizada && (
                    <button
                      onClick={() => setCancelConfirmation({
                        servicoId: v.id,
                        servicoPlaca: v.veiculo_placa,
                        profissionalNome: v.vistoriador_nome,
                      })}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                    >
                      <XIcon className="h-3 w-3" />Cancelar Rota
                    </button>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Vistoriadores */}
      {vistoriadoresEmServico.map((vistoriador) => (
        <Marker key={`vistoriador-${vistoriador.vistoriador_id}`} position={[vistoriador.latitude, vistoriador.longitude]} icon={getVistoriadorIcon()}>
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
                  vistoriador.status_operacional === 'em_contato' ? 'text-amber-600' : 'text-green-600'
                }`}>
                  <span className={`w-2 h-2 rounded-full animate-pulse ${
                    vistoriador.status_operacional === 'em_andamento' ? 'bg-blue-500' :
                    vistoriador.status_operacional === 'em_rota' ? 'bg-purple-500' :
                    vistoriador.status_operacional === 'em_contato' ? 'bg-amber-500' : 'bg-green-500'
                  }`} />
                  {vistoriador.status_operacional === 'em_andamento' ? 'Realizando Tarefa' :
                   vistoriador.status_operacional === 'em_rota' ? 'Em Rota' :
                   vistoriador.status_operacional === 'em_contato' ? 'Em Contato com Associado' : 'Aguardando Atribuição'}
                </p>
                <p className="text-muted-foreground">
                  Atualizado: {formatDistanceToNow(new Date(vistoriador.updated_at), { addSuffix: true, locale: ptBR })}
                </p>
              </div>
              {vistoriador.telefone && (
                <button onClick={() => abrirWhatsApp(vistoriador.telefone)} className="flex items-center justify-center gap-1 w-full px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                  <Phone className="h-3 w-3" />Contatar
                </button>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );

  const renderLegenda = () => (
    <div className={cn(
      "absolute z-[400] bg-background/95 backdrop-blur-sm rounded-lg shadow-lg border p-3",
      isMobile ? "top-2 right-2 text-xs" : "top-4 right-4"
    )}>
      <h4 className="font-semibold text-sm mb-3">Legenda</h4>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm p-2 rounded-md">
          <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: COR_REALIZADA }} />
          <span className="flex-1 text-left">Realizadas</span>
          <Badge variant="secondary" className="text-xs">{contadores.realizadas}</Badge>
        </div>
        <div className="flex items-center gap-2 text-sm p-2 rounded-md">
          <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: COR_A_REALIZAR }} />
          <span className="flex-1 text-left">A Realizar</span>
          <Badge variant="secondary" className="text-xs">{contadores.aRealizar}</Badge>
        </div>
        <div className="border-t my-2" />
        <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50">
          <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: COR_VISTORIADOR }}>
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
            <div className="w-4 h-0.5 flex-shrink-0" style={{ backgroundColor: COR_VISTORIADOR, borderStyle: 'dashed', borderWidth: '1px', borderColor: COR_VISTORIADOR }} />
            <span className="flex-1 text-left text-muted-foreground">Rotas ativas</span>
            <Badge variant="outline" className="text-xs">{linhasDeRota.length}</Badge>
          </div>
        )}
        {atribuicaoManualAtiva && (
          <>
            <div className="border-t my-2" />
            <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <GripVertical className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span className="flex-1 text-left text-amber-700 dark:text-amber-400 text-xs">
                Arraste pins sem técnico até um profissional
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderDialogs = () => (
    <>
      {/* Atribuição drag */}
      <AlertDialog open={!!dragConfirmation} onOpenChange={(open) => !open && setDragConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Atribuição</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja atribuir o serviço <strong>{dragConfirmation?.servicoPlaca || 'sem placa'}</strong> ao técnico{' '}
              <strong>{dragConfirmation?.profissionalNome}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarAtribuicaoDrag} disabled={atribuirMutation.isPending}>
              {atribuirMutation.isPending ? 'Atribuindo...' : 'Confirmar Atribuição'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancelamento de rota */}
      <AlertDialog open={!!cancelConfirmation} onOpenChange={(open) => !open && setCancelConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Atribuição</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja cancelar a atribuição do serviço <strong>{cancelConfirmation?.servicoPlaca || 'sem placa'}</strong>
              {cancelConfirmation?.profissionalNome && <> do técnico <strong>{cancelConfirmation.profissionalNome}</strong></>}?
              O serviço voltará ao status pendente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarCancelamento} disabled={desatribuirMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {desatribuirMutation.isPending ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (isMobile) {
    return (
      <>
        {renderDialogs()}
        <div className="relative h-full flex flex-col">
          <div className="flex-1 rounded-lg overflow-hidden relative">
            {renderMapa()}
            {renderLegenda()}
          </div>
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerTrigger asChild>
              <Button className="absolute bottom-4 left-4 z-[400] shadow-lg gap-2" size="sm">
                <List className="h-4 w-4" />{vistoriasFiltradas.length} serviços
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[80vh]">
              <DrawerHeader className="pb-2">
                <DrawerTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-primary" />Serviços
                  <Badge variant="secondary">{vistoriasFiltradas.length}</Badge>
                </DrawerTitle>
              </DrawerHeader>
              <ScrollArea className="px-4 pb-4 max-h-[65vh]">
                {renderFilters()}
                <div className="mt-4">{renderVistoriasList()}</div>
              </ScrollArea>
            </DrawerContent>
          </Drawer>
        </div>
      </>
    );
  }

  return (
    <>
      {renderDialogs()}
      <div className="flex h-full gap-4">
        <Card className="w-80 flex-shrink-0 flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Serviços de Campo</CardTitle>
              </div>
              <Badge variant="secondary">{vistoriasFiltradas.length}</Badge>
            </div>
            {renderFilters()}
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full px-4 pb-4">{renderVistoriasList()}</ScrollArea>
          </CardContent>
        </Card>
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-red-600" />
              <CardTitle className="text-base">Mapa de Atribuições</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {atribuicaoManualAtiva && (
                <Badge variant="outline" className="gap-1.5 text-xs text-amber-600 border-amber-300">
                  <GripVertical className="h-3 w-3" />Drag & Drop ativo
                </Badge>
              )}
              <Badge variant="outline" className="gap-1.5 text-xs">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />Ao vivo
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 relative">
            {renderMapa()}
            {renderLegenda()}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
