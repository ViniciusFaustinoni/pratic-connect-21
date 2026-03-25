import { ShieldAlert, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface VeiculoSGAModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placa: string;
}

export function VeiculoSGAModal({ open, onOpenChange, placa }: VeiculoSGAModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md border-destructive/50">
        <AlertDialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Veículo já cadastrado no SGA
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            <span className="font-mono font-semibold text-lg text-foreground">
              {placa?.toUpperCase()}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">
                Este veículo já existe no sistema SGA (Hinova)
              </p>
              <p className="text-sm text-muted-foreground">
                Não é possível realizar cotação para veículos que já estão cadastrados na plataforma.
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground text-center">
              Em caso de dúvidas, entre em contato com a <strong>Diretoria</strong> para verificar a situação deste veículo.
            </p>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogAction className="w-full">
            Entendido
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
