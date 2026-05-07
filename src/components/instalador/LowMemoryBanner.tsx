import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMemoryPressure } from '@/hooks/useMemoryPressure';

interface Props {
  /** Callback opcional para liberar fotos já enviadas/cache local. */
  onLiberarMemoria?: () => void;
}

/**
 * Banner exibido no app dos instaladores quando o JS heap atinge nível
 * crítico. Mostra que o app passou a comprimir em baixa qualidade e
 * oferece um botão para liberar memória manualmente.
 */
export function LowMemoryBanner({ onLiberarMemoria }: Props) {
  const critical = useMemoryPressure();
  if (!critical) return null;

  return (
    <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-600" />
        <div className="flex-1 space-y-2">
          <div>
            <p className="text-sm font-semibold">Modo de baixa memória ativo</p>
            <p className="text-xs leading-relaxed">
              O celular está com pouca memória disponível. As próximas fotos
              serão capturadas em qualidade reduzida para evitar travamentos.
            </p>
          </div>
          {onLiberarMemoria && (
            <Button
              size="sm"
              variant="outline"
              onClick={onLiberarMemoria}
              className="gap-2 border-amber-400 bg-white hover:bg-amber-100 text-amber-900"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Liberar memória das fotos enviadas
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
