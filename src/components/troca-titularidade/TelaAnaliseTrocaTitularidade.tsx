import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle2, Clock, XCircle, FileSignature, ShieldCheck, ClipboardCheck } from 'lucide-react';
import { TimelineAprovacao } from './TimelineAprovacao';
import type { StatusTroca } from '@/hooks/useSolicitacoesTroca';

interface Props {
  status: StatusTroca;
  motivoReprovacao?: string | null;
  termoAssinadoEm?: string | null;
  aprovadoCadastroEm?: string | null;
  aprovadoMonitoramentoEm?: string | null;
}

export function TelaAnaliseTrocaTitularidade({
  status, motivoReprovacao, termoAssinadoEm, aprovadoCadastroEm, aprovadoMonitoramentoEm,
}: Props) {
  const isReprovada = status === 'reprovada_cadastro' || status === 'reprovada_monitoramento';

  let icon = <Clock className="h-12 w-12 text-blue-600" />;
  let title = 'Aguardando análise';
  let description = 'Sua solicitação de troca de titularidade foi recebida. Aguarde a análise da nossa equipe.';

  if (status === 'aguardando_cadastro') {
    icon = <ClipboardCheck className="h-12 w-12 text-blue-600" />;
    title = 'Em análise pelo Cadastro';
    description = 'Estamos analisando os documentos enviados e o termo de cancelamento. Em breve você receberá uma resposta.';
  } else if (status === 'aguardando_monitoramento') {
    icon = <ShieldCheck className="h-12 w-12 text-blue-600" />;
    title = 'Análise final pelo Monitoramento';
    description = 'A documentação foi aprovada. Aguardando a análise final do setor de Monitoramento.';
  } else if (status === 'aguardando_vistoria') {
    icon = <FileSignature className="h-12 w-12 text-amber-600" />;
    title = 'Vistoria do veículo solicitada';
    description = 'O Monitoramento solicitou uma vistoria do veículo. Em breve nossa equipe entrará em contato.';
  } else if (isReprovada) {
    icon = <XCircle className="h-12 w-12 text-destructive" />;
    title = 'Solicitação não aprovada';
    description = motivoReprovacao || 'Sua solicitação de troca de titularidade foi reprovada.';
  } else if (status === 'efetivada') {
    icon = <CheckCircle2 className="h-12 w-12 text-green-600" />;
    title = 'Troca efetivada com sucesso!';
    description = 'A titularidade foi transferida. Bem-vindo!';
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6">
      <Card>
        <CardContent className="pt-6 text-center space-y-4">
          <div className="flex justify-center">{icon}</div>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
          {!isReprovada && status !== 'efetivada' && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Esta página atualiza automaticamente</span>
            </div>
          )}
        </CardContent>
      </Card>

      {isReprovada && motivoReprovacao && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Motivo</AlertTitle>
          <AlertDescription>{motivoReprovacao}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">Acompanhe o andamento</h3>
          <TimelineAprovacao
            status={status}
            termoAssinadoEm={termoAssinadoEm}
            aprovadoCadastroEm={aprovadoCadastroEm}
            aprovadoMonitoramentoEm={aprovadoMonitoramentoEm}
          />
        </CardContent>
      </Card>
    </div>
  );
}
