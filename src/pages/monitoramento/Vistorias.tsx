import { useState } from 'react';
import { Plus, Search, Clock, RefreshCw, CheckCircle, XCircle, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { useVistorias, useVistoriasMetricas, VistoriaStatus } from '@/hooks/useVistorias';
import { VistoriaListItem } from '@/components/vistorias/VistoriaListItem';
import { RealizarVistoriaDialog } from '@/components/vistorias/RealizarVistoriaDialog';
import { Loader2 } from 'lucide-react';

type FilterStatus = VistoriaStatus | 'todos';

export default function Vistorias() {
  const [filter, setFilter] = useState<FilterStatus>('todos');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: vistorias = [], isLoading } = useVistorias({ status: filter, search });
  const { data: metricas } = useVistoriasMetricas();

  const metricasCards = [
    {
      title: 'Pendentes',
      value: metricas?.pendentes || 0,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    },
    {
      title: 'Em Andamento',
      value: metricas?.em_andamento || 0,
      icon: RefreshCw,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      title: 'Concluídas',
      value: metricas?.concluidas || 0,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    },
    {
      title: 'Reprovadas',
      value: metricas?.reprovadas || 0,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
    },
  ];

  const handleVistoriaClick = (vistoria: any) => {
    // TODO: Abrir drawer de detalhes
    console.log('Vistoria selecionada:', vistoria);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Vistorias</h1>
          <p className="text-muted-foreground">
            Realize e gerencie vistorias de entrada de veículos
          </p>
        </div>

        <Button
          onClick={() => setDialogOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Realizar Vistoria
        </Button>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metricasCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", card.bgColor)}>
                  <card.icon className={cn("h-5 w-5", card.color)} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-bold">{card.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros e busca */}
      <div className="flex flex-col sm:flex-row gap-4">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(value) => value && setFilter(value as FilterStatus)}
          className="justify-start"
        >
          <ToggleGroupItem value="todos" aria-label="Todos">
            Todos
          </ToggleGroupItem>
          <ToggleGroupItem value="pendente" aria-label="Pendentes">
            Pendentes
          </ToggleGroupItem>
          <ToggleGroupItem value="em_analise" aria-label="Em Andamento">
            Em Andamento
          </ToggleGroupItem>
          <ToggleGroupItem value="aprovada" aria-label="Concluídas">
            Concluídas
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por placa ou nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Lista de vistorias */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : vistorias.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-1">Nenhuma vistoria encontrada</h3>
              <p className="text-muted-foreground text-center mb-4">
                {filter !== 'todos'
                  ? 'Não há vistorias com este status.'
                  : 'Comece realizando uma nova vistoria.'}
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Realizar Vistoria
              </Button>
            </CardContent>
          </Card>
        ) : (
          vistorias.map((vistoria) => (
            <VistoriaListItem
              key={vistoria.id}
              vistoria={vistoria}
              onClick={() => handleVistoriaClick(vistoria)}
            />
          ))
        )}
      </div>

      {/* Dialog de realizar vistoria */}
      <RealizarVistoriaDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
