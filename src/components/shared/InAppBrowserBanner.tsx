import { useState, useEffect } from 'react';
import { AlertTriangle, Copy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { detectInAppBrowser, getInAppBrowserName, isIOS } from '@/lib/detectInAppBrowser';

interface InAppBrowserBannerProps {
  /** Se true, não permite fechar o banner. */
  persistent?: boolean;
}

export function InAppBrowserBanner({ persistent = false }: InAppBrowserBannerProps) {
  const [browser, setBrowser] = useState<ReturnType<typeof detectInAppBrowser>>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setBrowser(detectInAppBrowser());
  }, []);

  if (!browser || dismissed) return null;

  const nome = getInAppBrowserName(browser);
  const navAlvo = isIOS() ? 'Safari' : 'Chrome';

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copiado! Cole no ' + navAlvo + ' para abrir.');
    } catch {
      toast.error('Não foi possível copiar. Copie manualmente da barra de endereço.');
    }
  };

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5 text-amber-600" />
        <div className="flex-1 space-y-2">
          <p className="text-sm font-semibold">
            Para gravar o vídeo, abra no {navAlvo}
          </p>
          <p className="text-xs leading-relaxed">
            Você está no navegador interno do {nome}, que não mostra a câmera ao vivo durante a gravação.
            Toque no menu (⋯) acima e escolha <strong>Abrir no {navAlvo}</strong>.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={copiarLink}
            className="gap-2 border-amber-400 bg-white hover:bg-amber-100"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar link
          </Button>
        </div>
        {!persistent && (
          <button
            onClick={() => setDismissed(true)}
            className="flex-shrink-0 rounded p-1 text-amber-700 hover:bg-amber-100"
            aria-label="Fechar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
