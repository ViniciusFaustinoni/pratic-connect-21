import { useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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

interface SuspenderAssociadoDialogProps {
  open: boolean;
  onClose: () => void;
  associadoNome: string;
  onConfirm: (motivo: string, observacoes?: string) => void;
  isLoading?: boolean;
}

const motivosOpcoes = [
  { value: 'inadimplencia', label: 'Inadimplência' },
  { value: 'solicitacao_associado', label: 'Solicitação do associado' },
  { value: 'documentacao_pendente', label: 'Documentação pendente' },
  { value: 'irregularidade_cadastral', label: 'Irregularidade cadastral' },
  { value: 'suspensao_temporaria', label: 'Suspensão temporária' },
  { value: 'outro', label: 'Outro motivo' },
];

export function SuspenderAssociadoDialog({
  open,
  onClose,
  associadoNome,
  onConfirm,
  isLoading = false,
}: SuspenderAssociadoDialogProps) {
  const [motivo, setMotivo] = useState<string>('');
  const [observacoes, setObservacoes] = useState('');

  const handleClose = () => {
    setMotivo('');
    setObservacoes('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo) return;
    
    const motivoLabel = motivosOpcoes.find(o => o.value === motivo)?.label || motivo;
    const motivoCompleto = observacoes 
      ? `${motivoLabel}: ${observacoes}` 
      : motivoLabel;
    
    onConfirm(motivoCompleto, observacoes);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Suspender Associado
          </DialogTitle>
          <DialogDescription>
            Suspender <strong>{associadoNome}</strong>? O associado perderá acesso aos benefícios até ser reativado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo da Suspensão *</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {motivosOpcoes.map((opcao) => (
                  <SelectItem key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Detalhes adicionais sobre a suspensão (opcional)"
              rows={3}
            />
          </div>

          <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3">
            <p className="text-sm text-yellow-800">
              <strong>Atenção:</strong> O associado será marcado como suspenso no sistema.
              Todos os veículos vinculados terão a proteção suspensa na plataforma de rastreamento.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-yellow-600 hover:bg-yellow-700"
              disabled={!motivo || isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Suspender
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
