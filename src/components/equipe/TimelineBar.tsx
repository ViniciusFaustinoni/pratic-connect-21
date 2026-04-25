import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ESTADO_COLOR,
  ESTADO_LABEL,
  formatarMinutos,
  type SegmentoEstado,
} from '@/hooks/useEquipeTempoReal';

interface TimelineBarProps {
  segmentos: SegmentoEstado[];
  inicioTurno: string;
  fimTurno: string | null;
}

export function TimelineBar({ segmentos, inicioTurno, fimTurno }: TimelineBarProps) {
  if (!segmentos.length) {
    return <div className="h-3 w-full rounded-full bg-muted/50" />;
  }
  const inicio = new Date(inicioTurno).getTime();
  const fim = fimTurno ? new Date(fimTurno).getTime() : Date.now();
  const duracaoTotal = Math.max(1, fim - inicio);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-3 w-full overflow-hidden rounded-full border border-border bg-muted/30">
        {segmentos.map((s, idx) => {
          const segIni = new Date(s.inicio).getTime();
          const segFim = new Date(s.fim).getTime();
          const dur = Math.max(0, segFim - segIni);
          const pct = (dur / duracaoTotal) * 100;
          if (pct < 0.1) return null;
          const minutos = Math.round(dur / 60_000);
          return (
            <Tooltip key={idx}>
              <TooltipTrigger asChild>
                <div
                  className={`${ESTADO_COLOR[s.tipo]} h-full transition-opacity hover:opacity-80`}
                  style={{ width: `${pct}%` }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <div className="font-medium">{ESTADO_LABEL[s.tipo]}</div>
                <div className="text-muted-foreground">
                  {format(new Date(s.inicio), 'HH:mm', { locale: ptBR })} →{' '}
                  {format(new Date(s.fim), 'HH:mm', { locale: ptBR })}
                </div>
                <div className="text-muted-foreground">{formatarMinutos(minutos)}</div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
