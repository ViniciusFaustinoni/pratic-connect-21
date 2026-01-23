import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download, Wrench } from 'lucide-react';
import { usePWAInstallProfissional } from '@/hooks/usePWAInstallProfissional';
import { IOSInstallGuideProfissional } from './IOSInstallGuideProfissional';
import { cn } from '@/lib/utils';

interface PWAInstallPromptProfissionalProps {
  className?: string;
  variant?: 'banner' | 'compact';
}

export function PWAInstallPromptProfissional({ 
  className,
  variant = 'banner' 
}: PWAInstallPromptProfissionalProps) {
  const {
    isInstallable,
    isInstalled,
    isIOS,
    promptInstall,
    dismissPrompt,
    showIOSInstructions,
    setShowIOSInstructions,
  } = usePWAInstallProfissional();

  const [isVisible, setIsVisible] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  // Mostrar o prompt após um delay
  useEffect(() => {
    if (isInstallable && !isInstalled) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000); // 3 segundos

      return () => clearTimeout(timer);
    }
  }, [isInstallable, isInstalled]);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
    } else {
      await promptInstall();
    }
  };

  const handleDismiss = () => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      setIsVisible(false);
      dismissPrompt();
    }, 300);
  };

  if (!isVisible) return null;

  if (variant === 'compact') {
    return (
      <>
        <Button
          onClick={handleInstall}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
        >
          <Download className="h-4 w-4" />
          Instalar App
        </Button>
        <IOSInstallGuideProfissional 
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
          'fixed bottom-20 left-4 right-4 max-w-md mx-auto z-50',
          'bg-slate-700 rounded-xl shadow-xl border border-slate-600',
          'transform transition-all duration-300',
          isAnimatingOut ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100',
          className
        )}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Ícone do App */}
            <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600">
              <Wrench className="h-6 w-6 text-white" />
            </div>

            {/* Conteúdo */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-white text-sm">
                Instale o App Profissional
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Acesse suas tarefas mais rápido direto da tela inicial
              </p>
            </div>

            {/* Botão de fechar */}
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 text-slate-400 hover:text-white transition-colors"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Botões */}
          <div className="flex gap-2 mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="flex-1 text-slate-300 hover:text-white hover:bg-slate-600"
            >
              Agora não
            </Button>
            <Button
              size="sm"
              onClick={handleInstall}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              <Download className="h-4 w-4" />
              Instalar
            </Button>
          </div>
        </div>
      </div>

      <IOSInstallGuideProfissional 
        open={showIOSInstructions} 
        onOpenChange={setShowIOSInstructions} 
      />
    </>
  );
}
