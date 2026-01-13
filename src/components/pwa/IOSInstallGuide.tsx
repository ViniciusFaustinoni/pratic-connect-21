import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Share, PlusSquare, CheckCircle2 } from 'lucide-react';

interface IOSInstallGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IOSInstallGuide({ open, onOpenChange }: IOSInstallGuideProps) {
  const steps = [
    {
      icon: Share,
      title: 'Toque no ícone de compartilhar',
      description: 'Na barra inferior do Safari, toque no ícone de compartilhar',
      highlight: '⬆️',
    },
    {
      icon: PlusSquare,
      title: 'Adicionar à Tela de Início',
      description: 'Role para baixo e toque em "Adicionar à Tela de Início"',
      highlight: '+ Adicionar',
    },
    {
      icon: CheckCircle2,
      title: 'Confirme a instalação',
      description: 'Toque em "Adicionar" no canto superior direito',
      highlight: 'Adicionar',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <span className="text-2xl">📲</span>
            Instalar App PRATIC
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-6">
            Siga os passos abaixo para instalar o app no seu iPhone ou iPad:
          </p>

          <div className="space-y-6">
            {steps.map((step, index) => (
              <div key={index} className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-bold text-primary">
                      {index + 1}
                    </span>
                  </div>
                </div>
                
                <div className="flex-1">
                  <h4 className="font-medium text-foreground mb-1">
                    {step.title}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                  <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg text-sm">
                    <step.icon className="h-4 w-4 text-primary" />
                    <span className="font-medium">{step.highlight}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-sm text-center text-muted-foreground">
              <strong className="text-foreground">Dica:</strong> Após a instalação, 
              você encontrará o app PRATIC na sua tela inicial
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>
            Entendi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
