import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Clock, CheckCircle, XCircle, BarChart3 } from 'lucide-react';
import { useEventosContadores } from '@/hooks/useEventosAnalise';

export default function AnalistaEventosHome() {
  const { data: contadores, isLoading } = useEventosContadores();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const cards = [
    {
      label: 'Aguardando Análise',
      value: contadores?.aguardando || 0,
      icon: Clock,
      color: 'text-amber-600 bg-amber-100',
    },
    {
      label: 'Analisados Hoje',
      value: contadores?.analisadosHoje || 0,
      icon: BarChart3,
      color: 'text-blue-600 bg-blue-100',
    },
    {
      label: 'Aprovados (Mês)',
      value: contadores?.aprovadosMes || 0,
      icon: CheckCircle,
      color: 'text-green-600 bg-green-100',
    },
    {
      label: 'Reprovados (Mês)',
      value: contadores?.reprovadosMes || 0,
      icon: XCircle,
      color: 'text-red-600 bg-red-100',
    },
  ];

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardContent className="pt-4 flex flex-col items-center gap-2 text-center">
                <div className={`p-2 rounded-full ${card.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
