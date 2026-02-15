import { useSinistroHistoricoTransicoes } from '@/hooks/useEventosSLA';
import { STATUS_SINISTRO_LABELS } from '@/types/sinistros';
import type { StatusSinistro } from '@/types/sinistros';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, Loader2 } from 'lucide-react';

interface Props {
  sinistroId: string;
}

export function SLAHistoricoTransicoes({ sinistroId }: Props) {
  const { data: historico, isLoading } = useSinistroHistoricoTransicoes(sinistroId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (!historico || historico.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Sem histórico de transições
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      <h4 className="text-sm font-semibold mb-3">Histórico de Transições</h4>
      <div className="space-y-1">
        {historico.map((h, i) => {
          const next = historico[i + 1];
          const diasNaFase = next
            ? differenceInDays(new Date(next.created_at), new Date(h.created_at))
            : differenceInDays(new Date(), new Date(h.created_at));

          return (
            <div key={h.id} className="flex items-center gap-3 text-sm py-1 border-b border-border/50 last:border-0">
              <span className="text-xs text-muted-foreground w-[90px] flex-shrink-0">
                {format(new Date(h.created_at), 'dd/MM/yy HH:mm', { locale: ptBR })}
              </span>
              <span className="text-muted-foreground">
                {STATUS_SINISTRO_LABELS[h.status_anterior as StatusSinistro] || h.status_anterior || '—'}
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="font-medium">
                {STATUS_SINISTRO_LABELS[h.status_novo as StatusSinistro] || h.status_novo}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {diasNaFase}d na fase
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
