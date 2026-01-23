import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Share, Plus, Wrench } from 'lucide-react';

interface IOSInstallGuideProfissionalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IOSInstallGuideProfissional({ open, onOpenChange }: IOSInstallGuideProfissionalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-slate-800 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600">
              <Wrench className="h-5 w-5 text-white" />
            </div>
            <span>Instalar App Profissional</span>
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            Siga os passos abaixo para adicionar o app à sua tela inicial no iPhone/iPad
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Passo 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm">
              1
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Share className="h-5 w-5 text-blue-400" />
                <span className="font-medium text-white">Toque em Compartilhar</span>
              </div>
              <p className="text-sm text-slate-400">
                Na barra inferior do Safari, toque no ícone de compartilhar (quadrado com seta para cima)
              </p>
            </div>
          </div>

          {/* Passo 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm">
              2
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Plus className="h-5 w-5 text-blue-400" />
                <span className="font-medium text-white">Adicionar à Tela de Início</span>
              </div>
              <p className="text-sm text-slate-400">
                Role para baixo e toque em "Adicionar à Tela de Início"
              </p>
            </div>
          </div>

          {/* Passo 3 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm">
              3
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-white">Confirme a instalação</span>
              </div>
              <p className="text-sm text-slate-400">
                Toque em "Adicionar" no canto superior direito para finalizar
              </p>
            </div>
          </div>
        </div>

        {/* Dica */}
        <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
          <p className="text-xs text-slate-300">
            <strong className="text-blue-400">Dica:</strong> Use o Safari para instalar. O Chrome no iOS não suporta instalação de apps.
          </p>
        </div>

        <Button 
          onClick={() => onOpenChange(false)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-2"
        >
          Entendi
        </Button>
      </DialogContent>
    </Dialog>
  );
}
