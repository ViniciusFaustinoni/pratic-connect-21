import { useState } from 'react';
import { XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  MOTIVO_REPROVACAO_DOCUMENTO_LABELS, 
  type MotivoReprovacaoDocumento 
} from '@/types/database';

interface DocumentoReprovacaoDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (motivo: string, observacao: string) => Promise<void>;
  isLoading?: boolean;
}

export function DocumentoReprovacaoDialog({
  open,
  onClose,
  onConfirm,
  isLoading = false,
}: DocumentoReprovacaoDialogProps) {
  const [motivo, setMotivo] = useState<MotivoReprovacaoDocumento | ''>('');
  const [observacao, setObservacao] = useState('');

  const handleConfirm = async () => {
    if (!motivo) return;
    
    const motivoLabel = MOTIVO_REPROVACAO_DOCUMENTO_LABELS[motivo];
    await onConfirm(motivoLabel, observacao);
    
    // Reset form
    setMotivo('');
    setObservacao('');
  };

  const handleClose = () => {
    setMotivo('');
    setObservacao('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Reprovar Documento
          </DialogTitle>
          <DialogDescription>
            Selecione o motivo da reprovação. O associado será notificado para reenviar o documento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo da Reprovação *</Label>
            <Select value={motivo} onValueChange={(value) => setMotivo(value as MotivoReprovacaoDocumento)}>
              <SelectTrigger id="motivo">
                <SelectValue placeholder="Selecione o motivo..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MOTIVO_REPROVACAO_DOCUMENTO_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observação */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="observacao">Observação (opcional)</Label>
              <span className="text-xs text-muted-foreground">
                {observacao.length}/500
              </span>
            </div>
            <Textarea
              id="observacao"
              placeholder="Descreva o problema encontrado..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value.slice(0, 500))}
              rows={4}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm}
            disabled={!motivo || isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Reprovação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
