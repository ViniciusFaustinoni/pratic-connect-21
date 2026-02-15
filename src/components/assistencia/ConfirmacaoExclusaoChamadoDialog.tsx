import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';

interface ConfirmacaoExclusaoChamadoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  protocolo: string;
  onConfirm: (motivo: string) => Promise<void>;
}

export function ConfirmacaoExclusaoChamadoDialog({
  open,
  onOpenChange,
  protocolo,
  onConfirm,
}: ConfirmacaoExclusaoChamadoDialogProps) {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!motivo.trim() || motivo.trim().length < 5) return;
    
    setLoading(true);
    try {
      await onConfirm(motivo.trim());
      setMotivo('');
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setMotivo('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Excluir Chamado Permanentemente
          </DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir o chamado <strong>{protocolo}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-4">
            <p className="text-sm text-destructive font-medium mb-1">
              ⚠️ ATENÇÃO: Esta ação é irreversível!
            </p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Todo o histórico do chamado será excluído</li>
              <li>• Todos os atendimentos vinculados serão removidos</li>
              <li>• Sinistros vinculados serão desassociados</li>
              <li>• O chamado não aparecerá mais no sistema</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo da exclusão *</Label>
            <Textarea
              id="motivo"
              placeholder="Descreva o motivo desta exclusão (mínimo 5 caracteres)..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              disabled={loading}
            />
            {motivo.length > 0 && motivo.length < 5 && (
              <p className="text-xs text-destructive">Mínimo de 5 caracteres</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading || motivo.trim().length < 5}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Excluir Permanentemente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
