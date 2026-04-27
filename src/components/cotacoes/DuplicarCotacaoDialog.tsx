import { useEffect, useState } from 'react';
import { Loader2, FileText, AlertTriangle } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * Mantido como tipo para compatibilidade com chamadores existentes,
 * mas o fluxo agora SEMPRE marca a original como "substituída".
 * A exclusão física pelo fluxo de duplicação foi removida — era a
 * causa raiz do sumiço de cotações da tela do consultor.
 */
export type AcaoOriginal = 'excluir' | 'manter';

export interface DuplicarCotacaoConfirmPayload {
  motivo: string;
  acaoOriginal: AcaoOriginal;
}

interface CotacaoMinima {
  id: string;
  numero: string;
  vendedor_id: string | null;
  status: string;
}

interface DuplicarCotacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotacao: CotacaoMinima | null;
  vendedorOriginalNome?: string | null;
  /** ID do usuário logado (profile.id ou user.id usado em vendedor_id das cotações) */
  currentUserId: string | undefined;
  isSubmitting?: boolean;
  onConfirm: (payload: DuplicarCotacaoConfirmPayload) => void;
}

export function DuplicarCotacaoDialog({
  open,
  onOpenChange,
  cotacao,
  vendedorOriginalNome,
  currentUserId,
  isSubmitting,
  onConfirm,
}: DuplicarCotacaoDialogProps) {
  const isMesmoConsultor = !!cotacao && !!currentUserId && cotacao.vendedor_id === currentUserId;

  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (open) setMotivo('');
  }, [open, cotacao?.id]);

  const motivoValido = motivo.trim().length >= 3;
  const podeConfirmar = motivoValido && !isSubmitting;

  const handleConfirm = () => {
    if (!podeConfirmar) return;
    // Sempre "manter" — a original fica registrada como substituída.
    onConfirm({ motivo: motivo.trim(), acaoOriginal: 'manter' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Duplicar cotação{cotacao?.numero ? ` ${cotacao.numero}` : ''}</DialogTitle>
          <DialogDescription>
            A cotação original será mantida e marcada como <strong>substituída</strong>,
            preservando o histórico para auditoria. Uma nova cotação será criada para você ajustar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!isMesmoConsultor && vendedorOriginalNome && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Esta cotação pertence a <strong>{vendedorOriginalNome}</strong>. A correção será
                atribuída a você, e a original ficará marcada como <strong>substituída</strong>.
              </AlertDescription>
            </Alert>
          )}

          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription className="text-xs">
              A cotação original <strong>{cotacao?.numero}</strong> permanece pesquisável com o
              badge "Substituída por…". Isso evita que números compartilhados com clientes ou
              registrados no histórico desapareçam do sistema.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="motivo-correcao" className="text-sm font-medium">
              Motivo da correção <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="motivo-correcao"
              placeholder="Ex.: FIPE incorreto, plano trocado, dados do cliente errados…"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              Mínimo 3 caracteres. Ficará registrado no histórico da cotação substituída.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!podeConfirmar}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Duplicar e substituir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
