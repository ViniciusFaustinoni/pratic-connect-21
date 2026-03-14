import { useState, useEffect, useCallback } from 'react';
import { FileSignature, Loader2, AlertCircle, ExternalLink, RefreshCw, CheckCircle2, Shield, Clock, Mail, MousePointer, PenTool, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Separator } from '@/components/ui/separator';

interface EtapaAssinaturaContratoProps {
  cotacaoId: string;
  tokenPublico: string; // Necessário para satisfazer RLS
  clienteNome: string;
  clienteEmail: string;
  onContratoAssinado: () => void;
  readOnly?: boolean;
}

type EtapaInterna = 'verificando' | 'gerando_contrato' | 'enviando_autentique' | 'aguardando_assinatura' | 'assinado' | 'erro';

interface ContratoInfo {
  id: string;
  numero: string;
  autentiqueDocumentoId?: string;
  linkAssinatura?: string;
  status?: string;
}

export function EtapaAssinaturaContrato({
  cotacaoId,
  tokenPublico,
  clienteNome,
  clienteEmail,
  onContratoAssinado,
  readOnly = false,
}: EtapaAssinaturaContratoProps) {
  const [etapaInterna, setEtapaInterna] = useState<EtapaInterna>('verificando');
  const [contrato, setContrato] = useState<ContratoInfo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);

  // Flag para evitar chamadas duplicadas em re-render
  const [inicializado, setInicializado] = useState(false);

  // 1. Verificar/gerar contrato
  const verificarOuGerarContrato = useCallback(async () => {
    try {
      setEtapaInterna('verificando');
      setErro(null);
      console.log('[EtapaAssinatura] Verificando contrato para cotação:', cotacaoId);

      // Buscar cotação com contrato vinculado (incluir token_publico para satisfazer RLS)
      const { data: cotacao, error: cotacaoError } = await publicSupabase
        .from('cotacoes')
        .select('contrato_gerado_id')
        .eq('id', cotacaoId)
        .eq('token_publico', tokenPublico)
        .maybeSingle();

      if (cotacaoError) {
        console.error('[EtapaAssinatura] Erro ao buscar cotação:', cotacaoError);
        throw cotacaoError;
      }
      
      if (!cotacao) {
        throw new Error('Cotação não encontrada ou acesso negado');
      }

      // ═══ NOVO: Buscar TODOS os contratos da cotação para priorizar assinado ═══
      const { data: todosContratos } = await publicSupabase
        .from('contratos')
        .select('id, numero, autentique_documento_id, autentique_url, status')
        .eq('cotacao_id', cotacaoId)
        .order('created_at', { ascending: false });

      // Priorizar contrato assinado/ativo
      const contratoAssinado = todosContratos?.find(
        (c: any) => c.status === 'assinado' || c.status === 'ativo'
      );
      
      let contratoId = cotacao?.contrato_gerado_id;
      let contratoData = contratoAssinado || todosContratos?.find((c: any) => c.id === contratoId) || todosContratos?.[0];

      // Se encontrou um contrato assinado que não é o vinculado, corrigir
      if (contratoAssinado && contratoAssinado.id !== contratoId) {
        console.log('[EtapaAssinatura] Corrigindo: cotação aponta para contrato errado. Assinado:', contratoAssinado.id);
        contratoId = contratoAssinado.id;
        contratoData = contratoAssinado;
        // Corrigir na base
        await publicSupabase
          .from('cotacoes')
          .update({ contrato_gerado_id: contratoAssinado.id, status_contratacao: 'contrato_assinado' })
          .eq('id', cotacaoId)
          .eq('token_publico', tokenPublico);
      }

      // Se já existe contrato, processar
      if (contratoData) {
        console.log('[EtapaAssinatura] Contrato encontrado:', contratoData.id, 'status:', contratoData.status);

        // Se já foi assinado, ir direto para próxima etapa
        if (contratoData.status === 'assinado' || contratoData.status === 'ativo') {
          console.log('[EtapaAssinatura] Contrato já assinado!');
          setContrato({
            id: contratoData.id,
            numero: contratoData.numero,
            autentiqueDocumentoId: contratoData.autentique_documento_id || undefined,
            status: contratoData.status,
          });
          setEtapaInterna('assinado');
          onContratoAssinado();
          return contratoData.id;
        }

        // Se já tem link do Autentique, ir para aguardar
        if (contratoData.autentique_url) {
          await publicSupabase
            .from('cotacoes')
            .update({ status_contratacao: 'documentos_ok' })
            .eq('id', cotacaoId)
            .eq('token_publico', tokenPublico)
            .in('status_contratacao', ['dados_preenchidos']);

          setContrato({
            id: contratoData.id,
            numero: contratoData.numero,
            autentiqueDocumentoId: contratoData.autentique_documento_id || undefined,
            linkAssinatura: contratoData.autentique_url,
            status: contratoData.status,
          });
          setEtapaInterna('aguardando_assinatura');
          return contratoData.id;
        }

        contratoId = contratoData.id;
        setContrato({
          id: contratoData.id,
          numero: contratoData.numero,
          status: contratoData.status,
        });
      }
      
      if (!contratoId) {
        // Gerar contrato (idempotente via edge function)
        setEtapaInterna('gerando_contrato');
        console.log('[EtapaAssinatura] Gerando novo contrato...');

        const { data, error } = await publicSupabase.functions.invoke('contrato-gerar', {
          body: { cotacao_id: cotacaoId },
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Erro ao gerar contrato');

        contratoId = data.contrato.id;
        console.log('[EtapaAssinatura] Contrato gerado:', data.contrato.numero);

        await publicSupabase
          .from('cotacoes')
          .update({ contrato_gerado_id: contratoId, status_contratacao: 'documentos_ok' })
          .eq('id', cotacaoId);

        setContrato({
          id: data.contrato.id,
          numero: data.contrato.numero,
          status: data.contrato.status,
        });
      }

      // Enviar para Autentique
      await enviarParaAutentique(contratoId);
      return contratoId;
    } catch (error: any) {
      console.error('[EtapaAssinatura] Erro:', error);
      setErro(error.message || 'Erro ao processar contrato');
      setEtapaInterna('erro');
      return null;
    }
  }, [cotacaoId, onContratoAssinado]);

  // 2. Enviar contrato para Autentique
  const enviarParaAutentique = async (contratoId: string) => {
    try {
      setEtapaInterna('enviando_autentique');
      console.log('[EtapaAssinatura] Enviando para Autentique...');

      // Buscar contrato atualizado para verificar se já foi enviado
      const { data: contratoData } = await publicSupabase
        .from('contratos')
        .select('autentique_url, autentique_documento_id')
        .eq('id', contratoId)
        .maybeSingle();

      // Se já tem link, usar ele
      if (contratoData?.autentique_url) {
        setContrato(prev => prev ? {
          ...prev,
          linkAssinatura: contratoData.autentique_url || undefined,
          autentiqueDocumentoId: contratoData.autentique_documento_id || undefined,
        } : null);
        setEtapaInterna('aguardando_assinatura');
        return;
      }

      // Chamar edge function para criar documento no Autentique usando o ID do contrato
      const { data, error } = await publicSupabase.functions.invoke('autentique-create', {
        body: { contrato_id: contratoId },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao enviar para assinatura');

      console.log('[EtapaAssinatura] Enviado para Autentique:', data);

      const linkAssinatura = data.signatureLink || data.link_assinatura || data.autentique_url;

      setContrato(prev => prev ? {
        ...prev,
        linkAssinatura,
        autentiqueDocumentoId: data.documentId || data.autentique_documento_id,
      } : null);

      setEtapaInterna('aguardando_assinatura');
    } catch (error: any) {
      console.error('[EtapaAssinatura] Erro no Autentique:', error);
      setErro(error.message || 'Erro ao enviar para assinatura digital');
      setEtapaInterna('erro');
    }
  };

  // 3. Inicializar fluxo (proteger contra múltiplas chamadas)
  useEffect(() => {
    if (!inicializado) {
      setInicializado(true);
      verificarOuGerarContrato();
    }
  }, [inicializado, verificarOuGerarContrato]);

  // 4. Polling para verificar status da assinatura
  useEffect(() => {
    if (etapaInterna !== 'aguardando_assinatura' || !contrato?.id) return;

    const verificarAssinatura = async () => {
      try {
        // Sincronizar status com Autentique
        const { data: syncResult } = await publicSupabase.functions.invoke('autentique-sync-contrato', {
          body: { contratoId: contrato.id },
        });

        console.log('[EtapaAssinatura] Polling sync result:', syncResult);

        // Verificar resposta da sync diretamente (campo 'status')
        if (syncResult?.status === 'assinado') {
          console.log('[EtapaAssinatura] Contrato assinado detectado via sync!');
          toast.success('Contrato assinado com sucesso!');
          
          // Atualizar status da cotação
          await publicSupabase
            .from('cotacoes')
            .update({ status_contratacao: 'contrato_assinado' })
            .eq('id', cotacaoId);

          setEtapaInterna('assinado');
          onContratoAssinado();
          return;
        }

        // Fallback: verificar diretamente no banco
        const { data, error } = await publicSupabase
          .from('contratos')
          .select('status')
          .eq('id', contrato.id)
          .maybeSingle();

        if (error || !data) return;

        if (data?.status === 'assinado' || data?.status === 'ativo') {
          console.log('[EtapaAssinatura] Contrato assinado detectado via banco!');
          toast.success('Contrato assinado com sucesso!');
          
          await publicSupabase
            .from('cotacoes')
            .update({ status_contratacao: 'contrato_assinado' })
            .eq('id', cotacaoId);

          setEtapaInterna('assinado');
          onContratoAssinado();
        }
      } catch (error) {
        console.error('[EtapaAssinatura] Erro no polling:', error);
      }
    };

    // Verificar imediatamente e depois a cada 15 segundos
    verificarAssinatura();
    const interval = setInterval(verificarAssinatura, 15000);

    return () => clearInterval(interval);
  }, [etapaInterna, contrato?.id, cotacaoId, onContratoAssinado]);

  // Verificar manualmente
  const verificarManualmente = async () => {
    if (!contrato?.id) return;

    try {
      setVerificando(true);

      // Sincronizar com Autentique
      const { data: syncResult } = await publicSupabase.functions.invoke('autentique-sync-contrato', {
        body: { contratoId: contrato.id },
      });

      console.log('[EtapaAssinatura] Resultado sync manual:', syncResult);

      // CORRIGIDO: Verificar campo 'status' em vez de 'novoStatus'
      if (syncResult?.status === 'assinado') {
        toast.success('Contrato assinado com sucesso!');
        
        await publicSupabase
          .from('cotacoes')
          .update({ status_contratacao: 'contrato_assinado' })
          .eq('id', cotacaoId);

        setEtapaInterna('assinado');
        onContratoAssinado();
      } else if (syncResult?.status === 'rejeitado') {
        toast.warning('Contrato foi rejeitado pelo signatário.');
      } else {
        toast.info('Assinatura ainda não identificada. Verifique se você completou o processo no link.');
      }
    } catch (error) {
      console.error('[EtapaAssinatura] Erro ao verificar:', error);
      toast.error('Erro ao verificar assinatura');
    } finally {
      setVerificando(false);
    }
  };

  // Tentar novamente
  const tentarNovamente = () => {
    setErro(null);
    verificarOuGerarContrato();
  };

  // Estados de carregamento
  if (etapaInterna === 'verificando' || etapaInterna === 'gerando_contrato' || etapaInterna === 'enviando_autentique') {
    return (
      <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
        <CardContent className="py-16 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {etapaInterna === 'verificando' && 'Verificando contrato...'}
              {etapaInterna === 'gerando_contrato' && 'Gerando seu contrato...'}
              {etapaInterna === 'enviando_autentique' && 'Preparando assinatura digital...'}
            </h3>
            <p className="text-muted-foreground text-sm">
              {etapaInterna === 'verificando' && 'Verificando se já existe um contrato para sua cotação.'}
              {etapaInterna === 'gerando_contrato' && 'Estamos gerando seu contrato com base nos dados informados.'}
              {etapaInterna === 'enviando_autentique' && 'Preparando o documento para assinatura digital segura.'}
            </p>
          </motion.div>
        </CardContent>
      </Card>
    );
  }

  // Estado de erro
  if (etapaInterna === 'erro') {
    return (
      <Card className="border-destructive/30 bg-card/80 backdrop-blur-xl">
        <CardContent className="py-16 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Erro ao processar contrato</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
              {erro || 'Ocorreu um erro ao preparar seu contrato para assinatura.'}
            </p>
            <Button onClick={tentarNovamente} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Tentar Novamente
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    );
  }

  // Estado de já assinado (ou readOnly)
  if (etapaInterna === 'assinado' || readOnly) {
    return (
      <Card className="border-success/30 bg-card/80 backdrop-blur-xl">
        <CardContent className="py-16 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <h3 className="text-xl font-bold mb-2">Contrato Assinado!</h3>
            <p className="text-muted-foreground mb-4">
              Seu contrato foi assinado digitalmente com sucesso.
            </p>
            {contrato?.numero && (
              <Badge variant="outline" className="text-lg px-4 py-1 border-success/30 text-success">
                {contrato.numero}
              </Badge>
            )}
          </motion.div>
        </CardContent>
      </Card>
    );
  }

  // Estado principal - Aguardando assinatura
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-border/50 bg-card/80 backdrop-blur-xl overflow-hidden">
        <CardHeader className="text-center pb-4 border-b border-border/30">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
            <FileSignature className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">Assinatura Digital do Contrato</CardTitle>
          <CardDescription>
            Contrato {contrato?.numero && <span className="font-medium text-foreground">{contrato.numero}</span>}
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Informações do signatário */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Signatário:</span>
              <span className="font-medium">{clienteNome}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{clienteEmail}</span>
            </div>
          </div>

          {/* Passo a passo para assinatura via email */}
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-5 border border-primary/20">
            <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Como assinar via Email
            </h4>
            
            <div className="space-y-4">
              {/* Passo 1 */}
              <motion.div 
                className="flex items-start gap-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">1</span>
                </div>
                <div>
                  <p className="font-medium text-sm">Acesse seu email</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Verifique sua caixa de entrada em <span className="font-medium text-foreground">{clienteEmail}</span>
                  </p>
                </div>
              </motion.div>

              {/* Passo 2 */}
              <motion.div 
                className="flex items-start gap-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">2</span>
                </div>
                <div>
                  <p className="font-medium text-sm">Clique no link de assinatura</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Procure o email da Autentique e clique no botão "Assinar documento"
                  </p>
                </div>
              </motion.div>

              {/* Passo 3 */}
              <motion.div 
                className="flex items-start gap-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">3</span>
                </div>
                <div>
                  <p className="font-medium text-sm">Assine o contrato</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Siga as instruções na plataforma Autentique para desenhar sua assinatura
                  </p>
                </div>
              </motion.div>

              {/* Passo 4 */}
              <motion.div 
                className="flex items-start gap-3"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
              >
                <div className="w-7 h-7 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                </div>
                <div>
                  <p className="font-medium text-sm">Pronto!</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Após assinar, volte aqui que a confirmação será automática
                  </p>
                </div>
              </motion.div>
            </div>
          </div>

          <Separator className="my-2" />

          {/* Botão de assinatura direta */}
          {contrato?.linkAssinatura && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="space-y-2"
            >
              <p className="text-xs text-center text-muted-foreground">
                Ou clique abaixo para assinar diretamente:
              </p>
              <Button 
                className="w-full h-14 text-lg gap-3" 
                asChild
              >
                <a href={contrato.linkAssinatura} target="_blank" rel="noopener noreferrer">
                  <FileSignature className="h-5 w-5" />
                  Assinar Contrato Agora
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </motion.div>
          )}

          {/* Alerta sobre segurança */}
          <Alert className="border-primary/30 bg-primary/5">
            <Shield className="h-4 w-4 text-primary" />
            <AlertTitle className="text-primary">Assinatura Digital Segura</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              Utilizamos a plataforma Autentique, certificada pela ICP-Brasil, garantindo
              validade jurídica à sua assinatura digital.
            </AlertDescription>
          </Alert>

          {/* Status de aguardando */}
          <motion.div 
            className="bg-muted/30 p-4 rounded-lg text-center border border-border/30"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              {verificando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando assinatura...
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4" />
                  Aguardando sua assinatura...
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              A confirmação é verificada automaticamente a cada 15 segundos
            </p>
          </motion.div>

          {/* Botão verificar manualmente */}
          <Button
            variant="outline"
            className="w-full"
            onClick={verificarManualmente}
            disabled={verificando}
          >
            {verificando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Já assinei, verificar agora
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
