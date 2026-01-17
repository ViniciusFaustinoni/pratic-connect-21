import { useState, useEffect, useCallback } from 'react';
import { CreditCard, QrCode, Loader2, Check, Copy, FileText, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface EtapaPagamentoCotacaoProps {
  cotacaoId: string;
  valorAdesao: number;
  clienteNome: string;
  clienteEmail: string;
  clienteCpf: string;
  onPagamentoConfirmado: () => void;
}

interface CobrancaData {
  id: string;
  pixCopiaECola?: string;
  pixQrCode?: string;
  boletoUrl?: string;
  linhaDigitavel?: string;
  status: string;
}

type EtapaInterna = 'gerando_contrato' | 'criando_cobranca' | 'aguardando_pagamento' | 'erro';

export function EtapaPagamentoCotacao({
  cotacaoId,
  valorAdesao,
  clienteNome,
  clienteEmail,
  clienteCpf,
  onPagamentoConfirmado,
}: EtapaPagamentoCotacaoProps) {
  const [etapaInterna, setEtapaInterna] = useState<EtapaInterna>('gerando_contrato');
  const [contratoId, setContratoId] = useState<string | null>(null);
  const [cobranca, setCobranca] = useState<CobrancaData | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // 1. Gerar contrato ao montar
  const gerarContrato = useCallback(async () => {
    try {
      setEtapaInterna('gerando_contrato');
      setErro(null);
      console.log('[EtapaPagamento] Verificando/gerando contrato para cotação:', cotacaoId);

      // Primeiro, verificar se já existe contrato vinculado à cotação
      const { data: cotacao, error: cotacaoError } = await publicSupabase
        .from('cotacoes')
        .select('contrato_gerado_id')
        .eq('id', cotacaoId)
        .single();

      if (cotacaoError) throw cotacaoError;

      if (cotacao?.contrato_gerado_id) {
        console.log('[EtapaPagamento] Contrato já existe:', cotacao.contrato_gerado_id);
        setContratoId(cotacao.contrato_gerado_id);
        return cotacao.contrato_gerado_id;
      }

      // Gerar contrato via edge function
      console.log('[EtapaPagamento] Gerando novo contrato...');
      const { data, error } = await publicSupabase.functions.invoke('contrato-gerar', {
        body: { cotacao_id: cotacaoId },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao gerar contrato');

      const novoContratoId = data.contrato.id;
      console.log('[EtapaPagamento] Contrato gerado:', novoContratoId);

      // Atualizar cotação com o ID do contrato
      await publicSupabase
        .from('cotacoes')
        .update({ contrato_gerado_id: novoContratoId })
        .eq('id', cotacaoId);

      setContratoId(novoContratoId);
      return novoContratoId;
    } catch (error: any) {
      console.error('[EtapaPagamento] Erro ao gerar contrato:', error);
      setErro(error.message || 'Erro ao gerar contrato');
      setEtapaInterna('erro');
      return null;
    }
  }, [cotacaoId]);

  // 2. Criar/buscar cobrança ASAAS
  const criarCobranca = useCallback(async (idContrato: string) => {
    try {
      setEtapaInterna('criando_cobranca');
      console.log('[EtapaPagamento] Verificando/criando cobrança para contrato:', idContrato);

      // Verificar se já existe cobrança pendente
      const { data: cobrancaExistente, error: fetchError } = await publicSupabase
        .from('asaas_cobrancas')
        .select('*')
        .eq('contrato_id', idContrato)
        .eq('tipo', 'adesao')
        .in('status', ['PENDING', 'OVERDUE'])
        .maybeSingle();

      if (fetchError) {
        console.warn('[EtapaPagamento] Erro ao buscar cobrança:', fetchError);
      }

      if (cobrancaExistente) {
        console.log('[EtapaPagamento] Cobrança existente encontrada:', cobrancaExistente.id);
        setCobranca({
          id: cobrancaExistente.id,
          pixCopiaECola: cobrancaExistente.pix_copia_cola,
          pixQrCode: cobrancaExistente.pix_qrcode,
          boletoUrl: cobrancaExistente.boleto_url,
          linhaDigitavel: cobrancaExistente.linha_digitavel,
          status: cobrancaExistente.status,
        });
        setEtapaInterna('aguardando_pagamento');
        return;
      }

      // Criar nova cobrança via edge function
      console.log('[EtapaPagamento] Criando nova cobrança...');
      const { data, error } = await publicSupabase.functions.invoke('asaas-cobranca-adesao', {
        body: {
          contratoId: idContrato,
          valor: valorAdesao,
          cliente: {
            nome: clienteNome,
            email: clienteEmail,
            cpfCnpj: clienteCpf?.replace(/\D/g, ''),
          },
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao criar cobrança');

      console.log('[EtapaPagamento] Cobrança criada:', data.cobranca_id);
      setCobranca({
        id: data.cobranca_id,
        pixCopiaECola: data.pix_copia_cola,
        pixQrCode: data.pix_qrcode,
        boletoUrl: data.boleto_url,
        linhaDigitavel: data.linha_digitavel,
        status: 'PENDING',
      });
      setEtapaInterna('aguardando_pagamento');
    } catch (error: any) {
      console.error('[EtapaPagamento] Erro ao criar cobrança:', error);
      setErro(error.message || 'Erro ao criar cobrança');
      setEtapaInterna('erro');
    }
  }, [valorAdesao, clienteNome, clienteEmail, clienteCpf]);

  // 3. Inicializar fluxo
  useEffect(() => {
    const inicializar = async () => {
      const idContrato = await gerarContrato();
      if (idContrato) {
        await criarCobranca(idContrato);
      }
    };
    inicializar();
  }, [gerarContrato, criarCobranca]);

  // 4. Polling automático para verificar pagamento
  useEffect(() => {
    if (etapaInterna !== 'aguardando_pagamento' || !contratoId) return;

    const interval = setInterval(async () => {
      try {
        const { data, error } = await publicSupabase
          .from('contratos')
          .select('adesao_paga')
          .eq('id', contratoId)
          .single();

        if (error) {
          console.error('[EtapaPagamento] Erro no polling:', error);
          return;
        }

        if (data?.adesao_paga) {
          console.log('[EtapaPagamento] Pagamento detectado automaticamente!');
          toast.success('Pagamento confirmado!');
          
          // Atualizar status da cotação
          await publicSupabase
            .from('cotacoes')
            .update({ 
              status_contratacao: 'pagamento_ok',
              status: 'aceita' 
            })
            .eq('id', cotacaoId);

          onPagamentoConfirmado();
        }
      } catch (error) {
        console.error('[EtapaPagamento] Erro no polling:', error);
      }
    }, 10000); // 10 segundos

    return () => clearInterval(interval);
  }, [etapaInterna, contratoId, cotacaoId, onPagamentoConfirmado]);

  // Verificar pagamento manualmente
  const verificarPagamento = async () => {
    if (!contratoId) return;

    try {
      setVerificando(true);

      const { data, error } = await publicSupabase
        .from('contratos')
        .select('adesao_paga')
        .eq('id', contratoId)
        .single();

      if (error) throw error;

      if (data?.adesao_paga) {
        toast.success('Pagamento confirmado!');
        
        await publicSupabase
          .from('cotacoes')
          .update({ 
            status_contratacao: 'pagamento_ok',
            status: 'aceita' 
          })
          .eq('id', cotacaoId);

        onPagamentoConfirmado();
      } else {
        toast.info('Pagamento ainda não identificado. Aguarde alguns minutos.');
      }
    } catch (error) {
      console.error('[EtapaPagamento] Erro ao verificar:', error);
      toast.error('Erro ao verificar pagamento');
    } finally {
      setVerificando(false);
    }
  };

  // Copiar PIX
  const handleCopiarPix = () => {
    if (cobranca?.pixCopiaECola) {
      navigator.clipboard.writeText(cobranca.pixCopiaECola);
      setCopiado(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopiado(false), 3000);
    }
  };

  // Tentar novamente
  const tentarNovamente = async () => {
    setErro(null);
    const idContrato = await gerarContrato();
    if (idContrato) {
      await criarCobranca(idContrato);
    }
  };

  // Formatar moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Estado de carregamento
  if (etapaInterna === 'gerando_contrato' || etapaInterna === 'criando_cobranca') {
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
              {etapaInterna === 'gerando_contrato' 
                ? 'Gerando seu contrato...' 
                : 'Criando cobrança...'}
            </h3>
            <p className="text-muted-foreground text-sm">
              {etapaInterna === 'gerando_contrato'
                ? 'Estamos preparando seu contrato com base nos dados informados.'
                : 'Gerando o pagamento via PIX...'}
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
            <h3 className="text-lg font-semibold mb-2">Erro ao processar</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
              {erro || 'Ocorreu um erro ao processar o pagamento.'}
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

  // Estado principal - Aguardando pagamento
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-border/50 bg-card/80 backdrop-blur-xl overflow-hidden">
        <CardHeader className="text-center pb-4 border-b border-border/30">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
            <CreditCard className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">Pagamento da Taxa de Adesão</CardTitle>
          <CardDescription className="text-lg">
            Valor: <span className="font-bold text-foreground">{formatCurrency(valorAdesao)}</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* QR Code PIX */}
          {cobranca?.pixQrCode && (
            <motion.div 
              className="text-center space-y-4"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <div className="bg-white p-4 rounded-xl inline-block shadow-lg">
                <img
                  src={`data:image/png;base64,${cobranca.pixQrCode}`}
                  alt="QR Code PIX"
                  className="w-52 h-52 mx-auto"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Escaneie o QR Code com o app do seu banco
              </p>
            </motion.div>
          )}

          {/* PIX Copia e Cola */}
          {cobranca?.pixCopiaECola && (
            <motion.div 
              className="space-y-2"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <label className="text-sm font-medium text-muted-foreground">PIX Copia e Cola</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={cobranca.pixCopiaECola}
                  className="flex-1 px-4 py-3 rounded-lg border border-border/50 bg-muted/30 text-xs font-mono truncate"
                />
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={handleCopiarPix}
                  className={cn(
                    "shrink-0 transition-all",
                    copiado && "bg-success/10 border-success/30 text-success"
                  )}
                >
                  {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Status de aguardando */}
          <motion.div 
            className="bg-muted/30 p-4 rounded-lg text-center border border-border/30"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              {verificando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando pagamento...
                </>
              ) : (
                <>
                  <QrCode className="h-4 w-4" />
                  Aguardando pagamento...
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              A confirmação é automática a cada 10 segundos
            </p>
          </motion.div>

          {/* Botão verificar manualmente */}
          <Button
            variant="outline"
            className="w-full"
            onClick={verificarPagamento}
            disabled={verificando}
          >
            {verificando ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Já paguei, verificar agora
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
