import { CheckCircle2, Clock, Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatarMinutos } from '@/hooks/useJornadaTrabalho';

interface TurnoData {
  minutos_trabalhados: number;
  minutos_extras: number;
  minutos_faltantes: number;
  saldo_anterior_minutos: number;
}

interface ModalResumoDiaProps {
  open: boolean;
  onClose: () => void;
  turno: TurnoData | null;
  servicosConcluidos: number;
  servicosRecusados: number;
  exibirSaldoAcumulado: boolean;
}

export function ModalResumoDia({
  open,
  onClose,
  turno,
  servicosConcluidos,
  servicosRecusados,
  exibirSaldoAcumulado,
}: ModalResumoDiaProps) {
  if (!turno) return null;

  const saldoTurno = (turno.minutos_extras || 0) - (turno.minutos_faltantes || 0);
  const saldoAcumulado = (turno.saldo_anterior_minutos || 0) + saldoTurno;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-sm"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        // Hide the default close button by covering with our own layout
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="items-center">
          <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center mb-2">
            <CheckCircle2 className="h-8 w-8 text-green-400" />
          </div>
          <DialogTitle className="text-xl">Turno encerrado ✓</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Seu dia em números */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Seu dia em números
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <Clock className="h-4 w-4 mx-auto mb-1 text-blue-400" />
                <p className="text-lg font-bold">{formatarMinutos(turno.minutos_trabalhados || 0)}</p>
                <p className="text-xs text-muted-foreground">Trabalhadas</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <Target className="h-4 w-4 mx-auto mb-1 text-green-400" />
                <p className="text-lg font-bold">{servicosConcluidos}</p>
                <p className="text-xs text-muted-foreground">Serviços concluídos</p>
              </div>
            </div>
            {servicosRecusados > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {servicosRecusados} serviço(s) recusado(s)
              </p>
            )}
          </div>

          {/* Saldo do turno */}
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Saldo do turno
            </h3>
            <div className={`rounded-lg p-3 text-center ${
              saldoTurno > 0
                ? 'bg-green-500/10 border border-green-500/20'
                : saldoTurno < 0
                ? 'bg-red-500/10 border border-red-500/20'
                : 'bg-muted/50'
            }`}>
              <div className="flex items-center justify-center gap-2">
                {saldoTurno > 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-400" />
                ) : saldoTurno < 0 ? (
                  <TrendingDown className="h-5 w-5 text-red-400" />
                ) : (
                  <Minus className="h-5 w-5 text-muted-foreground" />
                )}
                <span className={`text-lg font-bold ${
                  saldoTurno > 0 ? 'text-green-400' : saldoTurno < 0 ? 'text-red-400' : ''
                }`}>
                  {saldoTurno > 0
                    ? `+ ${formatarMinutos(saldoTurno)} de crédito`
                    : saldoTurno < 0
                    ? `- ${formatarMinutos(Math.abs(saldoTurno))} de débito`
                    : 'Jornada cumprida exatamente'}
                </span>
              </div>
            </div>
          </div>

          {/* Saldo acumulado */}
          {exibirSaldoAcumulado && (
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Saldo acumulado
              </h3>
              <p className={`text-center text-sm font-medium ${
                saldoAcumulado > 0 ? 'text-green-400' : saldoAcumulado < 0 ? 'text-red-400' : 'text-muted-foreground'
              }`}>
                {saldoAcumulado > 0
                  ? `+ ${formatarMinutos(saldoAcumulado)} de crédito total`
                  : saldoAcumulado < 0
                  ? `- ${formatarMinutos(Math.abs(saldoAcumulado))} de débito total`
                  : 'Saldo zerado'}
              </p>
            </div>
          )}
        </div>

        <Button onClick={onClose} className="w-full mt-4">
          Entendido
        </Button>
      </DialogContent>
    </Dialog>
  );
}
