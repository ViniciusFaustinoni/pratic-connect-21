import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Calendar, LayoutGrid, List, Search, ChevronLeft, ChevronRight, Settings, ArrowUpDown, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PropostasMetricsBar } from '@/components/propostas/PropostasMetricsBar';
import { ConsultorCardNew } from '@/components/propostas/ConsultorCardNew';
import { ConsultoresTable } from '@/components/propostas/ConsultoresTable';
import { ConsultorDrawer } from '@/components/propostas/ConsultorDrawer';
import { usePropostasMetricas, type PeriodoFiltro, type ConsultorMetricas } from '@/hooks/usePropostasMetricas';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const PAGE_SIZE = 12;

type SortOption = 'ranking' | 'ranking_inverso' | 'alfabetico' | 'alfabetico_inverso' | 'valor' | 'conversao' | 'cotacoes';
type PerformanceFilter = 'todos' | 'top' | 'regular' | 'atencao';

const SORT_LABELS: Record<SortOption, string> = {
  ranking: 'Ranking (Top →)',
  ranking_inverso: 'Ranking (Últimos →)',
  alfabetico: 'Nome (A → Z)',
  alfabetico_inverso: 'Nome (Z → A)',
  valor: 'Maior Valor Fechado',
  conversao: 'Maior Conversão',
  cotacoes: 'Mais Cotações',
};

function getPerformanceCategory(taxaConversao: number): PerformanceFilter {
  if (taxaConversao >= 30) return 'top';
  if (taxaConversao >= 10) return 'regular';
  return 'atencao';
}

function sortConsultores(consultores: ConsultorMetricas[], sortBy: SortOption): ConsultorMetricas[] {
  const sorted = [...consultores];
  switch (sortBy) {
    case 'ranking':
      return sorted.sort((a, b) => a.ranking - b.ranking);
    case 'ranking_inverso':
      return sorted.sort((a, b) => b.ranking - a.ranking);
    case 'alfabetico':
      return sorted.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    case 'alfabetico_inverso':
      return sorted.sort((a, b) => b.nome.localeCompare(a.nome, 'pt-BR'));
    case 'valor':
      return sorted.sort((a, b) => b.valorFechado - a.valorFechado);
    case 'conversao':
      return sorted.sort((a, b) => b.taxaConversao - a.taxaConversao);
    case 'cotacoes':
      return sorted.sort((a, b) => b.cotacoesRealizadas - a.cotacoesRealizadas);
    default:
      return sorted;
  }
}

