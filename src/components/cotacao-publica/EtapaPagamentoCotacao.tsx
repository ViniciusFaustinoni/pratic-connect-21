import { useState, useEffect, useCallback } from 'react';
import { CreditCard, QrCode, Loader2, Check, Copy, FileText, AlertCircle, RefreshCw, Calendar, Clock, MapPin, Wrench, ExternalLink, Shield, PartyPopper } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { validateCPF } from '@/lib/validations';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

interface VistoriaAgendadaInfo {
  data: string;
  horario?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
}

interface EtapaPagamentoCotacaoProps {
  cotacaoId: string;
  valorAdesao: number;
  clienteNome: string;
  clienteEmail: string;
  clienteCpf: string;
  onPagamentoConfirmado: () => void;
  readOnly?: boolean;
  tipoVistoria?: 'autovistoria' | 'agendada';
  vistoriaAgendada?: VistoriaAgendadaInfo;
}

interface CobrancaData {
  id: string;
  pixCopiaECola?: string;
  pixQrCode?: string;
  boletoUrl?: string;
  linhaDigitavel?: string;
  linkPagamento?: string; // Link para pagamento com cartão
  invoiceUrl?: string; // Link da fatura Asaas
  status: string;
}

type FormaPagamento = 'PIX' | 'CREDIT_CARD';

type EtapaInterna = 'gerando_contrato' | 'criando_cobranca' | 'aguardando_pagamento' | 'pago' | 'erro';

