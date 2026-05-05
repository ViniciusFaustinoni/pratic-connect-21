import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OcrFallbackBannerProps {
  /** Nome amigável do documento/foto. Ex.: "CRLV", "odômetro". */
  documento: string;
  /** Texto adicional opcional. */
  detalhe?: string;
  className?: string;
}

/**
 * Banner padrão exibido quando o OCR não conseguiu ler um documento ou foto.
 * Convida o usuário a preencher os dados manualmente.
 */
export function OcrFallbackBanner({ documento, detalhe, className }: OcrFallbackBannerProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-3 flex items-start gap-2',
        className,
      )}
      role="status"
    >
      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
      <div className="text-sm text-amber-900 dark:text-amber-200">
        <p className="font-medium">
          Não conseguimos ler automaticamente {documento}.
        </p>
        <p className="text-xs mt-0.5 opacity-90">
          {detalhe ?? 'Por favor, confirme/preencha os dados manualmente abaixo para continuar.'}
        </p>
      </div>
    </div>
  );
}
