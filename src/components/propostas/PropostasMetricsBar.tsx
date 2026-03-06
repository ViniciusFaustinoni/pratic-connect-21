import { FileText, Clock, CheckCircle, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { PropostasMetricasGlobais } from '@/hooks/usePropostasMetricas';

interface PropostasMetricsBarProps {
  metricas: PropostasMetricasGlobais;
  isLoading?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function VariacaoIndicador({ variacao }: { variacao: number }) {
  if (variacao === 0) return null;
  
  const isPositive = variacao > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[10px] font-semibold",
      isPositive ? "text-green-600" : "text-red-500"
    )}>
      <Icon className="h-2.5 w-2.5" />
      {isPositive ? '+' : ''}{variacao.toFixed(0)}%
    </span>
  );
}

export function PropostasMetricsBar({ metricas, isLoading }: PropostasMetricsBarProps) {
  if (isLoading) {
    return (
      <Card className="animate-pulse">
        <CardContent className="p-4">
          <div className="h-14 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const items = [
    {
      label: 'Total',
      value: metricas.totalPropostas,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500/10',
      variacao: metricas.variacaoPropostas,
    },
    {
      label: 'Em Cotação',
      value: metricas.emCotacao,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-500/10',
    },
    {
      label: 'Ag. Assinatura',
      value: metricas.aguardandoAssinatura,
      icon: FileText,
      color: 'text-orange-600',
      bgColor: 'bg-orange-500/10',
    },
    {
      label: 'Assinadas',
      value: metricas.assinadas,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-500/10',
      variacao: metricas.variacaoAssinadas,
    },
    {
      label: 'Valor Mensal',
      value: formatCurrency(metricas.valorTotalMensal),
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-500/10',
      variacao: metricas.variacaoValor,
      isMonetary: true,
    },
  ];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-border">
          {items.map((item, index) => (
            <div 
              key={item.label} 
              className={cn(
                "px-4 py-3 flex items-center gap-3",
                index >= 2 && index < 4 && "hidden sm:flex",
                index === 4 && "col-span-2 sm:col-span-1"
              )}
            >
              <div className={cn("rounded-lg p-2", item.bgColor)}>
                <item.icon className={cn("h-4 w-4", item.color)} />
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-bold leading-none truncate">
                    {item.isMonetary ? item.value : item.value}
                  </span>
                  {item.variacao !== undefined && (
                    <VariacaoIndicador variacao={item.variacao} />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
