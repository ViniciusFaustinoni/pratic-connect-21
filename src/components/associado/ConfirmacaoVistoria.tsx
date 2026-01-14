import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEffect, useState } from 'react';
import { CheckCircle, Calendar, Camera, Clock, FileSignature, ExternalLink, Loader2, RefreshCw, AlertCircle, PartyPopper } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useGerarAutentiqueByToken } from '@/hooks/useContratoLink';
import { useContratoRealtimeByToken } from '@/hooks/useContratosRealtime';

interface ConfirmacaoVistoriaProps {
  tipoVistoria: 'agendada' | 'autovistoria';
  dadosAgendamento?: { data: string; horario: string } | null;
  autentiqueUrl?: string | null;
  isAutentiqueTimeout?: boolean;
  onRetryAutentique?: () => void;
  contratoToken?: string;
  adesaoPaga?: boolean;
  contratoAssinado?: boolean;
}

export function ConfirmacaoVistoria({ 
  tipoVistoria, 
  dadosAgendamento, 
  autentiqueUrl,
  isAutentiqueTimeout,
  onRetryAutentique,
  contratoToken,
  adesaoPaga,
  contratoAssinado,
}: ConfirmacaoVistoriaProps) {
  const [hasTriedGeneration, setHasTriedGeneration] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  
  const gerarAutentique = useGerarAutentiqueByToken();
  
  // Ativar listener realtime para receber atualização quando contrato for assinado
  useContratoRealtimeByToken(contratoToken);
  
  // Gerar link automaticamente quando adesao_paga=true e autentique_url=null
  useEffect(() => {
    if (
      adesaoPaga && 
      !autentiqueUrl && 
      !hasTriedGeneration && 
      !gerarAutentique.isPending && 
      contratoToken
    ) {
      console.log('[ConfirmacaoVistoria] Iniciando geração automática do link Autentique...');
      setHasTriedGeneration(true);
      setGenerationError(null);
      
      gerarAutentique.mutate(contratoToken, {
        onSuccess: (result) => {
          console.log('[ConfirmacaoVistoria] Link gerado com sucesso:', result.signatureLink);
        },
        onError: (error: any) => {
          console.error('[ConfirmacaoVistoria] Erro ao gerar link:', error);
          setGenerationError(error.message || 'Erro ao gerar link de assinatura');
        },
      });
    }
  }, [adesaoPaga, autentiqueUrl, hasTriedGeneration, gerarAutentique.isPending, contratoToken]);
  
  // Função para tentar novamente
  const handleRetry = () => {
    if (contratoToken) {
      setHasTriedGeneration(false);
      setGenerationError(null);
      onRetryAutentique?.();
    }
  };
  
  const isGenerating = gerarAutentique.isPending;
  return (
    <Card className="border-green-200 dark:border-green-900">
      <CardHeader className="text-center bg-green-50 dark:bg-green-950/30 rounded-t-lg">
        <div className="mx-auto w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="h-10 w-10 text-white" />
        </div>
        <CardTitle className="text-green-700 dark:text-green-400">
          Pagamento Confirmado!
        </CardTitle>
        <CardDescription>
          Sua adesão foi processada com sucesso
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Feedback visual quando contrato é assinado */}
        {contratoAssinado && (
          <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
            <PartyPopper className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-300">
              <strong>Contrato assinado com sucesso!</strong> Seu processo de adesão está quase completo. 
              Aguarde as próximas etapas.
            </AlertDescription>
          </Alert>
        )}
        {tipoVistoria === 'agendada' && dadosAgendamento ? (
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Vistoria Agendada
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Data</p>
                    <p className="font-medium">
                      {format(new Date(dadosAgendamento.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground">Horário</p>
                    <p className="font-medium">{dadosAgendamento.horario}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                <strong>Importante:</strong> Compareça no local com o veículo limpo e todos os documentos.
                Você receberá um lembrete por SMS/WhatsApp antes da vistoria.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Camera className="h-4 w-4 text-primary" />
                Autovistoria Enviada
              </h4>
              <p className="text-sm text-muted-foreground">
                Suas fotos foram recebidas e estão em análise pela nossa equipe técnica.
              </p>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                <strong>Próximos passos:</strong> Você será notificado quando a análise for concluída.
                Em caso de aprovação, receberá o link para assinatura do contrato.
              </p>
            </div>
          </div>
        )}

        {/* CTA para Assinatura do Contrato - com estados de carregamento, timeout e sucesso */}
        {autentiqueUrl ? (
          <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-primary" />
              <h4 className="font-medium text-primary">Assine seu Contrato</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Clique no botão abaixo para assinar digitalmente seu contrato de proteção veicular.
            </p>
            <Button asChild className="w-full">
              <a href={autentiqueUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Assinar Contrato Agora
              </a>
            </Button>
          </div>
        ) : (isAutentiqueTimeout || generationError) ? (
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 p-4 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <h4 className="font-medium text-yellow-700 dark:text-yellow-400">
                {generationError ? 'Erro ao gerar link' : 'Link ainda não disponível'}
              </h4>
            </div>
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              {generationError || 'O link para assinatura está demorando mais que o esperado. Isso pode acontecer em momentos de alta demanda.'}
            </p>
            <Button 
              variant="outline" 
              className="w-full border-yellow-500 text-yellow-700 hover:bg-yellow-100 dark:text-yellow-400 dark:hover:bg-yellow-950"
              onClick={handleRetry}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Tentar Novamente
            </Button>
            <p className="text-xs text-yellow-600 dark:text-yellow-500 text-center">
              Caso o problema persista, entre em contato conosco.
            </p>
          </div>
        ) : (
          <div className="bg-muted/50 border border-muted p-4 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
              <h4 className="font-medium text-muted-foreground">Gerando Link de Assinatura...</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Estamos preparando seu contrato para assinatura digital. Isso pode levar alguns segundos...
            </p>
          </div>
        )}

        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">Próximas etapas:</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
              Pagamento da adesão confirmado
            </li>
            <li className="flex items-start gap-2">
              {contratoAssinado ? (
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
              ) : autentiqueUrl ? (
                <div className="h-4 w-4 rounded-full border-2 border-primary bg-primary/20 mt-0.5 animate-pulse" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 mt-0.5" />
              )}
              <span className={contratoAssinado ? "text-green-700 dark:text-green-400 font-medium" : autentiqueUrl ? "text-primary font-medium" : ""}>
                Assinatura do contrato{!contratoAssinado && autentiqueUrl && " (aguardando)"}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 mt-0.5" />
              {tipoVistoria === 'agendada' 
                ? 'Realização da vistoria presencial'
                : 'Análise das fotos da autovistoria'
              }
            </li>
            <li className="flex items-start gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 mt-0.5" />
              Instalação do rastreador
            </li>
            <li className="flex items-start gap-2">
              <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 mt-0.5" />
              Ativação da proteção
            </li>
          </ul>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Em caso de dúvidas, entre em contato conosco.
        </p>
      </CardContent>
    </Card>
  );
}
