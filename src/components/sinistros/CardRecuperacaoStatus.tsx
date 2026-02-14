import { useState } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, Clock, AlertTriangle, DollarSign, CheckCircle } from 'lucide-react';
import { IniciarIndenizacaoModal } from '@/components/sinistros/IniciarIndenizacaoModal';

interface CardRecuperacaoStatusProps {
  sinistroId: string;
  veiculoId: string;
  dataOcorrencia: string;
  protocolo: string;
  valorFipe?: number | null;
  onRegistrarRecuperacao?: () => void;
}

export function CardRecuperacaoStatus({ sinistroId, veiculoId, dataOcorrencia, protocolo, valorFipe, onRegistrarRecuperacao }: CardRecuperacaoStatusProps) {
  const [modalIndenizacaoOpen, setModalIndenizacaoOpen] = useState(false);

  const diasDesdeEvento = differenceInCalendarDays(new Date(), new Date(dataOcorrencia));
  const prazoTotal = 30;
  const progresso = Math.min((diasDesdeEvento / prazoTotal) * 100, 100);
  const diasRestantes = Math.max(prazoTotal - diasDesdeEvento, 0);

  const getStatusColor = () => {
    if (diasDesdeEvento >= 30) return 'text-red-600';
    if (diasDesdeEvento >= 20) return 'text-amber-600';
    return 'text-green-600';
  };

  const getProgressColor = () => {
    if (diasDesdeEvento >= 30) return 'bg-red-500';
    if (diasDesdeEvento >= 20) return 'bg-amber-500';
    return 'bg-green-500';
  };

  const getBadge = () => {
    if (diasDesdeEvento >= 30) return { label: 'Prazo esgotado', class: 'bg-red-100 text-red-800' };
    if (diasDesdeEvento >= 20) return { label: 'Próximo do prazo', class: 'bg-amber-100 text-amber-800' };
    return { label: 'Em monitoramento', class: 'bg-green-100 text-green-800' };
  };

  const badge = getBadge();

  return (
    <>
      <Card className={diasDesdeEvento >= 30 ? 'border-red-500/50' : diasDesdeEvento >= 20 ? 'border-amber-500/50' : 'border-green-500/50'}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-5 w-5" />
            Recuperação do Veículo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status badge */}
          <div className="flex items-center gap-2">
            <Badge className={badge.class}>{badge.label}</Badge>
          </div>

          {/* Contagem de dias */}
          <div className="text-center py-2">
            <p className={`text-4xl font-bold ${getStatusColor()}`}>{diasDesdeEvento}</p>
            <p className="text-sm text-muted-foreground">dias desde o evento</p>
          </div>

          {/* Barra de progresso */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Prazo de recuperação</span>
              <span>{diasRestantes > 0 ? `${diasRestantes} dias restantes` : 'Esgotado'}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${getProgressColor()}`}
                style={{ width: `${progresso}%` }}
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Prazo máximo: 30 dias corridos para recuperação</span>
          </div>

          {diasDesdeEvento >= 30 && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
              <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-300">
                Prazo de recuperação esgotado. Considere iniciar o processo de indenização integral.
              </p>
            </div>
          )}

          {/* Ações */}
          <div className="space-y-2 pt-2">
            <Button
              className="w-full"
              variant="default"
              onClick={onRegistrarRecuperacao}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Registrar Recuperação
            </Button>
            <Button
              className="w-full"
              variant={diasDesdeEvento >= 30 ? 'destructive' : 'outline'}
              onClick={() => setModalIndenizacaoOpen(true)}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Iniciar Indenização
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* RegistrarRecuperacaoModal is used from CardAcionamentoRoubo already, 
          users can use the existing button flow there */}

      <IniciarIndenizacaoModal
        open={modalIndenizacaoOpen}
        onOpenChange={setModalIndenizacaoOpen}
        sinistroId={sinistroId}
        veiculoId={veiculoId}
        protocolo={protocolo}
        valorFipe={valorFipe}
      />
    </>
  );
}
