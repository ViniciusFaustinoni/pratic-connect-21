import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const motivosCancelamento = [
  { value: 'desistencia', label: 'Desistência do associado' },
  { value: 'erro', label: 'Erro no cadastro' },
  { value: 'renegociacao', label: 'Renegociação em novo acordo' },
  { value: 'outro', label: 'Outro' }
];

interface CancelarAcordoModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
}

export function CancelarAcordoModal({ open, onClose, onConfirm }: CancelarAcordoModalProps) {
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');

  const handleConfirm = () => {
    const motivoFinal = observacao
      ? `${motivosCancelamento.find(m => m.value === motivo)?.label} - ${observacao}`
      : motivosCancelamento.find(m => m.value === motivo)?.label || motivo;
    onConfirm(motivoFinal);
    setMotivo('');
    setObservacao('');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar Acordo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Esta ação não pode ser desfeita. Os boletos originais não serão restaurados automaticamente.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Motivo do Cancelamento</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {motivosCancelamento.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observação (opcional)</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Detalhes adicionais..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Voltar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!motivo}>
            Confirmar Cancelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
