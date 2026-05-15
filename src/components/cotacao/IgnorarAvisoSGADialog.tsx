import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useRegistrarAvisoSGA, type RegistrarAvisoInput } from '@/hooks/useRegistrarAvisoSGA';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dados do aviso a registrar */
  aviso: Omit<RegistrarAvisoInput, 'decisao' | 'motivo'>;
  /** Texto do botão de confirmar (default: "Ignorar e Prosseguir") */
  confirmLabel?: string;
  /** Callback chamado após registrar com sucesso a decisão */
  onConfirm: () => void;
  /** Tornar o motivo obrigatório (default true) */
  motivoObrigatorio?: boolean;
}

/**
 * Diálogo padronizado para o usuário ignorar um aviso SGA e prosseguir.
 * Sempre registra a decisão na tabela `cotacao_avisos_sga` para auditoria
 * e posterior envio no campo `observacao` do veículo SGA.
 */
export function IgnorarAvisoSGADialog({
  open,
  onOpenChange,
  aviso,
  confirmLabel = 'Ignorar e Prosseguir',
  onConfirm,
  motivoObrigatorio = true,
}: Props) {
  const [motivo, setMotivo] = useState('');
  const registrar = useRegistrarAvisoSGA();

  const handleConfirm = async () => {
    if (motivoObrigatorio && motivo.trim().length < 5) {
      toast.error('Informe um motivo (mínimo 5 caracteres) para registrar a decisão.');
      return;
    }
    try {
      await registrar.mutateAsync({
        ...aviso,
        decisao: 'ignorado_prosseguiu',
        motivo: motivo.trim() || undefined,
      });
      toast.success('Decisão registrada. Histórico será enviado ao SGA junto com o veículo.');
      setMotivo('');
      onOpenChange(false);
      onConfirm();
    } catch (e: any) {
      console.error('[IgnorarAvisoSGADialog] erro ao registrar:', e);
      toast.error('Não foi possível registrar a decisão. Tente novamente.');
    }
  };

  const handleCancel = async () => {
    // Auditoria opcional: registrar que o usuário viu e cancelou.
    try {
      await registrar.mutateAsync({
        ...aviso,
        decisao: 'cancelou',
        motivo: motivo.trim() || undefined,
      });
    } catch {
      // não bloqueia
    }
    setMotivo('');
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {aviso.titulo}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            {aviso.mensagem && <p>{aviso.mensagem}</p>}
            <p className="text-xs text-muted-foreground">
              Toda decisão é registrada para auditoria e o histórico completo será enviado
              no campo <strong>observação</strong> do veículo no SGA.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="motivo-aviso-sga">
            Justificativa {motivoObrigatorio && <span className="text-destructive">*</span>}
          </Label>
          <Textarea
            id="motivo-aviso-sga"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: associado regularizou no SGA externamente / autorizado pelo gestor / …"
            rows={3}
            maxLength={500}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" onClick={handleCancel} disabled={registrar.isPending}>
              Cancelar
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={registrar.isPending}
            >
              {registrar.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registrando…
                </>
              ) : (
                confirmLabel
              )}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
