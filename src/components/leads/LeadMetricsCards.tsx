import { Calendar, MessageSquare, TrendingUp, Target, ArrowUp, ArrowDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface LeadBase {
  id: string;
  etapa: string;
  created_at: string;
  updated_at: string;
}

interface LeadMetricsCardsProps {
  leads: LeadBase[];
}

export function LeadMetricsCards({ leads }: LeadMetricsCardsProps) {
  // Calculate metrics
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const leadsHoje = leads.filter((l) => {
    const createdAt = new Date(l.created_at);
    createdAt.setHours(0, 0, 0, 0);
    return createdAt.getTime() === today.getTime();
  }).length;

  const emNegociacao = leads.filter((l) =>
    ['cotacao_enviada', 'negociacao', 'qualificado'].includes(l.etapa)
  ).length;

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  const conversoesMes = leads.filter((l) => {
    const updatedAt = new Date(l.updated_at);
    return l.etapa === 'ganho' && updatedAt >= thisMonth;
  }).length;

  // Calculate conversion rate
  const totalFinalizado = leads.filter((l) =>
    ['ganho', 'perdido'].includes(l.etapa)
  ).length;
  const ganhos = leads.filter((l) => l.etapa === 'ganho').length;
  const taxaConversao = totalFinalizado > 0 ? (ganhos / totalFinalizado) * 100 : 0;

  const metrics = [
    {
      title: 'Hoje',
      value: leadsHoje,
      subtitle: 'novos leads',
      icon: Calendar,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Negociação',
      value: emNegociacao,
      subtitle: 'em andamento',
      icon: MessageSquare,
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Conversões',
      value: conversoesMes,
      subtitle: 'este mês',
      icon: TrendingUp,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Taxa',
      value: `${taxaConversao.toFixed(1)}%`,
      subtitle: taxaConversao >= 15 ? '+2.3% vs mês ant.' : '-1.2% vs mês ant.',
      subtitleTrend: taxaConversao >= 15 ? 'up' : 'down',
      icon: Target,
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <Card
          key={metric.title}
          className={cn(
            'relative overflow-hidden',
            'border-border/50 bg-card/80 backdrop-blur-sm',
            'hover:border-border hover:shadow-sm transition-all duration-200'
          )}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {metric.title}
                </p>
                <p className="text-2xl font-bold tracking-tight">{metric.value}</p>
                <div className="flex items-center gap-1">
                  {metric.subtitleTrend === 'up' && (
                    <ArrowUp className="h-3 w-3 text-green-500" />
                  )}
                  {metric.subtitleTrend === 'down' && (
                    <ArrowDown className="h-3 w-3 text-red-500" />
                  )}
                  <p
                    className={cn(
                      'text-xs',
                      metric.subtitleTrend === 'up' && 'text-green-600 dark:text-green-400',
                      metric.subtitleTrend === 'down' && 'text-red-600 dark:text-red-400',
                      !metric.subtitleTrend && 'text-muted-foreground'
                    )}
                  >
                    {metric.subtitle}
                  </p>
                </div>
              </div>
              <div className={cn(
                'flex items-center justify-center h-11 w-11 rounded-xl',
                metric.bgColor
              )}>
                <metric.icon className={cn('h-5 w-5', metric.iconColor)} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
