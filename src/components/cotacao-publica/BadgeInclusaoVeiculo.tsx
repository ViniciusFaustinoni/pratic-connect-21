import { CarFront } from 'lucide-react';

interface BadgeInclusaoVeiculoProps {
  nomeAssociado?: string | null;
}

/**
 * Badge fixo no canto superior direito do fluxo público quando o sistema
 * detecta automaticamente que a cotação é uma INCLUSÃO de veículo (CPF
 * reconhecido na CNH bate com associado existente).
 */
export function BadgeInclusaoVeiculo({ nomeAssociado }: BadgeInclusaoVeiculoProps) {
  return (
    <div
      className="fixed top-2 right-2 sm:top-4 sm:right-4 z-50 max-w-[calc(100vw-1rem)] flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg px-3 py-1.5 sm:px-4 sm:py-2"
      role="status"
      aria-live="polite"
    >
      <CarFront className="h-4 w-4 shrink-0" />
      <div className="flex flex-col leading-tight min-w-0">
        <span className="text-[10px] sm:text-xs font-bold tracking-wider uppercase">
          Inclusão de Veículo
        </span>
        {nomeAssociado ? (
          <span className="text-[10px] sm:text-xs opacity-90 truncate">{nomeAssociado}</span>
        ) : null}
      </div>
    </div>
  );
}
