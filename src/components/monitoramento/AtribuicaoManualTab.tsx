import { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useServicosParaAtribuir, useVistoriadoresAtivos, useAtribuirServicoManual } from '@/hooks/useAtribuicaoManual';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, GripVertical, MapPin, User, Car, Clock, Wrench, ClipboardCheck, Search, Calendar, Navigation, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TIPO_SERVICO_LABELS } from '@/hooks/useServicos';

function getTipoLabel(tipo: string) {
  return (TIPO_SERVICO_LABELS as Record<string, string>)[tipo] || tipo;
}

function getTipoBadgeClass(tipo: string) {
  if (tipo === 'instalacao') return 'border-blue-300 text-blue-700 dark:text-blue-300';
  if (tipo === 'revistoria') return 'border-teal-300 text-teal-700 dark:text-teal-300';
  return 'border-amber-300 text-amber-700 dark:text-amber-300';
}

function getTipoIcon(tipo: string) {
  if (tipo === 'instalacao') return <Wrench className="h-3 w-3 text-blue-500" />;
  if (tipo === 'revistoria') return <FileText className="h-3 w-3 text-teal-500" />;
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
            {veic?.placa && (
              <span className="flex items-center gap-1">
                <Car className="h-3 w-3" /> {veic.placa}
              </span>
            )}
            {servico.bairro && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {servico.bairro}
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
          <p className="text-xs text-muted-foreground">{getTipoLabel(servico.tipo)} · {servico.bairro}</p>
        </div>
      </div>
    </div>
  );
}

// ── Droppable Vistoriador Card ──
function DroppableVistoriador({ vistoriador }: { vistoriador: any }) {
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
          {vistoriador.tarefas.map((t: any) => (
            <div key={t.id} className="flex items-center gap-2 text-xs p-2 rounded bg-muted/50">
              {getTipoIcon(t.tipo)}
              <span className="truncate">{t.bairro || t.cidade || 'Sem local'}</span>
              <Badge variant="outline" className="ml-auto text-[9px]">{t.status}</Badge>
            </div>
          ))}
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

// ── Main Component ──
export default function AtribuicaoManualTab() {
  const { data: servicos, isLoading: loadingServicos } = useServicosParaAtribuir();
  const { data: vistoriadores, isLoading: loadingVist } = useVistoriadoresAtivos();
  const atribuirMutation = useAtribuirServicoManual();

  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [busca, setBusca] = useState('');
  const [dragging, setDragging] = useState<any>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ servico: any; vistoriadorId: string } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const servicosFiltrados = (servicos || []).filter(s => {
    if (filtroTipo !== 'todos' && s.tipo !== filtroTipo) return false;
    if (busca) {
      const term = busca.toLowerCase();
      const assoc = s.associado as any;
      const veic = s.veiculo as any;
      if (
        !(assoc?.nome || '').toLowerCase().includes(term) &&
        !(veic?.placa || '').toLowerCase().includes(term) &&
        !(s.bairro || '').toLowerCase().includes(term)
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

    const vistoriadorId = (over.id as string).replace('vist-', '');
    const servico = active.data.current;
    setConfirmDialog({ servico, vistoriadorId });
  };

  const handleConfirm = () => {
    if (!confirmDialog) return;
    atribuirMutation.mutate({
      servicoId: confirmDialog.servico.id,
      profissionalId: confirmDialog.vistoriadorId,
    });
    setConfirmDialog(null);
  };

  const vistoriadorConfirm = confirmDialog
    ? (vistoriadores || []).find(v => v.id === confirmDialog.vistoriadorId)
    : null;
  const servicoConfirmAssoc = confirmDialog?.servico?.associado as any;

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
                    placeholder="Buscar por nome, placa ou bairro..."
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

        {/* ── Right: Vistoriadores ── */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <User className="h-4 w-4" />
            Vistoriadores Ativos
            <Badge variant="secondary">{(vistoriadores || []).length}</Badge>
          </h3>
          {(vistoriadores || []).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum vistoriador em serviço</p>
          )}
          {(vistoriadores || []).map(v => (
            <DroppableVistoriador key={v.id} vistoriador={v} />
          ))}
        </div>
      </div>

      <DragOverlay>
        {dragging && <DragOverlayCard servico={dragging} />}
      </DragOverlay>

      {/* ── Confirmation Dialog ── */}
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
    </DndContext>
  );
}
