import { useState } from 'react';
import { Search, Clock, RefreshCw, CheckCircle, XCircle, ClipboardList } from 'lucide-react';
import { useFilasRealtime } from '@/hooks/useFilasRealtime';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useVistorias, useVistoriasMetricas } from '@/hooks/useVistorias';
import { VistoriaListItem } from '@/components/vistorias/VistoriaListItem';
import { VistoriaDetailDrawer } from '@/components/vistorias/VistoriaDetailDrawer';
import { Loader2 } from 'lucide-react';

export default function Vistorias() {
  useFilasRealtime();

  const [search, setSearch] = useState('');
  const [selectedVistoriaId, setSelectedVistoriaId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: vistorias = [], isLoading } = useVistorias({ status: 'todos', search });
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
    setSelectedVistoriaId(vistoria.id);
    setDrawerOpen(true);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Vistorias</h1>
        <p className="text-muted-foreground">
          Acompanhe vistorias de entrada de veículos
        </p>
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

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por placa ou nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
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
              <p className="text-muted-foreground text-center">
                Nenhuma vistoria registrada no momento.
              </p>
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

      {/* Drawer de detalhes da vistoria */}
      <VistoriaDetailDrawer
        vistoriaId={selectedVistoriaId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}