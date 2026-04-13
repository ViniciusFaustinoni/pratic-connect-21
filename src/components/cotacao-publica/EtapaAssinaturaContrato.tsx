import { useState, useEffect, useCallback, useRef } from 'react';
import { FileSignature, Loader2, AlertCircle, RefreshCw, CheckCircle2, Shield, Clock, Mail, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Separator } from '@/components/ui/separator';
import { useAprovacaoFipeDiretoriaPorCotacao } from '@/hooks/useAprovacoesFipeDiretoria';

interface EtapaAssinaturaContratoProps {
  cotacaoId: string;
  tokenPublico: string;
  clienteNome: string;
  clienteEmail: string;
  onContratoAssinado: () => void;
  readOnly?: boolean;
  // Dados iniciais do contrato (vindos do hook pai)
  contratoInicial?: {
    id: string;
    numero?: string;
    autentique_url?: string;
    autentique_documento_id?: string;
    status?: string;
  } | null;
}

type EtapaInterna = 'coletar_email' | 'verificando' | 'gerando_contrato' | 'enviando_autentique' | 'aguardando_assinatura' | 'assinado' | 'erro';


export function EtapaAssinaturaContrato({
  cotacaoId,
  tokenPublico,
  clienteNome,
  clienteEmail,
  onContratoAssinado,
  readOnly = false,
  contratoInicial,
}: EtapaAssinaturaContratoProps) {
  // ═══ ESTADOS ATÔMICOS INDEPENDENTES ═══
  const [contratoId, setContratoId] = useState<string | null>(contratoInicial?.id || null);
  const [contratoNumero, setContratoNumero] = useState<string | null>(contratoInicial?.numero || null);
  // linkAssinatura mantido internamente apenas para controle de polling, não exibido na UI
  const [linkAssinatura, setLinkAssinatura] = useState<string | null>(contratoInicial?.autentique_url || null);
  const [autentiqueDocId, setAutentiqueDocId] = useState<string | null>(contratoInicial?.autentique_documento_id || null);
  const [statusContrato, setStatusContrato] = useState<string | null>(contratoInicial?.status || null);

  const [etapaInterna, setEtapaInterna] = useState<EtapaInterna>(
    !clienteEmail ? 'coletar_email' : 'verificando'
  );
  const [erro, setErro] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [emailLocal, setEmailLocal] = useState(clienteEmail || '');
  const [emailEfetivo, setEmailEfetivo] = useState(clienteEmail || '');
  const [salvandoEmail, setSalvandoEmail] = useState(false);
  const [aguardandoAprovacaoFipe, setAguardandoAprovacaoFipe] = useState(false);

  // ═══ Verificar se cotação está pendente de aprovação FIPE diretoria ═══
  useEffect(() => {
    const verificarAprovacao = async () => {
      try {
        const { data } = await publicSupabase
          .from('cotacoes')
          .select('fipe_diretoria_aprovado')
          .eq('id', cotacaoId)
          .maybeSingle();
        setAguardandoAprovacaoFipe(data?.fipe_diretoria_aprovado === false);
      } catch {
        // ignore
      }
    };
    verificarAprovacao();
    const interval = setInterval(verificarAprovacao, 15000);
    return () => clearInterval(interval);
  }, [cotacaoId]);
  

  // ═══ REFS DE TRAVA — impedir dupla execução ═══
  const initRef = useRef(false);
  const processingRef = useRef(false);
  const sendingRef = useRef(false);

  // Se já temos dados iniciais suficientes, pular para o estado correto
  useEffect(() => {
    if (!contratoInicial) return;
    if (contratoInicial.status === 'assinado' || contratoInicial.status === 'ativo') {
      setEtapaInterna('assinado');
      onContratoAssinado();
      return;
    }
    if (contratoInicial.autentique_url) {
      setLinkAssinatura(contratoInicial.autentique_url);
      setEtapaInterna('aguardando_assinatura');
    }
  }, []); // só na montagem

  // ═══ 1. Verificar/gerar contrato ═══
  const verificarOuGerarContrato = useCallback(async () => {
    if (processingRef.current) {
      console.log('[EtapaAssinatura] Já processando, ignorando chamada duplicada');
      return null;
    }
    processingRef.current = true;

    try {
      setEtapaInterna('verificando');
      setErro(null);
      console.log('[EtapaAssinatura] Verificando contrato para cotação:', cotacaoId);

      const { data: cotacao, error: cotacaoError } = await publicSupabase
        .from('cotacoes')
        .select('contrato_gerado_id')
        .eq('id', cotacaoId)
        .eq('token_publico', tokenPublico)
        .maybeSingle();

      if (cotacaoError) throw cotacaoError;
      if (!cotacao) throw new Error('Cotação não encontrada ou acesso negado');

      // Buscar TODOS os contratos da cotação
      const { data: todosContratos } = await publicSupabase
        .from('contratos')
        .select('id, numero, autentique_documento_id, autentique_url, status')
        .eq('cotacao_id', cotacaoId)
        .order('created_at', { ascending: false });

      const contratoAssinado = todosContratos?.find(
        (c: any) => c.status === 'assinado' || c.status === 'ativo'
      );

      let cId = cotacao?.contrato_gerado_id;
      let contratoData = contratoAssinado || todosContratos?.find((c: any) => c.id === cId) || todosContratos?.[0];

      if (contratoAssinado && contratoAssinado.id !== cId) {
        cId = contratoAssinado.id;
        contratoData = contratoAssinado;
        await publicSupabase
          .from('cotacoes')
          .update({ contrato_gerado_id: contratoAssinado.id, status_contratacao: 'contrato_assinado' })
          .eq('id', cotacaoId)
          .eq('token_publico', tokenPublico);
      }

      if (contratoData) {
        console.log('[EtapaAssinatura] Contrato encontrado:', contratoData.id, 'status:', contratoData.status);
        
        // Atualizar estados atômicos imediatamente
        setContratoId(contratoData.id);
        setContratoNumero(contratoData.numero);
        setStatusContrato(contratoData.status);

        if (contratoData.status === 'assinado' || contratoData.status === 'ativo') {
          setEtapaInterna('assinado');
          onContratoAssinado();
          processingRef.current = false;
          return contratoData.id;
        }

        if (contratoData.autentique_url) {
          setLinkAssinatura(contratoData.autentique_url);
          setAutentiqueDocId(contratoData.autentique_documento_id || null);
          setEtapaInterna('aguardando_assinatura');
          
          await publicSupabase
            .from('cotacoes')
            .update({ status_contratacao: 'documentos_ok' })
            .eq('id', cotacaoId)
            .eq('token_publico', tokenPublico)
            .in('status_contratacao', ['dados_preenchidos']);

          processingRef.current = false;
          return contratoData.id;
        }

        cId = contratoData.id;
      }

      if (!cId) {
        setEtapaInterna('gerando_contrato');
        console.log('[EtapaAssinatura] Gerando novo contrato...');

        const { data, error } = await publicSupabase.functions.invoke('contrato-gerar', {
          body: { cotacao_id: cotacaoId },
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Erro ao gerar contrato');

        cId = data.contrato.id;
        setContratoId(data.contrato.id);
        setContratoNumero(data.contrato.numero);
        setStatusContrato(data.contrato.status);

        await publicSupabase
          .from('cotacoes')
          .update({ contrato_gerado_id: cId, status_contratacao: 'documentos_ok' })
          .eq('id', cotacaoId);
      }

      await enviarParaAutentique(cId!);
      processingRef.current = false;
      return cId;
    } catch (error: any) {
      console.error('[EtapaAssinatura] Erro:', error);
      setErro(error.message || 'Erro ao processar contrato');
      setEtapaInterna('erro');
      processingRef.current = false;
      return null;
    }
  }, [cotacaoId, tokenPublico, onContratoAssinado]);

  // ═══ 2. Enviar para Autentique ═══
  const enviarParaAutentique = async (cId: string) => {
    if (sendingRef.current) {
      console.log('[EtapaAssinatura] Já enviando para Autentique, ignorando');
      return;
    }
    sendingRef.current = true;

    try {
      setEtapaInterna('enviando_autentique');
      console.log('[EtapaAssinatura] Enviando para Autentique...');

      // Verificar se já tem link
      const { data: contratoData } = await publicSupabase
        .from('contratos')
        .select('autentique_url, autentique_documento_id')
        .eq('id', cId)
        .maybeSingle();

      if (contratoData?.autentique_url) {
        setLinkAssinatura(contratoData.autentique_url);
        setAutentiqueDocId(contratoData.autentique_documento_id || null);
        setEtapaInterna('aguardando_assinatura');
        sendingRef.current = false;
        return;
      }

      const { data, error } = await publicSupabase.functions.invoke('autentique-create', {
        body: { contrato_id: cId },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao enviar para assinatura');

      console.log('[EtapaAssinatura] Enviado para Autentique:', data);

      const linkResp = data.signatureLink || data.link_assinatura || data.autentique_url;
      if (linkResp) {
        setLinkAssinatura(linkResp);
        setEtapaInterna('aguardando_assinatura');
      }
      if (data.documentId || data.autentique_documento_id) {
        setAutentiqueDocId(data.documentId || data.autentique_documento_id);
      }

      // Se não temos link ainda, ir direto para aguardando_assinatura com botão "Gerar Link"
      if (!linkResp) {
        console.log('[EtapaAssinatura] Link não retornado imediatamente, mostrando botão Gerar Link...');
        setEtapaInterna('aguardando_assinatura');
      }
    } catch (error: any) {
      console.error('[EtapaAssinatura] Erro no Autentique:', error);
      setErro(error.message || 'Erro ao enviar para assinatura digital');
      setEtapaInterna('erro');
    } finally {
      sendingRef.current = false;
    }
  };

  // ═══ 3. Inicializar (uma única vez) ═══
  useEffect(() => {
    if (initRef.current) return;
    if (etapaInterna !== 'verificando') return; // esperar email se necessário
    
    // Se já temos link do contratoInicial, não precisa verificar
    if (contratoInicial?.autentique_url) return;
    // Se já temos contrato assinado, não precisa verificar
    if (contratoInicial?.status === 'assinado' || contratoInicial?.status === 'ativo') return;

    initRef.current = true;
    verificarOuGerarContrato();
  }, [etapaInterna, verificarOuGerarContrato, contratoInicial]);

  // ═══ 4. REALTIME: Escutar mudanças no contrato ═══
  useEffect(() => {
    if (!contratoId) return;

    console.log('[EtapaAssinatura] Abrindo realtime para contrato:', contratoId);
    
    const channel = publicSupabase
      .channel(`contrato-assinatura-${contratoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contratos',
          filter: `id=eq.${contratoId}`,
        },
        (payload) => {
          const newData = payload.new as any;
          console.log('[EtapaAssinatura] Realtime update:', newData.status, 'url:', !!newData.autentique_url);

          // Atualizar link imediatamente e transicionar para aguardando_assinatura
          if (newData.autentique_url && !linkAssinatura) {
            console.log('[EtapaAssinatura] ✅ Link recebido via realtime!');
            setLinkAssinatura(newData.autentique_url);
            setEtapaInterna((prev) => prev === 'enviando_autentique' ? 'aguardando_assinatura' : prev);
          }

          if (newData.autentique_documento_id) {
            setAutentiqueDocId(newData.autentique_documento_id);
          }

          // Detectar assinatura
          if (newData.status === 'assinado' || newData.status === 'ativo') {
            console.log('[EtapaAssinatura] ✅ Contrato assinado via realtime!');
            setStatusContrato(newData.status);
            toast.success('Contrato assinado com sucesso!');
            
            publicSupabase
              .from('cotacoes')
              .update({ status_contratacao: 'contrato_assinado' })
              .eq('id', cotacaoId);

            setEtapaInterna('assinado');
            onContratoAssinado();
          }
        }
      )
      .subscribe((status) => {
        console.log('[EtapaAssinatura] Realtime status:', status);
      });

    return () => {
      console.log('[EtapaAssinatura] Removendo realtime');
      publicSupabase.removeChannel(channel);
    };
  }, [contratoId, cotacaoId, onContratoAssinado]); // linkAssinatura removido intencionalmente

  // ═══ 5. Polling FALLBACK para link (3s) — roda em enviando_autentique e aguardando_assinatura ═══
  useEffect(() => {
    if (!contratoId || linkAssinatura) return;
    if (etapaInterna !== 'enviando_autentique' && etapaInterna !== 'aguardando_assinatura') return;

    const buscarLink = async () => {
      try {
        const { data } = await publicSupabase
          .from('contratos')
          .select('autentique_url')
          .eq('id', contratoId)
          .maybeSingle();
        
        console.log('[EtapaAssinatura] Polling link result:', data?.autentique_url ? 'FOUND' : 'null');
        
        if (data?.autentique_url) {
          setLinkAssinatura(data.autentique_url);
          setEtapaInterna('aguardando_assinatura');
        }
      } catch (e) {
        console.error('[EtapaAssinatura] Erro polling link:', e);
      }
    };

    buscarLink();
    const interval = setInterval(buscarLink, 3000);
    return () => clearInterval(interval);
  }, [etapaInterna, contratoId, linkAssinatura]);


  // ═══ 6. Polling FALLBACK para status (15s) ═══
  useEffect(() => {
    if (etapaInterna !== 'aguardando_assinatura' || !contratoId) return;

    const verificarAssinatura = async () => {
      try {
        const { data: syncResult } = await publicSupabase.functions.invoke('autentique-sync-contrato', {
          body: { contratoId },
        });

        console.log('[EtapaAssinatura] Polling sync:', syncResult?.status);

        if (syncResult?.autentique_url && !linkAssinatura) {
          setLinkAssinatura(syncResult.autentique_url);
        }

        if (syncResult?.status === 'assinado') {
          toast.success('Contrato assinado com sucesso!');
          await publicSupabase
            .from('cotacoes')
            .update({ status_contratacao: 'contrato_assinado' })
            .eq('id', cotacaoId);
          setEtapaInterna('assinado');
          onContratoAssinado();
          return;
        }

        // Fallback direto no banco
        const { data } = await publicSupabase
          .from('contratos')
          .select('status, autentique_url')
          .eq('id', contratoId)
          .maybeSingle();

        if (data?.autentique_url && !linkAssinatura) {
          setLinkAssinatura(data.autentique_url);
        }

        if (data?.status === 'assinado' || data?.status === 'ativo') {
          toast.success('Contrato assinado com sucesso!');
          await publicSupabase
            .from('cotacoes')
            .update({ status_contratacao: 'contrato_assinado' })
            .eq('id', cotacaoId);
          setEtapaInterna('assinado');
          onContratoAssinado();
        }
      } catch (error) {
        console.error('[EtapaAssinatura] Erro polling status:', error);
      }
    };

    verificarAssinatura();
    const interval = setInterval(verificarAssinatura, 15000);
    return () => clearInterval(interval);
  }, [etapaInterna, contratoId, cotacaoId, onContratoAssinado]);

  // ═══ Verificar manualmente ═══
  const verificarManualmente = async () => {
    if (!contratoId) return;
    try {
      setVerificando(true);
      const { data: syncResult } = await publicSupabase.functions.invoke('autentique-sync-contrato', {
        body: { contratoId },
      });

      if (syncResult?.autentique_url && !linkAssinatura) {
        setLinkAssinatura(syncResult.autentique_url);
      }

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

  const tentarNovamente = () => {
    setErro(null);
    processingRef.current = false;
    sendingRef.current = false;
    initRef.current = false;
    setEtapaInterna('verificando');
  };

  // Salvar email e iniciar
  const handleSalvarEmail = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLocal)) {
      toast.error('Informe um email válido');
      return;
    }
    try {
      setSalvandoEmail(true);
      await publicSupabase
        .from('cotacoes')
        .update({ email_solicitante: emailLocal })
        .eq('id', cotacaoId)
        .eq('token_publico', tokenPublico);
      setEmailEfetivo(emailLocal);
      initRef.current = false;
      processingRef.current = false;
      setEtapaInterna('verificando');
    } catch (e: any) {
      toast.error('Erro ao salvar email');
    } finally {
      setSalvandoEmail(false);
    }
  };

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════

  // Tela de coleta de email
  if (etapaInterna === 'coletar_email') {
    return (
      <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
        <CardContent className="py-12 text-center space-y-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-1">Email necessário para assinatura</h3>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                Para enviar o contrato digital, precisamos do seu email.
              </p>
            </div>
            <div className="max-w-sm mx-auto space-y-3">
              <Input
                type="email"
                placeholder="seu@email.com"
                value={emailLocal}
                onChange={(e) => setEmailLocal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSalvarEmail()}
                className="text-center"
              />
              <Button
                onClick={handleSalvarEmail}
                disabled={salvandoEmail || !emailLocal}
                className="w-full gap-2"
              >
                {salvandoEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Continuar para assinatura
              </Button>
            </div>
          </motion.div>
        </CardContent>
      </Card>
    );
  }

  // Estados de carregamento
  if (etapaInterna === 'verificando' || etapaInterna === 'gerando_contrato') {
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
            </h3>
            <p className="text-muted-foreground text-sm">
              {etapaInterna === 'verificando' && 'Verificando se já existe um contrato para sua cotação.'}
              {etapaInterna === 'gerando_contrato' && 'Estamos gerando seu contrato com base nos dados informados.'}
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
            {contratoNumero && (
              <Badge variant="outline" className="text-lg px-4 py-1 border-success/30 text-success">
                {contratoNumero}
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
            Contrato {contratoNumero && <span className="font-medium text-foreground">{contratoNumero}</span>}
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
              <span className="font-medium">{emailEfetivo}</span>
            </div>
          </div>

          {/* Passo a passo para assinatura via email */}
          <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-5 border border-primary/20">
            <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Como assinar via Email
            </h4>
            
            <div className="space-y-4">
              <motion.div className="flex items-start gap-3" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
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

              <motion.div className="flex items-start gap-3" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
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

              <motion.div className="flex items-start gap-3" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
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

              <motion.div className="flex items-start gap-3" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
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
