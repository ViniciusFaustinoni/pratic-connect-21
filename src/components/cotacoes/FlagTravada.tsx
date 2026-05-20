import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getCotacaoTravada } from '@/lib/cotacaoTravada';
import type { CotacaoWithRelations } from '@/hooks/useCotacoes';

interface FlagTravadaProps {
  cotacao: CotacaoWithRelations;
  /** Tick passado pelo container para forçar recálculo periódico sem rerender em massa. */
  now?: Date;
  className?: string;
}

/**
 * Bolinha pulsante exibida ao lado do badge de etapa quando o cliente está
 * parado num passo após a assinatura. Visível apenas se `travada=true`.
 * Respeita `prefers-reduced-motion`.
 */
export const FlagTravada: React.FC<FlagTravadaProps> = ({ cotacao, now, className }) => {
  const info = React.useMemo(() => getCotacaoTravada(cotacao, now ?? new Date()), [cotacao, now]);

  if (!info.travada || !info.nivel) return null;

  const cor =
    info.nivel === 'vermelho'
      ? { dot: 'bg-red-500', ping: 'bg-red-500' }
      : { dot: 'bg-amber-500', ping: 'bg-amber-500' };

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="status"
            aria-label={info.motivo ?? 'Cotação travada'}
            className={cn(
              'relative inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center',
              className,
            )}
          >
            <span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping',
                cor.ping,
              )}
            />
            <span className={cn('relative inline-flex h-2 w-2 rounded-full', cor.dot)} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          <p className="font-medium">
            {info.nivel === 'vermelho' ? 'Atenção urgente' : 'Acompanhamento sugerido'}
          </p>
          {info.motivo && <p className="text-muted-foreground">{info.motivo}</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
