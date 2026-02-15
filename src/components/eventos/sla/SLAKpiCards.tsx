import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';
import type { SLAKpis } from '@/hooks/useEventosSLA';

interface Props {
  kpis: SLAKpis;
}

export function SLAKpiCards({ kpis }: Props) {
  const cards = [
    {
      label: 'Dentro do SLA',
      value: kpis.dentroDoSla,
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50 dark:bg-green-950/30',
    },
    {
      label: 'Próximo do Vencimento',
      value: kpis.proximoVencimento,
      icon: AlertTriangle,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50 dark:bg-yellow-950/30',
    },
    {
      label: 'SLA Estourado',
      value: kpis.slaEstourado,
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-50 dark:bg-red-950/30',
    },
    {
      label: 'Tempo Médio na Etapa',
      value: `${kpis.tempoMedio}d`,
      icon: Clock,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(c => (
        <Card key={c.label} className={c.bg}>
          <CardContent className="p-4 flex items-center gap-4">
            <c.icon className={`h-8 w-8 ${c.color}`} />
            <div>
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="text-2xl font-bold">{c.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
