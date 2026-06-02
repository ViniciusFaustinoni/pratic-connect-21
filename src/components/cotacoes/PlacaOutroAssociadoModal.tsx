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
      <AlertDialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl p-0 overflow-hidden gap-0 border-destructive/40 shadow-2xl shadow-destructive/20 ring-1 ring-destructive/30">
        {/* Faixa de alerta */}
        <div className="h-1.5 w-full bg-destructive" />

        <AlertDialogHeader className="space-y-0 p-6 pb-5 bg-destructive/5">
          <div className="flex items-start gap-4">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg shadow-destructive/30">
              <AlertTriangle className="h-6 w-6" />
              <span className="absolute inset-0 rounded-full bg-destructive/40 animate-ping" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-widest text-destructive mb-1">
                Atenção · Placa bloqueada
              </div>
              <AlertDialogTitle className="text-xl font-bold leading-tight text-foreground">
                Esta placa já pertence a outro associado
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-2 text-sm text-muted-foreground leading-relaxed">
                A placa{' '}
                <span className="font-mono font-bold text-foreground bg-destructive/10 px-1.5 py-0.5 rounded border border-destructive/30">
                  {placa.toUpperCase()}
                </span>{' '}
                não pode ser usada em uma cotação de{' '}
                <strong className="text-foreground">adesão</strong>.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="px-6 py-5 space-y-4 text-sm border-t border-border/60">
          <div className="rounded-lg border-2 border-border bg-muted/40 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Titular atual
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background border border-border">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground truncate">{info.associadoNome}</span>
                  {info.status && (
                    <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                      {info.status}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  CPF: <span className="font-mono">{info.cpfMascarado}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-foreground/90 leading-relaxed">
            Se o veículo está sendo transferido para um novo titular, use o fluxo de{' '}
            <strong className="text-destructive">Troca de Titularidade</strong>. Caso contrário, verifique se a placa foi digitada corretamente.
          </div>
        </div>

        <AlertDialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 px-6 py-4 border-t border-border/60 bg-muted/30">
          <AlertDialogCancel className="mt-0 w-full sm:w-auto">Cancelar</AlertDialogCancel>
          <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
            {onIgnorarEProsseguir && (
              <Button
                variant="outline"
                className="w-full sm:w-auto border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setShowBypass(true)}
              >
                Ignorar e prosseguir
              </Button>
            )}
            <AlertDialogAction onClick={irParaTroca} className="w-full sm:w-auto gap-2 whitespace-nowrap shadow-md">
              <ArrowRightLeft className="h-4 w-4" />
              Iniciar Troca de Titularidade
            </AlertDialogAction>
          </div>
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
