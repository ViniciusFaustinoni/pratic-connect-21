import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MOTIVO_PERDA_LABELS, type MotivoPerda, type EtapaLead } from '@/types/database';
import { useChangeLeadEtapa } from '@/hooks/useLeadHistorico';
import { toast } from 'sonner';

interface LeadLossDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadNome: string;
  etapaAtual: EtapaLead;
  onSuccess?: () => void;
}

export function LeadLossDialog({
  open,
  onOpenChange,
  leadId,
  leadNome,
  etapaAtual,
  onSuccess,
}: LeadLossDialogProps) {
  const [motivoPerda, setMotivoPerda] = useState<MotivoPerda | ''>('');
  const [observacaoPerda, setObservacaoPerda] = useState('');
  
  const changeEtapa = useChangeLeadEtapa();

  const handleConfirm = async () => {
    if (!motivoPerda) {
      toast.error('Selecione o motivo da perda');
      return;
    }

    try {
      await changeEtapa.mutateAsync({
        leadId,
        etapaAnterior: etapaAtual,
        etapaNova: 'perdido',
        motivoPerda,
        observacaoPerda: observacaoPerda || undefined,
      });

      toast.success('Lead marcado como perdido');
      onOpenChange(false);
      setMotivoPerda('');
      setObservacaoPerda('');
      onSuccess?.();
    } catch (error) {
      toast.error('Erro ao marcar lead como perdido');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setMotivoPerda('');
    setObservacaoPerda('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Motivo da Perda</DialogTitle>
          <DialogDescription>
            Informe o motivo pelo qual o lead <strong>{leadNome}</strong> foi perdido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo *</Label>
            <Select
              value={motivoPerda}
              onValueChange={(value) => setMotivoPerda(value as MotivoPerda)}
            >
              <SelectTrigger id="motivo">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(MOTIVO_PERDA_LABELS) as MotivoPerda[]).map((motivo) => (
                  <SelectItem key={motivo} value={motivo}>
                    {MOTIVO_PERDA_LABELS[motivo]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              value={observacaoPerda}
              onChange={(e) => setObservacaoPerda(e.target.value)}
              placeholder="Detalhes adicionais sobre a perda..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!motivoPerda || changeEtapa.isPending}
          >
            {changeEtapa.isPending ? 'Salvando...' : 'Confirmar Perda'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
