import { useState, useMemo } from 'react';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  UserPlus, RefreshCw, Edit, Upload, CheckCircle, XCircle,
  Car, Calendar, CheckSquare, SquareX, Receipt, DollarSign,
  PhoneCall, PhoneOff, AlertTriangle, FileText, FileCheck,
  MessageSquare, ChevronDown, Filter, Loader2, History, X, Wrench
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import type { LucideIcon } from 'lucide-react';
import type { DateRange } from 'react-day-picker';

// Types
export type TipoEvento =
  | 'associado_criado'
  | 'status_alterado'
  | 'dados_atualizados'
  | 'documento_enviado'
  | 'documento_aprovado'
  | 'documento_reprovado'
  | 'veiculo_adicionado'
  | 'veiculo_removido'
  | 'instalacao_agendada'
  | 'instalacao_concluida'
  | 'instalacao_cancelada'
  | 'boleto_gerado'
  | 'boleto_pago'
  | 'boleto_cancelado'
  | 'chamado_aberto'
  | 'chamado_concluido'
  | 'sinistro_aberto'
  | 'sinistro_atualizado'
  | 'sinistro_encerrado'
  | 'contrato_assinado'
  | 'observacao_adicionada'
  | 'ressalva_registrada'
  | 'ressalva_aprovada_monitoramento'
  | 'ressalva_declinada_monitoramento'
  | 'ressalva_instalacao';

