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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, AlertCircle } from 'lucide-react';

export interface CampoAlterado {
  campo: string;
  label: string;
  antes: string;
  depois: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alteracoes: CampoAlterado[];
  isPending: boolean;
  onConfirm: (motivo: string) => Promise<void> | void;
}

export function AssociadoEditConfirmDialog({
  open,
  onOpenChange,
  alteracoes,
  isPending,
  onConfirm,
}: Props) {
  const [motivo, setMotivo] = useState('');
  const motivoValido = motivo.trim().length >= 5;

  const handleConfirm = async () => {
    if (!motivoValido) return;
    await onConfirm(motivo.trim());
    setMotivo('');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!isPending) {
          if (!o) setMotivo('');
          onOpenChange(o);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirmar alterações</DialogTitle>
          <DialogDescription>
            Revise os campos alterados e informe o motivo. A alteração ficará registrada no histórico do associado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">
              {alteracoes.length} {alteracoes.length === 1 ? 'campo alterado' : 'campos alterados'}
            </Label>
            <ScrollArea className="max-h-[240px] mt-2 rounded-md border">
              <div className="divide-y">
                {alteracoes.map((a) => (
                  <div key={a.campo} className="px-3 py-2 text-sm">
                    <div className="font-medium">{a.label}</div>
                    <div className="mt-1 flex flex-col gap-0.5 text-xs">
                      <span className="text-muted-foreground">
                        de: <span className="text-foreground">{a.antes || '—'}</span>
                      </span>
                      <span className="text-muted-foreground">
                        para: <span className="text-foreground font-medium">{a.depois || '—'}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div>
            <Label htmlFor="motivo">
              Motivo da alteração <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: Cliente solicitou atualização do telefone via WhatsApp em 18/05/2026."
              rows={3}
              maxLength={500}
              disabled={isPending}
            />
            {!motivoValido && motivo.length > 0 && (
              <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" /> Informe ao menos 5 caracteres.
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {motivo.length}/500 caracteres
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Voltar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!motivoValido || isPending}
          >
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
