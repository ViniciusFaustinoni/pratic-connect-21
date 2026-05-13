import { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useServicosParaAtribuir, useVistoriadoresAtivos, useAtribuirServicoManual, useAtribuirServicoPrestador, AtribuirPrestadorResult, useServicosTravados } from '@/hooks/useAtribuicaoManual';
import { useVistoriadoresPrestadores } from '@/hooks/useVistoriadoresPrestadores';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Loader2, GripVertical, MapPin, User, Car, Clock, Wrench, ClipboardCheck, Search, Calendar, Navigation, FileText, ExternalLink, MoreVertical, RotateCcw, UserCog, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TIPO_SERVICO_LABELS } from '@/hooks/useServicos';
import { LinkPrestadorResultDialog } from './LinkPrestadorResultDialog';
import { DevolverFilaDialog } from './DevolverFilaDialog';
import { formatPlacaOuChassi, isPlacaPlaceholder } from '@/lib/placa-utils';
import { usePermissions } from '@/hooks/usePermissions';

function getTipoLabel(tipo: string) {
  if (tipo === 'vistoria_base') return 'Vistoria Base';
  return (TIPO_SERVICO_LABELS as Record<string, string>)[tipo] || tipo;
}

function getTipoBadgeClass(tipo: string) {
  if (tipo === 'instalacao') return 'border-blue-300 text-blue-700 dark:text-blue-300';
  if (tipo === 'revistoria') return 'border-teal-300 text-teal-700 dark:text-teal-300';
  if (tipo === 'vistoria_base') return 'border-green-300 text-green-700 dark:text-green-300';
  return 'border-amber-300 text-amber-700 dark:text-amber-300';
}

function getTipoIcon(tipo: string) {
  if (tipo === 'instalacao') return <Wrench className="h-3 w-3 text-blue-500" />;
  if (tipo === 'revistoria') return <FileText className="h-3 w-3 text-teal-500" />;
  if (tipo === 'vistoria_base') return <ClipboardCheck className="h-3 w-3 text-green-500" />;
  return <ClipboardCheck className="h-3 w-3 text-amber-500" />;
}

