import { useState } from 'react';
import { Bell, Mail, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCompleteOnboarding, useUpdateNotificacoesPreferencias } from '@/hooks/useNotificacoesPreferencias';
import { toast } from 'sonner';

interface ColaboradorOnboardingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ColaboradorOnboarding({ open, onOpenChange }: ColaboradorOnboardingProps) {
  const [loading, setLoading] = useState(false);
  const [resumoDiario, setResumoDiario] = useState(true);
  const [somNotificacao, setSomNotificacao] = useState(true);
  
  const completeOnboarding = useCompleteOnboarding();
  const updatePreferencias = useUpdateNotificacoesPreferencias();

  const handleContinuar = async () => {
    setLoading(true);
    try {
      await updatePreferencias.mutateAsync({
        email_resumo_diario: resumoDiario,
        som_notificacao: somNotificacao,
      });
      
      await completeOnboarding.mutateAsync();
      toast.success('Preferências salvas!');
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar preferências:', error);
      toast.error('Erro ao salvar preferências');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Bell className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-xl">Configure suas notificações</DialogTitle>
          <DialogDescription className="text-center">
            Receba alertas importantes do seu módulo de trabalho.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Resumo diário */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-sm">Resumo diário por email</div>
                <div className="text-xs text-muted-foreground">
                  Receba às 8h um resumo das suas pendências
                </div>
              </div>
            </div>
            <Switch 
              checked={resumoDiario} 
              onCheckedChange={setResumoDiario}
            />
          </div>

          {/* Som de notificação */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Volume2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <div className="font-medium text-sm">Som de notificação</div>
                <div className="text-xs text-muted-foreground">
                  Alerta sonoro para novas tarefas
                </div>
              </div>
            </div>
            <Switch 
              checked={somNotificacao} 
              onCheckedChange={setSomNotificacao}
            />
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          💡 Você pode alterar isso depois em Configurações
        </p>

        <Button 
          onClick={handleContinuar} 
          className="w-full"
          disabled={loading}
        >
          {loading ? 'Salvando...' : 'Continuar'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
