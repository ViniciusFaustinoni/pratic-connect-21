import { useState, useEffect } from 'react';
import { X, Download, Smartphone, ExternalLink, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { IOSInstallGuide } from './IOSInstallGuide';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface PWAInstallPromptProps {
  className?: string;
  variant?: 'banner' | 'compact';
}

export function PWAInstallPrompt({ className, variant = 'banner' }: PWAInstallPromptProps) {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    isWebView,
    promptInstall,
    dismissPrompt,
    showIOSInstructions,
    setShowIOSInstructions,
  } = usePWAInstall();

  const { toast } = useToast();
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isInstallable && !isInstalled) {
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    }
    setIsVisible(false);
  }, [isInstallable, isInstalled]);

  const handleInstall = async () => {
    if (isWebView) {
      await handleCopyUrl();
      return;
    }
    if (isIOS) {
      setShowIOSInstructions(true);
    } else {
      const installed = await promptInstall();
      if (installed) {
        handleDismiss();
      }
    }
  };

  const handleCopyUrl = async () => {
    try {
      const url = window.location.origin;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({
        title: 'Link copiado!',
        description: 'Abra o Chrome ou Safari e cole o link para instalar o app.',
      });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = window.location.origin;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      toast({
        title: 'Link copiado!',
        description: 'Abra o Chrome ou Safari e cole o link para instalar o app.',
      });
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleDismiss = () => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      setIsAnimatingOut(false);
      dismissPrompt();
    }, 300);
  };

  if (!isVisible) return null;

  if (variant === 'compact') {
    return (
      <>
        <button
          onClick={handleInstall}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium',
            'hover:bg-primary/90 transition-colors',
            className
          )}
        >
          {isWebView ? <ExternalLink className="h-4 w-4" /> : <Download className="h-4 w-4" />}
          {isWebView ? 'Abrir no navegador' : 'Instalar App'}
        </button>
        <IOSInstallGuide 
          open={showIOSInstructions} 
          onOpenChange={setShowIOSInstructions} 
        />
      </>
    );
  }

  return (
    <>
      <div
        className={cn(
          'fixed bottom-16 md:bottom-4 left-4 right-4 z-50',
          'bg-card border border-border rounded-xl shadow-lg',
          'transform transition-all duration-300 ease-out',
          isAnimatingOut ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100',
          className
        )}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 bg-primary/10 rounded-lg">
              {isWebView ? (
                <ExternalLink className="h-6 w-6 text-primary" />
              ) : (
                <Smartphone className="h-6 w-6 text-primary" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground">
                {isWebView ? 'Abra no navegador' : 'Instale o App PRATIC'}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isWebView 
                  ? 'Para instalar o app, abra este link no Chrome ou Safari'
                  : 'Acesse mais rápido direto da sua tela inicial'
                }
              </p>
            </div>

            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              onClick={handleInstall}
              className="flex-1"
              size="sm"
            >
              {isWebView ? (
                <>
                  {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? 'Link copiado!' : 'Copiar link'}
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  {isIOS ? 'Como instalar' : 'Instalar'}
                </>
              )}
            </Button>
            <Button
              onClick={handleDismiss}
              variant="outline"
              size="sm"
            >
              Agora não
            </Button>
          </div>
        </div>
      </div>

      <IOSInstallGuide 
        open={showIOSInstructions} 
        onOpenChange={setShowIOSInstructions} 
      />
    </>
  );
}
