import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  quantidade: number;
  valorTotal: number;
  isPending: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function ConfirmarNegativacaoModal({ open, onClose, onConfirm, quantidade, valorTotal, isPending }: Props) {
  const [confirmText, setConfirmText] = useState('');

  const isConfirmEnabled = confirmText === 'NEGATIVAR';

  const handleConfirm = () => {
    if (isConfirmEnabled) {
      onConfirm();
      setConfirmText('');
    }
  };

  const handleClose = () => {
    setConfirmText('');
    onClose();
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Confirmar Negativação em Lote
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              Você está prestes a negativar <strong>{quantidade}</strong> associado(s) 
              no valor total de <strong>{formatCurrency(valorTotal)}</strong>.
            </p>
            <p className="text-destructive font-medium">
              Esta ação registrará a dívida nos órgãos de proteção ao crédito (SPC/Serasa).
              A negativação pode afetar o score de crédito do associado.
            </p>
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mt-4">
              <Label htmlFor="confirm-text" className="text-sm font-medium">
                Para confirmar, digite <span className="font-bold text-destructive">NEGATIVAR</span> abaixo:
              </Label>
              <Input
                id="confirm-text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                placeholder="Digite NEGATIVAR"
                className="mt-2"
                autoComplete="off"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm}
            disabled={!isConfirmEnabled || isPending}
          >
            {isPending ? 'Processando...' : `Negativar ${quantidade} associado(s)`}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
