import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const MOTIVOS_RECUSA = [
  'Acidente ou emergência pessoal',
  'Veículo quebrado ou sinistro',
  'Problema de saúde',
  'Outro imprevisto grave',
] as const;

interface ModalRecusaTarefaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (motivo: string, motivoLivre?: string) => void;
  isPending: boolean;
}

export function ModalRecusaTarefa({ open, onOpenChange, onConfirm, isPending }: ModalRecusaTarefaProps) {
  const [motivo, setMotivo] = useState('');
  const [motivoLivre, setMotivoLivre] = useState('');

  const handleConfirm = () => {
    if (!motivo) return;
    onConfirm(motivo, motivo === 'Outro motivo' ? motivoLivre : undefined);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setMotivo('');
      setMotivoLivre('');
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recusar Tarefa</DialogTitle>
          <DialogDescription>
            Selecione o motivo da recusa. Essa informação será registrada para o coordenador.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={motivo} onValueChange={setMotivo} className="space-y-2">
          {MOTIVOS_RECUSA.map((m) => (
            <div key={m} className="flex items-center space-x-2">
              <RadioGroupItem value={m} id={`motivo-${m}`} />
              <Label htmlFor={`motivo-${m}`} className="cursor-pointer text-sm">{m}</Label>
            </div>
          ))}
        </RadioGroup>

        {motivo === 'Outro motivo' && (
          <Textarea
            placeholder="Descreva o motivo..."
            value={motivoLivre}
            onChange={(e) => setMotivoLivre(e.target.value)}
            rows={3}
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!motivo || isPending || (motivo === 'Outro motivo' && !motivoLivre.trim())}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Confirmar Recusa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
