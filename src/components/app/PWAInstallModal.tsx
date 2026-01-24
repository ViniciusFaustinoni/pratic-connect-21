import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Smartphone, Download, CheckCircle, Wifi, Bell, Zap } from 'lucide-react';
import { IOSInstallGuide } from '@/components/pwa/IOSInstallGuide';

interface PWAInstallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PWAInstallModal({ open, onOpenChange }: PWAInstallModalProps) {
  const { isIOS, promptInstall, showIOSInstructions, setShowIOSInstructions } = usePWAInstall();

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }
    
    const installed = await promptInstall();
    if (installed) {
      onOpenChange(false);
    }
  };

  const benefits = [
    { icon: Zap, text: 'Acesso rápido com um toque' },
    { icon: Bell, text: 'Notificações em tempo real' },
    { icon: Wifi, text: 'Funciona mesmo offline' },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Smartphone className="h-5 w-5 text-primary" />
              Baixe o App PRATIC!
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Ilustração */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-2xl">P</span>
                </div>
                <div className="absolute -bottom-2 -right-2 h-8 w-8 bg-primary rounded-full flex items-center justify-center shadow-md">
                  <Download className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
            </div>
            
            {/* Benefícios */}
            <ul className="space-y-3">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <li key={index} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="h-4 w-4 text-success" />
                    </div>
                    <span className="text-sm text-foreground">{benefit.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={handleInstall} className="w-full" size="lg">
              <Download className="h-4 w-4 mr-2" />
              {isIOS ? 'Ver Como Instalar' : 'Instalar Agora'}
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => onOpenChange(false)} 
              className="w-full text-muted-foreground"
            >
              Continuar no navegador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* iOS Instructions Modal */}
      <IOSInstallGuide 
        open={showIOSInstructions} 
        onOpenChange={setShowIOSInstructions} 
      />
    </>
  );
}
