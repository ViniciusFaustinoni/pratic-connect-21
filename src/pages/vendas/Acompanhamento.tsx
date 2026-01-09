import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { 
  Rocket, Download, RefreshCw, Clock, UserCheck,
  AlertTriangle, CheckCircle2, Timer, Search, 
  FileText, CreditCard, Camera, Cpu, Inbox,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAcompanhamento } from "@/hooks/useAcompanhamento";
import { AtivacaoCard, AtivacaoItem, Etapa } from "@/components/ativacao/AtivacaoCard";
import { useAtivacaoMetrics } from "@/hooks/useAtivacaoMetrics";

// Definição das etapas do pipeline
const ETAPAS_ATIVACAO: Etapa[] = [
  {
    id: 'documentos',
    nome: 'Documentação',
    icone: FileText,
    cor: '#6366F1', // Indigo
    descricao: 'Aguardando envio de documentos',
    sla: 2,
  },
  {
    id: 'analise',
    nome: 'Em Análise',
    icone: Search,
    cor: '#8B5CF6', // Violet
    descricao: 'Documentos em análise',
    sla: 1,
  },
  {
    id: 'pagamento',
    nome: 'Pagamento',
    icone: CreditCard,
    cor: '#F59E0B', // Amber
    descricao: 'Aguardando pagamento',
    sla: 3,
  },
  {
    id: 'vistoria',
    nome: 'Vistoria',
    icone: Camera,
    cor: '#3B82F6', // Blue
    descricao: 'Vistoria pendente ou agendada',
    sla: 3,
  },
  {
    id: 'instalacao',
    nome: 'Instalação',
    icone: Cpu,
    cor: '#10B981', // Emerald
    descricao: 'Instalação do rastreador',
    sla: 2,
  },
  {
    id: 'ativo',
    nome: 'Ativo',
    icone: CheckCircle2,
    cor: '#22C55E', // Green
    descricao: 'Associado ativo',
    sla: null,
  },
];

// Mapeamento das fases do banco para as etapas do frontend
const FASE_TO_ETAPA: Record<string, string> = {
  'documentacao': 'documentos',
  'analise_cadastro': 'analise',
  'aprovado': 'pagamento',
  'instalacao_agendada': 'vistoria',
  'instalacao_concluida': 'instalacao',
  'ativacao_pendente': 'instalacao',
  'ativo': 'ativo',
};

type SlaFilter = 'todos' | 'no-prazo' | 'atencao' | 'atrasado';

