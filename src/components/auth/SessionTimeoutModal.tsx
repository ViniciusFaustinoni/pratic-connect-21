import { useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock, LogOut, RefreshCw } from 'lucide-react';

// ============================================
// TIPOS
// ============================================
interface SessionTimeoutModalProps {
  open: boolean;
  remainingTime: number;
  onExtend: () => void;
  onLogout: () => void;
}

// ============================================
// FORMATAR TEMPO
// ============================================
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// ============================================
// COMPONENTE
// ============================================
export function SessionTimeoutModal({
  open,
  remainingTime,
  onExtend,
  onLogout,
}: SessionTimeoutModalProps) {
  // Som de alerta quando restam 60 segundos
  useEffect(() => {
    if (open && remainingTime === 60) {
      // Vibrar em dispositivos móveis
      if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
    }
  }, [open, remainingTime]);

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader className="flex flex-col items-center text-center">
          {/* Ícone */}
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
            <Clock className="h-8 w-8 text-yellow-500" />
          </div>

          <AlertDialogTitle className="text-xl">
            Sessão Expirando
          </AlertDialogTitle>

          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Sua sessão irá expirar por inatividade em:
              </p>

              {/* Countdown */}
              <div className="flex flex-col items-center gap-1 rounded-lg bg-muted p-4">
                <span className="font-mono text-4xl font-bold text-foreground">
                  {formatTime(remainingTime)}
                </span>
                <span className="text-sm text-muted-foreground">minutos</span>
              </div>

              <p className="text-sm text-muted-foreground">
                Deseja continuar conectado?
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <AlertDialogCancel
            onClick={onLogout}
            className="border-destructive text-destructive hover:bg-destructive/10"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </AlertDialogCancel>

          <AlertDialogAction
            onClick={onExtend}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Continuar Conectado
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
