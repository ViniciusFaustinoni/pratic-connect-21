import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, ShoppingCart, Car, Trophy } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface MinhasComissoesKPIsProps {
  totalMes: number;
  vendasConfirmadas: number;
  placasAtivas: number;
  posicaoRanking: number | null;
  isLoading?: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function MinhasComissoesKPIs({
  totalMes,
  vendasConfirmadas,
  placasAtivas,
  posicaoRanking,
  isLoading = false,
}: MinhasComissoesKPIsProps) {
  const isTop3 = posicaoRanking && posicaoRanking <= 3;

  const kpis = [
    {
      title: 'Total do Mês',
      value: formatCurrency(totalMes),
      icon: DollarSign,
      bgColor: 'bg-green-50 dark:bg-green-950/20',
      iconColor: 'text-green-600',
      valueColor: 'text-green-700 dark:text-green-400',
      large: true,
    },
    {
      title: 'Vendas Confirmadas',
      value: vendasConfirmadas.toString(),
      icon: ShoppingCart,
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      iconColor: 'text-blue-600',
      valueColor: 'text-blue-700 dark:text-blue-400',
    },
    {
      title: 'Placas Ativas',
      value: placasAtivas.toString(),
      icon: Car,
      bgColor: 'bg-purple-50 dark:bg-purple-950/20',
      iconColor: 'text-purple-600',
      valueColor: 'text-purple-700 dark:text-purple-400',
    },
    {
      title: 'Posição Ranking',
      value: posicaoRanking ? `${posicaoRanking}º` : '-',
      icon: Trophy,
      bgColor: isTop3 ? 'bg-yellow-50 dark:bg-yellow-950/20' : 'bg-muted',
      iconColor: isTop3 ? 'text-yellow-600' : 'text-muted-foreground',
      valueColor: isTop3 ? 'text-yellow-700 dark:text-yellow-400' : 'text-muted-foreground',
      badge: isTop3 ? (posicaoRanking === 1 ? '🥇' : posicaoRanking === 2 ? '🥈' : '🥉') : null,
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.title} className={kpi.bgColor}>
          <CardContent className={`pt-6 ${kpi.large ? 'py-8' : ''}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {kpi.title}
                </p>
                <div className="flex items-center gap-2">
                  <p className={`${kpi.large ? 'text-3xl' : 'text-2xl'} font-bold ${kpi.valueColor}`}>
                    {kpi.value}
                  </p>
                  {kpi.badge && (
                    <span className="text-2xl">{kpi.badge}</span>
                  )}
                </div>
              </div>
              <kpi.icon className={`${kpi.large ? 'h-10 w-10' : 'h-8 w-8'} ${kpi.iconColor}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