export interface EventoHistorico {
  id: string;
  tipo: TipoEvento;
  descricao: string;
  data: string;
  usuario?: {
    id: string;
    nome: string;
  };
  dados_anteriores?: Record<string, unknown>;
  dados_novos?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface TimelineHistoricoProps {
  eventos: EventoHistorico[];
  isLoading?: boolean;
  maxItems?: number;
  showFilters?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

// Event configuration
interface EventoConfig {
  icone: LucideIcon;
  cor: string;
  bgCor: string;
  label: string;
}

const eventoConfig: Record<TipoEvento, EventoConfig> = {
  associado_criado: {
    icone: UserPlus,
    cor: 'text-green-600',
    bgCor: 'bg-green-100',
    label: 'Associado cadastrado',
  },
  status_alterado: {
    icone: RefreshCw,
    cor: 'text-blue-600',
    bgCor: 'bg-blue-100',
    label: 'Status alterado',
  },
  dados_atualizados: {
    icone: Edit,
    cor: 'text-purple-600',
    bgCor: 'bg-purple-100',
    label: 'Dados atualizados',
  },
  documento_enviado: {
    icone: Upload,
    cor: 'text-yellow-600',
    bgCor: 'bg-yellow-100',
    label: 'Documento enviado',
  },
  documento_aprovado: {
    icone: CheckCircle,
    cor: 'text-green-600',
    bgCor: 'bg-green-100',
    label: 'Documento aprovado',
  },
  documento_reprovado: {
    icone: XCircle,
    cor: 'text-red-600',
    bgCor: 'bg-red-100',
    label: 'Documento reprovado',
  },
  veiculo_adicionado: {
    icone: Car,
    cor: 'text-blue-600',
    bgCor: 'bg-blue-100',
    label: 'Veículo adicionado',
  },
  veiculo_removido: {
    icone: Car,
    cor: 'text-red-600',
    bgCor: 'bg-red-100',
    label: 'Veículo removido',
  },
  instalacao_agendada: {
    icone: Calendar,
    cor: 'text-orange-600',
    bgCor: 'bg-orange-100',
    label: 'Instalação agendada',
  },
  instalacao_concluida: {
    icone: CheckSquare,
    cor: 'text-green-600',
    bgCor: 'bg-green-100',
    label: 'Instalação concluída',
  },
  instalacao_cancelada: {
    icone: SquareX,
    cor: 'text-red-600',
    bgCor: 'bg-red-100',
    label: 'Instalação cancelada',
  },
  boleto_gerado: {
    icone: Receipt,
    cor: 'text-blue-600',
    bgCor: 'bg-blue-100',
    label: 'Boleto gerado',
  },
  boleto_pago: {
    icone: DollarSign,
    cor: 'text-green-600',
    bgCor: 'bg-green-100',
    label: 'Boleto pago',
  },
  boleto_cancelado: {
    icone: Receipt,
    cor: 'text-red-600',
    bgCor: 'bg-red-100',
    label: 'Boleto cancelado',
  },
  chamado_aberto: {
    icone: PhoneCall,
    cor: 'text-orange-600',
    bgCor: 'bg-orange-100',
    label: 'Chamado aberto',
  },
  chamado_concluido: {
    icone: PhoneOff,
    cor: 'text-green-600',
    bgCor: 'bg-green-100',
    label: 'Chamado concluído',
  },
  sinistro_aberto: {
    icone: AlertTriangle,
    cor: 'text-red-600',
    bgCor: 'bg-red-100',
    label: 'Sinistro aberto',
  },
  sinistro_atualizado: {
    icone: FileText,
    cor: 'text-yellow-600',
    bgCor: 'bg-yellow-100',
    label: 'Sinistro atualizado',
  },
  sinistro_encerrado: {
    icone: FileCheck,
    cor: 'text-green-600',
    bgCor: 'bg-green-100',
    label: 'Sinistro encerrado',
  },
  contrato_assinado: {
    icone: FileText,
    cor: 'text-green-600',
    bgCor: 'bg-green-100',
    label: 'Contrato assinado',
  },
  observacao_adicionada: {
    icone: MessageSquare,
    cor: 'text-gray-600',
    bgCor: 'bg-gray-100',
    label: 'Observação adicionada',
  },
  ressalva_registrada: {
    icone: AlertTriangle,
    cor: 'text-amber-600',
    bgCor: 'bg-amber-100',
    label: 'Ressalva registrada',
  },
  ressalva_aprovada_monitoramento: {
    icone: CheckCircle,
    cor: 'text-green-600',
    bgCor: 'bg-green-100',
    label: 'Ressalva aprovada',
  },
  ressalva_declinada_monitoramento: {
    icone: XCircle,
    cor: 'text-red-600',
    bgCor: 'bg-red-100',
    label: 'Ressalva declinada',
  },
  ressalva_instalacao: {
    icone: Wrench,
    cor: 'text-amber-600',
    bgCor: 'bg-amber-100',
    label: 'Ressalva de instalação',
  },
};

// Filter categories
const filterCategories: Record<string, TipoEvento[]> = {
  todos: [],
  status: ['status_alterado', 'associado_criado', 'dados_atualizados'],
  documentos: ['documento_enviado', 'documento_aprovado', 'documento_reprovado'],
  instalacoes: ['instalacao_agendada', 'instalacao_concluida', 'instalacao_cancelada', 'veiculo_adicionado', 'veiculo_removido'],
  financeiro: ['boleto_gerado', 'boleto_pago', 'boleto_cancelado', 'contrato_assinado'],
  sinistros: ['sinistro_aberto', 'sinistro_atualizado', 'sinistro_encerrado'],
  chamados: ['chamado_aberto', 'chamado_concluido'],
  ressalvas: ['ressalva_registrada', 'ressalva_aprovada_monitoramento', 'ressalva_declinada_monitoramento', 'ressalva_instalacao'],
};

export function TimelineHistorico({
  eventos,
  isLoading = false,
  maxItems = 50,
  showFilters = true,
  onLoadMore,
  hasMore = false,
}: TimelineHistoricoProps) {
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Filter events
  const eventosFiltrados = useMemo(() => {
    let resultado = [...eventos];

    // Filter by type category
    if (filtroTipo !== 'todos') {
      const tiposPermitidos = filterCategories[filtroTipo];
      if (tiposPermitidos && tiposPermitidos.length > 0) {
        resultado = resultado.filter((e) => tiposPermitidos.includes(e.tipo));
      }
    }

    // Filter by date range
    if (dateRange?.from && dateRange?.to) {
      resultado = resultado.filter((e) => {
        const eventDate = parseISO(e.data);
        return isWithinInterval(eventDate, {
          start: startOfDay(dateRange.from!),
          end: endOfDay(dateRange.to!),
        });
      });
    }

    return resultado.slice(0, maxItems);
  }, [eventos, filtroTipo, dateRange, maxItems]);

  // Group by date
  const eventosAgrupados = useMemo(() => {
    const grupos: Record<string, EventoHistorico[]> = {};

    eventosFiltrados.forEach((evento) => {
      const dataKey = format(parseISO(evento.data), 'yyyy-MM-dd');
      if (!grupos[dataKey]) {
        grupos[dataKey] = [];
      }
      grupos[dataKey].push(evento);
    });

    return grupos;
  }, [eventosFiltrados]);

  const limparFiltros = () => {
    setFiltroTipo('todos');
    setDateRange(undefined);
  };

  const temFiltrosAtivos = filtroTipo !== 'todos' || dateRange?.from;

  if (isLoading) {
    return <TimelineSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Histórico de Atividades</span>
        </div>

        {showFilters && temFiltrosAtivos && (
          <Button variant="ghost" size="sm" onClick={limparFiltros}>
            <X className="mr-1 h-4 w-4" />
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Type filter */}
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os eventos</SelectItem>
              <SelectItem value="status">Alterações de status</SelectItem>
              <SelectItem value="documentos">Documentos</SelectItem>
              <SelectItem value="instalacoes">Instalações</SelectItem>
              <SelectItem value="financeiro">Financeiro</SelectItem>
              <SelectItem value="sinistros">Sinistros</SelectItem>
              <SelectItem value="chamados">Chamados</SelectItem>
              <SelectItem value="ressalvas">Ressalvas</SelectItem>
            </SelectContent>
          </Select>

          {/* Date filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto justify-start">
                <Calendar className="mr-2 h-4 w-4" />
                {dateRange?.from && dateRange?.to
                  ? `${format(dateRange.from, 'dd/MM')} - ${format(dateRange.to, 'dd/MM')}`
                  : 'Período'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                locale={ptBR}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Timeline content */}
      {eventosFiltrados.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

          {/* Events grouped by date */}
          <div className="space-y-6">
            {Object.entries(eventosAgrupados).map(([data, eventosData]) => (
              <div key={data} className="relative">
                {/* Date separator */}
                <div className="relative flex items-center gap-3 pb-4">
                  <div className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground capitalize">
                    {format(parseISO(data), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </span>
                </div>

                {/* Events for this date */}
                {eventosData.map((evento) => (
                  <EventoItem key={evento.id} evento={evento} />
                ))}
              </div>
            ))}
          </div>

          {/* Load more button */}
          {hasMore && onLoadMore && (
            <div className="pt-6 text-center">
              <Button variant="outline" onClick={onLoadMore}>
                <ChevronDown className="mr-2 h-4 w-4" />
                Carregar mais eventos
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Event item component
function EventoItem({ evento }: { evento: EventoHistorico }) {
  const [expandido, setExpandido] = useState(false);
  const config = eventoConfig[evento.tipo];
  const Icone = config.icone;

  const temDetalhes = evento.dados_anteriores || evento.dados_novos || evento.metadata;

  return (
    <div className="relative flex gap-4 pb-4 last:pb-0">
      {/* Icon */}
      <div
        className={cn(
          'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          config.bgCor
        )}
      >
        <Icone className={cn('h-4 w-4', config.cor)} />
      </div>

      {/* Content */}
      <Collapsible open={expandido} onOpenChange={setExpandido} className="flex-1 min-w-0">
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {format(parseISO(evento.data), 'HH:mm', { locale: ptBR })}
                </span>
                <span className={cn('text-sm font-medium', config.cor)}>
                  {config.label}
                </span>
              </div>

              <p className="mt-1 text-sm text-foreground">{evento.descricao}</p>

              {evento.usuario && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Por: {evento.usuario.nome}
                </p>
              )}
            </div>

            {temDetalhes && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="shrink-0">
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      expandido && 'rotate-180'
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            )}
          </div>

          {/* Expanded details */}
          <CollapsibleContent>
            {temDetalhes && (
              <div className="mt-3 space-y-3 border-t pt-3">
                {evento.dados_anteriores && evento.dados_novos && (
                  <DetalhesAlteracao
                    anterior={evento.dados_anteriores}
                    novo={evento.dados_novos}
                  />
                )}
                {evento.metadata && <DetalhesMetadata metadata={evento.metadata} />}
              </div>
            )}
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}

// Details for changes
function DetalhesAlteracao({
  anterior,
  novo,
}: {
  anterior: Record<string, unknown>;
  novo: Record<string, unknown>;
}) {
  const campos = Object.keys(novo);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Alterações:</p>
      <div className="space-y-1">
        {campos.map((campo) => (
          <div key={campo} className="flex flex-wrap items-center gap-1 text-xs">
            <span className="font-medium capitalize">{campo.replace(/_/g, ' ')}:</span>
            <span className="text-muted-foreground line-through">
              {String(anterior[campo] || '—')}
            </span>
            <span>→</span>
            <span className="font-medium text-foreground">{String(novo[campo] || '—')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Details for metadata
function DetalhesMetadata({ metadata }: { metadata: Record<string, unknown> }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Detalhes:</p>
      <div className="space-y-1">
        {Object.entries(metadata).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span>
            <span>{String(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Empty state
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <History className="h-12 w-12 text-muted-foreground/50" />
      <h3 className="mt-4 font-semibold">Nenhum evento encontrado</h3>
      <p className="text-sm text-muted-foreground">O histórico de atividades aparecerá aqui</p>
    </div>
  );
}

// Loading skeleton
function TimelineSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent>
        <div className="relative space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
