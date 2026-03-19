import { CheckCircle2, XCircle, AlertTriangle, Clock, Loader2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useVerificarElegibilidade } from '@/hooks/useSubstituicaoVeiculo';
import { cn } from '@/lib/utils';

interface StepElegibilidadeProps {
  associadoId: string;
  onNext: (hasEventoProprio: boolean, evento?: { id: string; tipo: string }) => void;
}

export function StepElegibilidade({ associadoId, onNext }: StepElegibilidadeProps) {
  const { data: elegibilidade, isLoading, error } = useVerificarElegibilidade(associadoId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
          <span className="text-muted-foreground">Verificando elegibilidade...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Erro ao verificar elegibilidade: {(error as Error).message}</AlertDescription>
      </Alert>
    );
  }

  if (!elegibilidade) return null;

  const { adimplente, rastreador_devolvido, evento_ativo } = elegibilidade;
  const hasEventoProprio = evento_ativo.tem && evento_ativo.tipo === 'proprio';
  const hasEventoTerceiros = evento_ativo.tem && evento_ativo.tipo === 'terceiros';
  const semEvento = !evento_ativo.tem;

  const canProceed = adimplente && rastreador_devolvido && (semEvento || hasEventoTerceiros || hasEventoProprio);

  const handleNext = () => {
    if (hasEventoProprio && evento_ativo.evento_id) {
      onNext(true, { id: evento_ativo.evento_id, tipo: evento_ativo.tipo! });
    } else {
      onNext(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Verificação de Elegibilidade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Adimplência */}
          <div className={cn(
            'flex items-start gap-3 p-4 rounded-lg border',
            adimplente ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30' : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
          )}>
            {adimplente ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className="font-medium text-sm">
                {adimplente ? 'Associado está adimplente' : 'Associado possui cobranças em aberto'}
              </p>
              {!adimplente && (
                <div className="mt-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/financeiro/cobrancas?associado=${associadoId}`}>
                      <ExternalLink className="h-3.5 w-3.5 mr-1" />
                      Ver financeiro
                    </a>
                  </Button>
                </div>
              )}
            </div>
            <Badge variant={adimplente ? 'default' : 'destructive'} className={cn(adimplente && 'bg-green-600')}>
              {adimplente ? 'OK' : 'Pendente'}
            </Badge>
          </div>

          {/* Rastreador */}
          <div className={cn(
            'flex items-start gap-3 p-4 rounded-lg border',
            rastreador_devolvido ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30' : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
          )}>
            {rastreador_devolvido ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className="font-medium text-sm">
                {rastreador_devolvido
                  ? 'Rastreador do veículo antigo foi devolvido'
                  : 'Rastreador ainda vinculado ao veículo'}
              </p>
              {!rastreador_devolvido && (
                <div className="mt-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href="/monitoramento/retiradas">
                      <Clock className="h-3.5 w-3.5 mr-1" />
                      Agendar retirada
                    </a>
                  </Button>
                </div>
              )}
            </div>
            <Badge variant={rastreador_devolvido ? 'default' : 'destructive'} className={cn(rastreador_devolvido && 'bg-green-600')}>
              {rastreador_devolvido ? 'OK' : 'Pendente'}
            </Badge>
          </div>

          {/* Eventos */}
          <div className={cn(
            'flex items-start gap-3 p-4 rounded-lg border',
            semEvento
              ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30'
              : hasEventoTerceiros
              ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30'
              : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
          )}>
            {semEvento ? (
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            ) : hasEventoTerceiros ? (
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className="font-medium text-sm">
                {semEvento
                  ? 'Nenhum evento ativo no veículo'
                  : hasEventoTerceiros
                  ? `Evento de terceiros em andamento (#${evento_ativo.evento_id?.slice(0, 8)}) — pode prosseguir`
                  : `Evento do próprio veículo em andamento (#${evento_ativo.evento_id?.slice(0, 8)}) — requer tratamento`}
              </p>
              {hasEventoProprio && (
                <p className="text-xs text-muted-foreground mt-1">
                  Você precisará escolher como tratar o evento no próximo passo.
                </p>
              )}
            </div>
            <Badge
              variant={semEvento ? 'default' : hasEventoTerceiros ? 'secondary' : 'destructive'}
              className={cn(semEvento && 'bg-green-600', hasEventoTerceiros && 'bg-yellow-600 text-white')}
            >
              {semEvento ? 'OK' : hasEventoTerceiros ? 'Atenção' : 'Bloqueio'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleNext} disabled={!canProceed}>
          Próximo
        </Button>
          Próximo
        </Button>
      </div>
    </div>
  );
}