export function EtapaPagamentoCotacao({
  cotacaoId,
  valorAdesao,
  clienteNome,
  clienteEmail,
  clienteCpf,
  onPagamentoConfirmado,
  readOnly = false,
  tipoVistoria,
  vistoriaAgendada,
}: EtapaPagamentoCotacaoProps) {
  const [etapaInterna, setEtapaInterna] = useState<EtapaInterna>('gerando_contrato');
  const [contratoId, setContratoId] = useState<string | null>(null);
  const [cobranca, setCobranca] = useState<CobrancaData | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('PIX');
  const [adesaoZerada, setAdesaoZerada] = useState(false);
  const [msgAdesaoZerada, setMsgAdesaoZerada] = useState<string>('');

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
          linkPagamento: `https://www.asaas.com/c/${cobrancaExistente.asaas_id}`,
          status: cobrancaExistente.status,
        });
        setEtapaInterna('aguardando_pagamento');
        return;
      }

      const cpfNormalizado = clienteCpf?.replace(/\D/g, '') || '';
      if (!validateCPF(cpfNormalizado)) {
        throw new Error('O CPF informado nesta cotação é inválido. Corrija os dígitos do CPF antes de gerar a cobrança.');
      }

      // Criar nova cobrança via edge function (usar UNDEFINED para permitir múltiplas formas)
      console.log('[EtapaPagamento] Criando nova cobrança...');
      const { data, error } = await publicSupabase.functions.invoke('asaas-cobranca-adesao', {
        body: {
          contratoId: idContrato,
          valor: valorAdesao,
          formaPagamento: 'UNDEFINED', // Permite PIX e Cartão no mesmo link
          cliente: {
            nome: clienteNome,
            email: clienteEmail,
            cpfCnpj: cpfNormalizado,
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
        linkPagamento: data.link_pagamento || data.invoice_url,
        invoiceUrl: data.invoice_url,
        status: 'PENDING',
      });
      setEtapaInterna('aguardando_pagamento');
    } catch (error: any) {
      console.error('[EtapaPagamento] Erro ao criar cobrança:', error);
      let mensagem = 'Erro ao criar cobrança';
      // Extrair mensagem real da edge function (FunctionsHttpError)
      if (error?.context) {
        try {
          const body = await error.context.json();
          mensagem = body?.error || mensagem;
        } catch (_) { /* ignore parse error */ }
      } else if (error?.message) {
        mensagem = error.message;
      }
      setErro(mensagem);
      setEtapaInterna('erro');
    }
  }, [valorAdesao, clienteNome, clienteEmail, clienteCpf]);

  // 3. Inicializar fluxo - verificar se já está pago ANTES de buscar/criar cobrança
  useEffect(() => {
    const inicializar = async () => {
      // Primeiro, verificar se a cotação já tem contrato
      const { data: cotacao } = await publicSupabase
        .from('cotacoes')
        .select('contrato_gerado_id')
        .eq('id', cotacaoId)
        .single();

      if (cotacao?.contrato_gerado_id) {
        // Verificar se o contrato já está pago
        const { data: contrato } = await publicSupabase
          .from('contratos')
          .select('adesao_paga')
          .eq('id', cotacao.contrato_gerado_id)
          .maybeSingle();

        if (contrato?.adesao_paga) {
          console.log('[EtapaPagamento] Contrato já está pago!');
          setContratoId(cotacao.contrato_gerado_id);
          setEtapaInterna('pago');
          return;
        }
      }

      // ===== ADESÃO ZERADA: pular cobrança ASAAS =====
      if (valorAdesao <= 0) {
        console.log('[EtapaPagamento] Adesão zerada — pulando cobrança ASAAS');

        // Buscar mensagem configurada
        const { data: configMsg } = await publicSupabase
          .from('configuracoes')
          .select('valor')
          .eq('chave', 'comissao_ext_msg_adesao_zero')
          .maybeSingle();

        const msg = configMsg?.valor || 'Parabéns! Sua adesão foi isenta. Bem-vindo à Praticcar!';
        setMsgAdesaoZerada(msg);

        // Gerar contrato normalmente
        const idContrato = await gerarContrato();
        if (!idContrato) return;

        // Marcar adesão como paga (nada a cobrar)
        await publicSupabase
          .from('contratos')
          .update({ adesao_paga: true })
          .eq('id', idContrato);

        // Criar instalação pós-adesão zerada
        try {
          await publicSupabase.functions.invoke('criar-instalacao-pos-pagamento', {
            body: { cotacaoId, skipPaymentCheck: true },
          });
        } catch (instErr) {
          console.error('[EtapaPagamento] Erro ao criar instalação (adesão zerada):', instErr);
        }

        setAdesaoZerada(true);
        setEtapaInterna('pago');

        // Avançar após breve delay
        setTimeout(() => onPagamentoConfirmado(), 1500);
        return;
      }

      // Se não está pago, continuar fluxo normal
      const idContrato = await gerarContrato();
      if (idContrato) {
        await criarCobranca(idContrato);
      }
    };
    inicializar();
  }, [cotacaoId, gerarContrato, criarCobranca, valorAdesao, onPagamentoConfirmado]);

  // 4. Polling automático para verificar pagamento - consulta diretamente na API do Asaas
  useEffect(() => {
    if (etapaInterna !== 'aguardando_pagamento' || !contratoId) return;

    const interval = setInterval(async () => {
      try {
        console.log('[EtapaPagamento] Verificação automática no Asaas...');
        
        // Chamar Edge Function que consulta diretamente na API do Asaas
        const { data: verificacao, error } = await publicSupabase.functions.invoke('asaas-verificar-pagamento', {
          body: { contratoId }
        });

        if (error) {
          console.error('[EtapaPagamento] Erro na verificação automática:', error);
          return;
        }

        console.log('[EtapaPagamento] Resultado verificação automática:', verificacao);

        if (verificacao?.pago) {
          console.log('[EtapaPagamento] Pagamento detectado automaticamente via Asaas!');
          toast.success('Pagamento confirmado!');
          
          // Criar instalação após pagamento confirmado
          try {
            console.log('[EtapaPagamento] Criando instalação pós-pagamento...');
            await publicSupabase.functions.invoke('criar-instalacao-pos-pagamento', {
              body: { cotacaoId }
            });
            console.log('[EtapaPagamento] Instalação criada com sucesso');
          } catch (instError) {
            console.error('[EtapaPagamento] Erro ao criar instalação:', instError);
          }

          setEtapaInterna('pago');
          
          // Pequeno delay para garantir propagação no banco
          await new Promise(resolve => setTimeout(resolve, 500));
          onPagamentoConfirmado();
        }
      } catch (error) {
        console.error('[EtapaPagamento] Erro no polling automático:', error);
      }
    }, 10000); // Verificar a cada 10 segundos

    return () => clearInterval(interval);
  }, [etapaInterna, contratoId, cotacaoId, onPagamentoConfirmado]);

  // Verificar pagamento manualmente - agora consulta diretamente no Asaas
  const verificarPagamento = async () => {
    if (!contratoId) return;

    try {
      setVerificando(true);
      console.log('[EtapaPagamento] Verificando pagamento diretamente no Asaas...');

      // Chamar Edge Function que consulta a API do Asaas
      const { data: verificacao, error } = await publicSupabase.functions.invoke('asaas-verificar-pagamento', {
        body: { contratoId }
      });

      if (error) {
        console.error('[EtapaPagamento] Erro na verificação:', error);
        throw error;
      }

      console.log('[EtapaPagamento] Resultado da verificação:', verificacao);

      if (verificacao?.pago) {
        toast.success('Pagamento confirmado!');

        // Criar instalação após pagamento confirmado
        try {
          console.log('[EtapaPagamento] Criando instalação pós-pagamento (manual)...');
          await publicSupabase.functions.invoke('criar-instalacao-pos-pagamento', {
            body: { cotacaoId }
          });
          console.log('[EtapaPagamento] Instalação criada com sucesso');
        } catch (instError) {
          console.error('[EtapaPagamento] Erro ao criar instalação:', instError);
        }

        setEtapaInterna('pago');
        
        // Pequeno delay para garantir que o banco propagou as alterações
        await new Promise(resolve => setTimeout(resolve, 500));
        onPagamentoConfirmado();
      } else {
        toast.info(`Pagamento ainda não identificado (Status: ${verificacao?.status || 'PENDING'}). Aguarde alguns minutos.`);
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

  // Componente reutilizável para detalhes da instalação agendada
  const InstalacaoAgendadaInfo = () => {
    if (tipoVistoria !== 'agendada' || !vistoriaAgendada) return null;
    
    return (
      <motion.div 
        className="mt-6 space-y-4"
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 max-w-md mx-auto">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Wrench className="h-5 w-5 text-primary" />
            <h4 className="font-semibold text-foreground">Instalação Agendada</h4>
          </div>
          
          <div className="space-y-3 text-left">
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-primary flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Data</p>
                <p className="text-sm font-medium">
                  {format(new Date(vistoriaAgendada.data + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </p>
              </div>
            </div>
            
            {vistoriaAgendada.horario && (
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-primary flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Horário</p>
                  <p className="text-sm font-medium">{vistoriaAgendada.horario}</p>
                </div>
              </div>
            )}
            
            {vistoriaAgendada.logradouro && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Local</p>
                  <p className="text-sm font-medium">
                    {vistoriaAgendada.logradouro}
                    {vistoriaAgendada.numero && `, ${vistoriaAgendada.numero}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {vistoriaAgendada.bairro}
                    {vistoriaAgendada.cidade && ` - ${vistoriaAgendada.cidade}`}
                    {vistoriaAgendada.estado && `/${vistoriaAgendada.estado}`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
          Aguardando Instalação
        </Badge>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          A Proteção 360º será ativada após a instalação do rastreador no seu veículo.
        </p>
      </motion.div>
    );
  };

  // ===== UI: Adesão Zerada (celebratória) =====
  if (adesaoZerada) {
    return (
      <Card className="border-success/30 bg-card/80 backdrop-blur-xl">
        <CardContent className="py-12 text-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="space-y-6"
          >
            <div className="w-24 h-24 mx-auto rounded-full bg-success/10 flex items-center justify-center">
              <PartyPopper className="h-12 w-12 text-success" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-foreground">Adesão Isenta!</h3>
              <p className="text-muted-foreground max-w-md mx-auto text-base leading-relaxed">
                {msgAdesaoZerada}
              </p>
            </div>

            <InstalacaoAgendadaInfo />

            <div className="pt-4 space-y-4">
              <Button
                size="lg"
                className="gap-2"
                onClick={() => window.location.href = '/login'}
              >
                <ExternalLink className="h-4 w-4" />
                Ir para o aplicativo
              </Button>

              <div className="flex items-center justify-center">
                <img
                  src="/pratic-logo.png"
                  alt="Praticcar"
                  className="h-8 opacity-60"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            </div>
          </motion.div>
        </CardContent>
      </Card>
    );
  }

  // Modo read-only: mostrar pagamento confirmado
  if (readOnly) {
    return (
      <Card className="border-success/30 bg-card/80 backdrop-blur-xl">
        <CardContent className="py-12 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
              <Check className="h-10 w-10 text-success" />
            </div>
            <h3 className="text-xl font-bold mb-2">Pagamento Confirmado!</h3>
            <p className="text-muted-foreground mb-4">
              Taxa de adesão paga com sucesso.
            </p>
            <p className="text-lg font-bold text-success">{formatCurrency(valorAdesao)}</p>
            
            <InstalacaoAgendadaInfo />
          </motion.div>
        </CardContent>
      </Card>
    );
  }

  // Estado de pagamento já confirmado
  if (etapaInterna === 'pago') {
    return (
      <Card className="border-success/30 bg-card/80 backdrop-blur-xl">
        <CardContent className="py-12 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
              <Check className="h-10 w-10 text-success" />
            </div>
            <h3 className="text-xl font-bold mb-2">Pagamento Confirmado!</h3>
            <p className="text-muted-foreground mb-4">
              Taxa de adesão paga com sucesso.
            </p>
            <p className="text-lg font-bold text-success">{formatCurrency(valorAdesao)}</p>
            
            <InstalacaoAgendadaInfo />
          </motion.div>
        </CardContent>
      </Card>
    );
  }

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
          {/* Abas de Forma de Pagamento */}
          <Tabs value={formaPagamento} onValueChange={(v) => setFormaPagamento(v as FormaPagamento)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="PIX" className="gap-2">
                <QrCode className="h-4 w-4" />
                PIX
              </TabsTrigger>
              <TabsTrigger value="CREDIT_CARD" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Cartão
              </TabsTrigger>
            </TabsList>

            {/* Conteúdo PIX */}
            <TabsContent value="PIX" className="space-y-4 mt-0">
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
                      className="w-48 h-48 mx-auto"
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
            </TabsContent>

            {/* Conteúdo Cartão de Crédito */}
            <TabsContent value="CREDIT_CARD" className="space-y-4 mt-0">
              <motion.div 
                className="text-center space-y-4"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                {/* Ícone decorativo */}
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <CreditCard className="h-10 w-10 text-primary" />
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground">Pague com Cartão de Crédito</h4>
                  <p className="text-sm text-muted-foreground">
                    Você será redirecionado para o ambiente seguro do Asaas para completar o pagamento.
                  </p>
                </div>

                {/* Badge de segurança */}
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Shield className="h-4 w-4 text-success" />
                  <span>Ambiente seguro PCI-DSS</span>
                </div>

                {/* Botão de pagamento com cartão */}
                <Button
                  className="w-full gap-2"
                  size="lg"
                  onClick={() => {
                    if (cobranca?.linkPagamento) {
                      window.open(cobranca.linkPagamento, '_blank');
                      toast.info('Página de pagamento aberta. Complete o pagamento e volte aqui.');
                    }
                  }}
                  disabled={!cobranca?.linkPagamento}
                >
                  <CreditCard className="h-5 w-5" />
                  Pagar com Cartão
                  <ExternalLink className="h-4 w-4" />
                </Button>

                <p className="text-xs text-muted-foreground">
                  Após o pagamento, a confirmação é automática
                </p>
              </motion.div>
            </TabsContent>
          </Tabs>

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
                  <Clock className="h-4 w-4" />
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
