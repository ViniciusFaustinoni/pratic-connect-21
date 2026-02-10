import { Users, Signal, Navigation, Wrench, SignalZero, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ProfissionalEquipe } from '@/hooks/useEquipe';

interface EquipeMetricsProps {
  profissionais: ProfissionalEquipe[];
}

export function EquipeMetrics({ profissionais }: EquipeMetricsProps) {
  const total = profissionais.length;
  const online = profissionais.filter(p => p.status_operacional === 'disponivel_operacional').length;
  const emRota = profissionais.filter(p => p.status_operacional === 'em_rota').length;
  const emAndamento = profissionais.filter(p => p.status_operacional === 'em_andamento').length;
  const emContato = profissionais.filter(p => p.status_operacional === 'em_contato').length;
  const offline = profissionais.filter(p => p.status_operacional === 'offline').length;

  const metrics = [
    {
      label: 'Total',
      value: total,
      icon: Users,
      className: 'bg-primary/10 text-primary',
      iconBg: 'bg-primary/20',
    },
    {
      label: 'Realizando Tarefa',
      value: emAndamento,
      icon: Wrench,
      className: 'bg-blue-500/10 text-blue-500',
      iconBg: 'bg-blue-500/20',
    },
    {
      label: 'Em Rota',
      value: emRota,
      icon: Navigation,
      className: 'bg-purple-500/10 text-purple-500',
      iconBg: 'bg-purple-500/20',
    },
    {
      label: 'Em Contato',
      value: emContato,
      icon: MessageCircle,
      className: 'bg-amber-500/10 text-amber-500',
      iconBg: 'bg-amber-500/20',
    },
    {
      label: 'Aguardando',
      value: online,
      icon: Signal,
      className: 'bg-emerald-500/10 text-emerald-500',
      iconBg: 'bg-emerald-500/20',
    },
    {
      label: 'Offline',
      value: offline,
      icon: SignalZero,
      className: 'bg-muted text-muted-foreground',
      iconBg: 'bg-muted-foreground/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {metrics.map((metric) => (
        <Card 
          key={metric.label} 
          className={cn(
            "border-border/50 hover:border-border transition-colors cursor-default",
            metric.className
          )}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", metric.iconBg)}>
              <metric.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{metric.value}</p>
              <p className="text-xs opacity-80">{metric.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
