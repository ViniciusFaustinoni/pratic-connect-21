import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';
import { 
  ETAPA_LABELS, 
  ETAPA_COLORS,
  ETAPAS_TODAS,
} from '@/types/vendas';
import type { EtapaLead } from '@/types/vendas';

interface MoverEtapaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadNome: string;
  etapaAtual: EtapaLead;
  onMover: (novaEtapa: EtapaLead, observacao: string, motivoPerda?: string) => Promise<void>;
  isMoving?: boolean;
}

export function MoverEtapaModal({
  open,
  onOpenChange,
  leadNome,
  etapaAtual,
  onMover,
  isMoving = false,
}: MoverEtapaModalProps) {
  const [novaEtapa, setNovaEtapa] = useState<EtapaLead | ''>('');
  const [observacao, setObservacao] = useState('');
  const [motivoPerda, setMotivoPerda] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setNovaEtapa('');
      setObservacao('');
      setMotivoPerda('');
    }
  }, [open]);

  // Etapas disponíveis (exceto a atual)
  const etapasDisponiveis = ETAPAS_TODAS.filter(e => e !== etapaAtual);

  const handleMover = async () => {
    if (!novaEtapa) return;
    await onMover(novaEtapa, observacao, novaEtapa === 'perdido' ? motivoPerda : undefined);
  };

  const handleClose = () => {
    setNovaEtapa('');
    setObservacao('');
    setMotivoPerda('');
    onOpenChange(false);
  };

  const isPerdido = novaEtapa === 'perdido';
  const canSubmit = novaEtapa && (!isPerdido || motivoPerda.length >= 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mover Lead de Etapa</DialogTitle>
          <DialogDescription>
            {leadNome}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Visualização da transição */}
          <div className="flex items-center justify-center gap-3">
            <Badge className={ETAPA_COLORS[etapaAtual]}>
              {ETAPA_LABELS[etapaAtual]}
            </Badge>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            {novaEtapa ? (
              <Badge className={ETAPA_COLORS[novaEtapa]}>
                {ETAPA_LABELS[novaEtapa]}
              </Badge>
            ) : (
              <span className="text-sm text-muted-foreground">Selecione</span>
            )}
          </div>

          {/* Select nova etapa */}
          <div className="space-y-2">
            <Label>Nova etapa *</Label>
            <Select value={novaEtapa} onValueChange={(v) => setNovaEtapa(v as EtapaLead)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a nova etapa" />
              </SelectTrigger>
              <SelectContent>
                {etapasDisponiveis.map((etapa) => (
                  <SelectItem key={etapa} value={etapa}>
                    {ETAPA_LABELS[etapa]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Motivo da perda (condicional) */}
          {isPerdido && (
            <div className="space-y-2">
              <Label>Motivo da perda *</Label>
              <Textarea
                placeholder="Descreva o motivo da perda do lead..."
                value={motivoPerda}
                onChange={(e) => setMotivoPerda(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo 10 caracteres ({motivoPerda.length}/10)
              </p>
            </div>
          )}

          {/* Observação */}
          <div className="space-y-2">
            <Label>Observação (opcional)</Label>
            <Textarea
              placeholder="Adicione uma observação sobre esta movimentação..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isMoving}>
            Cancelar
          </Button>
          <Button 
            onClick={handleMover} 
            disabled={!canSubmit || isMoving}
          >
            {isMoving ? 'Movendo...' : 'Mover Lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
