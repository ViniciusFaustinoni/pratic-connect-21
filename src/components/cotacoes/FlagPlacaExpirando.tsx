import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, ExternalLink, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CancelarCotacaoDialog } from './CancelarCotacaoDialog';
import type { CotacaoWithRelations } from '@/hooks/useCotacoes';

interface FlagPlacaExpirandoProps {
  cotacao: CotacaoWithRelations;
  /** Tick do container para forçar recálculo periódico. */
  now?: Date;
  className?: string;
  /** Horas de alerta — quando faltarem ≤ N horas, começa a pulsar. Default 12h. */
  alertaHoras?: number;
}

/**
 * Bolinha pulsante âmbar/vermelha quando a reserva da placa está prestes a expirar.
 * Clique abre popup com contador, atalho para a cotação e botão "Cancelar cotação".
 * Não dispara WhatsApp — alerta puramente visual.
 */
export const FlagPlacaExpirando: React.FC<FlagPlacaExpirandoProps> = ({
  cotacao,
  now,
  className,
  alertaHoras = 12,
}) => {
  const navigate = useNavigate();
  const [openPopup, setOpenPopup] = useState(false);
  const [openCancelar, setOpenCancelar] = useState(false);

  const reservaAte = (cotacao as any).placa_reservada_ate as string | null | undefined;

  const info = useMemo(() => {
    if (!reservaAte) return null;
    if (!['rascunho', 'enviada', 'aceita'].includes(cotacao.status)) return null;
    const ref = now ?? new Date();
    const expira = new Date(reservaAte);
    const msRestantes = expira.getTime() - ref.getTime();
    if (msRestantes <= 0) return null;
    const horasRestantes = msRestantes / (1000 * 60 * 60);
    if (horasRestantes > alertaHoras) return null;
    const nivel: 'amber' | 'red' = horasRestantes <= 2 ? 'red' : 'amber';
    const totalMin = Math.floor(msRestantes / 60000);
    const hh = Math.floor(totalMin / 60);
    const mm = totalMin % 60;
    return {
      nivel,
      expira,
      contador: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
      horasRestantes,
    };
  }, [reservaAte, now, cotacao.status, alertaHoras]);

  if (!info) return null;

  const cor =
    info.nivel === 'red'
      ? { dot: 'bg-red-500', ping: 'bg-red-500' }
      : { dot: 'bg-amber-500', ping: 'bg-amber-500' };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenPopup(true);
  };

  const handleAbrir = () => {
    setOpenPopup(false);
    navigate(`/vendas/cotacoes?cotacaoId=${cotacao.id}`);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Reserva da placa prestes a expirar"
        onClick={handleClick}
        className={cn(
          'relative inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center cursor-pointer',
          className,
        )}
      >
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping',
            cor.ping,
          )}
        />
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', cor.dot)} />
      </button>

      <Dialog open={openPopup} onOpenChange={setOpenPopup}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock
                className={cn(
                  'h-5 w-5',
                  info.nivel === 'red' ? 'text-red-500' : 'text-amber-500',
                )}
              />
              {info.nivel === 'red' ? 'Placa expira em breve' : 'Reserva da placa expirando'}
            </DialogTitle>
            <DialogDescription>
              A placa <strong>{cotacao.veiculo_placa}</strong> está reservada para você até{' '}
              <strong>{format(info.expira, "dd/MM 'às' HH:mm", { locale: ptBR })}</strong>.
              <br />
              Tempo restante: <strong>{info.contador}</strong>
              <br />
              <span className="text-xs text-muted-foreground">
                Qualquer movimentação na cotação (alterar plano, valor ou observações) renova o prazo.
                Sem movimento, a placa volta para o pool e outro consultor pode usá-la.
              </span>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setOpenPopup(false);
                setOpenCancelar(true);
              }}
              className="gap-1"
            >
              <XCircle className="h-4 w-4" />
              Cancelar cotação
            </Button>
            <Button size="sm" onClick={handleAbrir} className="gap-1">
              <ExternalLink className="h-4 w-4" />
              Movimentar agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CancelarCotacaoDialog
        open={openCancelar}
        onOpenChange={setOpenCancelar}
        cotacaoId={cotacao.id}
        numero={cotacao.numero ?? undefined}
      />
    </>
  );
};
