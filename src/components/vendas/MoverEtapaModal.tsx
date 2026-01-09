import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  hasVeiculo?: boolean;
}

export function MoverEtapaModal({
  open,
  onOpenChange,
  leadNome,
  etapaAtual,
  onMover,
  isMoving = false,
  hasVeiculo = false,
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

  // Verificar se etapa requer veículo
  const isQualificadoSemVeiculo = novaEtapa === 'qualificado' && !hasVeiculo;

  const handleMover = async () => {
    if (!novaEtapa) return;
    if (isQualificadoSemVeiculo) return;
    await onMover(novaEtapa, observacao, novaEtapa === 'perdido' ? motivoPerda : undefined);
  };

  const handleClose = () => {
    setNovaEtapa('');
    setObservacao('');
    setMotivoPerda('');
    onOpenChange(false);
  };

  const isPerdido = novaEtapa === 'perdido';
  const canSubmit = novaEtapa && (!isPerdido || motivoPerda.length >= 10) && !isQualificadoSemVeiculo;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mover Lead</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Info do lead com fundo destacado */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm">
              <span className="text-muted-foreground">Lead:</span>{' '}
              <span className="font-medium">{leadNome}</span>
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Etapa atual:</span>
              <Badge className={ETAPA_COLORS[etapaAtual]}>
                {ETAPA_LABELS[etapaAtual]}
              </Badge>
            </div>
          </div>

          {/* RadioGroup para nova etapa */}
          <div className="space-y-3">
            <Label>Nova etapa:</Label>
            <RadioGroup 
              value={novaEtapa} 
              onValueChange={(v) => setNovaEtapa(v as EtapaLead)}
              className="space-y-2"
            >
              {etapasDisponiveis.map((etapa) => (
                <div key={etapa} className="flex items-center space-x-3">
                  <RadioGroupItem value={etapa} id={etapa} />
                  <Label htmlFor={etapa} className="cursor-pointer font-normal">
                    {ETAPA_LABELS[etapa]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Alerta: precisa de veículo para qualificar */}
          {isQualificadoSemVeiculo && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                ⚠️ Para mover para <strong>Qualificado</strong>, é necessário preencher os dados do veículo primeiro.
              </p>
            </div>
          )}

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
              placeholder="Ex: Cliente pediu mais tempo para pensar..."
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
            {isMoving ? 'Movendo...' : 'Mover'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}