import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle2, Clock, XCircle, FileSignature, ShieldCheck, ClipboardCheck, Wrench, Camera, AlertTriangle } from 'lucide-react';
import { TimelineAprovacao } from './TimelineAprovacao';
import type { StatusTroca, TipoVistoriaTroca } from '@/hooks/useSolicitacoesTroca';

interface Props {
  status: StatusTroca;
  motivoReprovacao?: string | null;
  termoAssinadoEm?: string | null;
  aprovadoCadastroEm?: string | null;
  aprovadoMonitoramentoEm?: string | null;
  tipoVistoriaTroca?: TipoVistoriaTroca | null;
  expiradaEm?: string | null;
}

export function TelaAnaliseTrocaTitularidade({
  status, motivoReprovacao, termoAssinadoEm, aprovadoCadastroEm, aprovadoMonitoramentoEm,
  tipoVistoriaTroca, expiradaEm,
}: Props) {
  const isReprovada = status === 'reprovada_cadastro' || status === 'reprovada_monitoramento';
  const isExpirada = status === 'expirada';
  const isCancelada = status === 'cancelada';

  let icon = <Clock className="h-12 w-12 text-blue-600" />;
  let title = 'Aguardando análise';
  let description = 'Sua solicitação de troca de titularidade foi recebida. Aguarde a análise da nossa equipe.';

  if (status === 'cotacao_em_andamento' && !termoAssinadoEm) {
    icon = <FileSignature className="h-12 w-12 text-amber-600" />;
    title = 'Aguardando o titular anterior assinar o termo de cancelamento';
    description = 'Sua cotação já foi montada pelo consultor. Você poderá continuar a contratação assim que o titular anterior assinar o termo de cancelamento (biometria facial). Você receberá um aviso por WhatsApp.';
  } else if (status === 'aguardando_cadastro') {
    icon = <ClipboardCheck className="h-12 w-12 text-blue-600" />;
    title = 'Em análise pelo Cadastro';
    description = 'Estamos analisando os documentos enviados e o termo de cancelamento. Em breve você receberá uma resposta.';
  } else if (status === 'aguardando_monitoramento') {
    icon = <ShieldCheck className="h-12 w-12 text-blue-600" />;
    title = 'Análise final pelo Monitoramento';
    description = 'A documentação foi aprovada. Aguardando a análise final do setor de Monitoramento.';
  } else if (status === 'aguardando_vistoria') {
    if (tipoVistoriaTroca === 'fotos_com_rastreador') {
      icon = <ShieldCheck className="h-12 w-12 text-amber-600" />;
      title = 'Vistoria + instalação de rastreador';
      description = 'O Monitoramento solicitou vistoria com fotos e instalação de novo rastreador. Acesse o link de contratação para iniciar a autovistoria ou aguarde nosso contato para agendar a presencial.';
    } else {
      icon = <Camera className="h-12 w-12 text-amber-600" />;
      title = 'Vistoria por fotos solicitada';
      description = 'O Monitoramento pediu uma vistoria por fotos. Acesse o link de contratação para enviar as fotos do veículo.';
    }
  } else if (status === 'aguardando_manutencao') {
    icon = <Wrench className="h-12 w-12 text-amber-600" />;
    title = 'Manutenção do rastreador agendada';
    description = 'O Monitoramento agendou uma manutenção do rastreador antes da efetivação da troca. Em breve nosso técnico entrará em contato no endereço informado.';
  } else if (isExpirada) {
    icon = <AlertTriangle className="h-12 w-12 text-destructive" />;
    title = 'Solicitação expirada';
    description = 'O novo titular não assinou o termo de filiação até a meia-noite do dia da assinatura do termo de cancelamento. A troca foi automaticamente cancelada e o veículo anterior foi cancelado. Para prosseguir, será necessário criar uma nova venda (cotação) para o veículo.';
  } else if (isCancelada) {
    icon = <XCircle className="h-12 w-12 text-destructive" />;
    title = 'Solicitação cancelada';
    description = motivoReprovacao || 'Esta solicitação de troca foi cancelada.';
  } else if (isReprovada) {
    icon = <XCircle className="h-12 w-12 text-destructive" />;
    title = 'Solicitação não aprovada';
    description = motivoReprovacao || 'Sua solicitação de troca de titularidade foi reprovada.';
  } else if (status === 'efetivada') {
    icon = <CheckCircle2 className="h-12 w-12 text-green-600" />;
    title = 'Troca efetivada com sucesso!';
    description = 'A titularidade foi transferida. Bem-vindo!';
  }

  const mostraSpinner = !isReprovada && !isExpirada && !isCancelada && status !== 'efetivada';

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6">
      <Card>
        <CardContent className="pt-6 text-center space-y-4">
          <div className="flex justify-center">{icon}</div>
          <h2 className="text-2xl font-bold">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
          {mostraSpinner && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Esta página atualiza automaticamente</span>
            </div>
          )}
          {isExpirada && expiradaEm && (
            <p className="text-xs text-muted-foreground">Expirada em {new Date(expiradaEm).toLocaleString('pt-BR')}</p>
          )}
        </CardContent>
      </Card>

      {(isReprovada || isCancelada) && motivoReprovacao && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Motivo</AlertTitle>
          <AlertDescription>{motivoReprovacao}</AlertDescription>
        </Alert>
      )}

      {isExpirada && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>O que fazer agora?</AlertTitle>
          <AlertDescription>
            Entre em contato com a equipe comercial para iniciar uma nova cotação para o veículo. O link anterior não está mais ativo.
          </AlertDescription>
        </Alert>
      )}

      {!isExpirada && !isCancelada && (
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
      )}
    </div>
  );
}
