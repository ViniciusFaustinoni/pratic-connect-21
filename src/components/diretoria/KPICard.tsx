import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface KPICardProps {
  titulo: string;
  valor: number;
  variacao?: number;
  icone: LucideIcon;
  cor?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange';
  formato?: 'numero' | 'moeda' | 'percentual';
  meta?: number;
  loading?: boolean;
}

const corMap = {
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  yellow: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
};

function formatarValor(valor: number, formato: 'numero' | 'moeda' | 'percentual' = 'numero'): string {
  switch (formato) {
    case 'moeda':
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(valor);
    case 'percentual':
      return `${valor.toFixed(1)}%`;
    case 'numero':
    default:
      return valor.toLocaleString('pt-BR');
  }
}

export function KPICard({
  titulo,
  valor,
  variacao,
  icone: Icone,
  cor = 'blue',
  formato = 'numero',
  meta,
  loading = false,
}: KPICardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-12 w-12 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const progresso = meta ? Math.min((valor / meta) * 100, 100) : null;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{titulo}</p>
            <p className="text-2xl font-bold">{formatarValor(valor, formato)}</p>
            
            {variacao !== undefined && (
              <div className="flex items-center gap-1 text-sm">
                {variacao > 0 ? (
                  <>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-green-500">+{variacao.toFixed(1)}%</span>
                  </>
                ) : variacao < 0 ? (
                  <>
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    <span className="text-red-500">{variacao.toFixed(1)}%</span>
                  </>
                ) : (
                  <>
                    <Minus className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">0%</span>
                  </>
                )}
                <span className="text-muted-foreground">vs anterior</span>
              </div>
            )}

            {progresso !== null && (
              <div className="pt-2 space-y-1">
                <Progress value={progresso} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {progresso.toFixed(0)}% da meta
                </p>
              </div>
            )}
          </div>

          <div className={cn('p-3 rounded-lg', corMap[cor])}>
            <Icone className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
