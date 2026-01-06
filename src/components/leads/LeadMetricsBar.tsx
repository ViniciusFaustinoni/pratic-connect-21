import { Users, Target, TrendingUp, Percent } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Lead = Tables<'leads'>;

interface LeadMetricsBarProps {
  leads: Lead[];
}

export function LeadMetricsBar({ leads }: LeadMetricsBarProps) {
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
    { label: 'Hoje', value: leadsHoje, icon: Users, color: 'text-blue-600' },
    { label: 'Negociação', value: leadsNegociacao, icon: Target, color: 'text-purple-600' },
    { label: 'Conversões', value: conversoesMes, icon: TrendingUp, color: 'text-green-600' },
    { label: 'Taxa', value: `${taxaConversao}%`, icon: Percent, color: 'text-orange-600' },
  ];

  return (
    <div className="flex items-center gap-4 py-2.5 px-4 bg-muted/40 rounded-lg mb-4">
      {metrics.map((metric, index) => (
        <div key={metric.label} className="flex items-center gap-2">
          {index > 0 && <div className="h-4 w-px bg-border mr-2" />}
          <metric.icon className={`h-4 w-4 ${metric.color}`} />
          <span className="text-sm text-muted-foreground">{metric.label}:</span>
          <span className="font-semibold text-sm">{metric.value}</span>
        </div>
      ))}
    </div>
  );
}
