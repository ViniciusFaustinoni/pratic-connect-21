import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileSignature, Loader2, CheckCircle2, Lock, Mail, AlertCircle, RefreshCw, ArrowDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { EtapaAssinaturaContrato } from './EtapaAssinaturaContrato';
import { useTermoCancelamentoSubstituicao } from '@/hooks/useTermoCancelamentoSubstituicao';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EtapaAssinaturaSubstituicaoProps {
  cotacaoId: string;
  tokenPublico: string;
  clienteNome: string;
  clienteEmail: string;
  onContratoAssinado: () => void;
  readOnly?: boolean;
  contratoInicial?: {
    id: string;
    numero?: string;
    autentique_url?: string;
    autentique_documento_id?: string;
    status?: string;
  } | null;
  veiculoAntigoPlaca?: string;
  veiculoAntigoModelo?: string;
}

export function EtapaAssinaturaSubstituicao({
  cotacaoId,
  tokenPublico,
  clienteNome,
  clienteEmail,
  onContratoAssinado,
  readOnly = false,
  contratoInicial,
  veiculoAntigoPlaca,
  veiculoAntigoModelo,
}: EtapaAssinaturaSubstituicaoProps) {
  const {
    status: statusCancelamento,
    linkAssinatura,
    assinadoEm,
    enviar,
    recarregar,
    erro,
  } = useTermoCancelamentoSubstituicao(cotacaoId);

  const cancelamentoAssinado = statusCancelamento === 'assinado';

  const badgeCancelamento = useMemo(() => {
    switch (statusCancelamento) {
      case 'assinado':
        return <Badge className="bg-success/20 text-success border-success/30">Assinado</Badge>;
      case 'enviado':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Aguardando assinatura</Badge>;
      case 'enviando':
        return <Badge variant="outline">Enviando…</Badge>;
      case 'erro':
        return <Badge variant="destructive">Erro</Badge>;
      default:
        return <Badge variant="outline">Não enviado</Badge>;
    }
  }, [statusCancelamento]);

  return (
    <div className="space-y-6">
      {/* Header explicativo */}
      <Alert className="border-primary/30 bg-primary/5">
        <FileSignature className="h-4 w-4 text-primary" />
        <AlertTitle>Substituição de veículo — duas assinaturas</AlertTitle>
        <AlertDescription>
          Para substituir o veículo, você precisa assinar <strong>dois documentos</strong>:
          o <strong>Termo de Cancelamento</strong> do veículo atual e, em seguida, o
          <strong> Termo de Filiação</strong> do veículo novo. A filiação só é liberada
          após a assinatura do cancelamento.
        </AlertDescription>
      </Alert>

      {/* ETAPA 1 — Termo de Cancelamento */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <Card className={cancelamentoAssinado ? 'border-success/30 bg-card/80 backdrop-blur-xl' : 'border-primary/30 bg-card/80 backdrop-blur-xl'}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center ${cancelamentoAssinado ? 'bg-success/10' : 'bg-primary/10'}`}>
                  {cancelamentoAssinado ? (
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  ) : (
                    <FileSignature className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div>
                  <Badge variant="outline" className="mb-1 text-xs">Etapa 1 de 2</Badge>
                  <CardTitle className="text-lg">Termo de Cancelamento</CardTitle>
                  <CardDescription>
                    Veículo atual{veiculoAntigoPlaca ? ` • ${veiculoAntigoPlaca}` : ''}
                    {veiculoAntigoModelo ? ` — ${veiculoAntigoModelo}` : ''}
                  </CardDescription>
                </div>
              </div>
              {badgeCancelamento}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {erro && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}

            {statusCancelamento === 'nao_enviado' && (
              <>
                <p className="text-sm text-muted-foreground">
                  Clique abaixo para enviarmos o termo de cancelamento por e-mail.
                  Após assinar, a próxima etapa será liberada automaticamente.
                </p>
                <Button onClick={enviar} disabled={readOnly} className="w-full">
                  <Mail className="h-4 w-4 mr-2" />
                  Enviar termo de cancelamento
                </Button>
              </>
            )}

            {statusCancelamento === 'enviando' && (
              <div className="flex items-center justify-center py-6 gap-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Gerando e enviando termo…</span>
              </div>
            )}

            {statusCancelamento === 'enviado' && (
              <div className="space-y-3">
                <Alert className="border-amber-500/30 bg-amber-500/5">
                  <Mail className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-xs">
                    Enviamos o termo de cancelamento para o e-mail cadastrado.
                    Verifique sua caixa de entrada (e o spam) e assine pelo Autentique.
                    Esta tela atualiza automaticamente após a assinatura.
                  </AlertDescription>
                </Alert>
                <div className="flex items-center gap-2">
                  {linkAssinatura && (
                    <Button asChild variant="outline" className="flex-1">
                      <a href={linkAssinatura} target="_blank" rel="noopener noreferrer">
                        Abrir link de assinatura
                      </a>
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => void recarregar()}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {statusCancelamento === 'assinado' && (
              <Alert className="border-success/30 bg-success/5">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <AlertDescription className="text-xs">
                  Termo de cancelamento assinado
                  {assinadoEm
                    ? ` em ${format(new Date(assinadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`
                    : ''}
                  . Você já pode prosseguir para a assinatura da filiação do veículo novo.
                </AlertDescription>
              </Alert>
            )}

            {statusCancelamento === 'erro' && (
              <Button onClick={enviar} variant="outline" className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Conector visual */}
      <div className="flex justify-center">
        <ArrowDown className={`h-5 w-5 ${cancelamentoAssinado ? 'text-success' : 'text-muted-foreground/40'}`} />
      </div>

      {/* ETAPA 2 — Termo de Filiação */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
      >
        {!cancelamentoAssinado ? (
          <Card className="border-border/50 bg-card/40 backdrop-blur-xl opacity-70">
            <CardHeader>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-muted/40 flex items-center justify-center">
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <Badge variant="outline" className="mb-1 text-xs">Etapa 2 de 2</Badge>
                    <CardTitle className="text-lg text-muted-foreground">Termo de Filiação (veículo novo)</CardTitle>
                    <CardDescription>
                      Disponível após a assinatura do cancelamento
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline">Bloqueado</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Assim que o termo de cancelamento for assinado, a assinatura da filiação
                do novo veículo será liberada automaticamente nesta tela.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Badge variant="outline" className="text-xs">Etapa 2 de 2</Badge>
              <span className="text-xs text-muted-foreground">Termo de Filiação — veículo novo</span>
            </div>
            <EtapaAssinaturaContrato
              cotacaoId={cotacaoId}
              tokenPublico={tokenPublico}
              clienteNome={clienteNome}
              clienteEmail={clienteEmail}
              onContratoAssinado={onContratoAssinado}
              readOnly={readOnly}
              contratoInicial={contratoInicial}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}
