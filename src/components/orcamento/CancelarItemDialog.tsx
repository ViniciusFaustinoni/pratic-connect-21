import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
  itemDescricao: string;
  saving?: boolean;
}

export function CancelarItemDialog({ open, onClose, onConfirm, itemDescricao, saving }: Props) {
  const [motivo, setMotivo] = useState('');

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setMotivo(''); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancelar Item</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Tem certeza que deseja cancelar <strong>"{itemDescricao}"</strong>?
          O item ficará visível mas não será contabilizado no total.
        </p>
        <div>
          <Label>Motivo do cancelamento *</Label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex: Peça não precisa ser trocada, apenas reparada com funilaria"
            rows={2}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onClose(); setMotivo(''); }}>Voltar</Button>
          <Button variant="destructive" onClick={() => { onConfirm(motivo); setMotivo(''); }} disabled={!motivo.trim() || saving}>
            {saving ? 'Cancelando...' : 'Confirmar Cancelamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
