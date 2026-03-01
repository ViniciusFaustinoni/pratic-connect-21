import { useState, useEffect } from 'react';
import { Bell, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotificationsProfissional } from '@/hooks/usePushNotificationsProfissional';
import { toast } from 'sonner';

const DISMISSED_KEY = 'pratic-push-banner-dismissed';
const DISMISSED_UNTIL_KEY = 'pratic-push-banner-dismissed-until';

export function PushNotificationBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const { isSupported, isSubscribed, permission, isLoading, subscribe } = usePushNotificationsProfissional();

  useEffect(() => {
    // Não mostrar enquanto carrega
    if (isLoading) return;

    // Verificar se foi dispensado recentemente
    const dismissedUntil = localStorage.getItem(DISMISSED_UNTIL_KEY);
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil)) {
      return;
    }

    // Mostrar banner apenas se:
    // - Navegador suporta
    // - Não está inscrito
    // - Permissão não foi negada permanentemente
    if (isSupported && !isSubscribed && permission !== 'denied') {
      // Delay para não mostrar imediatamente ao abrir o app
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSupported, isSubscribed, permission, isLoading]);

  const handleSubscribe = async () => {
    const result = await subscribe();
    if (result.success) {
      toast.success('Notificações ativadas com sucesso!');
      setIsVisible(false);
    } else {
      // Mensagens específicas por tipo de erro
      switch (result.reason) {
        case 'ios_not_installed':
          toast.error('No iPhone, instale o app na tela inicial primeiro para ativar notificações.', { duration: 6000 });
          break;
        case 'not_supported':
          toast.error('Seu navegador não suporta notificações push.');
          break;
        case 'permission_denied':
          toast.error('Permissão de notificações bloqueada. Desbloqueie nas configurações do navegador.', { duration: 6000 });
          break;
        case 'permission_dismissed':
          toast.info('Você pode ativar as notificações a qualquer momento.');
          break;
        case 'rls_blocked':
          toast.error('Erro de permissão ao salvar. Contate o suporte.');
          break;
        default:
          toast.error('Não foi possível ativar as notificações. Tente novamente.');
      }
    }
  };

  const handleDismiss = () => {
    // Dispensar por 3 dias
    const dismissedUntil = Date.now() + 3 * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISSED_KEY, 'true');
    localStorage.setItem(DISMISSED_UNTIL_KEY, dismissedUntil.toString());
    setIsVisible(false);
  };

  if (!isVisible || isLoading) return null;

  return (
    <div className="mx-4 mb-4 p-4 bg-primary rounded-xl shadow-lg animate-in slide-in-from-top-4 duration-300">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
          <Bell className="h-5 w-5 text-primary-foreground" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-primary-foreground font-semibold text-sm">
            Ativar Notificações
          </h3>
          <p className="text-primary-foreground/80 text-xs mt-1">
            Receba alertas instantâneos quando novas tarefas forem atribuídas a você
          </p>
          
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSubscribe}
              disabled={isLoading}
              className="bg-background text-primary hover:bg-background/90"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Bell className="h-4 w-4 mr-1" />
              )}
              Ativar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/20"
            >
              Agora não
            </Button>
          </div>
        </div>
        
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 rounded-full hover:bg-primary-foreground/20 transition-colors"
        >
          <X className="h-4 w-4 text-primary-foreground/60" />
        </button>
      </div>
    </div>
  );
}
