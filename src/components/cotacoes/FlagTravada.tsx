import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getCotacaoTravada } from '@/lib/cotacaoTravada';
import { descreverEtapaPendente } from '@/lib/etapaPendentePublica';
import type { CotacaoWithRelations } from '@/hooks/useCotacoes';

interface FlagTravadaProps {
  cotacao: CotacaoWithRelations;
  /** Tick passado pelo container para forçar recálculo periódico sem rerender em massa. */
  now?: Date;
  className?: string;
}

/**
 * Bolinha pulsante exibida ao lado do badge de etapa quando o cliente está
 * parado num passo do link público. Visível apenas se `travada=true`.
 * Tooltip usa a label canônica (mesma do Cadastro e Monitoramento).
 * Respeita `prefers-reduced-motion`.
 */
export const FlagTravada: React.FC<FlagTravadaProps> = ({ cotacao, now, className }) => {
  const info = React.useMemo(() => getCotacaoTravada(cotacao, now ?? new Date()), [cotacao, now]);

  if (!info.travada || !info.nivel) return null;

  const etapaCanonica = descreverEtapaPendente(info.codigoPendente);
  const cor =
    info.nivel === 'vermelho'
      ? { dot: 'bg-red-500', ping: 'bg-red-500' }
      : { dot: 'bg-amber-500', ping: 'bg-amber-500' };

  const horasInt = Math.round(info.horasParada);

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="status"
            aria-label={`${etapaCanonica.label} há ${horasInt}h`}
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
          <p className="text-foreground">{etapaCanonica.label} há {horasInt}h</p>
          {etapaCanonica.descricaoAssociado && (
            <p className="text-muted-foreground mt-1">{etapaCanonica.descricaoAssociado}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

