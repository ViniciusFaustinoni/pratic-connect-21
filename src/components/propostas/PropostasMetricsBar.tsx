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
  }).format(value);
}

function VariacaoIndicador({ variacao }: { variacao: number }) {
  if (variacao === 0) return null;
  
  const isPositive = variacao > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-xs font-medium",
      isPositive ? "text-green-600" : "text-red-500"
    )}>
      <Icon className="h-3 w-3" />
      {isPositive ? '+' : ''}{variacao.toFixed(0)}%
    </span>
  );
}

export function PropostasMetricsBar({ metricas, isLoading }: PropostasMetricsBarProps) {
  const cards = [
    {
      title: 'Total Propostas',
      value: metricas.totalPropostas,
      icon: FileText,
      color: 'bg-blue-500/10 text-blue-600',
      variacao: metricas.variacaoPropostas,
    },
    {
      title: 'Em Cotação',
      value: metricas.emCotacao,
      icon: Clock,
      color: 'bg-yellow-500/10 text-yellow-600',
    },
    {
      title: 'Aguardando Assinatura',
      value: metricas.aguardandoAssinatura,
      icon: FileText,
      color: 'bg-orange-500/10 text-orange-600',
    },
    {
      title: 'Assinadas',
      value: metricas.assinadas,
      icon: CheckCircle,
      color: 'bg-green-500/10 text-green-600',
      variacao: metricas.variacaoAssinadas,
    },
    {
      title: 'Valor Mensal',
      value: formatCurrency(metricas.valorTotalMensal),
      icon: DollarSign,
      color: 'bg-emerald-500/10 text-emerald-600',
      variacao: metricas.variacaoValor,
      isMonetary: true,
    },
  ];

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.title} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn("rounded-lg p-2.5", card.color)}>
                <card.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold truncate">
                    {card.isMonetary ? card.value : card.value}
                  </p>
                  {card.variacao !== undefined && (
                    <VariacaoIndicador variacao={card.variacao} />
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{card.title}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
