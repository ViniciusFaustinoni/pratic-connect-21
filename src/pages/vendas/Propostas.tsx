import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Calendar, LayoutGrid, List, Search, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PropostasMetricsBar } from '@/components/propostas/PropostasMetricsBar';
import { ConsultorCardNew } from '@/components/propostas/ConsultorCardNew';
import { ConsultoresTable } from '@/components/propostas/ConsultoresTable';
import { ConsultorDrawer } from '@/components/propostas/ConsultorDrawer';
import { usePropostasMetricas, type PeriodoFiltro } from '@/hooks/usePropostasMetricas';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const PAGE_SIZE = 12;

export default function Propostas() {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('mes');
  const [selectedConsultorId, setSelectedConsultorId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
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
          
          // Se mudou para assinado, notificar e invalidar cache
          if (newStatus === 'assinado' && oldStatus !== 'assinado') {
            console.log('[Propostas] Contrato assinado:', payload.new?.numero);
            toast.success('🎉 Nova proposta assinada!', {
              description: `Contrato ${payload.new?.numero || ''} foi assinado pelo cliente`,
              duration: 10000,
            });
            // Invalidar cache das métricas
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

  // Filtrar consultores (ranking já vem correto do hook)
  const sortedConsultores = useMemo(() => {
    return data?.consultores.filter(consultor =>
      consultor.nome.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];
  }, [data?.consultores, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(sortedConsultores.length / PAGE_SIZE);
  const paginatedConsultores = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedConsultores.slice(start, start + PAGE_SIZE);
  }, [sortedConsultores, page]);

  const startItem = (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, sortedConsultores.length);

  // Reset page when search changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const selectedConsultor = data?.consultores.find(c => c.id === selectedConsultorId) || null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Equipe Comercial
          </h1>
          <p className="text-muted-foreground">
            Acompanhe o desempenho dos consultores
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Botão Gerenciar Consultores */}
          <Button
            variant="outline"
            onClick={() => navigate('/vendas/consultores')}
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Gerenciar Consultores</span>
          </Button>
          {/* Campo de Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar consultor..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 w-[180px]"
            />
          </div>

          {/* Seletor de Período */}
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoFiltro)}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semana">Esta Semana</SelectItem>
              <SelectItem value="mes">Este Mês</SelectItem>
            </SelectContent>
          </Select>

          {/* Toggle View Mode */}
          <div className="flex border rounded-lg">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "rounded-r-none",
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
                "rounded-l-none",
                viewMode === 'list' && "bg-muted"
              )}
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
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

      {/* Conteúdo Principal */}
      {isLoading ? (
        viewMode === 'grid' ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-80" />
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
              : 'Cadastre consultores para visualizar as métricas'
            }
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="space-y-4">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginatedConsultores.map((consultor, index) => (
              <ConsultorCardNew
                key={consultor.id}
                consultor={consultor}
                ranking={consultor.ranking}
                onClick={() => setSelectedConsultorId(consultor.id)}
              />
            ))}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-border/50">
              <p className="text-sm text-muted-foreground">
                Mostrando {startItem} a {endItem} de {sortedConsultores.length} consultores
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
