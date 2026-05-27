import { useState, useEffect } from 'react';
import { RotateCcw, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import type { DocumentoAnexadoCompleto } from '@/types/documentos';

const JUSTIFICATIVA_MIN = 10;

export type NovoStatusReversao = 'em_analise' | 'aprovado';

interface ReverterReprovacaoDocumentoDialogProps {
  documento: DocumentoAnexadoCompleto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (docId: string, novoStatus: NovoStatusReversao, justificativa: string) => Promise<void>;
}

export function ReverterReprovacaoDocumentoDialog({
  documento,
  open,
  onOpenChange,
  onConfirm,
}: ReverterReprovacaoDocumentoDialogProps) {
  const [justificativa, setJustificativa] = useState('');
  const [loading, setLoading] = useState<NovoStatusReversao | null>(null);

  useEffect(() => {
    if (!open) {
      setJustificativa('');
      setLoading(null);
    }
  }, [open]);

  if (!documento) return null;

  const podeConfirmar = justificativa.trim().length >= JUSTIFICATIVA_MIN && !loading;

  const handleConfirm = async (novoStatus: NovoStatusReversao) => {
    const j = justificativa.trim();
    if (j.length < JUSTIFICATIVA_MIN) {
      toast.error(`Justificativa precisa ter ao menos ${JUSTIFICATIVA_MIN} caracteres`);
      return;
    }
    setLoading(novoStatus);
    try {
      await onConfirm(documento.id, novoStatus, j);
      onOpenChange(false);
    } catch (e) {
      // toast tratado no handler
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-warning" />
            Reverter reprovação
          </DialogTitle>
          <DialogDescription>
            A reversão fica registrada no histórico do associado e nos logs de auditoria.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {documento.motivo_reprovacao && (
            <Alert className="border-destructive/40 bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-destructive text-xs">
                <span className="font-medium">Motivo original:</span> {documento.motivo_reprovacao}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="justificativa-reversao">
              Justificativa da reversão <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="justificativa-reversao"
              placeholder="Explique por que essa reprovação está sendo desfeita..."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={4}
              maxLength={1000}
              disabled={!!loading}
            />
            <p className="text-xs text-muted-foreground">
              Mínimo {JUSTIFICATIVA_MIN} caracteres. {justificativa.trim().length}/1000
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={!!loading}
          >
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={() => handleConfirm('em_analise')}
            disabled={!podeConfirmar}
            className="border-info/40 text-info hover:bg-info/10"
          >
            {loading === 'em_analise' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            Reverter para análise
          </Button>
          <Button
            onClick={() => handleConfirm('aprovado')}
            disabled={!podeConfirmar}
            className="bg-success text-success-foreground hover:bg-success/90"
          >
            {loading === 'aprovado' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Reverter e aprovar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
