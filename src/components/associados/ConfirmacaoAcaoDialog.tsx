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
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmacaoAcaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  acao: 'bloquear' | 'suspender' | 'cancelar' | 'excluir';
  nomeAssociado: string;
  onConfirm: (motivo: string) => Promise<void>;
}

const acaoConfig = {
  bloquear: {
    titulo: 'Bloquear Associado',
    descricao: 'O associado não terá acesso aos serviços enquanto estiver bloqueado.',
    botao: 'Bloquear',
    cor: 'bg-red-600 hover:bg-red-700',
  },
  suspender: {
    titulo: 'Suspender Associado',
    descricao: 'O associado ficará com os serviços suspensos temporariamente.',
    botao: 'Suspender',
    cor: 'bg-orange-600 hover:bg-orange-700',
  },
  cancelar: {
    titulo: 'Cancelar Associado',
    descricao: 'Esta ação encerra o vínculo do associado. O histórico será mantido.',
    botao: 'Cancelar Associado',
    cor: 'bg-destructive hover:bg-destructive/90',
  },
  excluir: {
    titulo: 'Excluir Associado Permanentemente',
    descricao: 'ATENÇÃO: Esta ação é irreversível! O associado e todos os seus dados serão excluídos permanentemente do sistema.',
    botao: 'Excluir Permanentemente',
    cor: 'bg-destructive hover:bg-destructive/90',
  },
};

export function ConfirmacaoAcaoDialog({
  open,
  onOpenChange,
  acao,
  nomeAssociado,
  onConfirm,
}: ConfirmacaoAcaoDialogProps) {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const config = acaoConfig[acao];

  const handleConfirm = async () => {
    if (!motivo.trim()) return;
    
    setLoading(true);
    try {
      await onConfirm(motivo);
      setMotivo('');
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setMotivo('');
      onOpenChange(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {config.titulo}
          </DialogTitle>
          <DialogDescription>
            Tem certeza que deseja {acao} o associado <strong>{nomeAssociado}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            {config.descricao}
          </p>

          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo *</Label>
            <Textarea
              id="motivo"
              placeholder="Descreva o motivo desta ação..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              disabled={loading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Voltar
          </Button>
          <Button
            className={config.cor}
            onClick={handleConfirm}
            disabled={loading || !motivo.trim()}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {config.botao}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
