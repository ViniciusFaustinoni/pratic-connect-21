import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Activity, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  sinistralidade: number;
  custoAdmin: number;
  margemOperacional: number;
  margemFinal: number;
}

export function IndicadoresDRE({ sinistralidade, custoAdmin, margemOperacional, margemFinal }: Props) {
  const indicadores = [
    {
      label: 'Sinistralidade',
      valor: sinistralidade,
      meta: 65,
      invertido: true, // menor é melhor
      icon: Activity,
      descricao: 'Desp. Benefícios / Receita Total',
    },
    {
      label: 'Custo Administrativo',
      valor: custoAdmin,
      meta: 25,
      invertido: true,
      icon: Target,
      descricao: 'Desp. Admin. / Receita Total',
    },
    {
      label: 'Margem Operacional',
      valor: margemOperacional,
      meta: 10,
      invertido: false, // maior é melhor
      icon: TrendingUp,
      descricao: 'Result. Operacional / Receita',
    },
    {
      label: 'Margem Final',
      valor: margemFinal,
      meta: 5,
      invertido: false,
      icon: TrendingDown,
      descricao: 'Superávit / Receita Total',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {indicadores.map((ind) => {
        const bom = ind.invertido ? ind.valor <= ind.meta : ind.valor >= ind.meta;
        const Icon = ind.icon;
        return (
          <Card key={ind.label}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{ind.label}</span>
                <Icon className={cn('h-4 w-4', bom ? 'text-green-600' : 'text-red-600')} />
              </div>
              <p className={cn(
                'text-2xl font-bold',
                bom ? 'text-green-600' : 'text-red-600'
              )}>
                {ind.valor.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Meta: {ind.invertido ? '< ' : '> '}{ind.meta}%
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
