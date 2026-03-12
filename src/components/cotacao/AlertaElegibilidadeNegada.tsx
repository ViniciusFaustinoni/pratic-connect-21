import { useState } from 'react';
import { AlertTriangle, ShieldAlert, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useCriarSolicitacaoElegibilidade } from '@/hooks/useAprovacaoElegibilidade';

export interface PlanoNegado {
  planoId: string;
  planoNome: string;
  linha: string | null;
  motivo: string;
  observacao?: string;
  /** Se já existe solicitação para esse plano nesta cotação */
  solicitacaoStatus?: 'pendente' | 'aprovado' | 'recusado' | null;
}

interface AlertaElegibilidadeNegadaProps {
  planosNegados: PlanoNegado[];
  cotacaoId?: string;
  marca: string;
  modelo: string;
  ano: number;
  combustivel: string;
  placa?: string;
}

export function AlertaElegibilidadeNegada({
  planosNegados,
  cotacaoId,
  marca,
  modelo,
  ano,
  combustivel,
  placa,
}: AlertaElegibilidadeNegadaProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [planoParaSolicitar, setPlanoParaSolicitar] = useState<PlanoNegado | null>(null);
  const [justificativa, setJustificativa] = useState('');

  const criarSolicitacao = useCriarSolicitacaoElegibilidade();

  if (planosNegados.length === 0) return null;

  const handleSolicitar = (plano: PlanoNegado) => {
    setPlanoParaSolicitar(plano);
    setJustificativa('');
    setModalOpen(true);
  };

  const handleEnviar = () => {
    if (!planoParaSolicitar || !cotacaoId || !justificativa.trim()) return;

    criarSolicitacao.mutate(
      {
        cotacao_id: cotacaoId,
        plano_id: planoParaSolicitar.planoId,
        marca,
        modelo,
        ano,
        combustivel,
        placa,
        motivo_bloqueio: 'negado',
        observacao_regra: planoParaSolicitar.observacao || planoParaSolicitar.motivo,
        justificativa: justificativa.trim(),
      },
      {
        onSuccess: () => {
          setModalOpen(false);
          setPlanoParaSolicitar(null);
          setJustificativa('');
        },
      }
    );
  };

  const getStatusBadge = (status?: string | null) => {
    switch (status) {
      case 'pendente':
        return (
          <Badge variant="outline" className="text-yellow-400 border-yellow-500/30 bg-yellow-500/10 gap-1">
            <Clock className="h-3 w-3" /> Aguardando autorização
          </Badge>
        );
      case 'aprovado':
        return (
          <Badge variant="outline" className="text-green-400 border-green-500/30 bg-green-500/10 gap-1">
            <CheckCircle2 className="h-3 w-3" /> Autorizado
          </Badge>
        );
      case 'recusado':
        return (
          <Badge variant="outline" className="text-red-400 border-red-500/30 bg-red-500/10 gap-1">
            <ShieldAlert className="h-3 w-3" /> Recusado
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-destructive text-sm">
              {planosNegados.length} plano(s) indisponível(is) para este veículo
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Restrição de modelo/marca para {marca} {modelo} {ano}
            </p>
          </div>
        </div>

        <div className="space-y-2 pl-8">
          {planosNegados.map((plano) => (
            <div
              key={plano.planoId}
              className="flex items-center justify-between gap-2 rounded-md bg-background/60 px-3 py-2 text-sm"
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-medium truncate">{plano.planoNome}</span>
                {plano.observacao && (
                  <span className="text-xs text-muted-foreground truncate">{plano.observacao}</span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {plano.solicitacaoStatus ? (
                  getStatusBadge(plano.solicitacaoStatus)
                ) : cotacaoId ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSolicitar(plano)}
                    className="text-xs"
                  >
                    Solicitar autorização
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar Autorização de Elegibilidade</DialogTitle>
            <DialogDescription>
              O plano <strong>{planoParaSolicitar?.planoNome}</strong> está bloqueado para{' '}
              <strong>
                {marca} {modelo} {ano}
              </strong>
              . Descreva a justificativa para solicitar uma exceção à diretoria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Textarea
              placeholder="Ex: Cliente fidelizado, renovação de contrato, caso especial..."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleEnviar}
              disabled={!justificativa.trim() || criarSolicitacao.isPending}
            >
              {criarSolicitacao.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Solicitação'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
