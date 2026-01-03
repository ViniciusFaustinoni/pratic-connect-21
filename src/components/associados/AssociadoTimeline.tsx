import { FileText, Car, Wrench, AlertTriangle, Phone, User, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type HistoricoItem } from '@/hooks/useAssociadoHistorico';

const iconMap = {
  file: FileText,
  car: Car,
  wrench: Wrench,
  alert: AlertTriangle,
  phone: Phone,
  user: User,
  check: Check,
  x: X,
};

const colorMap = {
  blue: 'bg-blue-500 text-white',
  green: 'bg-green-500 text-white',
  yellow: 'bg-yellow-500 text-white',
  red: 'bg-red-500 text-white',
  purple: 'bg-purple-500 text-white',
  gray: 'bg-gray-500 text-white',
};

interface AssociadoTimelineProps {
  items: HistoricoItem[];
  isLoading?: boolean;
}

export function AssociadoTimeline({ items, isLoading }: AssociadoTimelineProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <User className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 font-semibold">Nenhuma atividade registrada</h3>
        <p className="text-sm text-muted-foreground">
          O histórico de atividades aparecerá aqui
        </p>
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Vertical line */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

      {items.map((item, index) => {
        const Icon = iconMap[item.icone];
        
        return (
          <div key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
            {/* Icon circle */}
            <div
              className={cn(
                'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                colorMap[item.cor]
              )}
            >
              <Icon className="h-4 w-4" />
            </div>

            {/* Content */}
            <div className="flex-1 pt-1">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{item.titulo}</p>
                  {item.descricao && (
                    <p className="text-sm text-muted-foreground">{item.descricao}</p>
                  )}
                </div>
                <time className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(item.data)}
                </time>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
