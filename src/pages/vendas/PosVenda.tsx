import { useState, useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ClipboardCheck, 
  Search, 
  Filter, 
  Car, 
  FileText, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Wrench,
  GripVertical,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

// Etapas do pós-venda
type EtapaPosVenda = 
  | 'contrato_assinado' 
  | 'docs_pendentes' 
  | 'implantacao' 
  | 'ativo' 
  | 'cancelado';

const ETAPAS_POS_VENDA: EtapaPosVenda[] = [
  'contrato_assinado',
  'docs_pendentes',
  'implantacao',
  'ativo',
  'cancelado',
];

const ETAPA_LABELS: Record<EtapaPosVenda, string> = {
  contrato_assinado: 'Contrato Assinado',
  docs_pendentes: 'Docs Pendentes',
  implantacao: 'Em Implantação',
  ativo: 'Ativo',
  cancelado: 'Cancelado',
};

const ETAPA_ICONS: Record<EtapaPosVenda, React.ComponentType<{ className?: string }>> = {
  contrato_assinado: FileText,
  docs_pendentes: AlertTriangle,
  implantacao: Wrench,
  ativo: CheckCircle2,
  cancelado: XCircle,
};

const ETAPA_COLORS: Record<EtapaPosVenda, string> = {
  contrato_assinado: 'border-t-blue-500',
  docs_pendentes: 'border-t-yellow-500',
  implantacao: 'border-t-purple-500',
  ativo: 'border-t-green-500',
  cancelado: 'border-t-red-500',
};

const ETAPA_BADGE_COLORS: Record<EtapaPosVenda, string> = {
  contrato_assinado: 'bg-blue-500/20 text-blue-400',
  docs_pendentes: 'bg-yellow-500/20 text-yellow-400',
  implantacao: 'bg-purple-500/20 text-purple-400',
  ativo: 'bg-green-500/20 text-green-400',
  cancelado: 'bg-red-500/20 text-red-400',
};

// Mock data structure - em produção viria do banco
interface ContratoPosvenda {
  id: string;
  associado_nome: string;
  veiculo_placa: string;
  veiculo_modelo: string;
  etapa: EtapaPosVenda;
  docs_pendentes: string[];
  vendedor_nome: string;
  data_fechamento: string;
  updated_at: string;
}

// Hook para buscar contratos em pós-venda
function useContratosPosVenda() {
  return useQuery({
    queryKey: ['contratos-posvenda'],
    queryFn: async () => {
      // Query contratos com status que indicam pós-venda
      const { data, error } = await supabase
        .from('contratos')
        .select(`
          id,
          numero,
          status,
          created_at,
          updated_at,
          associado:associado_id (
            nome
          ),
          veiculo:veiculo_id (
            placa,
            modelo
          ),
          vendedor:vendedor_id (
            nome
          )
        `)
        .in('status', ['assinado', 'pendente', 'ativo', 'suspenso', 'cancelado'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Map to our structure
      return (data || []).map((c: any): ContratoPosvenda => {
        let etapa: EtapaPosVenda = 'contrato_assinado';
        
        // Map contract status to post-sale stage
        if (c.status === 'ativo') {
          etapa = 'ativo';
        } else if (c.status === 'cancelado' || c.status === 'suspenso') {
          etapa = 'cancelado';
        } else if (c.status === 'assinado') {
          etapa = 'docs_pendentes';
        } else if (c.status === 'pendente') {
          etapa = 'contrato_assinado';
        }

        return {
          id: c.id,
          associado_nome: c.associado?.nome || 'N/A',
          veiculo_placa: c.veiculo?.placa || 'N/A',
          veiculo_modelo: c.veiculo?.modelo || 'N/A',
          etapa,
          docs_pendentes: [], // Would come from a checklist table
          vendedor_nome: c.vendedor?.nome || 'N/A',
          data_fechamento: c.created_at,
          updated_at: c.updated_at,
        };
      });
    },
  });
}

// Card do Pós-venda
interface PosVendaCardProps {
  contrato: ContratoPosvenda;
  onClick: () => void;
}

function PosVendaCard({ contrato, onClick }: PosVendaCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: contrato.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'p-3 cursor-pointer transition-all duration-200 border',
        'hover:border-primary hover:shadow-md hover:-translate-y-0.5',
        isDragging && 'opacity-50 shadow-lg rotate-2'
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-muted"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-xs font-semibold text-primary flex-shrink-0">
            {contrato.associado_nome.charAt(0).toUpperCase()}
          </div>
          <span className="font-medium text-sm truncate">{contrato.associado_nome}</span>
        </div>
      </div>

      {/* Veículo */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Car className="h-3 w-3" />
        <span className="font-mono text-xs">{contrato.veiculo_placa}</span>
        <span className="text-xs">•</span>
        <span className="text-xs truncate">{contrato.veiculo_modelo}</span>
      </div>

      {/* Docs pendentes (if any) */}
      {contrato.docs_pendentes.length > 0 && (
        <div className="mb-3 space-y-1">
          {contrato.docs_pendentes.slice(0, 2).map((doc, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-orange-500">
              <FileText className="h-3 w-3" />
              <span>{doc}</span>
            </div>
          ))}
          {contrato.docs_pendentes.length > 2 && (
            <span className="text-xs text-muted-foreground">
              +{contrato.docs_pendentes.length - 2} mais
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
        <div className="flex items-center gap-1">
          <User className="h-3 w-3" />
          <span>{contrato.vendedor_nome}</span>
        </div>
        <span>
          {format(new Date(contrato.data_fechamento), 'dd/MM', { locale: ptBR })}
        </span>
      </div>
    </Card>
  );
}

// Coluna droppable
interface DroppableColumnProps {
  etapa: EtapaPosVenda;
  contratos: ContratoPosvenda[];
  onContratoClick: (contrato: ContratoPosvenda) => void;
}

function DroppableColumn({ etapa, contratos, onContratoClick }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa });
  const Icon = ETAPA_ICONS[etapa];

  return (
    <Card
      className={cn(
        'flex flex-col min-w-[280px] max-w-[280px] flex-shrink-0 border-t-4 bg-card',
        ETAPA_COLORS[etapa],
        isOver && 'ring-2 ring-primary ring-offset-2'
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{ETAPA_LABELS[etapa]}</span>
        </div>
        <Badge variant="secondary" className={cn('text-xs', ETAPA_BADGE_COLORS[etapa])}>
          {contratos.length}
        </Badge>
      </div>

      {/* Column Body with Cards */}
      <ScrollArea className="flex-1 max-h-[calc(100vh-320px)]">
        <div ref={setNodeRef} className="p-2 space-y-2 min-h-[100px]">
          <SortableContext items={contratos.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {contratos.map((contrato) => (
              <PosVendaCard
                key={contrato.id}
                contrato={contrato}
                onClick={() => onContratoClick(contrato)}
              />
            ))}
          </SortableContext>
          {contratos.length === 0 && (
            <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
              Nenhum contrato
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}

export default function PosVenda() {
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: contratos = [], isLoading } = useContratosPosVenda();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  // Filter by search
  const filteredContratos = useMemo(() => {
    if (!search) return contratos;
    const searchLower = search.toLowerCase();
    return contratos.filter(
      (c) =>
        c.associado_nome.toLowerCase().includes(searchLower) ||
        c.veiculo_placa.toLowerCase().includes(searchLower) ||
        c.veiculo_modelo.toLowerCase().includes(searchLower)
    );
  }, [contratos, search]);

  // Group by stage
  const contratosByEtapa = ETAPAS_POS_VENDA.reduce((acc, etapa) => {
    acc[etapa] = filteredContratos.filter((c) => c.etapa === etapa);
    return acc;
  }, {} as Record<EtapaPosVenda, ContratoPosvenda[]>);

  // Metrics
  const metrics = useMemo(() => {
    return {
      docsPendentes: contratosByEtapa.docs_pendentes?.length || 0,
      implantando: contratosByEtapa.implantacao?.length || 0,
      ativosMes: contratosByEtapa.ativo?.length || 0,
    };
  }, [contratosByEtapa]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over) return;

    const contratoId = active.id as string;
    const newEtapa = over.id as EtapaPosVenda;

    if (ETAPAS_POS_VENDA.includes(newEtapa)) {
      const contrato = contratos.find((c) => c.id === contratoId);
      if (contrato && contrato.etapa !== newEtapa) {
        // Map post-sale stage to contract status
        type ContratoStatus = 'pendente' | 'assinado' | 'ativo' | 'cancelado';
        let newStatus: ContratoStatus = 'pendente';
        if (newEtapa === 'ativo') newStatus = 'ativo';
        else if (newEtapa === 'cancelado') newStatus = 'cancelado';
        else if (newEtapa === 'docs_pendentes') newStatus = 'assinado';
        else if (newEtapa === 'implantacao') newStatus = 'assinado';

        try {
          const { error } = await supabase
            .from('contratos')
            .update({ status: newStatus })
            .eq('id', contratoId);

          if (error) throw error;
          
          queryClient.invalidateQueries({ queryKey: ['contratos-posvenda'] });
          toast.success('Contrato movido com sucesso!');
        } catch (error) {
          toast.error('Erro ao mover contrato');
          console.error(error);
        }
      }
    }
  };

  const handleContratoClick = (contrato: ContratoPosvenda) => {
    // Could open a detail drawer/dialog
    toast.info(`Contrato: ${contrato.associado_nome}`);
  };

  const activeContrato = activeId ? contratos.find((c) => c.id === activeId) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ClipboardCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Pós-venda</h1>
              <p className="text-sm text-muted-foreground">Acompanhamento após fechamento</p>
            </div>
          </div>

          {/* Metrics */}
          <div className="flex gap-3">
            <Card className="px-4 py-2 flex items-center gap-3 min-w-[100px]">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <div>
                <p className="text-xs text-muted-foreground">Docs Pend.</p>
                <p className="text-lg font-semibold text-yellow-500">{metrics.docsPendentes}</p>
              </div>
            </Card>
            <Card className="px-4 py-2 flex items-center gap-3 min-w-[100px]">
              <Wrench className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-xs text-muted-foreground">Implantando</p>
                <p className="text-lg font-semibold text-purple-500">{metrics.implantando}</p>
              </div>
            </Card>
            <Card className="px-4 py-2 flex items-center gap-3 min-w-[100px]">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Ativos</p>
                <p className="text-lg font-semibold text-green-500">{metrics.ativosMes}</p>
              </div>
            </Card>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, placa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Carregando contratos...</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 overflow-x-auto overflow-y-hidden pb-4 px-6 pt-4 h-[calc(100vh-220px)]">
              {ETAPAS_POS_VENDA.map((etapa) => (
                <DroppableColumn
                  key={etapa}
                  etapa={etapa}
                  contratos={contratosByEtapa[etapa] || []}
                  onContratoClick={handleContratoClick}
                />
              ))}
            </div>

            <DragOverlay>
              {activeContrato && (
                <div className="opacity-80 rotate-3 shadow-2xl">
                  <PosVendaCard contrato={activeContrato} onClick={() => {}} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}
