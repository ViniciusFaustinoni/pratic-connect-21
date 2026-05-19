import { useBuildVersion } from '@/hooks/useBuildVersion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * Indicador discreto de versão para o rodapé do dropdown do perfil.
 * - Ponto verde: usuário na versão mais recente publicada
 * - Ponto âmbar: versão antiga (recarregar)
 * Clique copia o hash para o clipboard (útil para suporte comparar entre usuários).
 */
export function BuildVersionIndicator() {
  const { current, latest, isStale } = useBuildVersion();
  const short = (current || 'dev').slice(0, 7);
  const isChecking = latest === null;

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(current);
      toast.success(
        isStale
          ? 'Versão antiga — recarregue a página'
          : `Versão ${short} copiada`
      );
    } catch {
      // ignore
    }
  };

  const handleReload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.location.reload();
  };

  return (
    <div
      className="px-2 py-1 flex items-center justify-center gap-1.5 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          isChecking
            ? 'bg-muted-foreground/40'
            : isStale
            ? 'bg-amber-500 animate-pulse'
            : 'bg-emerald-500'
        )}
        aria-hidden
      />
      <button
        type="button"
        onClick={handleClick}
        title={
          isStale
            ? 'Versão antiga — clique para copiar o hash ou recarregue'
            : 'Versão atualizada — clique para copiar'
        }
        className="text-[10px] text-muted-foreground font-mono hover:text-foreground transition-colors"
      >
        {short}
      </button>
      {isStale && (
        <button
          type="button"
          onClick={handleReload}
          className="text-[10px] text-amber-500 hover:text-amber-400 underline-offset-2 hover:underline"
          title="Recarregar para atualizar"
        >
          atualizar
        </button>
      )}
    </div>
  );
}
