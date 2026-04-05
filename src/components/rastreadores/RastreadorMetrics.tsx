import { Radio, Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { RastreadoresMetricas, RastreadorFilters } from '@/hooks/useRastreadores';

interface RastreadorMetricsProps {
  metricas: RastreadoresMetricas | undefined;
  isLoading?: boolean;
  onFilterClick?: (filter: Partial<RastreadorFilters>, filterKey: string) => void;
  activeFilter?: string;
}

export function RastreadorMetrics({ metricas, isLoading, onFilterClick, activeFilter }: RastreadorMetricsProps) {
  const atencao = (metricas?.alertas || 0) - (metricas?.offline || 0);
  const atencaoCount = atencao > 0 ? atencao : 0;

  const metrics = [
    {
      label: 'Total',
      value: metricas?.total || 0,
      description: 'cadastrados',
      icon: Radio,
      className: 'bg-primary/10 text-primary',
      iconBg: 'bg-primary/20',
      filterKey: 'total',
      filterValue: {} as Partial<RastreadorFilters>,
    },
    {
      label: 'Estoque',
      value: metricas?.estoque || 0,
      description: 'disponíveis',
      icon: Package,
      className: 'bg-blue-500/10 text-blue-600',
      iconBg: 'bg-blue-500/20',
      filterKey: 'estoque',
      filterValue: { status: ['estoque'] } as Partial<RastreadorFilters>,
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[...Array(2)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted" />
              <div className="space-y-2">
                <div className="h-6 w-12 bg-muted rounded" />
                <div className="h-3 w-16 bg-muted rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {metrics.map((metric) => {
        const isActive = activeFilter === metric.filterKey;
        return (
          <Card
            key={metric.label}
            className={cn(
              "border-border/50 hover:border-border transition-all cursor-pointer overflow-hidden",
              metric.className,
              isActive && "ring-2 ring-primary ring-offset-2 ring-offset-background"
            )}
            onClick={() => {
              if (!onFilterClick) return;
              if (isActive) {
                onFilterClick({}, '');
              } else {
                onFilterClick(metric.filterValue, metric.filterKey);
              }
            }}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn(
                "p-2.5 rounded-lg relative",
                metric.iconBg,
                metric.pulse && "after:absolute after:inset-0 after:rounded-lg after:animate-ping after:bg-red-500/30"
              )}>
                <metric.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{metric.value}</p>
                <p className="text-xs opacity-80 mt-0.5">{metric.description}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
