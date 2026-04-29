import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldOff, AlertTriangle, Loader2 } from 'lucide-react';
import { useSuspenderPorNaoInstalacao } from '@/hooks/useSuspenderPorNaoInstalacao';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contratoId: string;
  placa?: string | null;
}

export function SuspenderPorNaoInstalacaoDialog({ open, onOpenChange, contratoId, placa }: Props) {
  const [motivo, setMotivo] = useState('');
  const suspender = useSuspenderPorNaoInstalacao();

  const handleConfirm = async () => {
    try {
      await suspender.mutateAsync({ contrato_id: contratoId, motivo: motivo.trim() || undefined });
      setMotivo('');
      onOpenChange(false);
    } catch {
      // toast tratado no hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setMotivo(''); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldOff className="h-5 w-5 text-destructive" />
            Suspender por não instalação
          </DialogTitle>
          <DialogDescription>
            Marca a cobertura do veículo {placa ? <strong>{placa}</strong> : 'selecionado'} como suspensa porque a instalação do rastreador não foi realizada no prazo.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-amber-500/40 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm">
            O associado será notificado por WhatsApp e a cobertura só voltará automaticamente após a instalação concluída.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="motivo-suspensao">Motivo / observação (opcional)</Label>
          <Textarea
            id="motivo-suspensao"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: cliente não respondeu tentativas de agendamento..."
            rows={3}
            maxLength={500}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={suspender.isPending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={suspender.isPending}>
            {suspender.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Suspendendo...</>
            ) : (
              <><ShieldOff className="h-4 w-4 mr-2" />Confirmar suspensão</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
