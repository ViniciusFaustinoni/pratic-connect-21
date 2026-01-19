import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MOTIVOS_RECUSA = [
  { value: 'condicoes_precarias', label: 'Condições precárias do veículo' },
  { value: 'danos_estruturais', label: 'Danos estruturais identificados' },
  { value: 'adulteracoes', label: 'Adulterações ou modificações não autorizadas' },
  { value: 'quilometragem_adulterada', label: 'Quilometragem possivelmente adulterada' },
  { value: 'documentacao_irregular', label: 'Documentação irregular' },
  { value: 'chassi_divergente', label: 'Chassi divergente do documento' },
  { value: 'sinais_sinistro', label: 'Sinais de sinistro anterior não declarado' },
  { value: 'sistema_eletrico', label: 'Sistema elétrico comprometido' },
  { value: 'outro', label: 'Outro motivo' },
];

interface ModalRecusaVeiculoProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (motivo: string, detalhes: string) => void;
  isPending?: boolean;
  veiculoInfo?: {
    placa?: string;
    modelo?: string;
  };
}

export function ModalRecusaVeiculo({
  open,
  onClose,
  onConfirm,
  isPending = false,
  veiculoInfo,
}: ModalRecusaVeiculoProps) {
  const [motivoSelecionado, setMotivoSelecionado] = useState<string>('');
  const [detalhes, setDetalhes] = useState('');

  const handleConfirm = () => {
    const motivo = MOTIVOS_RECUSA.find(m => m.value === motivoSelecionado)?.label || motivoSelecionado;
    const motivoCompleto = detalhes ? `${motivo}: ${detalhes}` : motivo;
    onConfirm(motivoSelecionado, motivoCompleto);
  };

  const handleClose = () => {
    setMotivoSelecionado('');
    setDetalhes('');
    onClose();
  };

  const isValid = motivoSelecionado && (motivoSelecionado !== 'outro' || detalhes.trim().length > 10);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Recusar Veículo
          </DialogTitle>
          <DialogDescription>
            {veiculoInfo && (
              <span className="font-medium">
                {veiculoInfo.modelo} - {veiculoInfo.placa}
              </span>
            )}
            <br />
            Esta ação irá recusar o veículo e notificar o associado. O veículo não será ativado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo da Recusa *</Label>
            <Select value={motivoSelecionado} onValueChange={setMotivoSelecionado}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_RECUSA.map((motivo) => (
                  <SelectItem key={motivo.value} value={motivo.value}>
                    {motivo.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="detalhes">
              Detalhes {motivoSelecionado === 'outro' ? '*' : '(opcional)'}
            </Label>
            <Textarea
              id="detalhes"
              placeholder="Descreva detalhes adicionais sobre a recusa..."
              value={detalhes}
              onChange={(e) => setDetalhes(e.target.value)}
              rows={4}
            />
            {motivoSelecionado === 'outro' && detalhes.trim().length < 10 && (
              <p className="text-xs text-red-500">
                Detalhe o motivo com pelo menos 10 caracteres
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isValid || isPending}
          >
            {isPending ? 'Processando...' : 'Confirmar Recusa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
