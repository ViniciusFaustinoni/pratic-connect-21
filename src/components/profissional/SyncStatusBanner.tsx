import { CloudOff, Cloud, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSyncQueue } from '@/hooks/useSyncQueue';

/**
 * Banner global de status de sincronização para o app do profissional.
 * Mostra:
 * - Vermelho: offline ou com pendências sem rede
 * - Azul: online sincronizando
 * - Amarelo: itens em erro requerendo atenção
 * - Verde (3s): tudo sincronizado
 */
export function SyncStatusBanner() {
  const online = useOnlineStatus();
  const { pendentes, comErro, sincronizando, forcarSync } = useSyncQueue();
  const [mostrarSucesso, setMostrarSucesso] = useState(false);

  useEffect(() => {
    if (online && pendentes === 0 && comErro === 0) {
      setMostrarSucesso(true);
      const t = setTimeout(() => setMostrarSucesso(false), 3000);
      return () => clearTimeout(t);
    }
  }, [online, pendentes, comErro]);

  // Nada a mostrar
  if (online && pendentes === 0 && comErro === 0 && !mostrarSucesso) return null;

  let cor = 'bg-muted text-foreground border-border';
  let icone = <Cloud className="h-4 w-4" />;
  let texto = '';

  if (!online) {
    cor = 'bg-destructive/10 text-destructive border-destructive/30';
    icone = <CloudOff className="h-4 w-4" />;
    texto = pendentes > 0
      ? `Sem internet — ${pendentes} ${pendentes === 1 ? 'item aguardando' : 'itens aguardando'}`
      : 'Sem internet — trabalhando offline';
  } else if (comErro > 0) {
    cor = 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30';
    icone = <AlertTriangle className="h-4 w-4" />;
    texto = `${comErro} ${comErro === 1 ? 'envio falhou' : 'envios falharam'} — verificar`;
  } else if (sincronizando || pendentes > 0) {
    cor = 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30';
    icone = <Loader2 className="h-4 w-4 animate-spin" />;
    texto = `Sincronizando ${pendentes} ${pendentes === 1 ? 'item' : 'itens'}...`;
  } else if (mostrarSucesso) {
    cor = 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30';
    icone = <Cloud className="h-4 w-4" />;
    texto = 'Tudo sincronizado';
  }

  return (
    <div
      className={cn(
        'fixed left-1/2 top-2 z-[100] -translate-x-1/2 flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium shadow-md backdrop-blur-sm transition-all',
        cor
      )}
      role="status"
      aria-live="polite"
    >
      {icone}
      <span>{texto}</span>
      {online && (pendentes > 0 || comErro > 0) && !sincronizando && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={() => forcarSync()}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Tentar agora
        </Button>
      )}
    </div>
  );
}
