import { AlertTriangle, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export type RevistoriaStatusType = 
  | 'suspensa_sem_revistoria' // 1-5 dias atraso
  | 'revistoria_obrigatoria'  // 6+ dias
  | 'em_analise'              // fotos enviadas
  | 'aprovada'                // proteção reativada
  | 'reprovada'               // precisa refazer
  | 'ativa';                  // sem pendências

interface RevistoriaStatusCardProps {
  status: RevistoriaStatusType;
  diasAtraso?: number;
  dataEnvio?: string | null;
  motivosReprovacao?: string[];
  dataLimite?: string | null;
}

export function RevistoriaStatusCard({
  status,
  diasAtraso = 0,
  dataEnvio,
  motivosReprovacao = [],
  dataLimite,
}: RevistoriaStatusCardProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  if (status === 'ativa') {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-800 dark:text-green-200">
                Proteção Ativa
              </h3>
              <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                Sua proteção está ativa e em dia. Nenhuma revistoria necessária.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === 'suspensa_sem_revistoria') {
    return (
      <Card className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 flex-shrink-0 text-orange-600" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-orange-800 dark:text-orange-200">
                  Proteção Suspensa
                </h3>
                <Badge variant="outline" className="border-orange-300 text-orange-700">
                  Suspenso há {diasAtraso} dia{diasAtraso > 1 ? 's' : ''}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-orange-700 dark:text-orange-300">
                Sua proteção está suspensa por atraso no pagamento.
                {dataLimite && (
                  <> Regularize até <strong>{formatDate(dataLimite)}</strong> para evitar a revistoria.</>
                )}
              </p>
              <Link to="/app/boletos">
                <Button size="sm" className="mt-3 bg-orange-600 hover:bg-orange-700">
                  Pagar boleto pendente
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === 'revistoria_obrigatoria') {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 flex-shrink-0 text-red-600" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-red-800 dark:text-red-200">
                  Revistoria Obrigatória
                </h3>
                <Badge variant="outline" className="border-red-300 text-red-700">
                  Pendente há {diasAtraso} dia{diasAtraso > 1 ? 's' : ''}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-red-700 dark:text-red-300">
                Sua proteção está suspensa há mais de 5 dias. Para reativar, envie as fotos do seu veículo abaixo e regularize o pagamento.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === 'em_analise') {
    return (
      <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-6 w-6 flex-shrink-0 text-yellow-600" />
            <div>
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                Revistoria em Análise
              </h3>
              <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                Recebemos suas fotos e estamos analisando. Você será notificado assim que aprovado.
              </p>
              {dataEnvio && (
                <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                  Enviado em {formatDateTime(dataEnvio)}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (status === 'reprovada') {
    return (
      <div className="flex flex-col gap-3">
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <XCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-red-600" />
              <div>
                <h3 className="font-semibold text-red-800 dark:text-red-200">
                  Revistoria Reprovada
                </h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  Por favor, tire novas fotos corrigindo os problemas apontados abaixo.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {motivosReprovacao.length > 0 && (
          <Card className="border-red-100">
            <CardContent className="p-4">
              <h4 className="mb-2 font-medium text-foreground">Motivos da reprovação:</h4>
              <ul className="space-y-1">
                {motivosReprovacao.map((motivo, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-red-500">❌</span>
                    {motivo}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (status === 'aprovada') {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-0.5 h-6 w-6 flex-shrink-0 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-800 dark:text-green-200">
                Revistoria Aprovada
              </h3>
              <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                Sua revistoria foi aprovada! Regularize o pagamento para reativar sua proteção.
              </p>
              <Link to="/app/boletos">
                <Button size="sm" className="mt-3">
                  Ver boletos
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
