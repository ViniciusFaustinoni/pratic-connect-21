import { Card, CardContent } from '@/components/ui/card';
import {
  ClipboardList, Truck, Hourglass, CheckCircle2,
  UserX, RotateCw, DollarSign, Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FaseServico } from '@/hooks/useServicosCampoUnificado';

interface MetricasProps {
  metricas: {
    preExecucao: number;
    emCampo: number;
    aguardandoAnalise: number;
    concluidasHoje: number;
    naoCompareceu: number;
    reagendadas: number;
    multas: number;
    totalDia: number;
  };
  faseAtiva?: FaseServico | 'todos';
  onFaseClick: (fase: FaseServico | 'todos') => void;
}

const cards: Array<{
  fase: FaseServico | 'todos';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  key: keyof MetricasProps['metricas'];
  colorClass: string;
  ringClass: string;
}> = [
  { fase: 'pre_execucao', label: 'Pré-Execução', icon: ClipboardList, key: 'preExecucao', colorClass: 'text-blue-600 dark:text-blue-400', ringClass: 'ring-blue-500' },
  { fase: 'em_campo', label: 'Em Campo', icon: Truck, key: 'emCampo', colorClass: 'text-purple-600 dark:text-purple-400', ringClass: 'ring-purple-500' },
  { fase: 'aguardando_analise', label: 'Aguardando Análise', icon: Hourglass, key: 'aguardandoAnalise', colorClass: 'text-cyan-600 dark:text-cyan-400', ringClass: 'ring-cyan-500' },
  { fase: 'concluida', label: 'Concluídas Hoje', icon: CheckCircle2, key: 'concluidasHoje', colorClass: 'text-green-600 dark:text-green-400', ringClass: 'ring-green-500' },
  { fase: 'nao_compareceu', label: 'Não Compareceu', icon: UserX, key: 'naoCompareceu', colorClass: 'text-orange-600 dark:text-orange-400', ringClass: 'ring-orange-500' },
  { fase: 'reagendada', label: 'Reagendadas', icon: RotateCw, key: 'reagendadas', colorClass: 'text-indigo-600 dark:text-indigo-400', ringClass: 'ring-indigo-500' },
  { fase: 'todos', label: 'Multas/Bloqueios', icon: DollarSign, key: 'multas', colorClass: 'text-red-600 dark:text-red-400', ringClass: 'ring-red-500' },
  { fase: 'todos', label: 'Total do Dia', icon: Calendar, key: 'totalDia', colorClass: 'text-foreground', ringClass: 'ring-primary' },
];

export function ServicosMetricasCards({ metricas, faseAtiva, onFaseClick }: MetricasProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        const isActive = faseAtiva === c.fase && c.fase !== 'todos';
        const value = metricas[c.key];
        return (
          <Card
            key={c.label}
            className={cn(
              'cursor-pointer transition-all hover:bg-muted/50',
              isActive && `ring-2 ${c.ringClass}`
            )}
            onClick={() => onFaseClick(c.fase === 'todos' ? 'todos' : c.fase)}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground line-clamp-1">{c.label}</span>
                <Icon className={cn('h-4 w-4', c.colorClass)} />
              </div>
              <div className={cn('text-2xl font-bold mt-1', c.colorClass)}>{value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
