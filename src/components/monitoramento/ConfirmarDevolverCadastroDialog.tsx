import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Undo2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onConfirm: (motivo: string) => void;
}

export function ConfirmarDevolverCadastroDialog({ open, onOpenChange, isPending, onConfirm }: Props) {
  const [motivo, setMotivo] = useState('');

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isPending) onOpenChange(v); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Devolver ao Cadastro</DialogTitle>
          <DialogDescription className="leading-relaxed">
            O contrato volta para a fila do Cadastro para o analista aprovar
            <strong> Roubo & Furto</strong> via autovistoria enxuta. A instalação técnica
            do rastreador continua agendada — quando o técnico concluir, o caso retorna a
            esta fila para aprovação final.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">
            Motivo <span className="text-destructive">*</span>
            <span className="ml-1 text-xs">(obrigatório — fica registrado em auditoria)</span>
          </label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex: chegou cá sem instalação técnica concluída — devolvendo para o Cadastro liberar R&F."
            className="bg-muted/30 border-border"
            rows={3}
            disabled={isPending}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            className="bg-amber-500 hover:bg-amber-500/90 text-white"
            onClick={() => onConfirm(motivo.trim())}
            disabled={isPending || motivo.trim().length < 5}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Undo2 className="h-4 w-4 mr-2" />
            )}
            Devolver ao Cadastro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
