import { useState } from 'react';
import { Users, Calendar, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PropostasMetricsBar } from '@/components/propostas/PropostasMetricsBar';
import { ConsultorCard } from '@/components/propostas/ConsultorCard';
import { ConsultorTab } from '@/components/propostas/ConsultorTab';
import { usePropostasMetricas, type PeriodoFiltro } from '@/hooks/usePropostasMetricas';
import { cn } from '@/lib/utils';

export default function Propostas() {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('mes');
  const [selectedConsultorId, setSelectedConsultorId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const { data, isLoading } = usePropostasMetricas(periodo);

  const selectedConsultor = data?.consultores.find(c => c.id === selectedConsultorId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Consultores
          </h1>
          <p className="text-muted-foreground">
            Acompanhe o desempenho da equipe comercial
          </p>
        </div>
        
        <div className="flex items-center gap-3">
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

      {/* Sistema de Abas */}
      <Tabs 
        value={selectedConsultorId || 'visao-geral'} 
        onValueChange={(v) => setSelectedConsultorId(v === 'visao-geral' ? null : v)}
        className="space-y-4"
      >
        <div className="overflow-x-auto pb-1">
          <TabsList className="inline-flex h-auto p-1 gap-1">
            <TabsTrigger 
              value="visao-geral"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4"
            >
              <Users className="h-4 w-4 mr-2" />
              Visão Geral
            </TabsTrigger>
            
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-9 w-32" />
              ))
            ) : (
              data?.consultores.map((consultor) => (
                <TabsTrigger 
                  key={consultor.id}
                  value={consultor.id}
                  className="gap-2"
                >
                  <span className="truncate max-w-[100px]">{consultor.nome.split(' ')[0]}</span>
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full",
                    consultor.propostasFechadas > 0 
                      ? "bg-green-100 text-green-700" 
                      : "bg-muted text-muted-foreground"
                  )}>
                    {consultor.propostasFechadas}
                  </span>
                </TabsTrigger>
              ))
            )}
          </TabsList>
        </div>

        {/* Conteúdo da Aba Visão Geral */}
        <TabsContent value="visao-geral" className="mt-6">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-64" />
              ))}
            </div>
          ) : data?.consultores.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhum consultor encontrado</h3>
              <p className="text-muted-foreground">
                Cadastre consultores para visualizar as métricas
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {data?.consultores.map((consultor) => (
                <ConsultorCard
                  key={consultor.id}
                  consultor={consultor}
                  onClick={() => setSelectedConsultorId(consultor.id)}
                  isSelected={selectedConsultorId === consultor.id}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {data?.consultores.map((consultor) => (
                <ConsultorCard
                  key={consultor.id}
                  consultor={consultor}
                  onClick={() => setSelectedConsultorId(consultor.id)}
                  isSelected={selectedConsultorId === consultor.id}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Abas Individuais dos Consultores */}
        {data?.consultores.map((consultor) => (
          <TabsContent key={consultor.id} value={consultor.id} className="mt-6">
            <ConsultorTab consultor={consultor} periodo={periodo} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
