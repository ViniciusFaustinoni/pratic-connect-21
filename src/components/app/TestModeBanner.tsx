import { useState } from 'react';
import { X, FlaskConical } from 'lucide-react';
import { useAssociado } from '@/contexts/AssociadoContext';

export function TestModeBanner() {
  const { isTestMode, associado } = useAssociado();
  const [minimized, setMinimized] = useState(false);

  if (!isTestMode) return null;

  // Botão minimizado
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed right-0 top-0 z-50 flex items-center gap-1 rounded-bl-lg bg-yellow-500 px-2 py-1 text-xs font-bold text-black shadow-md transition-all hover:bg-yellow-400"
        aria-label="Expandir banner de teste"
      >
        <FlaskConical className="h-3 w-3" />
        TESTE
      </button>
    );
  }

  // Banner completo
  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-yellow-500 px-4 py-1.5 text-center text-sm font-medium text-black shadow-md">
      <FlaskConical className="h-4 w-4 flex-shrink-0" />
      <span className="truncate">
        AMBIENTE DE TESTE — {associado?.nome}
      </span>
      <button
        onClick={() => setMinimized(true)}
        className="ml-1 flex-shrink-0 rounded p-0.5 transition-colors hover:bg-yellow-400"
        aria-label="Minimizar banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
