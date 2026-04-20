import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Lock, Unlock, Loader2 } from 'lucide-react';
import { useBloquearData, useDesbloquearData } from '@/hooks/useDatasBloqueadas';

interface BloquearDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: string; // yyyy-MM-dd
  bloqueada: boolean;
  motivoAtual?: string;
}

export function BloquearDataDialog({
  open,
  onOpenChange,
  data,
  bloqueada,
  motivoAtual,
}: BloquearDataDialogProps) {
  const [motivo, setMotivo] = useState('');
  const bloquearMutation = useBloquearData();
  const desbloquearMutation = useDesbloquearData();

  useEffect(() => {
    if (open) setMotivo('');
  }, [open]);

  const dataFormatada = data
    ? format(parseISO(data), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : '';

  const handleConfirm = async () => {
    if (bloqueada) {
      await desbloquearMutation.mutateAsync(data);
    } else {
      if (motivo.trim().length < 3) return;
      await bloquearMutation.mutateAsync({ data, motivo: motivo.trim() });
    }
    onOpenChange(false);
  };

  const isPending = bloquearMutation.isPending || desbloquearMutation.isPending;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {bloqueada ? (
              <>
                <Unlock className="h-5 w-5 text-primary" />
                Desbloquear data
              </>
            ) : (
              <>
                <Lock className="h-5 w-5 text-destructive" />
                Bloquear data
              </>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription className="capitalize">
            {dataFormatada}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {bloqueada ? (
          <div className="space-y-3">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Ao desbloquear, esta data voltará a aceitar novos agendamentos.
              </AlertDescription>
            </Alert>
            {motivoAtual && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <span className="font-medium">Motivo atual:</span> {motivoAtual}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Novos agendamentos (associados e atribuições manuais) serão recusados nesta data.
                Agendamentos já existentes <strong>não</strong> serão cancelados automaticamente —
                reagende manualmente se necessário.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="motivo">
                Motivo do bloqueio <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="motivo"
                placeholder="Ex: Feriado municipal, treinamento da equipe, manutenção da base..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                maxLength={280}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo 3 caracteres • {motivo.length}/280
              </p>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={isPending || (!bloqueada && motivo.trim().length < 3)}
            className={bloqueada ? '' : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {bloqueada ? 'Desbloquear data' : 'Bloquear data'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
