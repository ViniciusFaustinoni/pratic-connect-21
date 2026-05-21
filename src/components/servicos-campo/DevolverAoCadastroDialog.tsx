import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, RotateCcw, Info } from 'lucide-react';
import { useDevolverAoCadastro } from '@/hooks/useDevolverAoCadastro';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contratoId: string;
  servicoLabel?: string;
  onSuccess?: () => void;
}

export function DevolverAoCadastroDialog({ open, onOpenChange, contratoId, servicoLabel, onSuccess }: Props) {
  const [motivo, setMotivo] = useState('');
  const mutation = useDevolverAoCadastro();

  const handle = async () => {
    try {
      await mutation.mutateAsync({ contrato_id: contratoId, motivo: motivo.trim() || undefined });
      setMotivo('');
      onOpenChange(false);
      onSuccess?.();
    } catch {/* toast no hook */}
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-amber-500" />
            Devolver ao Cadastro
          </DialogTitle>
          <DialogDescription>
            {servicoLabel ? `${servicoLabel} — ` : ''}envia o caso de volta para o Cadastro reavaliar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
          <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <span>
            Reverte a aprovação do Cadastro e reabre a cotação na fila de Aprovação do Cadastro.
            Use quando houver erro na documentação ou na decisão de Roubo &amp; Furto.
          </span>
        </div>

        <div className="space-y-2">
          <Label>Motivo (opcional)</Label>
          <Textarea
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex: foto da CNH ilegível, divergência de dados..."
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button onClick={handle} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Devolver ao Cadastro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
