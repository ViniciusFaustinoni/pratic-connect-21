import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAInstallState {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isSafari: boolean;
  isChrome: boolean;
  promptInstall: () => Promise<boolean>;
  dismissPrompt: () => void;
  showIOSInstructions: boolean;
  setShowIOSInstructions: (show: boolean) => void;
}

const PWA_DISMISSED_KEY = 'pwa-install-dismissed';
const PWA_DISMISSED_UNTIL_KEY = 'pwa-install-dismissed-until';

export function usePWAInstall(): PWAInstallState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  // Detectar dispositivo
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
  const isAndroid = /Android/.test(userAgent);
  const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
  const isChrome = /Chrome/.test(userAgent) && !/Edge/.test(userAgent);

  // Verificar se está instalado como PWA
  useEffect(() => {
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOSStandalone = (navigator as any).standalone === true;
      setIsInstalled(isStandalone || isIOSStandalone);
    };

    checkInstalled();

    // Ouvir mudanças no display-mode
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkInstalled);

    return () => mediaQuery.removeEventListener('change', checkInstalled);
  }, []);

  // Capturar evento beforeinstallprompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Detectar instalação
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  // Função para disparar o prompt de instalação
  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      // Se for iOS, mostrar instruções manuais
      if (isIOS) {
        setShowIOSInstructions(true);
        return false;
      }
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao exibir prompt de instalação:', error);
      return false;
    }
  }, [deferredPrompt, isIOS]);

  // Função para dispensar o prompt
  const dismissPrompt = useCallback(() => {
    // Salvar que foi dispensado por 7 dias
    const dismissedUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem(PWA_DISMISSED_KEY, 'true');
    localStorage.setItem(PWA_DISMISSED_UNTIL_KEY, dismissedUntil.toString());
  }, []);

  // Verificar se pode mostrar (não foi dispensado recentemente)
  const isInstallable = (() => {
    if (isInstalled) return false;
    
    const dismissedUntil = localStorage.getItem(PWA_DISMISSED_UNTIL_KEY);
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil)) {
      return false;
    }

    // Android com Chrome: precisa do deferredPrompt
    if (isAndroid && isChrome) {
      return !!deferredPrompt;
    }

    // iOS com Safari: sempre pode mostrar instruções
    if (isIOS && isSafari) {
      return true;
    }

    // Outros navegadores com suporte a PWA
    return !!deferredPrompt;
  })();

  return {
    isInstallable,
    isInstalled,
    isIOS,
    isAndroid,
    isSafari,
    isChrome,
    promptInstall,
    dismissPrompt,
    showIOSInstructions,
    setShowIOSInstructions,
  };
}
