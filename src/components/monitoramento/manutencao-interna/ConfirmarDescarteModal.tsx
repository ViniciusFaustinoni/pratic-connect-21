import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useDescartarRastreador, type ManutencaoInterna } from '@/hooks/useManutencaoInterna';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manutencao: ManutencaoInterna | null;
}

export function ConfirmarDescarteModal({ open, onOpenChange, manutencao }: Props) {
  const [motivo, setMotivo] = useState('');
  const mutation = useDescartarRastreador();

  const handleSubmit = async () => {
    if (!manutencao || !motivo) return;
    await mutation.mutateAsync({ manutencaoId: manutencao.id, motivo });
    onOpenChange(false);
  };

  if (!manutencao) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Descartar Rastreador</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Ação Irreversível</AlertTitle>
            <AlertDescription>
              O rastreador <strong>{manutencao.rastreador?.codigo}</strong> será BAIXADO permanentemente.
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label>Motivo do Descarte *</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Justifique o descarte..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={!motivo || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar Descarte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