export default function Propostas() {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('mes');
  const [selectedConsultorId, setSelectedConsultorId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('ranking');
  const [performanceFilter, setPerformanceFilter] = useState<PerformanceFilter>('todos');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  
  const { data, isLoading } = usePropostasMetricas(periodo);

  // Realtime: atualizar quando contrato for assinado
  useEffect(() => {
    const channel = supabase
      .channel('propostas-realtime')
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'contratos'
        },
        (payload) => {
          const newStatus = payload.new?.status;
          const oldStatus = payload.old?.status;
          
          if (newStatus === 'assinado' && oldStatus !== 'assinado') {
            toast.success('🎉 Nova proposta assinada!', {
              description: `Contrato ${payload.new?.numero || ''} foi assinado pelo cliente`,
              duration: 10000,
            });
            queryClient.invalidateQueries({ queryKey: ['propostas-metricas'] });
            queryClient.invalidateQueries({ queryKey: ['consultor-propostas'] });
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Filter + Sort consultores
  const sortedConsultores = useMemo(() => {
    let filtered = data?.consultores || [];
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.nome.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Performance filter
    if (performanceFilter !== 'todos') {
      filtered = filtered.filter(c => getPerformanceCategory(c.taxaConversao) === performanceFilter);
    }
    
    return sortConsultores(filtered, sortBy);
  }, [data?.consultores, searchTerm, performanceFilter, sortBy]);

  // Pagination
  const totalPages = Math.ceil(sortedConsultores.length / PAGE_SIZE);
  const paginatedConsultores = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedConsultores.slice(start, start + PAGE_SIZE);
  }, [sortedConsultores, page]);

  const startItem = (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, sortedConsultores.length);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value as SortOption);
    setPage(1);
  };

  const handlePerformanceFilter = (filter: PerformanceFilter) => {
    setPerformanceFilter(prev => prev === filter ? 'todos' : filter);
    setPage(1);
  };

  // Count by category for badges
  const categoryCounts = useMemo(() => {
    const all = data?.consultores || [];
    return {
      top: all.filter(c => getPerformanceCategory(c.taxaConversao) === 'top').length,
      regular: all.filter(c => getPerformanceCategory(c.taxaConversao) === 'regular').length,
      atencao: all.filter(c => getPerformanceCategory(c.taxaConversao) === 'atencao').length,
    };
  }, [data?.consultores]);

  const selectedConsultor = data?.consultores.find(c => c.id === selectedConsultorId) || null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Equipe Comercial
          </h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe o desempenho dos consultores
          </p>
        </div>
        
        <Button
          variant="outline"
          onClick={() => navigate('/vendas/consultores')}
          className="gap-2 self-start"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Gerenciar</span>
        </Button>
      </div>

      {/* Métricas Globais */}
      <PropostasMetricsBar 
        metricas={data?.globais || {
          totalPropostas: 0,
          emCotacao: 0,
          aguardandoAssinatura: 0,
          assinadas: 0,
          valorTotalMensal: 0,
          variacaoPropostas: 0,
          variacaoAssinadas: 0,
          variacaoValor: 0,
        }}
        isLoading={isLoading}
      />

      {/* Toolbar - Filters & Sort */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar consultor..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {/* Sort */}
          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="w-[200px] h-9">
              <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Period */}
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoFiltro)}>
            <SelectTrigger className="w-[140px] h-9">
              <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semana">Esta Semana</SelectItem>
              <SelectItem value="mes">Este Mês</SelectItem>
            </SelectContent>
          </Select>

          {/* View Toggle */}
          <div className="flex border rounded-lg ml-auto">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-r-none h-9 w-9",
                viewMode === 'grid' && "bg-muted"
              )}
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-l-none h-9 w-9",
                viewMode === 'list' && "bg-muted"
              )}
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Performance Filter Chips */}
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Badge
            variant={performanceFilter === 'todos' ? 'default' : 'outline'}
            className="cursor-pointer text-xs"
            onClick={() => setPerformanceFilter('todos')}
          >
            Todos ({(data?.consultores || []).length})
          </Badge>
          <Badge
            variant={performanceFilter === 'top' ? 'default' : 'outline'}
            className={cn(
              "cursor-pointer text-xs",
              performanceFilter === 'top' 
                ? "bg-yellow-500 hover:bg-yellow-600 text-yellow-950 border-yellow-500" 
                : "border-yellow-500/50 text-yellow-700 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-950/30"
            )}
            onClick={() => handlePerformanceFilter('top')}
          >
            ⭐ Top ({categoryCounts.top})
          </Badge>
          <Badge
            variant={performanceFilter === 'regular' ? 'default' : 'outline'}
            className={cn(
              "cursor-pointer text-xs",
              performanceFilter === 'regular' 
                ? "bg-green-500 hover:bg-green-600 text-green-950 border-green-500" 
                : "border-green-500/50 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30"
            )}
            onClick={() => handlePerformanceFilter('regular')}
          >
            🏅 Regular ({categoryCounts.regular})
          </Badge>
          <Badge
            variant={performanceFilter === 'atencao' ? 'default' : 'outline'}
            className={cn(
              "cursor-pointer text-xs",
              performanceFilter === 'atencao' 
                ? "bg-red-500 hover:bg-red-600 text-red-950 border-red-500" 
                : "border-red-500/50 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            )}
            onClick={() => handlePerformanceFilter('atencao')}
          >
            ⚠️ Atenção ({categoryCounts.atencao})
          </Badge>
        </div>
      </div>

      {/* Conteúdo Principal */}
      {isLoading ? (
        viewMode === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : (
          <Skeleton className="h-96" />
        )
      ) : sortedConsultores.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Nenhum consultor encontrado</h3>
          <p className="text-muted-foreground">
            {searchTerm 
              ? `Nenhum consultor corresponde à busca "${searchTerm}"`
              : performanceFilter !== 'todos'
              ? 'Nenhum consultor nesta categoria'
              : 'Cadastre consultores para visualizar as métricas'
            }
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginatedConsultores.map((consultor, index) => (
              <ConsultorCardNew
                key={consultor.id}
                consultor={consultor}
                ranking={sortBy === 'ranking' ? consultor.ranking : (page - 1) * PAGE_SIZE + index + 1}
                onClick={() => setSelectedConsultorId(consultor.id)}
              />
            ))}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-border/50">
              <p className="text-sm text-muted-foreground">
                Mostrando {startItem} a {endItem} de {sortedConsultores.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "outline"}
                        size="sm"
                        className="w-8 h-8 p-0"
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <ConsultoresTable 
          consultores={sortedConsultores}
          onSelect={(id) => setSelectedConsultorId(id)}
        />
      )}

      {/* Drawer de Detalhes */}
      <ConsultorDrawer 
        consultor={selectedConsultor}
        periodo={periodo}
        open={!!selectedConsultorId}
        onClose={() => setSelectedConsultorId(null)}
      />
    </div>
  );
}
