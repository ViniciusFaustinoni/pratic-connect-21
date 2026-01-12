import { Calendar, MessageSquare, FileText, Clock, CheckCircle, Target, ArrowUp, ArrowDown } from 'lucide-react';
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

  // Leads today
  const leadsHoje = leads.filter((l) => {
    const createdAt = new Date(l.created_at);
    createdAt.setHours(0, 0, 0, 0);
    return createdAt.getTime() === today.getTime();
  }).length;

  // Em contato (contato + qualificado)
  const emContato = leads.filter((l) =>
    ['contato', 'qualificado'].includes(l.etapa)
  ).length;

  // Cotações (cotacao_enviada + negociacao)
  const cotacoes = leads.filter((l) =>
    ['cotacao_enviada', 'negociacao'].includes(l.etapa)
  ).length;

  // Propostas pendentes (contrato_enviado)
  const propostasPendentes = leads.filter((l) => l.etapa === 'contrato_enviado').length;

  // This month
  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  // Assinados este mês (contrato_assinado)
  const assinadosMes = leads.filter((l) => {
    const updatedAt = new Date(l.updated_at);
    return l.etapa === 'contrato_assinado' && updatedAt >= thisMonth;
  }).length;

  // Calculate conversion rate
  const totalFinalizado = leads.filter((l) =>
    ['ganho', 'perdido'].includes(l.etapa)
  ).length;
  const ganhos = leads.filter((l) => l.etapa === 'ganho').length;
  const taxaConversao = totalFinalizado > 0 ? (ganhos / totalFinalizado) * 100 : 0;

  const metrics = [
    {
      title: 'Novos Hoje',
      value: leadsHoje,
      subtitle: 'leads criados',
      icon: Calendar,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Em Contato',
      value: emContato,
      subtitle: 'em negociação',
      icon: MessageSquare,
      iconColor: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
    {
      title: 'Cotações',
      value: cotacoes,
      subtitle: 'enviadas',
      icon: FileText,
      iconColor: 'text-violet-500',
      bgColor: 'bg-violet-500/10',
    },
    {
      title: 'Aguardando',
      value: propostasPendentes,
      subtitle: 'assinatura',
      icon: Clock,
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      highlight: propostasPendentes > 0,
    },
    {
      title: 'Assinados',
      value: assinadosMes,
      subtitle: 'este mês',
      icon: CheckCircle,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Taxa',
      value: `${taxaConversao.toFixed(0)}%`,
      subtitle: taxaConversao >= 15 ? 'acima da meta' : 'abaixo da meta',
      subtitleTrend: taxaConversao >= 15 ? 'up' : 'down',
      icon: Target,
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {metrics.map((metric) => (
        <Card
          key={metric.title}
          className={cn(
            'relative overflow-hidden',
            'border-border/50 bg-card/80 backdrop-blur-sm',
            'hover:border-border hover:shadow-sm transition-all duration-200',
            metric.highlight && 'ring-2 ring-amber-500/30 border-amber-500/50'
          )}
        >
          <CardContent className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 min-w-0 flex-1">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide truncate">
                  {metric.title}
                </p>
                <p className="text-xl font-bold tracking-tight">{metric.value}</p>
                <div className="flex items-center gap-1">
                  {metric.subtitleTrend === 'up' && (
                    <ArrowUp className="h-2.5 w-2.5 text-green-500" />
                  )}
                  {metric.subtitleTrend === 'down' && (
                    <ArrowDown className="h-2.5 w-2.5 text-red-500" />
                  )}
                  <p
                    className={cn(
                      'text-[10px] truncate',
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
                'flex items-center justify-center h-9 w-9 rounded-lg shrink-0',
                metric.bgColor
              )}>
                <metric.icon className={cn('h-4 w-4', metric.iconColor)} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}