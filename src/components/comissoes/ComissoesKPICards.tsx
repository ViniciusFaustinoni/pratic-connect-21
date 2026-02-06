import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ComissoesKPICardsProps {
  totalComissoes: number;
  vendedoresAtivos: number;
  totalVendas: number;
  totalDeducoes: number;
  isLoading?: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function ComissoesKPICards({
  totalComissoes,
  vendedoresAtivos,
  totalVendas,
  totalDeducoes,
  isLoading = false,
}: ComissoesKPICardsProps) {
  const kpis = [
    {
      title: 'Total Comissões',
      value: formatCurrency(totalComissoes),
      icon: DollarSign,
      bgColor: 'bg-green-50 dark:bg-green-950/20',
      iconColor: 'text-green-600',
      valueColor: 'text-green-700 dark:text-green-400',
    },
    {
      title: 'Vendedores Ativos',
      value: vendedoresAtivos.toString(),
      icon: Users,
      bgColor: 'bg-blue-50 dark:bg-blue-950/20',
      iconColor: 'text-blue-600',
      valueColor: 'text-blue-700 dark:text-blue-400',
    },
    {
      title: 'Vendas Confirmadas',
      value: totalVendas.toString(),
      icon: TrendingUp,
      bgColor: 'bg-purple-50 dark:bg-purple-950/20',
      iconColor: 'text-purple-600',
      valueColor: 'text-purple-700 dark:text-purple-400',
    },
    {
      title: 'Deduções',
      value: formatCurrency(totalDeducoes),
      icon: AlertTriangle,
      bgColor: 'bg-orange-50 dark:bg-orange-950/20',
      iconColor: 'text-orange-600',
      valueColor: 'text-orange-700 dark:text-orange-400',
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
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {kpi.title}
                </p>
                <p className={`text-2xl font-bold ${kpi.valueColor}`}>
                  {kpi.value}
                </p>
              </div>
              <kpi.icon className={`h-8 w-8 ${kpi.iconColor}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
