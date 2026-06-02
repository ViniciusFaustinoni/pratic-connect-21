import { useState } from 'react';
import { AlertTriangle, ArrowRightLeft, User } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PlacaOutroAssociadoInfo } from '@/hooks/useVerificarPlacaOutroAssociado';
import { useNavigate } from 'react-router-dom';
import { IgnorarAvisoSGADialog } from '@/components/cotacoes/IgnorarAvisoSGADialog';

interface PlacaOutroAssociadoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placa: string;
  info: PlacaOutroAssociadoInfo | null;
  /** Quando definido, exibe botão "Ignorar e Prosseguir" */
  onIgnorarEProsseguir?: () => void;
}

export function PlacaOutroAssociadoModal({
  open,
  onOpenChange,
  placa,
  info,
  onIgnorarEProsseguir,
}: PlacaOutroAssociadoModalProps) {
  const navigate = useNavigate();
  const [showBypass, setShowBypass] = useState(false);
  if (!info || !info.conflito) return null;

  const irParaTroca = () => {
    onOpenChange(false);
    if (info.associadoId) {
      navigate(`/cadastro/associados/${info.associadoId}`);
    } else {
      navigate('/cobranca/troca-titularidade');
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg p-0 overflow-hidden gap-0">
        <AlertDialogHeader className="space-y-0 p-6 pb-4 border-b border-border/60">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <AlertDialogTitle className="text-base font-semibold leading-tight">
                Placa já pertence a outro associado
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-1 text-sm text-muted-foreground">
                A placa <span className="font-mono font-semibold text-foreground">{placa.toUpperCase()}</span> não pode ser usada em uma cotação de <strong className="text-foreground">adesão</strong>.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="px-6 py-4 space-y-4 text-sm">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
              Titular atual
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-background border border-border/60">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <span className="font-medium text-foreground truncate">{info.associadoNome}</span>
              {info.status && (
                <Badge variant="outline" className="text-[10px] uppercase">
                  {info.status}
                </Badge>
              )}
            </div>
            <div className="mt-2 pl-9 text-xs text-muted-foreground">
              CPF: <span className="font-mono">{info.cpfMascarado}</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Se o veículo está sendo transferido para um novo titular, use o fluxo de{' '}
            <strong className="text-foreground">Troca de Titularidade</strong>. Caso contrário, verifique se a placa foi digitada corretamente.
          </p>
        </div>

        <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-border/60 bg-muted/20">
          <AlertDialogCancel className="mt-0 sm:mr-auto">Cancelar</AlertDialogCancel>
          {onIgnorarEProsseguir && (
            <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setShowBypass(true)}>
              Ignorar e prosseguir
            </Button>
          )}
          <AlertDialogAction onClick={irParaTroca} className="gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Iniciar Troca de Titularidade
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>

      {onIgnorarEProsseguir && (
        <IgnorarAvisoSGADialog
          open={showBypass}
          onOpenChange={setShowBypass}
          aviso={{
            tipo: 'placa_outro_associado_local',
            titulo: 'Placa pertence a outro associado',
            mensagem: `A placa ${placa.toUpperCase()} já está vinculada ao associado ${info.associadoNome} (${info.cpfMascarado}).`,
            placa,
            detalhes: { associadoNome: info.associadoNome, status: info.status, associadoId: info.associadoId },
          }}
          onConfirm={() => {
            onOpenChange(false);
            onIgnorarEProsseguir();
          }}
        />
      )}
    </AlertDialog>
  );
}