// ── Draggable Service Card ──
function DraggableServico({ servico }: { servico: any }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: servico.id,
    data: servico,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 50,
  } : undefined;

  const assoc = servico.associado as any;
  const veic = servico.veiculo as any;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'border rounded-lg p-3 bg-card cursor-grab active:cursor-grabbing transition-shadow',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary'
      )}
      {...listeners}
      {...attributes}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn(
              'text-[10px]',
              getTipoBadgeClass(servico.tipo)
            )}>
              {getTipoLabel(servico.tipo)}
            </Badge>
            {servico.permite_encaixe && (
              <Badge variant="secondary" className="text-[10px]">Encaixe</Badge>
            )}
          </div>
          <p className="text-sm font-medium truncate">{assoc?.nome || 'Sem nome'}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {(veic?.placa || veic?.chassi) && (
              <span className="flex items-center gap-1" title={isPlacaPlaceholder(veic?.placa) && veic?.chassi ? `Veículo 0KM · Chassi: ${veic.chassi}` : undefined}>
                <Car className="h-3 w-3" /> {formatPlacaOuChassi(veic?.placa, veic?.chassi)}
              </span>
            )}
            {servico.localizacaoFormatada && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {servico.localizacaoFormatada}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {isToday(parseISO(servico.data_agendada)) ? 'Hoje' :
                isTomorrow(parseISO(servico.data_agendada)) ? 'Amanhã' :
                  format(parseISO(servico.data_agendada), 'dd/MM', { locale: ptBR })}
              {servico.hora_agendada && ` às ${servico.hora_agendada.slice(0, 5)}`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Overlay card while dragging ──
function DragOverlayCard({ servico }: { servico: any }) {
  const assoc = servico.associado as any;
  return (
    <div className="border rounded-lg p-3 bg-card shadow-2xl ring-2 ring-primary w-72">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{assoc?.nome || 'Sem nome'}</p>
          <p className="text-xs text-muted-foreground">{getTipoLabel(servico.tipo)} · {servico.localizacaoFormatada || servico.bairro || servico.cidade || 'Sem local'}</p>
        </div>
      </div>
    </div>
  );
}

// ── Droppable Vistoriador Card ──
function DroppableVistoriador({
  vistoriador,
  onAcaoTarefa,
  podeForcarDevolucao,
}: {
  vistoriador: any;
  onAcaoTarefa: (tarefa: any, modo: 'devolver' | 'reatribuir') => void;
  podeForcarDevolucao: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `vist-${vistoriador.id}` });

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        'transition-all',
        isOver && 'ring-2 ring-primary bg-primary/5 scale-[1.01]'
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm truncate">{vistoriador.nome}</CardTitle>
            {vistoriador.bairroAtual ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Navigation className="h-3 w-3 text-green-500" />
                {vistoriador.bairroAtual}
              </p>
            ) : vistoriador.latitude ? (
              <p className="text-xs text-muted-foreground italic">Localizando...</p>
            ) : null}
            {vistoriador.ultimaAtualizacao && (
              <p className="text-[10px] text-muted-foreground/70">
                Atualizado {formatDistanceToNow(new Date(vistoriador.ultimaAtualizacao), { locale: ptBR, addSuffix: true })}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {vistoriador.tarefas.length} tarefa(s) atribuída(s)
            </p>
          </div>
          <Badge variant={vistoriador.tarefas.length === 0 ? 'default' : 'secondary'} className="text-[10px]">
            {vistoriador.tarefas.length === 0 ? 'Disponível' : 'Ocupado'}
          </Badge>
        </div>
      </CardHeader>
      {vistoriador.tarefas.length > 0 && (
        <CardContent className="pt-0 space-y-1.5">
          {vistoriador.tarefas.map((t: any) => {
            const placa = t.veiculo?.placa as string | undefined;
            const chassi = t.veiculo?.chassi as string | undefined;
            const isZeroKm = isPlacaPlaceholder(placa);
            const identificador = formatPlacaOuChassi(placa, chassi, { fallback: '' });
            const emAndamento = t.status === 'em_andamento';
            const emRota = t.status === 'em_rota';
            const tarefaParaAcao = {
              ...t,
              profissionalNome: vistoriador.nome,
              profissionalIdAtual: vistoriador.id,
            };
            return (
              <div
                key={t.id}
                className={cn(
                  'flex items-center gap-2 text-xs p-2 rounded',
                  emAndamento
                    ? 'bg-blue-500/10 border border-blue-500/40 ring-1 ring-blue-500/30'
                    : emRota
                      ? 'bg-purple-500/10 border border-purple-500/30'
                      : 'bg-muted/50'
                )}
              >
                {getTipoIcon(t.tipo)}
                {identificador ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono font-semibold tracking-wider text-[10px] max-w-[160px] truncate',
                      emAndamento
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                        : 'bg-background/60 text-foreground border border-border'
                    )}
                    title={isZeroKm && chassi ? `Veículo 0KM · Chassi: ${chassi}` : `Placa: ${placa}`}
                  >
                    <Car className="h-3 w-3 shrink-0" /> <span className="truncate">{identificador}</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground italic">sem placa</span>
                )}
                <span className="truncate flex-1">{t.localizacaoFormatada || t.bairro || t.cidade || 'Sem local'}</span>
                {emAndamento ? (
                  <Badge variant="outline" className="ml-auto text-[9px] bg-blue-500/15 text-blue-300 border-blue-500/40">
                    atendendo agora
                  </Badge>
                ) : (
                  <Badge variant="outline" className="ml-auto text-[9px]">{t.status}</Badge>
                )}
                {(!emAndamento || podeForcarDevolucao) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onPointerDown={(e) => e.stopPropagation()}
                        title={emAndamento ? 'Ações administrativas (erro na execução)' : undefined}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      {emAndamento && (
                        <div className="px-2 py-1.5 text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 border-b mb-1">
                          <AlertTriangle className="h-3 w-3" />
                          Tarefa em andamento — uso administrativo
                        </div>
                      )}
                      <DropdownMenuItem onClick={() => onAcaoTarefa(tarefaParaAcao, 'devolver')}>
                        <RotateCcw className="h-3.5 w-3.5 mr-2" />
                        {emAndamento ? 'Voltar para a fila (erro na instalação)' : 'Devolver à fila / não compareceu'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onAcaoTarefa(tarefaParaAcao, 'reatribuir')}>
                        <UserCog className="h-3.5 w-3.5 mr-2" />
                        Reatribuir a outro técnico
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}
        </CardContent>
      )}
      {isOver && (
        <div className="px-4 pb-3">
          <div className="border-2 border-dashed border-primary/40 rounded-lg p-3 text-center text-xs text-primary">
            Soltar aqui para atribuir
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Droppable Prestador Card ──
function DroppablePrestador({ prestador }: { prestador: any }) {
  const { isOver, setNodeRef } = useDroppable({ id: `prest-${prestador.id}` });

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        'transition-all',
        isOver && 'ring-2 ring-amber-500 bg-amber-50/50 dark:bg-amber-950/20 scale-[1.01]'
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <ExternalLink className="h-4 w-4 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm truncate">{prestador.nome}</CardTitle>
            {prestador.telefone && (
              <p className="text-xs text-muted-foreground">{prestador.telefone}</p>
            )}
            {prestador.cpf_cnpj && (
              <p className="text-[10px] text-muted-foreground/70">{prestador.cpf_cnpj}</p>
            )}
          </div>
          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
            Prestador
          </Badge>
        </div>
      </CardHeader>
      {isOver && (
        <div className="px-4 pb-3">
          <div className="border-2 border-dashed border-amber-400/60 rounded-lg p-3 text-center text-xs text-amber-600">
            Soltar aqui para atribuir ao prestador
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Main Component ──
export default function AtribuicaoManualTab() {
  const { data: servicos, isLoading: loadingServicos } = useServicosParaAtribuir();
  const { data: vistoriadores, isLoading: loadingVist } = useVistoriadoresAtivos();
  const { data: prestadores, isLoading: loadingPrestadores } = useVistoriadoresPrestadores();
  const { data: travados } = useServicosTravados();
  const atribuirMutation = useAtribuirServicoManual();
  const atribuirPrestadorMutation = useAtribuirServicoPrestador();
  const { isDiretor, isCoordenadorMonitoramento } = usePermissions();
  const podeForcarDevolucao = !!(isDiretor || isCoordenadorMonitoramento);

  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [busca, setBusca] = useState('');
  const [dragging, setDragging] = useState<any>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ servico: any; vistoriadorId: string } | null>(null);

  // Devolver / reatribuir state
  const [acaoDialog, setAcaoDialog] = useState<{
    servico: any;
    modo: 'devolver' | 'reatribuir';
  } | null>(null);

  // Prestador assignment states
  const [prestadorConfirmDialog, setPrestadorConfirmDialog] = useState<{ servico: any; prestadorId: string; prestadorNome: string; prestadorTelefone?: string | null } | null>(null);
  const [valorPrestador, setValorPrestador] = useState('');
  const [linkResult, setLinkResult] = useState<AtribuirPrestadorResult | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const prestadoresAtivos = (prestadores || []).filter((p: any) => p.ativo);

  const handleAcaoTarefa = (tarefa: any, modo: 'devolver' | 'reatribuir') => {
    setAcaoDialog({
      servico: {
        id: tarefa.id,
        tipo: tarefa.tipo,
        associadoNome: tarefa.associado?.nome,
        veiculoPlaca: tarefa.veiculo?.placa,
        profissionalNome: tarefa.profissionalNome,
        profissionalIdAtual: tarefa.profissionalIdAtual,
      },
      modo,
    });
  };

  const servicosFiltrados = (servicos || []).filter(s => {
    if (filtroTipo !== 'todos' && s.tipo !== filtroTipo) return false;
    if (busca) {
      const term = busca.toLowerCase();
      const assoc = s.associado as any;
      const veic = s.veiculo as any;
      if (
        !(assoc?.nome || '').toLowerCase().includes(term) &&
        !(veic?.placa || '').toLowerCase().includes(term) &&
        !(veic?.chassi || '').toLowerCase().includes(term) &&
        !(s.bairro || '').toLowerCase().includes(term) &&
        !(s.cidade || '').toLowerCase().includes(term) &&
        !(s.zona || '').toLowerCase().includes(term)
      ) return false;
    }
    return true;
  });

  // Group by date
  const grouped = servicosFiltrados.reduce<Record<string, any[]>>((acc, s) => {
    const key = s.data_agendada;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const handleDragStart = (event: DragStartEvent) => {
    setDragging(event.active.data.current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const { active, over } = event;
    if (!over) return;

    const overId = over.id as string;

    if (overId.startsWith('prest-')) {
      const prestadorId = overId.replace('prest-', '');
      const prest = prestadoresAtivos.find((p: any) => p.id === prestadorId);
      const servico = active.data.current;
      setPrestadorConfirmDialog({
        servico,
        prestadorId,
        prestadorNome: prest?.nome || 'Prestador',
        prestadorTelefone: prest?.telefone,
      });
      setValorPrestador('');
    } else {
      const vistoriadorId = overId.replace('vist-', '');
      const servico = active.data.current;
      setConfirmDialog({ servico, vistoriadorId });
    }
  };

  const handleConfirm = () => {
    if (!confirmDialog) return;
    atribuirMutation.mutate({
      servicoId: confirmDialog.servico.id,
      profissionalId: confirmDialog.vistoriadorId,
      isBase: !!confirmDialog.servico.isBase,
    });
    setConfirmDialog(null);
  };

  const handleConfirmPrestador = async () => {
    if (!prestadorConfirmDialog) return;
    // Valor é opcional — quando vazio, envia 0 (definido depois pela operação)
    const valor = valorPrestador.trim() === '' ? 0 : parseFloat(valorPrestador);
    if (isNaN(valor) || valor < 0) return;

    try {
      const result = await atribuirPrestadorMutation.mutateAsync({
        servicoId: prestadorConfirmDialog.servico.id,
        prestadorId: prestadorConfirmDialog.prestadorId,
        prestadorNome: prestadorConfirmDialog.prestadorNome,
        prestadorTelefone: prestadorConfirmDialog.prestadorTelefone,
        valor,
      });
      setPrestadorConfirmDialog(null);
      setLinkResult(result);
    } catch {
      // Error handled by mutation
    }
  };

  const vistoriadorConfirm = confirmDialog
    ? (vistoriadores || []).find(v => v.id === confirmDialog.vistoriadorId)
    : null;
  const servicoConfirmAssoc = confirmDialog?.servico?.associado as any;
  const prestadorConfirmAssoc = prestadorConfirmDialog?.servico?.associado as any;

  if (loadingServicos || loadingVist) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* ── Left: Pending Services ── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Travados / atribuídos vencidos */}
          {(travados?.length || 0) > 0 && (
            <Card className="border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4" />
                  Atribuídos travados / vencidos
                  <Badge variant="outline" className="ml-auto bg-amber-100 dark:bg-amber-900/40 border-amber-400 text-amber-800 dark:text-amber-200">
                    {travados!.length}
                  </Badge>
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Serviços já atribuídos cuja janela passou e ainda não iniciaram. Devolva à fila ou reatribua.
                </p>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[40vh] overflow-y-auto">
                {travados!.map((t: any) => {
                  const placa = t.veiculo?.placa as string | undefined;
                  const chassi = t.veiculo?.chassi as string | undefined;
                  const identificador = formatPlacaOuChassi(placa, chassi, { fallback: '—' });
                  const tarefaParaAcao = {
                    ...t,
                    profissionalNome: t.profissional?.nome || 'Técnico',
                    profissionalIdAtual: t.profissional_id,
                  };
                  return (
                    <div key={t.id} className="border border-amber-300/50 rounded-md p-2 bg-background/60 flex items-center gap-2 text-xs">
                      {getTipoIcon(t.tipo)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold tracking-wider truncate">{identificador}</span>
                          <Badge variant="outline" className="text-[9px]">{t.status}</Badge>
                        </div>
                        <div className="text-muted-foreground truncate">
                          {t.associado?.nome || 'Sem nome'} · {t.localizacaoFormatada || t.bairro || '—'}
                        </div>
                        <div className="text-[10px] text-amber-700 dark:text-amber-400">
                          {format(parseISO(t.data_agendada), 'dd/MM', { locale: ptBR })} {t.periodo || ''} · técnico: {t.profissional?.nome || '—'}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem onClick={() => handleAcaoTarefa(tarefaParaAcao, 'devolver')}>
                            <RotateCcw className="h-3.5 w-3.5 mr-2" />
                            Devolver à fila / não compareceu
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAcaoTarefa(tarefaParaAcao, 'reatribuir')}>
                            <UserCog className="h-3.5 w-3.5 mr-2" />
                            Reatribuir a outro técnico
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Serviços Pendentes
                <Badge variant="secondary" className="ml-auto">{servicosFiltrados.length}</Badge>
              </CardTitle>
              <div className="flex gap-2 mt-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, placa, bairro, cidade ou zona..."
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger className="w-40 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os tipos</SelectItem>
                    <SelectItem value="instalacao">Instalações</SelectItem>
                    <SelectItem value="vistoria">Vistorias</SelectItem>
                    <SelectItem value="vistoria_base">Vistorias Base</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[65vh] overflow-y-auto">
              {Object.keys(grouped).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum serviço pendente</p>
              )}
              {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => (
                <div key={date}>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                    {isToday(parseISO(date)) ? '📅 Hoje' :
                      isTomorrow(parseISO(date)) ? '📅 Amanhã' :
                        format(parseISO(date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    <Badge variant="outline" className="ml-2 text-[10px]">{items.length}</Badge>
                  </p>
                  <div className="space-y-2">
                    {items.map(s => <DraggableServico key={s.id} servico={s} />)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ── Right: Vistoriadores + Prestadores ── */}
        <div className="lg:col-span-2 space-y-3 max-h-[80vh] overflow-y-auto">
          {/* Técnicos Internos */}
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <User className="h-4 w-4" />
            Técnicos Internos
            <Badge variant="secondary">{(vistoriadores || []).length}</Badge>
          </h3>
          {(vistoriadores || []).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum vistoriador em serviço</p>
          )}
          {(vistoriadores || []).map(v => (
            <DroppableVistoriador key={v.id} vistoriador={v} onAcaoTarefa={handleAcaoTarefa} podeForcarDevolucao={podeForcarDevolucao} />
          ))}

          {/* Prestadores Externos */}
          <div className="border-t pt-3 mt-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2 mb-1">
              <ExternalLink className="h-4 w-4" />
              Prestadores Externos
              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
                {prestadoresAtivos.length}
              </Badge>
            </h3>
            <p className="text-[11px] text-muted-foreground mb-3">
              Disponíveis por cadastro ativo — não dependem de status online.
            </p>
            {loadingPrestadores ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : prestadoresAtivos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum prestador ativo cadastrado</p>
            ) : (
              <div className="space-y-2">
                {prestadoresAtivos.map((p: any) => (
                  <DroppablePrestador key={p.id} prestador={p} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <DragOverlay>
        {dragging && <DragOverlayCard servico={dragging} />}
      </DragOverlay>

      {/* ── Confirmation Dialog (Técnico Interno) ── */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Atribuição</DialogTitle>
            <DialogDescription>
              Atribuir <strong>{getTipoLabel(confirmDialog?.servico?.tipo)}</strong>
              {confirmDialog?.servico?.bairro && <> em <strong>{confirmDialog.servico.bairro}</strong></>}
              {servicoConfirmAssoc?.nome && <> ({servicoConfirmAssoc.nome})</>}
              {' '}para <strong>{vistoriadorConfirm?.nome || 'Vistoriador'}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={atribuirMutation.isPending}>
              {atribuirMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmation Dialog (Prestador Externo) ── */}
      <Dialog open={!!prestadorConfirmDialog} onOpenChange={() => setPrestadorConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Atribuir a Prestador Externo
            </DialogTitle>
            <DialogDescription>
              Atribuir <strong>{getTipoLabel(prestadorConfirmDialog?.servico?.tipo)}</strong>
              {prestadorConfirmDialog?.servico?.bairro && <> em <strong>{prestadorConfirmDialog.servico.bairro}</strong></>}
              {prestadorConfirmAssoc?.nome && <> ({prestadorConfirmAssoc.nome})</>}
              {' '}para o prestador <strong>{prestadorConfirmDialog?.prestadorNome}</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
              Prestador Externo — Link será gerado sem envio automático de WhatsApp
            </Badge>

            <div>
              <label className="text-sm font-medium mb-1 block">Valor (R$) <span className="text-muted-foreground font-normal">(opcional)</span></label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex: 80.00 (opcional)"
                value={valorPrestador}
                onChange={e => setValorPrestador(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPrestadorConfirmDialog(null)}>Cancelar</Button>
            <Button
              onClick={handleConfirmPrestador}
              disabled={atribuirPrestadorMutation.isPending}
            >
              {atribuirPrestadorMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Gerar Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Link Result Dialog ── */}
      <LinkPrestadorResultDialog
        open={!!linkResult}
        onClose={() => setLinkResult(null)}
        url={linkResult?.url || ''}
        prestadorNome={linkResult?.prestadorNome || ''}
        prestadorTelefone={linkResult?.prestadorTelefone}
      />

      {/* ── Devolver à Fila / Reatribuir ── */}
      <DevolverFilaDialog
        open={!!acaoDialog}
        onOpenChange={(o) => { if (!o) setAcaoDialog(null); }}
        servico={acaoDialog?.servico ?? null}
        modoReatribuir={acaoDialog?.modo === 'reatribuir'}
      />
    </DndContext>
  );
}
