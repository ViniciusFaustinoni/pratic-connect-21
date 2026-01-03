import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useEstornarLancamento } from '@/hooks/useContabilidade';

interface EstornoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lancamentoId: string;
  lancamentoNumero: string;
}

export function EstornoDialog({
  open,
  onOpenChange,
  lancamentoId,
  lancamentoNumero,
}: EstornoDialogProps) {
  const [motivo, setMotivo] = useState('');
  const estornar = useEstornarLancamento();

  const handleEstornar = async () => {
    if (!motivo.trim()) return;

    try {
      await estornar.mutateAsync({ id: lancamentoId, motivo });
      onOpenChange(false);
      setMotivo('');
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Estornar Lançamento</AlertDialogTitle>
          <AlertDialogDescription>
            Você está prestes a estornar o lançamento <strong>{lancamentoNumero}</strong>.
            Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="motivo">Motivo do estorno *</Label>
          <Textarea
            id="motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Descreva o motivo do estorno..."
            rows={3}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleEstornar}
            disabled={!motivo.trim() || estornar.isPending}
          >
            {estornar.isPending ? 'Estornando...' : 'Estornar'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
