import { useState } from 'react';
import { Bell, CreditCard, Car, Shield, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCompleteOnboarding, useUpdateNotificacoesPreferencias } from '@/hooks/useNotificacoesPreferencias';
import { toast } from 'sonner';

interface NotificacoesOnboardingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificacoesOnboarding({ open, onOpenChange }: NotificacoesOnboardingProps) {
  const [loading, setLoading] = useState(false);
  const completeOnboarding = useCompleteOnboarding();
  const updatePreferencias = useUpdateNotificacoesPreferencias();

  const handleAtivarNotificacoes = async () => {
    setLoading(true);
    try {
      // Solicitar permissão de push
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          await updatePreferencias.mutateAsync({ push_ativo: true });
          toast.success('Notificações ativadas com sucesso!');
        } else {
          toast.info('Você pode ativar as notificações depois em Configurações');
        }
      }
      
      await completeOnboarding.mutateAsync();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao configurar notificações:', error);
      toast.error('Erro ao configurar notificações');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigurarDepois = async () => {
    try {
      await completeOnboarding.mutateAsync();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao pular onboarding:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Bell className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-xl">Fique sempre informado!</DialogTitle>
          <DialogDescription className="text-center">
            Ative as notificações para não perder nada importante.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="p-2 bg-green-100 rounded-lg">
              <CreditCard className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm">Saber quando seu boleto vencer</span>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Car className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-sm">Acompanhar instalação em tempo real</span>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="p-2 bg-red-100 rounded-lg">
              <Shield className="h-5 w-5 text-red-600" />
            </div>
            <span className="text-sm">Receber ajuda rápida em emergências</span>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Megaphone className="h-5 w-5 text-purple-600" />
            </div>
            <span className="text-sm">Ficar por dentro das novidades</span>
          </div>
        </div>

        <div className="space-y-2">
          <Button 
            onClick={handleAtivarNotificacoes} 
            className="w-full"
            disabled={loading}
          >
            {loading ? 'Ativando...' : 'Ativar Notificações'}
          </Button>
          <p className="text-xs text-center text-muted-foreground">Recomendado</p>
          
          <Button 
            variant="ghost" 
            className="w-full text-muted-foreground"
            onClick={handleConfigurarDepois}
            disabled={loading}
          >
            Configurar depois →
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
