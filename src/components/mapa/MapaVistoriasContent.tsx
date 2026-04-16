import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from "react-leaflet";
import { RotaPolyline } from "@/components/mapa/RotaPolyline";
import L from "leaflet";
import { format, isSameDay, isAfter, formatDistanceToNow } from "date-fns";
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
  MousePointerClick,
  MessageSquare,
  Send,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Building2,
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
import { useEnviarConfirmacaoWhatsApp } from "@/hooks/useEnviarConfirmacaoWhatsApp";
import { useBasesPratic } from "@/hooks/useBasesPratic";
import { usePrestadoresAtivosMapa } from "@/hooks/usePrestadoresAtivosMapa";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarioDiaModal } from "@/components/monitoramento/CalendarioDiaModal";

const COR_REALIZADA = '#10B981';
const COR_A_REALIZAR = '#EF4444';
const COR_SELECIONADO = '#F59E0B';
const COR_NAO_CONFIRMADO = '#F97316'; // Orange
const COR_CONFIRMADO = '#10B981'; // Green
const COR_AGUARDANDO = '#EAB308'; // Yellow
const COR_EM_EXECUCAO = '#3B82F6'; // Blue
const COR_FUTURA = '#94A3B8'; // Slate/gray-blue for future tasks
const STATUS_REALIZADOS = ['concluida', 'aprovada', 'reprovada', 'em_analise'];
const STATUS_EM_EXECUCAO = ['em_andamento', 'em_rota'];

function getCorPorStatus(status: string, confirmacao_whatsapp?: string | null, permite_encaixe?: boolean, isFutura?: boolean): string {
  if (STATUS_EM_EXECUCAO.includes(status)) return COR_EM_EXECUCAO;
  if (STATUS_REALIZADOS.includes(status)) return COR_REALIZADA;
  if (isFutura) return COR_FUTURA;
  if (permite_encaixe) return COR_A_REALIZAR;
  if (confirmacao_whatsapp === 'confirmada') return COR_CONFIRMADO;
  if (confirmacao_whatsapp?.startsWith('aguardando')) return COR_AGUARDANDO;
  if (!confirmacao_whatsapp) return COR_NAO_CONFIRMADO;
  return COR_A_REALIZAR;
}

function getTooltipColor(confirmacao_whatsapp?: string | null, permite_encaixe?: boolean): string {
  if (permite_encaixe) return '#6B7280';
  if (confirmacao_whatsapp === 'confirmada') return COR_CONFIRMADO;
  if (confirmacao_whatsapp?.startsWith('aguardando')) return COR_AGUARDANDO;
  return '#9CA3AF';
}

const iconCache = new Map<string, L.Icon>();
function getColoredIcon(color: string, selected = false): L.Icon {
  const cacheKey = `icon-${color}-${selected}`;
  if (iconCache.has(cacheKey)) return iconCache.get(cacheKey)!;
  const size: [number, number] = selected ? [38, 48] : [32, 40];
  const icon = new L.Icon({
    iconUrl: svgToDataUrl(createColoredMarkerSvg(color)),
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1]],
    popupAnchor: [0, -size[1]],
  });
  iconCache.set(cacheKey, icon);
  return icon;
}

// Draggable marker icon with grab cursor hint
function getDraggableIcon(color: string): L.DivIcon {
  return L.divIcon({
    html: `
      <div style="position:relative;cursor:grab;">
        <img src="${svgToDataUrl(createColoredMarkerSvg(color))}" width="32" height="40" />
        <div style="position:absolute;top:-4px;left:-4px;background:#F59E0B;border-radius:50%;width:14px;height:14px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2"><path d="M12 2l4 4-4-4-4 4M12 22l4-4-4 4-4-4M2 12l4-4-4 4 4 4M22 12l-4-4 4 4-4 4"/></svg>
        </div>
      </div>
    `,
    className: 'draggable-task-icon',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40],
  });
}

// Technician icon with task count badge
const vistoriadorBadgeIconCache = new Map<string, L.DivIcon>();
function getVistoriadorIconWithBadge(color: string = COR_VISTORIADOR, count: number): L.DivIcon {
  const cacheKey = `vistoriador-badge-${color}-${count}`;
  if (vistoriadorBadgeIconCache.has(cacheKey)) return vistoriadorBadgeIconCache.get(cacheKey)!;
  const badgeHtml = count > 0
    ? `<div style="position:absolute;top:-5px;right:-5px;background:#EF4444;border-radius:50%;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);padding:0 3px;">
        <span style="color:white;font-size:10px;font-weight:700;line-height:1;">${count}</span>
      </div>`
    : '';
  const icon = L.divIcon({
    html: `
      <div style="position:relative;">
        <img src="${svgToDataUrl(createVistoriadorMarkerSvg(color))}" width="36" height="36" />
        ${badgeHtml}
      </div>
    `,
    className: 'vistoriador-badge-icon',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
  vistoriadorBadgeIconCache.set(cacheKey, icon);
  return icon;
}

function FlyToPosition({ position, zoom = 15 }: { position: [number, number] | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, zoom, { duration: 1 });
  }, [position, zoom, map]);
  return null;
}

function getPeriodoLabel(periodo?: string | null): string {
  if (periodo === 'manha') return 'M';
  if (periodo === 'tarde') return 'T';
  return '';
}

function safeParseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function safeFormat(dateStr: string | null | undefined, fmt: string): string {
  if (!dateStr) return '';
  const d = safeParseDate(dateStr);
  if (!d) return '';
  try { return format(d, fmt, { locale: ptBR }); } catch { return ''; }
}

function getConfirmacaoLabel(confirmacao_whatsapp?: string | null, permite_encaixe?: boolean): string {
  if (permite_encaixe) return 'Encaixe';
  if (confirmacao_whatsapp === 'confirmada') return '✅ Confirmado';
  if (confirmacao_whatsapp?.startsWith('aguardando')) return '⏳ Aguardando';
  if (confirmacao_whatsapp === 'recusada') return '❌ Recusado';
  return '⚪ Não enviado';
}

export function MapaVistoriasContent() {
  const isMobile = useIsMobile();
  const { data: vistorias, isLoading } = useVistoriasMapa();
  const { data: vistoriadores, isLoading: isLoadingVistoriadores } = useVistoriadoresRealtime();
  const { data: atribuicaoManualAtiva } = useConfigAtribuicaoManual();
  const atribuirMutation = useAtribuirServicoManual();
  const desatribuirMutation = useDesatribuirServico();
  const enviarConfirmacaoMutation = useEnviarConfirmacaoWhatsApp();
  const { isDiretor, isCoordenadorMonitoramento, isAnalistaMonitoramento, isAdminMaster, isDesenvolvedor } = usePermissions();
  const { data: basesPratic } = useBasesPratic();
  const { data: prestadoresAtivos } = usePrestadoresAtivosMapa();

  // Base pendentes do dia
  const hojeStr = format(new Date(), 'yyyy-MM-dd');
  const { data: agendamentosBaseHoje } = useQuery({
    queryKey: ['mapa-base-pendentes', hojeStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agendamentos_base')
        .select('id, status, data_agendada, horario, cliente_nome, veiculo_placa, oficina_id')
        .eq('data_agendada', hojeStr)
        .not('status', 'in', '("concluida","cancelado","cancelada")');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  // Group pendentes by oficina_id
  const pendentesPorBase = useMemo(() => {
    const map = new Map<string, number>();
    (agendamentosBaseHoje || []).forEach((ag: any) => {
      if (ag.oficina_id) {
        map.set(ag.oficina_id, (map.get(ag.oficina_id) || 0) + 1);
      }
    });
    return map;
  }, [agendamentosBaseHoje]);

  const baseModalState = useState<{ open: boolean; data: string }>({ open: false, data: hojeStr });
  const [baseModal, setBaseModal] = baseModalState;

  const podeCancelarAtribuicao = isDiretor || isCoordenadorMonitoramento || isAnalistaMonitoramento || isAdminMaster || isDesenvolvedor;

  const [filtroBusca, setFiltroBusca] = useState("");
  const [posicaoSelecionada, setPosicaoSelecionada] = useState<[number, number] | null>(null);
  const [vistoriaSelecionada, setVistoriaSelecionada] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [painelAberto, setPainelAberto] = useState(true);

  // Single-task assignment confirmation (triggered by drag-and-drop)
  const [assignConfirmation, setAssignConfirmation] = useState<{
    servicos: VistoriaMapa[];
    profissional: VistoriadorLocalizacao;
  } | null>(null);

  // Cancel confirmation state
  const [cancelConfirmation, setCancelConfirmation] = useState<{
    servicoId: string;
    servicoPlaca: string | null;
    profissionalNome: string | null;
  } | null>(null);

  const vistoriadoresEmServico = useMemo(() => {
    return vistoriadores?.filter(v => v.em_servico && v.latitude && v.longitude) || [];
  }, [vistoriadores]);

  const vistoriasFiltradas = useMemo(() => {
    if (!vistorias) return [];
    return vistorias.filter((v) => {
      if (!v.data_agendada) return false;
      if (filtroBusca) {
        const termo = filtroBusca.toLowerCase();
        const placa = v.veiculo_placa?.toLowerCase() || "";
        const associado = v.associado_nome?.toLowerCase() || "";
        const bairro = v.endereco_bairro?.toLowerCase() || "";
        if (!placa.includes(termo) && !associado.includes(termo) && !bairro.includes(termo)) return false;
      }
      return true;
    });
  }, [vistorias, filtroBusca]);

  // Chronological index map for tooltip numbering
  const ordemCronologica = useMemo(() => {
    const sorted = [...(vistoriasFiltradas || [])].sort((a, b) => {
      const dtA = new Date(`${a.data_agendada}T${a.horario_agendado || '00:00'}`);
      const dtB = new Date(`${b.data_agendada}T${b.horario_agendado || '00:00'}`);
      return dtA.getTime() - dtB.getTime();
    });
    const map = new Map<string, number>();
    sorted.forEach((v, i) => map.set(v.id, i + 1));
    return map;
  }, [vistoriasFiltradas]);

  const isFuturaFn = useCallback((dataAgendada: string | null) => {
    if (!dataAgendada) return false;
    const dateStr = dataAgendada.split('T')[0];
    const dataVistoria = new Date(dateStr + 'T00:00:00');
    const hojeNorm = new Date();
    hojeNorm.setHours(0, 0, 0, 0);
    return isAfter(dataVistoria, hojeNorm);
  }, []);

  const vistoriasComCoordenadas = useMemo(() => {
    return vistoriasFiltradas.filter((v) => v.latitude && v.longitude);
  }, [vistoriasFiltradas]);

  const contadores = useMemo(() => {
    const realizadas = vistoriasComCoordenadas.filter(v => STATUS_REALIZADOS.includes(v.status)).length;
    const futuras = vistoriasComCoordenadas.filter(v => isFuturaFn(v.data_agendada) && !STATUS_REALIZADOS.includes(v.status)).length;
    const aRealizar = vistoriasComCoordenadas.length - realizadas;
    const confirmados = vistoriasComCoordenadas.filter(v => v.confirmacao_whatsapp === 'confirmada').length;
    const naoConfirmados = vistoriasComCoordenadas.filter(v => !STATUS_REALIZADOS.includes(v.status) && !v.permite_encaixe && !v.confirmacao_whatsapp && !isFuturaFn(v.data_agendada)).length;
    return { realizadas, aRealizar, confirmados, naoConfirmados, futuras };
  }, [vistoriasComCoordenadas]);

  // Tasks assigned to each technician (for badge count and popup)
  const tarefasPorTecnico = useMemo(() => {
    const map = new Map<string, VistoriaMapa[]>();
    vistoriasComCoordenadas.forEach(v => {
      if (v.vistoriador_id && !STATUS_REALIZADOS.includes(v.status)) {
        const list = map.get(v.vistoriador_id) || [];
        list.push(v);
        map.set(v.vistoriador_id, list);
      }
    });
    // Sort each technician's tasks chronologically
    map.forEach((tasks) => {
      tasks.sort((a, b) => {
        const dtA = new Date(`${a.data_agendada}T${a.horario_agendado || '00:00'}`);
        const dtB = new Date(`${b.data_agendada}T${b.horario_agendado || '00:00'}`);
        return dtA.getTime() - dtB.getTime();
      });
    });
    return map;
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

  const distanciaKm = useCallback((lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  const selecionarVistoria = (vistoria: VistoriaMapa) => {
    if (vistoria.latitude && vistoria.longitude) {
      setPosicaoSelecionada([vistoria.latitude, vistoria.longitude]);
      setVistoriaSelecionada(vistoria.id);
      if (isMobile) setDrawerOpen(false);
    } else {
      toast.error("Vistoria sem coordenadas GPS");
    }
  };

  // Handle task drag-end: find nearest technician
  const handleTaskDragEnd = useCallback((vistoria: VistoriaMapa, newLatLng: L.LatLng) => {
    let melhorTecnico: VistoriadorLocalizacao | null = null;
    let melhorDist = Infinity;

    for (const tec of vistoriadoresEmServico) {
      const d = distanciaKm(newLatLng.lat, newLatLng.lng, tec.latitude, tec.longitude);
      if (d < melhorDist) {
        melhorDist = d;
        melhorTecnico = tec;
      }
    }

    if (melhorTecnico && melhorDist <= 5) {
      setAssignConfirmation({
        servicos: [vistoria],
        profissional: melhorTecnico,
      });
    } else if (melhorTecnico) {
      toast.error(`Técnico mais próximo está a ${melhorDist.toFixed(1)} km. Solte mais perto do ícone do técnico.`);
    } else {
      toast.error('Nenhum técnico em campo encontrado.');
    }
  }, [vistoriadoresEmServico, distanciaKm]);

  // Handle technician drag-end: find nearest unassigned task
  const handleTecnicoDragEnd = useCallback((profissional: VistoriadorLocalizacao, newLatLng: L.LatLng) => {
    const tarefasDisponiveis = vistoriasComCoordenadas.filter(v =>
      !v.vistoriador_id
      && !STATUS_REALIZADOS.includes(v.status)
      && !!v.servico_id_unificado
      && !!v.latitude
      && !!v.longitude
    );

    if (tarefasDisponiveis.length === 0) {
      toast.error('Nenhuma tarefa disponível para atribuir.');
      return;
    }

    let melhorTarefa: VistoriaMapa | null = null;
    let melhorDist = Infinity;
    for (const t of tarefasDisponiveis) {
      const d = distanciaKm(newLatLng.lat, newLatLng.lng, t.latitude!, t.longitude!);
      if (d < melhorDist) {
        melhorDist = d;
        melhorTarefa = t;
      }
    }

    if (melhorTarefa && melhorDist <= 5) {
      setAssignConfirmation({
        servicos: [melhorTarefa],
        profissional,
      });
    } else if (melhorTarefa) {
      toast.error(`Tarefa mais próxima está a ${melhorDist.toFixed(1)} km. Solte mais perto do ícone da tarefa.`);
    }
  }, [vistoriasComCoordenadas, distanciaKm]);

  const confirmarAtribuicao = useCallback(async () => {
    if (!assignConfirmation) return;
    const { servicos, profissional } = assignConfirmation;

    const servicoId = servicos[0]?.servico_id_unificado;
    if (!servicoId) {
      toast.error('Serviço sem ID unificado');
      setAssignConfirmation(null);
      return;
    }

    try {
      await atribuirMutation.mutateAsync({
        servicoId,
        profissionalId: profissional.vistoriador_id,
      });
      toast.success(`Tarefa ${servicos[0]?.veiculo_placa || ''} atribuída a ${profissional.vistoriador_nome}`);
    } catch {
      // mutation handles error toast
    }

    setAssignConfirmation(null);
  }, [assignConfirmation, atribuirMutation]);

  const confirmarCancelamento = useCallback(() => {
    if (!cancelConfirmation) return;
    desatribuirMutation.mutate(cancelConfirmation.servicoId);
    setCancelConfirmation(null);
  }, [cancelConfirmation, desatribuirMutation]);

  const podeEnviarConfirmacao = (v: VistoriaMapa) => {
    return !!v.servico_id_unificado
      && (!v.confirmacao_whatsapp || v.confirmacao_whatsapp === 'recusada')
      && !STATUS_REALIZADOS.includes(v.status);
  };

  const abrirWhatsApp = (telefone: string | null) => {
    if (!telefone) { toast.error("Telefone não cadastrado"); return; }
    window.open(`https://wa.me/55${telefone.replace(/\D/g, "")}`, "_blank");
  };

  const abrirGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
  };

  const centroInicial: [number, number] = [-22.9068, -43.1729];

  const renderFilters = () => (
    <>
      <div className="flex gap-2 flex-wrap">
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
            const isFutura = isFuturaFn(v.data_agendada);
            const color = getCorPorStatus(v.status, v.confirmacao_whatsapp, v.permite_encaixe, isFutura);
            const hojeNorm = new Date();
            hojeNorm.setHours(0, 0, 0, 0);
            const isAtrasada = v.data_agendada
              ? new Date(v.data_agendada + 'T00:00:00') < hojeNorm && v.status !== 'concluida' && v.status !== 'cancelada'
              : false;
            const isRealizada = STATUS_REALIZADOS.includes(v.status);
            const canSendConfirmation = podeEnviarConfirmacao(v);
            const ordemNum = ordemCronologica.get(v.id) || 0;
            // Show drag hint for unassigned draggable tasks
            const isDraggable = !!atribuicaoManualAtiva && !isRealizada && !v.vistoriador_id && !!v.latitude && !!v.servico_id_unificado;

            return (
              <div
                key={v.id}
                className={cn(
                  "p-3 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50",
                  vistoriaSelecionada === v.id && "border-primary bg-primary/5",
                  !v.latitude && "opacity-60",
                  isAtrasada && "bg-orange-50 dark:bg-orange-950/20",
                )}
                onClick={() => selecionarVistoria(v)}
                style={{ borderLeftWidth: 4, borderLeftColor: color }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-bold text-muted-foreground">#{ordemNum}</span>
                      <span className="font-semibold text-sm truncate">{v.veiculo_placa || "Sem placa"}</span>
                      <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                        {TIPO_VISTORIA_LABELS[v.tipo_vistoria as keyof typeof TIPO_VISTORIA_LABELS] || v.tipo_vistoria}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {safeFormat(v.data_agendada, "dd/MM")} {v.horario_agendado ? v.horario_agendado.slice(0, 5) : getPeriodoLabel(v.periodo)}
                      </Badge>
                      {isAtrasada && (
                        <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-300">Atrasada</Badge>
                      )}
                      {isFutura && (
                        <Badge variant="outline" className="text-xs bg-slate-100 text-slate-600 border-slate-300">Futura</Badge>
                      )}
                      {v.permite_encaixe && (
                        <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-300">Encaixe</Badge>
                      )}
                      {isDraggable && (
                        <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300 gap-1">
                          <GripVertical className="h-3 w-3" />Arraste no mapa
                        </Badge>
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
                    {!isRealizada && !v.permite_encaixe && (
                      <p className={cn("text-xs mt-1 flex items-center gap-1", 
                        v.confirmacao_whatsapp === 'confirmada' ? 'text-green-600' :
                        v.confirmacao_whatsapp?.startsWith('aguardando') ? 'text-amber-600' :
                        'text-gray-500'
                      )}>
                        <MessageSquare className="h-3 w-3" />
                        {getConfirmacaoLabel(v.confirmacao_whatsapp, v.permite_encaixe)}
                      </p>
                    )}
                    {isRealizada && (
                      <p className="text-xs mt-1 flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-3 w-3" />Realizada
                      </p>
                    )}
                    {!v.latitude && <p className="text-xs text-orange-600 mt-1">⚠️ Sem coordenadas GPS</p>}
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {v.latitude && v.longitude && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); selecionarVistoria(v); }}>
                        <Locate className="h-4 w-4" />
                      </Button>
                    )}
                    {canSendConfirmation && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 text-green-600 border-green-300 hover:bg-green-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          enviarConfirmacaoMutation.mutate(v.servico_id_unificado!);
                        }}
                        disabled={enviarConfirmacaoMutation.isPending}
                        title="Enviar confirmação WhatsApp"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
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
          mostrarInfoOverlay
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
        const isEmExecucao = STATUS_EM_EXECUCAO.includes(v.status);
        const isFutura = isFuturaFn(v.data_agendada);
        const markerColor = getCorPorStatus(v.status, v.confirmacao_whatsapp, v.permite_encaixe, isFutura);
        const isRealizada = STATUS_REALIZADOS.includes(v.status);
        const tooltipColor = isEmExecucao ? COR_EM_EXECUCAO : isFutura ? COR_FUTURA : getTooltipColor(v.confirmacao_whatsapp, v.permite_encaixe);
        const periodoStr = getPeriodoLabel(v.periodo);
        const dataLabel = safeFormat(v.data_agendada ? v.data_agendada + 'T00:00:00' : null, "dd/MM");
        const ordemNum = ordemCronologica.get(v.id) || 0;
        const horarioLabel = v.horario_agendado ? v.horario_agendado.slice(0, 5) : periodoStr;

        // Task is draggable if: manual mode, not realized, unassigned, has coords, has service ID
        const isDraggable = !!atribuicaoManualAtiva && !isRealizada && !v.vistoriador_id && !!v.servico_id_unificado;
        
        let tooltipText: string;
        if (isEmExecucao) {
          const updatedDate = safeParseDate(v.horario_agendado ? `${v.data_agendada}T${v.horario_agendado}` : null) || safeParseDate(v.data_agendada);
          const tempoDecorrido = updatedDate ? formatDistanceToNow(updatedDate, { locale: ptBR }) : '';
          tooltipText = `#${ordemNum} · 🔧 ${tempoDecorrido ? `há ${tempoDecorrido}` : 'Em execução'}`;
        } else {
          tooltipText = `#${ordemNum} · ${[dataLabel, horarioLabel].filter(Boolean).join(' ')}`;
        }

        return (
          <Marker
            key={`marker-${v.id}-${markerColor}-${isDraggable}`}
            position={[v.latitude!, v.longitude!]}
            icon={isDraggable ? getDraggableIcon(markerColor) : getColoredIcon(markerColor)}
            draggable={isDraggable}
            eventHandlers={isDraggable ? {
              dragend: (e) => {
                const marker = e.target as L.Marker;
                const newPos = marker.getLatLng();
                // Reset marker position
                marker.setLatLng([v.latitude!, v.longitude!]);
                handleTaskDragEnd(v, newPos);
              },
            } : undefined}
          >
            {tooltipText && (
              <Tooltip
                permanent
                direction="top"
                offset={[0, -42]}
                className="custom-tooltip-clean"
              >
                <span style={{
                  backgroundColor: tooltipColor,
                  color: 'white',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}>
                  {isDraggable ? `↕ ${tooltipText}` : tooltipText}
                </span>
              </Tooltip>
            )}
            <Popup>
              <div className="min-w-[200px]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-sm">{v.veiculo_placa || "Sem placa"}</h3>
                  <span className="text-xs px-2 py-0.5 rounded text-white" style={{ backgroundColor: markerColor }}>
                    {isEmExecucao ? "Em Execução" : isRealizada ? "Realizada" : v.permite_encaixe ? "Encaixe" : v.confirmacao_whatsapp === 'confirmada' ? "Confirmado" : "A Realizar"}
                  </span>
                </div>
                <div className="text-xs space-y-1 mb-2">
                  <p><strong>Tipo:</strong> {TIPO_VISTORIA_LABELS[v.tipo_vistoria as keyof typeof TIPO_VISTORIA_LABELS] || v.tipo_vistoria}</p>
                  <p><strong>Associado:</strong> {v.associado_nome || "-"}</p>
                  <p><strong>Veículo:</strong> {v.veiculo_marca} {v.veiculo_modelo}</p>
                  {v.data_agendada && <p><strong>Agendada:</strong> {safeFormat(v.data_agendada, "dd/MM/yyyy") || v.data_agendada}</p>}
                  <p><strong>Local:</strong> {v.endereco_bairro}, {v.endereco_cidade}</p>
                  <p><strong>Status:</strong> {v.status}</p>
                  {isEmExecucao && (
                    <p className="text-blue-600 font-semibold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      🔧 Serviço em execução
                    </p>
                  )}
                  {!isRealizada && !v.permite_encaixe && !isEmExecucao && (
                    <p style={{ color: tooltipColor }}><strong>Confirmação:</strong> {getConfirmacaoLabel(v.confirmacao_whatsapp, v.permite_encaixe)}</p>
                  )}
                  {v.vistoriador_nome ? (
                    <p><strong>Vistoriador:</strong> {v.vistoriador_nome}</p>
                  ) : (
                    <p className="text-orange-600"><strong>Vistoriador:</strong> Não atribuído</p>
                  )}
                  {isDraggable && (
                    <p className="text-amber-600 font-semibold flex items-center gap-1 mt-1">
                      <GripVertical className="h-3 w-3" />
                      Arraste até um técnico para atribuir
                    </p>
                  )}
                </div>
                {!isEmExecucao && (
                  <div className="flex gap-2 flex-wrap">
                    {podeEnviarConfirmacao(v) && (
                      <button
                        onClick={() => enviarConfirmacaoMutation.mutate(v.servico_id_unificado!)}
                        disabled={enviarConfirmacaoMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
                      >
                        <Send className="h-3 w-3" />Enviar Confirmação
                      </button>
                    )}
                    {v.associado_telefone && (
                      <button onClick={() => abrirWhatsApp(v.associado_telefone)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                        <Phone className="h-3 w-3" />WhatsApp
                      </button>
                    )}
                    <button onClick={() => abrirGoogleMaps(v.latitude!, v.longitude!)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
                      <Navigation className="h-3 w-3" />Google Maps
                    </button>
                    {podeCancelarAtribuicao && v.vistoriador_id && !isRealizada && v.servico_id_unificado && (
                      <button
                        onClick={() => setCancelConfirmation({
                          servicoId: v.servico_id_unificado!,
                          servicoPlaca: v.veiculo_placa,
                          profissionalNome: v.vistoriador_nome,
                        })}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                      >
                        <XIcon className="h-3 w-3" />Cancelar Rota
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Vistoriadores with badge count */}
      {vistoriadoresEmServico.map((vistoriador) => {
        const tarefasDoTecnico = tarefasPorTecnico.get(vistoriador.vistoriador_id) || [];
        const taskCount = tarefasDoTecnico.length;
        const corStatus =
          vistoriador.status_operacional === 'em_andamento' ? '#F59E0B' :
          vistoriador.status_operacional === 'em_rota' ? COR_VISTORIADOR :
          vistoriador.status_operacional === 'em_contato' ? '#FCD34D' :
          '#22C55E';
        return (
          <Marker
            key={`vistoriador-${vistoriador.vistoriador_id}-${taskCount}-${vistoriador.status_operacional}`}
            position={[vistoriador.latitude, vistoriador.longitude]}
            icon={getVistoriadorIconWithBadge(corStatus, taskCount)}
          >
            <Popup>
              <div className="min-w-[200px]">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-blue-600" />
                  <h3 className="font-bold text-sm">{vistoriador.vistoriador_nome}</h3>
                  {taskCount > 0 && (
                    <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{taskCount}</span>
                  )}
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
                    Atualizado: {safeParseDate(vistoriador.updated_at) ? formatDistanceToNow(safeParseDate(vistoriador.updated_at)!, { addSuffix: true, locale: ptBR }) : 'desconhecido'}
                  </p>
                </div>
                {/* Tarefas atribuídas ao técnico */}
                {tarefasDoTecnico.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-semibold mb-1 text-blue-700">
                      📋 {tarefasDoTecnico.length} tarefa{tarefasDoTecnico.length > 1 ? 's' : ''} pendente{tarefasDoTecnico.length > 1 ? 's' : ''}:
                    </p>
                    <div className="max-h-[120px] overflow-y-auto space-y-0.5">
                      {tarefasDoTecnico.map((t, idx) => (
                        <p key={t.id} className="text-xs text-muted-foreground flex items-center gap-1">
                          <span className="font-mono">{idx + 1}.</span>
                          <span className="font-semibold">{t.veiculo_placa || '---'}</span>
                          <span>· {safeFormat(t.data_agendada, 'dd/MM')} {t.horario_agendado ? t.horario_agendado.slice(0, 5) : getPeriodoLabel(t.periodo)}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {vistoriador.telefone && (
                  <button onClick={() => abrirWhatsApp(vistoriador.telefone)} className="flex items-center justify-center gap-1 w-full px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                    <Phone className="h-3 w-3" />Contatar
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Prestadores parceiros ativos (com localização) */}
      {(prestadoresAtivos || []).map((p) => {
        const corPrest = p.status === 'em_execucao' ? '#3B82F6' : p.status === 'em_rota' ? '#A855F7' : '#F59E0B';
        const prestIcon = L.divIcon({
          html: `
            <div style="position:relative;">
              <img src="${svgToDataUrl(createVistoriadorMarkerSvg(corPrest))}" width="36" height="36" />
              <div style="position:absolute;top:-5px;right:-5px;background:#F59E0B;border-radius:50%;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);">
                <span style="color:white;font-size:10px;font-weight:700;line-height:1;">P</span>
              </div>
            </div>
          `,
          className: 'prestador-icon',
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -18],
        });
        const showRoute = (p.status === 'em_rota' || p.status === 'em_execucao') && p.destino_lat && p.destino_lng;
        return (
          <div key={`prest-wrap-${p.link_id}`}>
            {showRoute && (
              <RotaPolyline
                origem={[p.latitude, p.longitude]}
                destino={[p.destino_lat!, p.destino_lng!]}
                cor={corPrest}
                peso={4}
                opacidade={0.7}
                mostrarPopup
                mostrarInfoOverlay
                popupContent={
                  <div className="text-xs">
                    <p className="font-semibold">{p.prestador_nome} (Prestador)</p>
                    <p className="text-muted-foreground">→ {p.veiculo_placa || 'Local'}</p>
                  </div>
                }
              />
            )}
            <Marker position={[p.latitude, p.longitude]} icon={prestIcon}>
              <Popup>
                <div className="min-w-[200px]">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4" style={{ color: corPrest }} />
                    <h3 className="font-bold text-sm">{p.prestador_nome}</h3>
                    <span className="ml-auto bg-amber-500 text-white text-[10px] font-bold rounded px-1.5 py-0.5">PRESTADOR</span>
                  </div>
                  <div className="text-xs space-y-1 mb-2">
                    <p style={{ color: corPrest }} className="font-semibold flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: corPrest }} />
                      {p.status === 'em_execucao' ? 'Em Execução' : p.status === 'em_rota' ? 'Em Rota' : 'Aceito'}
                    </p>
                    {p.associado_nome && <p><strong>Associado:</strong> {p.associado_nome}</p>}
                    {p.veiculo_placa && <p><strong>Placa:</strong> {p.veiculo_placa}</p>}
                    <p className="text-muted-foreground">
                      Atualizado: {formatDistanceToNow(new Date(p.localizacao_atualizada_em), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {p.prestador_telefone && (
                      <button onClick={() => abrirWhatsApp(p.prestador_telefone!)} className="flex items-center justify-center gap-1 w-full px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                        <Phone className="h-3 w-3" />Contatar
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        const fnName = p.origem_tabela === 'vistoria' ? 'gerar-link-vistoriador-prestador' : 'gerar-link-prestador';
                        const payload = p.origem_tabela === 'vistoria'
                          ? { instalacao_id: p.instalacao_id, vistoriador_prestador_id: p.prestador_id, reenviar: true }
                          : { instalacao_id: p.instalacao_id, vistoriador_prestador_id: p.prestador_id, reenviar: true };
                        const { error } = await supabase.functions.invoke(fnName, { body: payload });
                        if (error) toast.error('Erro ao reenviar link');
                        else toast.success('Link reenviado via WhatsApp');
                      }}
                      className="flex items-center justify-center gap-1 w-full px-3 py-1.5 bg-amber-500 text-white rounded text-xs hover:bg-amber-600"
                    >
                      <Send className="h-3 w-3" />Reenviar Link
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          </div>
        );
      })}

      {/* Bases Pratic com contagem de pendentes */}
      {(basesPratic || []).map((base) => {
        const pendentes = pendentesPorBase.get(base.id) || 0;
        const hasPendentes = pendentes > 0;
        const baseIcon = L.divIcon({
          html: `
            <div style="position:relative;cursor:pointer;">
              ${hasPendentes ? '<div style="position:absolute;inset:-4px;border-radius:50%;background:rgba(139,92,246,0.3);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>' : ''}
              <div style="width:40px;height:40px;border-radius:50%;background:${hasPendentes ? '#8B5CF6' : '#94A3B8'};display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);opacity:${hasPendentes ? 1 : 0.6};">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>
              </div>
              ${hasPendentes ? `<div style="position:absolute;top:-6px;right:-6px;background:#EF4444;border-radius:50%;min-width:20px;height:20px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);padding:0 4px;">
                <span style="color:white;font-size:11px;font-weight:700;line-height:1;">${pendentes}</span>
              </div>` : ''}
            </div>
            <style>@keyframes ping{75%,100%{transform:scale(2);opacity:0}}</style>
          `,
          className: 'base-pratic-icon',
          iconSize: [40, 40],
          iconAnchor: [20, 20],
          popupAnchor: [0, -20],
        });

        return (
          <Marker
            key={`base-${base.id}`}
            position={[base.latitude, base.longitude]}
            icon={baseIcon}
            eventHandlers={{
              click: () => {
                if (!hasPendentes) {
                  toast.info("Nenhuma vistoria agendada para esta base");
                  return;
                }
                setBaseModal({ open: true, data: hojeStr });
              },
            }}
          >
            <Tooltip permanent direction="bottom" offset={[0, 16]} className="custom-tooltip-clean">
              <span style={{
                backgroundColor: hasPendentes ? '#8B5CF6' : '#94A3B8',
                color: 'white',
                padding: '1px 6px',
                borderRadius: '3px',
                fontSize: '10px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}>
                🏢 {base.nome_fantasia || base.razao_social} {hasPendentes ? `(${pendentes})` : ''}
              </span>
            </Tooltip>
          </Marker>
        );
      })}
    </MapContainer>
  );

  const [legendaAberta, setLegendaAberta] = useState(false);

  const renderLegenda = () => (
    <div className={cn(
      "absolute z-[400] bg-background/95 backdrop-blur-sm rounded-lg shadow-lg border",
      isMobile ? "top-2 right-2 text-xs" : "top-4 right-4"
    )}>
      <button
        onClick={() => setLegendaAberta(!legendaAberta)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors rounded-lg"
      >
        <h4 className="font-semibold text-sm">Legenda</h4>
        {legendaAberta ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {legendaAberta && (
        <div className="space-y-2 px-3 pb-3">
          <div className="flex items-center gap-2 text-sm p-2 rounded-md">
            <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: COR_REALIZADA }} />
            <span className="flex-1 text-left">Realizadas</span>
            <Badge variant="secondary" className="text-xs">{contadores.realizadas}</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm p-2 rounded-md">
            <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: COR_NAO_CONFIRMADO }} />
            <span className="flex-1 text-left">Não confirmado</span>
            <Badge variant="secondary" className="text-xs">{contadores.naoConfirmados}</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm p-2 rounded-md">
            <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: COR_AGUARDANDO }} />
            <span className="flex-1 text-left">Aguardando</span>
          </div>
          <div className="flex items-center gap-2 text-sm p-2 rounded-md">
            <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: COR_CONFIRMADO }} />
            <span className="flex-1 text-left">Confirmado</span>
            <Badge variant="secondary" className="text-xs">{contadores.confirmados}</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm p-2 rounded-md">
            <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: COR_A_REALIZAR }} />
            <span className="flex-1 text-left">A Realizar</span>
            <Badge variant="secondary" className="text-xs">{contadores.aRealizar}</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm p-2 rounded-md">
            <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: COR_FUTURA }} />
            <span className="flex-1 text-left">Futuras</span>
            <Badge variant="secondary" className="text-xs">{contadores.futuras}</Badge>
          </div>
          <div className="border-t my-2" />
          <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50">
            <span className="flex gap-1 flex-shrink-0">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#F59E0B' }} title="Realizando tarefa" />
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COR_VISTORIADOR }} title="Em rota" />
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#22C55E' }} title="Disponível" />
            </span>
            <span className="flex-1 text-left text-xs">
              Profissionais
              <span className="block text-[10px] text-muted-foreground">Amarelo: executando · Azul: em rota · Verde: disponível</span>
            </span>
            <Badge variant="secondary" className="text-xs">{vistoriadoresEmServico.length}</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50">
            <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center bg-amber-500">
              <User className="h-2.5 w-2.5 text-white" />
            </span>
            <span className="flex-1 text-left">Prestadores em campo</span>
            <Badge variant="secondary" className="text-xs gap-1">
              {prestadoresAtivos?.length || 0}
            </Badge>
          </div>
          <div
            className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
            onClick={() => setBaseModal({ open: true, data: hojeStr })}
          >
            <span className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: '#8B5CF6' }}>
              <Building2 className="h-2.5 w-2.5 text-white" />
            </span>
            <span className="flex-1 text-left">Base Pratic</span>
            <Badge variant="secondary" className="text-xs gap-1">
              {agendamentosBaseHoje?.length || 0} pendentes
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
                  Arraste a tarefa até o técnico para atribuir
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );

  const renderDialogs = () => (
    <>
      {/* Atribuição (single task from drag) */}
      <AlertDialog open={!!assignConfirmation} onOpenChange={(open) => !open && setAssignConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Atribuição</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Deseja atribuir <strong>{assignConfirmation?.servicos[0]?.veiculo_placa || 'tarefa'}</strong> ao técnico{' '}
                  <strong>{assignConfirmation?.profissional.vistoriador_nome}</strong>?
                </p>
                {assignConfirmation && (
                  <div className="bg-muted/50 rounded-md p-2 space-y-1">
                    {assignConfirmation.servicos.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 text-xs">
                        <span className="font-semibold">{s.veiculo_placa || 'Sem placa'}</span>
                        <span className="text-muted-foreground">
                          · {safeFormat(s.data_agendada, 'dd/MM')} {s.horario_agendado ? s.horario_agendado.slice(0, 5) : getPeriodoLabel(s.periodo)}
                        </span>
                        <Badge variant="outline" className="text-[10px] h-4">
                          {TIPO_VISTORIA_LABELS[s.tipo_vistoria as keyof typeof TIPO_VISTORIA_LABELS] || s.tipo_vistoria}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                {/* Show technician's current workload */}
                {assignConfirmation && (() => {
                  const currentTasks = tarefasPorTecnico.get(assignConfirmation.profissional.vistoriador_id) || [];
                  if (currentTasks.length === 0) return null;
                  return (
                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-md p-2 border border-blue-200 dark:border-blue-800">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">
                        📋 Já tem {currentTasks.length} tarefa{currentTasks.length > 1 ? 's' : ''} atribuída{currentTasks.length > 1 ? 's' : ''}:
                      </p>
                      <div className="space-y-0.5">
                        {currentTasks.slice(0, 5).map((t, idx) => (
                          <p key={t.id} className="text-xs text-muted-foreground">
                            {idx + 1}. {t.veiculo_placa || '---'} · {safeFormat(t.data_agendada, 'dd/MM')} {t.horario_agendado ? t.horario_agendado.slice(0, 5) : ''}
                          </p>
                        ))}
                        {currentTasks.length > 5 && (
                          <p className="text-xs text-muted-foreground">... e mais {currentTasks.length - 5}</p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarAtribuicao} disabled={atribuirMutation.isPending}>
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
        <CalendarioDiaModal
          open={baseModal.open}
          onClose={() => setBaseModal({ ...baseModal, open: false })}
          data={baseModal.data}
          abaInicial="base"
        />
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
      <CalendarioDiaModal
        open={baseModal.open}
        onClose={() => setBaseModal({ ...baseModal, open: false })}
        data={baseModal.data}
        abaInicial="base"
      />
      <div className="flex h-full gap-4">
        <Card className={cn(
          "flex-shrink-0 flex flex-col overflow-hidden transition-all duration-300",
          painelAberto ? "w-72" : "w-0 border-0 p-0 opacity-0 pointer-events-none"
        )}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Serviços de Campo</CardTitle>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="secondary">{vistoriasFiltradas.length}</Badge>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPainelAberto(false)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
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
              {atribuicaoManualAtiva ? (
                <Badge variant="outline" className="gap-1.5 text-xs text-amber-600 border-amber-300">
                  <GripVertical className="h-3 w-3" />Manual — Arraste tarefas
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1.5 text-xs text-green-600 border-green-300">
                  <span className="h-2 w-2 rounded-full bg-green-500" />Modo Automático
                </Badge>
              )}
              <Badge variant="outline" className="gap-1.5 text-xs">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />Ao vivo
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 relative">
            {!painelAberto && (
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-3 left-3 z-[400] gap-1.5 shadow-md"
                onClick={() => setPainelAberto(true)}
              >
                <List className="h-4 w-4" />
                <span>{vistoriasFiltradas.length}</span>
                <ChevronRight className="h-3 w-3" />
              </Button>
            )}
            {renderMapa()}
            {renderLegenda()}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
