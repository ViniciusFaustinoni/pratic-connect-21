import { useState, useMemo } from 'react';
import { Users, Calendar, LayoutGrid, List, Search } from 'lucide-react';
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

export default function Propostas() {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('mes');
  const [selectedConsultorId, setSelectedConsultorId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data, isLoading } = usePropostasMetricas(periodo);

  // Filtrar e ordenar consultores por valor fechado (maior para menor)
  const sortedConsultores = useMemo(() => {
    const filtered = data?.consultores.filter(consultor =>
      consultor.nome.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];
    
    // Ordenar por valor fechado (desc)
    return [...filtered].sort((a, b) => b.valorFechado - a.valorFechado);
  }, [data?.consultores, searchTerm]);

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
          {/* Campo de Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar consultor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedConsultores.map((consultor, index) => (
            <ConsultorCardNew
              key={consultor.id}
              consultor={consultor}
              ranking={index + 1}
              onClick={() => setSelectedConsultorId(consultor.id)}
            />
          ))}
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
