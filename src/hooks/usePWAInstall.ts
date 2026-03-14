import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PWAInstallState {
  isInstallable: boolean;
  isInstalled: boolean;
  canInstall: boolean;
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
  const { user, profile } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  
  // Verificar se está autenticado como associado
  const isAuthenticated = !!user && profile?.tipo === 'associado';

  // Detectar dispositivo
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
  const isAndroid = /Android/.test(userAgent);
  const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent);
  const isChrome = /Chrome/.test(userAgent) && !/Edge/.test(userAgent);
  
  // Detectar WebView (WhatsApp, Instagram, Facebook, etc.)
  const isWebView = /FBAN|FBAV|Instagram|WhatsApp|wv|WebView/i.test(userAgent) 
    || (isAndroid && /Version\/[\d.]+/.test(userAgent) && /Chrome\/[\d.]+/.test(userAgent) && !/SamsungBrowser/.test(userAgent) && (window as any).navigator?.standalone === undefined && !window.matchMedia('(display-mode: standalone)').matches && /; wv\)/.test(userAgent));

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

  // Verificar se pode mostrar o banner (não foi dispensado recentemente)
  const isInstallable = (() => {
    // Primeiro: verificar se está autenticado como associado
    if (!isAuthenticated) return false;
    
    if (isInstalled) return false;
    
    const dismissedUntil = localStorage.getItem(PWA_DISMISSED_UNTIL_KEY);
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil)) {
      return false;
    }

    // Android com Chrome: precisa do deferredPrompt
    if (isAndroid && isChrome) {
      return !!deferredPrompt;
    }

    // iOS: sempre pode mostrar instruções (qualquer browser)
    if (isIOS) {
      return true;
    }

    // WebView: sempre pode mostrar banner orientando abrir no navegador
    if (isWebView) {
      return true;
    }

    // Outros navegadores com suporte a PWA
    return !!deferredPrompt;
  })();

  // Flag independente para menus permanentes (não depende de dismiss)
  const canInstall = (() => {
    if (isInstalled) return false;
    if (isIOS) return true;
    if (isWebView) return true;
    return !!deferredPrompt;
  })();

  return {
    isInstallable,
    isInstalled,
    canInstall,
    isIOS,
    isAndroid,
    isWebView,
    isSafari,
    isChrome,
    promptInstall,
    dismissPrompt,
    showIOSInstructions,
    setShowIOSInstructions,
  };
}
