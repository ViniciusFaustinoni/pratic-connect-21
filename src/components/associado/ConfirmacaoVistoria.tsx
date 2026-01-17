import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useEffect, useState } from 'react';
import { CheckCircle, Calendar, Camera, Clock, FileSignature, Loader2, RefreshCw, AlertCircle, PartyPopper, Circle, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useGerarAutentiqueByToken } from '@/hooks/useContratoLink';
import { useContratoRealtimeByToken } from '@/hooks/useContratosRealtime';
import { useAutentiqueStatusPublico } from '@/hooks/useAutentiqueStatusPublico';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface ConfirmacaoVistoriaProps {
  tipoVistoria: 'agendada' | 'autovistoria';
  dadosAgendamento?: { data: string; horario: string } | null;
  autentiqueUrl?: string | null;
  isAutentiqueTimeout?: boolean;
  onRetryAutentique?: () => void;
  contratoToken?: string;
  adesaoPaga?: boolean;
  contratoAssinado?: boolean;
  isGeneratingLink?: boolean;
  autentiqueDocumentoId?: string | null;
  clienteEmail?: string;
  onVoltar?: () => void;
}

type ProgressoEtapa = 'preparando' | 'enviando' | 'finalizando' | null;

export function ConfirmacaoVistoria({ 
  tipoVistoria, 
  dadosAgendamento, 
  autentiqueUrl,
  isAutentiqueTimeout,
  onRetryAutentique,
  contratoToken,
  adesaoPaga,
  contratoAssinado,
  isGeneratingLink = false,
  autentiqueDocumentoId,
  clienteEmail,
  onVoltar,
}: ConfirmacaoVistoriaProps) {
  const [hasTriedGeneration, setHasTriedGeneration] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [progressoGeracao, setProgressoGeracao] = useState<ProgressoEtapa>(null);
  const [linkGerado, setLinkGerado] = useState<string | null>(null);
  
  // Estados para reenvio de email após 30 segundos
  const [showResendOption, setShowResendOption] = useState(false);
  const [timeWaiting, setTimeWaiting] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [showEmailIncorrect, setShowEmailIncorrect] = useState(false);
  
  const gerarAutentique = useGerarAutentiqueByToken();
  const queryClient = useQueryClient();
  
  // Ativar listener realtime para receber atualização quando contrato for assinado
  useContratoRealtimeByToken(contratoToken);
  
  // Polling para verificar status da assinatura a cada 15 segundos
  const { data: statusAutentique, isLoading: isCheckingStatus } = useAutentiqueStatusPublico({
    documentoId: autentiqueDocumentoId || undefined,
    contratoToken,
    enabled: !!autentiqueDocumentoId && !contratoAssinado,
  });
  
  // Detectar quando foi assinado via polling
  const assinadoViaPolling = statusAutentique?.document?.status === 'signed';
  const contratoFoiAssinado = contratoAssinado || assinadoViaPolling;

  // Forçar refetch quando polling detecta assinatura mas prop ainda não atualizou
  useEffect(() => {
    if (assinadoViaPolling && !contratoAssinado && contratoToken) {
      console.log('[ConfirmacaoVistoria] Assinatura detectada via polling, forçando refetch...');
      queryClient.refetchQueries({ queryKey: ['contrato-publico', contratoToken] });
    }
  }, [assinadoViaPolling, contratoAssinado, contratoToken, queryClient]);
  
  // Gerenciar progresso visual quando link está sendo gerado externamente
  useEffect(() => {
    if (isGeneratingLink && !autentiqueUrl && !linkGerado) {
      setProgressoGeracao('preparando');
      const timer1 = setTimeout(() => setProgressoGeracao('enviando'), 1500);
      const timer2 = setTimeout(() => setProgressoGeracao('finalizando'), 4000);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    } else if (autentiqueUrl || linkGerado) {
      setProgressoGeracao(null);
    }
  }, [isGeneratingLink, autentiqueUrl, linkGerado]);
  
  // Fallback: Gerar link se ainda não foi gerado após 3 segundos
  useEffect(() => {
    if (
      adesaoPaga && 
      !autentiqueUrl && 
      !linkGerado &&
      !hasTriedGeneration && 
      !gerarAutentique.isPending && 
      !isGeneratingLink &&
      contratoToken
    ) {
      // Aguardar 3 segundos antes de tentar gerar (dar tempo para a geração antecipada ou Realtime)
      const fallbackTimer = setTimeout(() => {
        if (!autentiqueUrl && !linkGerado) {
          console.log('[ConfirmacaoVistoria] Fallback: Iniciando geração do link Autentique...');
          setHasTriedGeneration(true);
          setGenerationError(null);
          setProgressoGeracao('preparando');
          
          const timer1 = setTimeout(() => setProgressoGeracao('enviando'), 1500);
          const timer2 = setTimeout(() => setProgressoGeracao('finalizando'), 4000);
          
          gerarAutentique.mutate(contratoToken, {
            onSuccess: (result) => {
              console.log('[ConfirmacaoVistoria] Link gerado com sucesso:', result.signatureLink);
              setLinkGerado(result.signatureLink);
              setProgressoGeracao(null);
              clearTimeout(timer1);
              clearTimeout(timer2);
            },
            onError: (error: any) => {
              console.error('[ConfirmacaoVistoria] Erro ao gerar link:', error);
              setGenerationError(error.message || 'Erro ao gerar link de assinatura');
              setProgressoGeracao(null);
              clearTimeout(timer1);
              clearTimeout(timer2);
            },
          });
        }
      }, 3000);
      
      return () => clearTimeout(fallbackTimer);
    }
  }, [adesaoPaga, autentiqueUrl, linkGerado, hasTriedGeneration, gerarAutentique.isPending, isGeneratingLink, contratoToken]);
  
  const isGenerating = gerarAutentique.isPending || isGeneratingLink || progressoGeracao !== null;
  const urlAssinatura = autentiqueUrl || linkGerado;
  
  // Timer de 30 segundos para mostrar opção de reenvio
  useEffect(() => {
    // Só iniciar timer quando houver URL mas ainda não foi assinado
    if (urlAssinatura && !contratoFoiAssinado) {
      const interval = setInterval(() => {
        setTimeWaiting(prev => {
          const newTime = prev + 1;
          if (newTime >= 30) {
            setShowResendOption(true);
          }
          return newTime;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [urlAssinatura, contratoFoiAssinado]);
  
  // Função para reenviar email
  const handleResendEmail = async () => {
    if (!autentiqueDocumentoId) {
      toast.error('ID do documento não disponível');
      return;
    }
    
    setIsResending(true);
    try {
      const { error } = await supabase.functions.invoke('autentique-resend', {
        body: { documentId: autentiqueDocumentoId }
      });
      
      if (error) throw error;
      
      toast.success('Email reenviado com sucesso!');
      setShowResendOption(false);
      setTimeWaiting(0);
      setShowEmailIncorrect(false);
    } catch (err: any) {
      console.error('[ConfirmacaoVistoria] Erro ao reenviar email:', err);
      toast.error('Erro ao reenviar email. Tente novamente.');
    } finally {
      setIsResending(false);
    }
  };
  
  // Função para tentar novamente
  const handleRetry = () => {
    if (contratoToken) {
      setHasTriedGeneration(false);
      setGenerationError(null);
      setLinkGerado(null);
      onRetryAutentique?.();
    }
  };
  
  // Função para exibir mensagem de erro amigável baseada no código de erro
  const getMensagemErro = (error: string) => {
    // Erros específicos do Autentique
    if (error.includes('UNAVAILABLE_CREDITS') || error.includes('indisponível')) {
      return 'Serviço de assinatura sem créditos no momento. Nossa equipe já foi notificada e está resolvendo. Você receberá o link por e-mail em breve.';
    }
    if (error.includes('AUTENTIQUE_UNAUTHORIZED') || error.includes('Configuração')) {
      return 'Configuração do serviço de assinatura inválida. Entre em contato com o suporte.';
    }
    if (error.includes('AUTENTIQUE_VALIDATION') || error.includes('incompletos')) {
      return 'Dados incompletos para gerar a assinatura. Contate seu vendedor.';
    }
    // Erros genéricos
    if (error.includes('Token inválido') || error.includes('TOKEN_INVALID')) {
      return 'Link inválido. Solicite um novo link ao vendedor.';
    }
    if (error.includes('não encontrado') || error.includes('CONTRACT_NOT_FOUND')) {
      return 'Contrato não encontrado. O link pode ter expirado.';
    }
    if (error.includes('pagamento') || error.includes('PAYMENT_PENDING')) {
      return 'Aguardando confirmação do pagamento da adesão.';
    }
    if (error.includes('non-2xx') || error.includes('network') || error.includes('fetch')) {
      return 'Erro de conexão. Verifique sua internet e tente novamente.';
    }
    return 'Erro ao gerar link. Tente novamente em alguns instantes.';
  };
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
        {/* O feedback de contrato assinado agora é exibido junto com as instruções de email */}
        {tipoVistoria === 'agendada' ? (
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Vistoria Presencial Agendada
              </h4>
              {dadosAgendamento ? (
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
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sua vistoria presencial foi agendada. Você receberá os detalhes por SMS/WhatsApp.
                </p>
              )}
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
                Em caso de aprovação, receberá o link para assinatura da proposta.
              </p>
            </div>
          </div>
        )}

        {/* CTA para Assinatura do Contrato - Instruções por email + verificação automática */}
        {contratoFoiAssinado ? (
          <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
            <PartyPopper className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-300">
              <strong>Contrato assinado com sucesso!</strong> Seu processo de adesão está quase completo. 
              Aguarde as próximas etapas.
            </AlertDescription>
          </Alert>
        ) : urlAssinatura ? (
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 rounded-lg space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-800 dark:text-blue-300">
                  Verifique seu Email
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                  Enviamos o contrato para <strong>{clienteEmail || 'seu email cadastrado'}</strong>. 
                  Siga as instruções abaixo para assinar.
                </p>
              </div>
            </div>

            <div className="border-t border-blue-200 dark:border-blue-700 pt-3">
              <h5 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                Passo a passo para assinar:
              </h5>
              <ol className="text-sm text-blue-700 dark:text-blue-400 space-y-2 list-decimal list-inside">
                <li>Acesse a caixa de entrada do email <strong>{clienteEmail || 'cadastrado'}</strong></li>
                <li>Procure por um email da <strong>Autentique</strong> (verifique spam/lixo eletrônico)</li>
                <li>Clique no link <strong>"Assinar Documento"</strong> no email</li>
                <li>Leia o contrato e clique em <strong>"Assinar"</strong></li>
                <li>Volte para esta página - atualizaremos automaticamente quando concluir</li>
              </ol>
            </div>

            {/* Indicador de verificação automática */}
            <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-3 py-2 rounded">
              <RefreshCw className={`h-3 w-3 ${isCheckingStatus ? 'animate-spin' : ''}`} />
              <span>Verificando assinatura automaticamente a cada 10 segundos...</span>
            </div>

            {/* Opção de reenvio após 30 segundos */}
            {showResendOption && (
              <div className="mt-4 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                    Ainda não recebeu o email?
                  </p>
                </div>
                
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  Confirme se o email <strong>{clienteEmail || 'cadastrado'}</strong> está correto.
                </p>
                
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-yellow-500 text-yellow-700 hover:bg-yellow-100 dark:text-yellow-400 dark:hover:bg-yellow-900"
                    onClick={handleResendEmail}
                    disabled={isResending}
                  >
                    {isResending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Reenviar Email
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-yellow-600 dark:text-yellow-400"
                    onClick={() => setShowEmailIncorrect(true)}
                  >
                    O email está incorreto
                  </Button>
                </div>

                {/* Alerta quando email está incorreto */}
                {showEmailIncorrect && (
                  <Alert className="bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-700 dark:text-orange-400">
                      Para corrigir o email, entre em contato com seu vendedor ou 
                      nossa central de atendimento pelo WhatsApp.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
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
              {generationError ? getMensagemErro(generationError) : 'O link para assinatura está demorando mais que o esperado. Isso pode acontecer em momentos de alta demanda. Você também receberá o link por email.'}
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
          <div className="bg-muted/50 border border-muted p-4 rounded-lg space-y-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
              <h4 className="font-medium text-primary">Gerando Link de Assinatura...</h4>
            </div>
            
            {/* Etapas de progresso visuais */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-muted-foreground">Preparando contrato</span>
              </div>
              <div className="flex items-center gap-2">
                {progressoGeracao === 'enviando' || progressoGeracao === 'finalizando' ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                )}
                <span className={progressoGeracao === 'preparando' ? 'text-primary font-medium' : 'text-muted-foreground'}>
                  Enviando para assinatura digital
                </span>
              </div>
              <div className="flex items-center gap-2">
                {progressoGeracao === 'finalizando' ? (
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/30" />
                )}
                <span className={progressoGeracao === 'finalizando' ? 'text-primary font-medium' : 'text-muted-foreground'}>
                  Gerando link de assinatura
                </span>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground text-center">
              Isso pode levar de 10 a 30 segundos. Você também receberá o link por e-mail.
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
              {contratoFoiAssinado ? (
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
              ) : urlAssinatura ? (
                <div className="h-4 w-4 rounded-full border-2 border-primary bg-primary/20 mt-0.5 animate-pulse" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 mt-0.5" />
              )}
              <span className={contratoFoiAssinado ? "text-green-700 dark:text-green-400 font-medium" : urlAssinatura ? "text-primary font-medium" : ""}>
                Assinatura do contrato{!contratoFoiAssinado && urlAssinatura && " (aguardando)"}
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

        {/* Botão Voltar */}
        {onVoltar && (
          <div className="pt-4 border-t">
            <Button
              variant="outline"
              onClick={onVoltar}
              className="w-full"
            >
              Voltar para etapa anterior
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
