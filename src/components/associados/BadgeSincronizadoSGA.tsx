import { CloudCheck } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  codigoHinova: number | null | undefined;
  sincronizadoEm?: string | null;
  className?: string;
}

/**
 * Selo discreto exibido ao lado do nome do associado para indicar que o
 * registro está vinculado ao SGA Hinova (origem ou sincronizado).
 *
 * Não renderiza nada quando `codigoHinova` está vazio.
 */
export function BadgeSincronizadoSGA({ codigoHinova, sincronizadoEm, className }: Props) {
  if (!codigoHinova) return null;

  let sincronizadoLabel: string | null = null;
  if (sincronizadoEm) {
    try {
      sincronizadoLabel = new Date(sincronizadoEm).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      sincronizadoLabel = null;
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex items-center text-primary cursor-help ${className ?? ''}`}
          aria-label={`Sincronizado com SGA — código ${codigoHinova}`}
        >
          <CloudCheck className="h-3.5 w-3.5" strokeWidth={2.2} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <div className="font-medium">Sincronizado com SGA</div>
        <div className="text-muted-foreground">Código Hinova: {codigoHinova}</div>
        {sincronizadoLabel && (
          <div className="text-muted-foreground">Última sync: {sincronizadoLabel}</div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export default BadgeSincronizadoSGA;
