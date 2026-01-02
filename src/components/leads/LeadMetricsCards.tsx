import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, Target, Percent } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Lead = Tables<'leads'>;

interface LeadMetricsCardsProps {
  leads: Lead[];
}

export function LeadMetricsCards({ leads }: LeadMetricsCardsProps) {
  // Leads novos de hoje
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const leadsHoje = leads.filter((l) => new Date(l.created_at) >= today).length;

  // Em negociação (etapas de negociação ativa)
  const etapasNegociacao = ['cotacao_enviada', 'negociacao', 'vistoria_agendada', 'contrato_enviado'];
  const leadsNegociacao = leads.filter((l) => etapasNegociacao.includes(l.etapa)).length;

  // Conversões do mês
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const conversoesMes = leads.filter(
    (l) => l.etapa === 'ganho' && new Date(l.updated_at) >= startOfMonth
  ).length;

  // Taxa de conversão (ganhos / total exceto novo)
  const leadsFinalizados = leads.filter((l) => l.etapa === 'ganho' || l.etapa === 'perdido');
  const leadsGanhos = leads.filter((l) => l.etapa === 'ganho').length;
  const taxaConversao =
    leadsFinalizados.length > 0
      ? Math.round((leadsGanhos / leadsFinalizados.length) * 100)
      : 0;

  const metrics = [
    {
      title: 'Leads Novos (Hoje)',
      value: leadsHoje,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Em Negociação',
      value: leadsNegociacao,
      icon: Target,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Conversões (Mês)',
      value: conversoesMes,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Taxa de Conversão',
      value: `${taxaConversao}%`,
      icon: Percent,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <Card key={metric.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {metric.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${metric.bgColor}`}>
              <metric.icon className={`h-4 w-4 ${metric.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${typeof metric.value === 'number' && metric.value > 0 ? metric.color : ''}`}>
              {metric.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
