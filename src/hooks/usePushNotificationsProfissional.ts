import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PushNotificationState {
  permission: NotificationPermission | 'default';
  isSubscribed: boolean;
  isSupported: boolean;
  isLoading: boolean;
}

// VAPID Public Key - placeholder, será substituído pela chave real do backend
const VAPID_PUBLIC_KEY_FALLBACK = 'BLc8Qy8VYUZMy3q2JQH0f0t4vNqM8P7YK2WN1Rz6pF5wT3mJ4cB9dS2aE6hN0kL8xV5gR7uI9oP1';

// Converter base64 URL-safe para Uint8Array (necessário para applicationServerKey)
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer;
}

// Detectar tipo de dispositivo
function getDeviceType(): string {
  const userAgent = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(userAgent)) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  return 'desktop';
}

export function usePushNotificationsProfissional() {
  const { user } = useAuth();
  const [state, setState] = useState<PushNotificationState>({
    permission: 'default',
    isSubscribed: false,
    isSupported: false,
    isLoading: true,
  });

  // Verificar suporte do navegador
  useEffect(() => {
    const checkSupport = () => {
      const isSupported = 
        'serviceWorker' in navigator && 
        'PushManager' in window && 
        'Notification' in window;

      setState(prev => ({
        ...prev,
        isSupported,
        permission: isSupported ? Notification.permission : 'default',
      }));
    };

    checkSupport();
  }, []);

  // Verificar subscription existente
  useEffect(() => {
    const checkExistingSubscription = async () => {
      if (!state.isSupported || !user) {
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await (registration as any).pushManager.getSubscription();

        if (subscription) {
          // Verificar se existe no banco
          const { data } = await supabase
            .from('push_subscriptions_profissionais')
            .select('id')
            .eq('endpoint', subscription.endpoint)
            .eq('is_active', true)
            .single();

          setState(prev => ({
            ...prev,
            isSubscribed: !!data,
            isLoading: false,
          }));
        } else {
          setState(prev => ({ ...prev, isSubscribed: false, isLoading: false }));
        }
      } catch (error) {
        console.error('[Push] Erro ao verificar subscription:', error);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    if (state.isSupported && user) {
      checkExistingSubscription();
    }
  }, [state.isSupported, user]);

  // Função para se inscrever
  const subscribe = useCallback(async (): Promise<{ success: boolean; reason?: string }> => {
    if (!state.isSupported) {
      console.error('[Push] Push não suportado neste navegador');
      return { success: false, reason: 'not_supported' };
    }
    if (!user) {
      console.error('[Push] Usuário não logado');
      return { success: false, reason: 'not_logged_in' };
    }

    // Verificar se está em modo standalone (PWA instalada) - necessário no iOS
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS && !isStandalone) {
      console.warn('[Push] iOS requer que o app seja instalado na tela inicial para push');
      return { success: false, reason: 'ios_not_installed' };
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Solicitar permissão
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission }));

      if (permission !== 'granted') {
        console.log('[Push] Permissão negada pelo usuário');
        setState(prev => ({ ...prev, isLoading: false }));
        return { success: false, reason: permission === 'denied' ? 'permission_denied' : 'permission_dismissed' };
      }

      // Aguardar service worker estar pronto
      const registration = await navigator.serviceWorker.ready;

      // Buscar a VAPID key do backend
      let vapidKey = VAPID_PUBLIC_KEY_FALLBACK;
      try {
        const { data: vapidData } = await supabase.functions.invoke('send-push-profissional', {
          body: { action: 'get-vapid-key' }
        });
        if (vapidData?.vapidPublicKey) {
          vapidKey = vapidData.vapidPublicKey;
        }
      } catch (err) {
        console.warn('[Push] Não foi possível buscar VAPID key do backend, usando fallback');
      }

      // Criar subscription
      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Extrair dados da subscription
      const subscriptionJson = subscription.toJSON();
      const { endpoint } = subscriptionJson;
      const p256dh = subscriptionJson.keys?.p256dh;
      const auth = subscriptionJson.keys?.auth;

      if (!endpoint || !p256dh || !auth) {
        throw new Error('Dados da subscription incompletos');
      }

      // Salvar no banco (upsert para evitar duplicatas)
      const { error } = await supabase
        .from('push_subscriptions_profissionais')
        .upsert({
          profissional_id: user.id,
          endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent,
          device_type: getDeviceType(),
          is_active: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'endpoint',
        });

      if (error) {
        console.error('[Push] Erro ao salvar subscription no banco:', error);
        throw error;
      }

      setState(prev => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
      }));

      console.log('[Push] ✅ Inscrito em notificações push');
      return { success: true };

    } catch (error: any) {
      console.error('[Push] Erro ao inscrever:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      
      // Identificar tipo de erro
      if (error?.name === 'AbortError') {
        return { success: false, reason: 'sw_not_ready' };
      }
      if (error?.message?.includes('push service')) {
        return { success: false, reason: 'push_service_error' };
      }
      if (error?.code === '42501' || error?.message?.includes('row-level security')) {
        return { success: false, reason: 'rls_blocked' };
      }
      return { success: false, reason: 'unknown' };
    }
  }, [state.isSupported, user]);

  // Função para cancelar inscrição
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.getSubscription();

      if (subscription) {
        // Remover do navegador
        await subscription.unsubscribe();

        // Remover do banco
        await supabase
          .from('push_subscriptions_profissionais')
          .delete()
          .eq('profissional_id', user.id)
          .eq('endpoint', subscription.endpoint);
      }

      setState(prev => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
      }));

      console.log('[Push] ✅ Desinscrito de notificações push');
      return true;

    } catch (error) {
      console.error('[Push] Erro ao desinscrever:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [user]);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}
