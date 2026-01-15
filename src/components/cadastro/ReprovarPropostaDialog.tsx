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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { XCircle, AlertTriangle } from 'lucide-react';

interface ReprovarPropostaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (motivo: string, justificativa: string) => void;
  loading?: boolean;
}

const MOTIVOS_REPROVACAO = [
  { id: 'dados_inconsistentes', label: 'Dados inconsistentes' },
  { id: 'veiculo_nao_elegivel', label: 'Veículo não elegível' },
  { id: 'cliente_restricao', label: 'Cliente com restrição' },
  { id: 'documentos_fraudulentos', label: 'Documentos fraudulentos' },
  { id: 'veiculo_sinistrado', label: 'Veículo sinistrado/recuperado' },
  { id: 'uso_comercial', label: 'Uso comercial não permitido' },
  { id: 'outro', label: 'Outro motivo' },
];

export function ReprovarPropostaDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
}: ReprovarPropostaDialogProps) {
  const [motivo, setMotivo] = useState('');
  const [justificativa, setJustificativa] = useState('');

  const handleConfirm = () => {
    if (!motivo || !justificativa.trim()) return;
    const motivoLabel = MOTIVOS_REPROVACAO.find((m) => m.id === motivo)?.label || motivo;
    onConfirm(motivoLabel, justificativa);
    // Reset form
    setMotivo('');
    setJustificativa('');
  };

  const handleClose = () => {
    setMotivo('');
    setJustificativa('');
    onOpenChange(false);
  };

  const isValid = motivo && justificativa.trim().length >= 10;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <XCircle className="h-5 w-5 text-destructive" />
            Reprovar Proposta
          </DialogTitle>
          <DialogDescription>
            Esta ação não pode ser desfeita. A proposta será marcada como reprovada.
          </DialogDescription>
        </DialogHeader>

        {/* Alerta */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-destructive">Atenção</p>
            <p className="text-muted-foreground">
              O cliente será notificado sobre a reprovação e o motivo informado.
            </p>
          </div>
        </div>

        <div className="space-y-4 py-2">
          {/* Seleção de motivo */}
          <div className="space-y-2">
            <Label htmlFor="motivo" className="text-foreground font-medium">
              Motivo da reprovação *
            </Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_REPROVACAO.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Justificativa detalhada */}
          <div className="space-y-2">
            <Label htmlFor="justificativa" className="text-foreground font-medium">
              Justificativa detalhada * <span className="text-muted-foreground font-normal">(mínimo 10 caracteres)</span>
            </Label>
            <Textarea
              id="justificativa"
              placeholder="Descreva detalhadamente o motivo da reprovação..."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              className="min-h-[120px] bg-background border-border"
            />
            <p className="text-xs text-muted-foreground">
              {justificativa.length}/10 caracteres
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-border"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid || loading}
            variant="destructive"
          >
            {loading ? 'Reprovando...' : 'Confirmar Reprovação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
