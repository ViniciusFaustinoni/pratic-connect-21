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
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Negociação',
      value: emNegociacao,
      subtitle: 'em andamento',
      icon: MessageSquare,
      gradient: 'from-purple-500 to-purple-600',
    },
    {
      title: 'Conversões',
      value: conversoesMes,
      subtitle: 'este mês',
      icon: TrendingUp,
      gradient: 'from-green-500 to-green-600',
    },
    {
      title: 'Taxa',
      value: `${taxaConversao.toFixed(1)}%`,
      subtitle: taxaConversao >= 15 ? '+2.3%' : '-1.2%',
      subtitleTrend: taxaConversao >= 15 ? 'up' : 'down',
      icon: Target,
      gradient: 'from-orange-500 to-orange-600',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <Card
          key={metric.title}
          className={cn(
            'relative overflow-hidden border-0',
            'bg-gradient-to-br',
            metric.gradient
          )}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-white/80">{metric.title}</p>
                <p className="text-2xl font-bold text-white">{metric.value}</p>
                <div className="flex items-center gap-1">
                  {metric.subtitleTrend === 'up' && (
                    <ArrowUp className="h-3 w-3 text-green-200" />
                  )}
                  {metric.subtitleTrend === 'down' && (
                    <ArrowDown className="h-3 w-3 text-red-200" />
                  )}
                  <p
                    className={cn(
                      'text-xs',
                      metric.subtitleTrend === 'up' && 'text-green-200',
                      metric.subtitleTrend === 'down' && 'text-red-200',
                      !metric.subtitleTrend && 'text-white/60'
                    )}
                  >
                    {metric.subtitle}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-white/10">
                <metric.icon className="h-6 w-6 text-white/80" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