export default function Acompanhamento() {
  const { data: rawItems, isLoading, error, refetch } = useAcompanhamento();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [slaFilter, setSlaFilter] = useState<SlaFilter>("todos");
  const [consultorFilter, setConsultorFilter] = useState<string>("todos");

  // Transformar dados do banco para o formato do componente
  const transformedItems: AtivacaoItem[] = useMemo(() => {
    if (!rawItems) return [];
    
    return rawItems.map(item => ({
      id: item.lead_id,
      codigo: `ATI-${item.lead_id.slice(0, 6).toUpperCase()}`,
      nome: item.nome,
      telefone: item.telefone || '',
      veiculo: [item.veiculo_marca, item.veiculo_modelo, item.veiculo_ano].filter(Boolean).join(' ') || undefined,
      placa: item.veiculo_placa || undefined,
      etapa: FASE_TO_ETAPA[item.fase_acompanhamento] || 'documentos',
      entrou_etapa_em: item.updated_at,
      consultor: item.vendedor_nome || 'Não atribuído',
      docsAprovados: item.docs_aprovados,
      docsTotal: item.docs_total,
      created_at: item.updated_at, // Using updated_at as created_at since view doesn't have created_at
    }));
  }, [rawItems]);

  // Lista de consultores únicos
  const consultores = useMemo(() => {
    const uniqueConsultores = [...new Set(transformedItems.map(i => i.consultor))];
    return uniqueConsultores.sort();
  }, [transformedItems]);

  // Métricas
  const metrics = useAtivacaoMetrics(transformedItems, ETAPAS_ATIVACAO);

  // Filtrar items
  const filteredItems = useMemo(() => {
    return transformedItems.filter(item => {
      // Filtro de busca
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          item.nome.toLowerCase().includes(query) ||
          item.codigo.toLowerCase().includes(query) ||
          item.veiculo?.toLowerCase().includes(query) ||
          item.placa?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Filtro de consultor
      if (consultorFilter !== 'todos' && item.consultor !== consultorFilter) {
        return false;
      }

      // Filtro de SLA
      if (slaFilter !== 'todos') {
        const etapa = ETAPAS_ATIVACAO.find(e => e.id === item.etapa);
        if (!etapa?.sla) return slaFilter === 'no-prazo';
        
        const diasNaEtapa = Math.floor(
          (Date.now() - new Date(item.entrou_etapa_em).getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (slaFilter === 'atrasado' && diasNaEtapa <= etapa.sla) return false;
        if (slaFilter === 'atencao' && (diasNaEtapa < etapa.sla - 1 || diasNaEtapa > etapa.sla)) return false;
        if (slaFilter === 'no-prazo' && diasNaEtapa >= etapa.sla - 1) return false;
      }

      return true;
    });
  }, [transformedItems, searchQuery, slaFilter, consultorFilter]);

  // Agrupar por etapa
  const itemsPorEtapa = useMemo(() => {
    return ETAPAS_ATIVACAO.reduce((acc, etapa) => {
      acc[etapa.id] = filteredItems.filter(item => item.etapa === etapa.id);
      return acc;
    }, {} as Record<string, AtivacaoItem[]>);
  }, [filteredItems]);

  // Verificar se tem item atrasado em uma etapa
  const temAtrasado = (etapaId: string) => {
    const etapa = ETAPAS_ATIVACAO.find(e => e.id === etapaId);
    if (!etapa?.sla) return false;
    
    return itemsPorEtapa[etapaId]?.some(item => {
      const dias = Math.floor(
        (Date.now() - new Date(item.entrou_etapa_em).getTime()) / (1000 * 60 * 60 * 24)
      );
      return dias > etapa.sla;
    });
  };

  // Smart wheel handler
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;

    let el: HTMLElement | null = target;
    while (el && el !== scrollRef.current) {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      const canScrollY =
        (overflowY === 'auto' || overflowY === 'scroll') &&
        el.scrollHeight > el.clientHeight;
      if (canScrollY) return;
      el = el.parentElement;
    }

    if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && !e.shiftKey) {
      e.preventDefault();
      scrollRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Rocket className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Pipeline de Ativação</h1>
            <p className="text-muted-foreground">Erro ao carregar dados</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-destructive p-4 bg-destructive/10 rounded-lg">
          <AlertTriangle className="h-5 w-5" />
          <span>Erro ao carregar dados. Tente novamente mais tarde.</span>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="ml-auto">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 bg-gradient-to-b from-muted/30 to-background">
      {/* Header */}
      <div className="flex-shrink-0 p-6 pb-4 space-y-4">
        {/* Breadcrumb + Title + Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Icon */}
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <Rocket className="h-7 w-7 text-white" />
            </div>
            
            <div>
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                <span>CRM</span>
                <ChevronRight className="h-3 w-3" />
                <span className="text-foreground font-medium">Ativações</span>
              </div>
              
              <h1 className="text-2xl font-bold tracking-tight">Pipeline de Ativação</h1>
              <p className="text-sm text-muted-foreground">
                Acompanhe o processo de ativação dos novos associados
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="hidden sm:flex">
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Em Processo */}
          <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border-indigo-500/20 hover:border-indigo-500/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-indigo-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? '-' : metrics.emProcesso}</p>
                  <p className="text-xs text-muted-foreground">Em processo</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Aguardando Cliente */}
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20 hover:border-amber-500/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <UserCheck className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? '-' : metrics.aguardandoCliente}</p>
                  <p className="text-xs text-muted-foreground">Aguard. cliente</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SLA Estourado */}
          <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20 hover:border-red-500/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? '-' : metrics.slaEstourado}</p>
                  <p className="text-xs text-muted-foreground">SLA estourado</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ativados Hoje */}
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? '-' : metrics.ativadosHoje}</p>
                  <p className="text-xs text-muted-foreground">Ativados hoje</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tempo Médio */}
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20 hover:border-blue-500/30 transition-colors col-span-2 sm:col-span-1">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Timer className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{isLoading ? '-' : `${metrics.tempoMedio}d`}</p>
                  <p className="text-xs text-muted-foreground">Tempo médio</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Buscar por nome, código, veículo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          <div className="h-6 w-px bg-border/50 hidden sm:block" />

          {/* SLA Filter */}
          <ToggleGroup 
            type="single" 
            value={slaFilter}
            onValueChange={(v) => v && setSlaFilter(v as SlaFilter)}
            className="bg-muted/50 rounded-lg p-0.5"
          >
            <ToggleGroupItem value="todos" className="text-xs px-3 h-8 data-[state=on]:bg-background data-[state=on]:shadow-sm">
              Todos
            </ToggleGroupItem>
            <ToggleGroupItem value="no-prazo" className="text-xs px-3 h-8 data-[state=on]:bg-background data-[state=on]:shadow-sm">
              <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
              No prazo
            </ToggleGroupItem>
            <ToggleGroupItem value="atencao" className="text-xs px-3 h-8 data-[state=on]:bg-background data-[state=on]:shadow-sm">
              <AlertTriangle className="h-3 w-3 mr-1 text-amber-500" />
              Atenção
            </ToggleGroupItem>
            <ToggleGroupItem value="atrasado" className="text-xs px-3 h-8 data-[state=on]:bg-background data-[state=on]:shadow-sm">
              <AlertTriangle className="h-3 w-3 mr-1 text-red-500" />
              Atrasados
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="h-6 w-px bg-border/50 hidden sm:block" />

          {/* Consultor Filter */}
          <Select value={consultorFilter} onValueChange={setConsultorFilter}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <SelectValue placeholder="Consultor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos consultores</SelectItem>
              {consultores.map(consultor => (
                <SelectItem key={consultor} value={consultor}>
                  {consultor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Progress Timeline */}
        <div className="flex items-center justify-between overflow-x-auto pb-2 gap-2">
          {ETAPAS_ATIVACAO.map((etapa, index) => {
            const Icon = etapa.icone;
            const count = itemsPorEtapa[etapa.id]?.length || 0;
            
            return (
              <div key={etapa.id} className="flex items-center flex-shrink-0">
                {/* Stage indicator */}
                <div className="flex flex-col items-center gap-1">
                  <div 
                    className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center relative transition-all",
                      count > 0 ? "bg-card shadow-md" : "bg-muted/50"
                    )}
                    style={{ 
                      borderWidth: 2,
                      borderColor: count > 0 ? etapa.cor : 'hsl(var(--border))'
                    }}
                  >
                    <Icon 
                      className="h-4 w-4" 
                      style={{ color: count > 0 ? etapa.cor : 'hsl(var(--muted-foreground))' }} 
                    />
                    {count > 0 && (
                      <span 
                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                        style={{ backgroundColor: etapa.cor }}
                      >
                        {count}
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    "text-[10px] font-medium whitespace-nowrap",
                    count > 0 ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {etapa.nome}
                  </span>
                </div>
                
                {/* Connector line */}
                {index < ETAPAS_ATIVACAO.length - 1 && (
                  <div className="w-8 lg:w-12 h-0.5 bg-border mx-1 relative overflow-hidden">
                    <div 
                      className="absolute inset-y-0 left-0 transition-all duration-500"
                      style={{ 
                        width: count > 0 ? '100%' : '0%',
                        backgroundColor: etapa.cor
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Kanban Columns */}
      <div 
        ref={scrollRef}
        onWheel={handleWheel}
        className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden px-6 pb-6 kanban-scroll"
      >
        <div className="inline-flex gap-4 min-w-max h-full py-2">
          {isLoading ? (
            // Skeleton loading
            ETAPAS_ATIVACAO.map((etapa) => (
              <div key={etapa.id} className="flex-shrink-0 w-[300px] rounded-xl border bg-card/50">
                <div className="p-4 border-b">
                  <Skeleton className="h-6 w-32" />
                </div>
                <div className="p-3 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-lg" />
                  ))}
                </div>
              </div>
            ))
          ) : filteredItems.length === 0 && !searchQuery && slaFilter === 'todos' && consultorFilter === 'todos' ? (
            // Empty state - no items at all
            <div className="flex flex-col items-center justify-center w-full min-h-[400px] text-center px-4">
              <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Inbox className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Nenhuma ativação pendente</h3>
              <p className="text-sm text-muted-foreground max-w-md mb-6">
                Todos os associados foram ativados! Quando novos contratos forem fechados, 
                eles aparecerão aqui para acompanhamento.
              </p>
              <Button variant="outline" onClick={() => window.history.back()}>
                Voltar para Vendas
              </Button>
            </div>
          ) : (
            // Kanban columns
            ETAPAS_ATIVACAO.map((etapa) => {
              const Icon = etapa.icone;
              const items = itemsPorEtapa[etapa.id] || [];
              const hasOverdue = temAtrasado(etapa.id);
              
              return (
                <div 
                  key={etapa.id} 
                  className={cn(
                    "flex-shrink-0 w-[300px] rounded-xl border bg-card/60 backdrop-blur-sm",
                    "flex flex-col h-full transition-all",
                    "hover:shadow-md hover:border-border"
                  )}
                  style={{ borderTopWidth: 3, borderTopColor: etapa.cor }}
                >
                  {/* Column Header */}
                  <div className="p-4 border-b border-border/50 flex-shrink-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-8 w-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${etapa.cor}20` }}
                        >
                          <Icon className="h-4 w-4" style={{ color: etapa.cor }} />
                        </div>
                        <h3 className="font-semibold text-sm">{etapa.nome}</h3>
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        {hasOverdue && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                          </span>
                        )}
                        <Badge 
                          variant="secondary" 
                          className="text-xs font-bold"
                          style={{ 
                            backgroundColor: items.length > 0 ? `${etapa.cor}20` : undefined,
                            color: items.length > 0 ? etapa.cor : undefined
                          }}
                        >
                          {items.length}
                        </Badge>
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">{etapa.descricao}</p>
                    
                    {etapa.sla && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        SLA: {etapa.sla} {etapa.sla === 1 ? 'dia' : 'dias'}
                      </div>
                    )}
                  </div>

                  {/* Column Content */}
                  <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
                    {items.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div 
                          className="h-12 w-12 rounded-full flex items-center justify-center mb-3"
                          style={{ backgroundColor: `${etapa.cor}10` }}
                        >
                          <Inbox className="h-6 w-6" style={{ color: etapa.cor, opacity: 0.5 }} />
                        </div>
                        <p className="text-sm text-muted-foreground">Nenhum item</p>
                      </div>
                    ) : (
                      items.map((item) => (
                        <AtivacaoCard
                          key={item.id}
                          item={item}
                          etapa={etapa}
                          onClick={() => {
                            // TODO: Open detail modal
                            console.log('Open details for:', item.id);
                          }}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Mobile indicator */}
      <p className="text-xs text-muted-foreground text-center pb-2 md:hidden px-6">
        ← Arraste para ver mais colunas →
      </p>
    </div>
  );
}
