import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Car, CheckCircle2, CalendarCheck, Calendar, Clock, MapPin, PartyPopper, Shield, Loader2, Puzzle, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useCotacaoContratacao } from '@/hooks/useCotacaoContratacao';
import { useAgendamentoExistente } from '@/hooks/useAgendamentoExistente';
import { StepperCotacao, type Step } from '@/components/cotacao-publica/StepperCotacao';
import { EscolhaPlano } from '@/components/cotacao-publica/EscolhaPlano';
import { EtapaDadosPessoaisDocumentos } from '@/components/cotacao-publica/EtapaDadosPessoaisDocumentos';
import { EtapaAssinaturaContrato } from '@/components/cotacao-publica/EtapaAssinaturaContrato';
import { EtapaVistoria } from '@/components/cotacao-publica/EtapaVistoria';
import { EtapaPagamentoCotacao } from '@/components/cotacao-publica/EtapaPagamentoCotacao';
import { AgendamentoVistoriaCompleta } from '@/components/cotacao-publica/AgendamentoVistoriaCompleta';
import { DocumentosPendentesPublico } from '@/components/cotacao-publica/DocumentosPendentesPublico';
import { AgendamentoBaseResumo } from '@/components/cotacao-publica/AgendamentoBaseResumo';
import { NavegacaoEtapas } from '@/components/cotacao-publica/NavegacaoEtapas';
import type { DadosPessoaisForm } from '@/components/cotacao-publica/FormularioDadosPessoais';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatarMoeda } from '@/config/pricing';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';

// NOVO FLUXO: 1-Plano, 2-Docs, 3-Contrato (Autentique), 4-Vistoria, 5-Pagamento
const STEPS: Step[] = [
  { id: 'plano', label: 'Escolha do Plano', description: 'Selecione seu plano' },
  { id: 'documentos', label: 'Documentos', description: 'Envie seus dados' },
  { id: 'contrato', label: 'Contrato', description: 'Assine digitalmente' },
  { id: 'vistoria', label: 'Vistoria', description: 'Tire as fotos' },
  { id: 'pagamento', label: 'Pagamento', description: 'Ative sua cobertura' },
];

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
};

export default function CotacaoContratacao() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    cotacao,
    isLoading,
    error,
    planosDisponiveis,
    etapaAtual,
    setEtapaAtual,
    determinarEtapa,
    selecionarPlano,
    salvarDadosPessoais,
    isPending,
    // Novos campos para documentos pendentes
    associadoId,
    associadoStatus,
    contratoLinkToken,
    docsPendentes,
    refetch,
    refetchDocs,
  } = useCotacaoContratacao(token);

  // Verificar se já existe agendamento nas tabelas operacionais (fonte da verdade)
  const { hasVistoriaAgendada, hasInstalacaoAgendada, hasAgendamentoBase, isLoading: isLoadingAgendamento } = useAgendamentoExistente(cotacao?.id);
  
  // Estado local para travar UI após agendamento bem-sucedido
  const [agendamentoConcluido, setAgendamentoConcluido] = useState(false);

  // Estado para navegação manual (quando usuário clica em etapas anteriores para revisar)
  const [navegacaoManual, setNavegacaoManual] = useState(false);

  const [planoSelecionadoId, setPlanoSelecionadoId] = useState<string | null>(null);

  // Determinar etapa baseada no status para saber o que está concluído
  // IMPORTANTE: Se tipo_vistoria já está preenchido, considera vistoria como concluída (etapa 4+)
  const etapaDoStatus = useMemo(() => {
    if (!cotacao?.status_contratacao) return 0;
    
    const etapaBase = determinarEtapa(cotacao.status_contratacao);
    
    // Se vistoria já foi escolhida/agendada (tipo_vistoria preenchido) e ainda está na etapa 3,
    // avança para a etapa 4 (pagamento) para não pedir agendamento novamente
    if (etapaBase === 3 && cotacao.tipo_vistoria) {
      return 4;
    }
    
    return etapaBase;
  }, [cotacao?.status_contratacao, cotacao?.tipo_vistoria, determinarEtapa]);

  // Função para verificar se uma etapa específica já foi concluída
  // Isso garante o modo somente leitura mesmo quando o cliente volta para etapas anteriores
  const isEtapaConcluida = useCallback((etapaIndex: number): boolean => {
    if (!cotacao?.status_contratacao) return false;
    
    const statusConcluidos = {
      plano: ['plano_escolhido', 'dados_preenchidos', 'documentos_ok', 'contrato_assinado', 'vistoria_ok', 'pagamento_ok', 'contrato_gerado', 'ativo'],
      documentos: ['dados_preenchidos', 'documentos_ok', 'contrato_assinado', 'vistoria_ok', 'pagamento_ok', 'contrato_gerado', 'ativo'],
      contrato: ['contrato_assinado', 'vistoria_ok', 'pagamento_ok', 'contrato_gerado', 'ativo'],
      vistoria: ['vistoria_ok', 'pagamento_ok', 'contrato_gerado', 'ativo'],
      pagamento: ['pagamento_ok', 'contrato_gerado', 'ativo'],
    };
    
    switch (etapaIndex) {
      case 0: // Plano - concluído se plano_escolhido_id existe
        return !!cotacao.plano_escolhido_id || statusConcluidos.plano.includes(cotacao.status_contratacao);
      case 1: // Documentos - concluído se status >= dados_preenchidos
        return statusConcluidos.documentos.includes(cotacao.status_contratacao);
      case 2: // Contrato - concluído se status >= contrato_assinado
        return statusConcluidos.contrato.includes(cotacao.status_contratacao);
      case 3: // Vistoria - concluído se tipo_vistoria está preenchido OU status >= vistoria_ok
        return !!cotacao.tipo_vistoria || statusConcluidos.vistoria.includes(cotacao.status_contratacao);
      case 4: // Pagamento - concluído se status >= pagamento_ok
        return statusConcluidos.pagamento.includes(cotacao.status_contratacao);
      default:
        return false;
    }
  }, [cotacao?.status_contratacao, cotacao?.plano_escolhido_id, cotacao?.tipo_vistoria]);

  // Redirecionar para /acompanhar/:link_token quando associado está em_analise ou ativo
  // Isso garante que o cliente veja a tela de acompanhamento após a vistoria ser concluída
  useEffect(() => {
    if (associadoStatus && ['em_analise', 'ativo'].includes(associadoStatus) && contratoLinkToken) {
      console.log('[CotacaoContratacao] Redirecionando para /acompanhar:', contratoLinkToken, 'status:', associadoStatus);
      navigate(`/acompanhar/${contratoLinkToken}`, { replace: true });
    }
  }, [associadoStatus, contratoLinkToken, navigate]);

  // Sincronizar etapa com status da cotação (apenas se não está em navegação manual)
  useEffect(() => {
    // Não sincronizar se usuário está navegando manualmente (revisando etapas anteriores)
    if (navegacaoManual) return;
    
    if (cotacao?.status_contratacao) {
      let etapa = determinarEtapa(cotacao.status_contratacao);
      
      // Se vistoria já foi escolhida/agendada, avança para pagamento
      if (etapa === 3 && cotacao.tipo_vistoria) {
        etapa = 4;
      }
      
      setEtapaAtual(etapa);
    }
  }, [cotacao?.status_contratacao, cotacao?.tipo_vistoria, determinarEtapa, setEtapaAtual, navegacaoManual]);

  // Handler para navegação no Stepper
  const handleStepClick = useCallback((step: number) => {
    if (step <= etapaDoStatus) {
      setNavegacaoManual(true);
      setEtapaAtual(step);
    }
  }, [etapaDoStatus, setEtapaAtual]);

  // Handler para avançar para próxima etapa
  const handleAvancar = useCallback(() => {
    if (etapaAtual < etapaDoStatus) {
      setEtapaAtual(etapaAtual + 1);
    }
    // Se chegou na etapa atual do status, desativa navegação manual
    if (etapaAtual + 1 >= etapaDoStatus) {
      setNavegacaoManual(false);
    }
  }, [etapaAtual, etapaDoStatus, setEtapaAtual]);

  // Handler para voltar para etapa anterior
  const handleVoltar = useCallback(() => {
    if (etapaAtual > 0) {
      setNavegacaoManual(true);
      setEtapaAtual(etapaAtual - 1);
    }
  }, [etapaAtual, setEtapaAtual]);

  // Pré-selecionar plano se já escolhido
  useEffect(() => {
    if (cotacao?.plano_escolhido_id) {
      setPlanoSelecionadoId(cotacao.plano_escolhido_id);
    }
  }, [cotacao?.plano_escolhido_id]);

  const handleSelecionarPlano = () => {
    if (planoSelecionadoId) {
      selecionarPlano(planoSelecionadoId);
    }
  };

  const handleSalvarDados = (dados: DadosPessoaisForm) => {
    salvarDadosPessoais(dados);
  };

  // Loading
  if (isLoading) {
    return (
      <div className="dark min-h-screen public-premium-bg p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-24 w-full rounded-xl bg-white/5" />
          <div className="grid md:grid-cols-[280px_1fr] gap-6">
            <Skeleton className="h-80 rounded-xl bg-white/5" />
            <Skeleton className="h-[500px] rounded-xl bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  // Error / Not Found
  if (error || !cotacao) {
    return (
      <div className="dark min-h-screen public-premium-bg flex items-center justify-center p-4">
        {/* Ambient glow effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-accent/5 blur-[100px]" />
        </div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="relative z-10"
        >
          <Card className="max-w-md w-full border-destructive/30 bg-card/80 backdrop-blur-xl">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <h1 className="text-xl font-bold mb-2 text-foreground">Cotação não encontrada</h1>
              <p className="text-muted-foreground">
                Esta cotação não existe, expirou ou o link está incorreto.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Contrato já gerado
  if (cotacao.status_contratacao === 'contrato_gerado' && cotacao.contrato_gerado_id) {
    return (
      <div className="dark min-h-screen public-premium-bg flex items-center justify-center p-4">
        {/* Ambient glow effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full bg-success/10 blur-[120px]" />
          <div className="absolute bottom-1/3 right-1/4 w-72 h-72 rounded-full bg-primary/10 blur-[100px]" />
        </div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: 'spring' }}
          className="relative z-10"
        >
          <Card className="max-w-md w-full border-success/30 bg-card/80 backdrop-blur-xl">
            <CardContent className="pt-8 pb-8 text-center">
              <motion.div 
                className="w-20 h-20 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              >
                <CheckCircle2 className="h-10 w-10 text-success" />
              </motion.div>
              <h1 className="text-2xl font-bold mb-2 text-foreground">Contrato Gerado!</h1>
              <p className="text-muted-foreground mb-6">
                Seu contrato foi gerado com sucesso. Em breve você receberá um e-mail para assinatura.
              </p>
              <Badge variant="outline" className="text-lg px-6 py-2 border-success/30 text-success">
                {cotacao.numero}
              </Badge>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Default values para formulário de dados pessoais
  const dadosPessoaisDefault: Partial<DadosPessoaisForm> = {
    nome: cotacao.nome_solicitante || '',
    email: cotacao.email_solicitante || '',
    telefone: cotacao.telefone1_solicitante || '',
    cpf: cotacao.cliente_cpf || '',
    data_nascimento: cotacao.cliente_data_nascimento || '',
    cep: cotacao.cliente_cep || '',
    logradouro: cotacao.cliente_logradouro || '',
    numero: cotacao.cliente_numero || '',
    complemento: cotacao.cliente_complemento || '',
    bairro: cotacao.cliente_bairro || '',
    cidade: cotacao.cliente_cidade || '',
    uf: cotacao.cliente_uf || '',
  };

  return (
    <div className="dark min-h-screen public-premium-bg relative">
      {/* Ambient glow - simplified */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)]" />
      </div>

      {/* Header Premium com Logo */}
      <motion.header 
        className="header-premium-glow text-white sticky top-0 z-20"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, type: 'spring' }}
      >
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-white/20 blur-xl rounded-full" />
              <img 
                src="/pratic-logo.png" 
                alt="PRATIC" 
                className="h-12 w-12 object-contain rounded-lg bg-white/10 p-1 relative z-10"
              />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">PRATIC</h1>
              <p className="text-xs text-white/60">Proteção Veicular</p>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className="border-white/20 text-white bg-white/5 backdrop-blur-sm px-4"
          >
            Cotação {cotacao.numero}
          </Badge>
        </div>
      </motion.header>

      {/* Vehicle Info Bar */}
      <motion.div 
        className="bg-card/50 backdrop-blur-md border-b border-border/50 relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 text-sm flex-wrap">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Car className="h-4 w-4" />
              <span className="font-medium text-foreground">
                {cotacao.veiculo_marca} {cotacao.veiculo_modelo}
              </span>
            </div>
            {cotacao.veiculo_ano && (
              <Badge variant="secondary" className="text-xs bg-white/5 border-white/10">
                {cotacao.veiculo_ano}
              </Badge>
            )}
            {cotacao.valor_fipe && (
              <span className="text-muted-foreground hidden sm:inline">
                FIPE: <span className="font-medium text-foreground">{formatarMoeda(cotacao.valor_fipe)}</span>
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 relative z-10">
        <div className="space-y-8">
          {/* Stepper - Horizontal no Desktop, compacto no Mobile */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <Card className="p-4 stepper-card-premium">
              <StepperCotacao
                steps={STEPS}
                currentStep={etapaAtual}
                onStepClick={handleStepClick}
                maxReachableStep={etapaDoStatus}
              />
            </Card>
          </motion.div>

          {/* Step Content - Largura Total */}
          <div className="w-full">
            <AnimatePresence mode="wait">
              {/* Etapa 0: Escolha do Plano */}
              {etapaAtual === 0 && (
                <motion.div
                  key="plano"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                <EscolhaPlano
                    planos={planosDisponiveis}
                    planoSelecionadoId={planoSelecionadoId}
                    onSelectPlano={setPlanoSelecionadoId}
                    onConfirmar={handleSelecionarPlano}
                    isLoading={isPending}
                    categoriaVeiculo={(cotacao as { categoria_veiculo?: string }).categoria_veiculo}
                    readOnly={isEtapaConcluida(0)}
                  />
                  <NavegacaoEtapas
                    etapaAtual={etapaAtual}
                    etapaMaxima={etapaDoStatus}
                    totalEtapas={STEPS.length}
                    onVoltar={handleVoltar}
                    onAvancar={handleAvancar}
                    navegacaoManual={navegacaoManual}
                  />
                </motion.div>
              )}

              {/* Etapa 1: Documentos e Dados (Unificado) */}
              {etapaAtual === 1 && (
                <motion.div
                  key="documentos"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                <EtapaDadosPessoaisDocumentos
                    cotacaoId={cotacao.id}
                    onSubmit={handleSalvarDados}
                    defaultValues={dadosPessoaisDefault}
                    isLoading={isPending}
                    readOnly={isEtapaConcluida(1)}
                  />
                  <NavegacaoEtapas
                    etapaAtual={etapaAtual}
                    etapaMaxima={etapaDoStatus}
                    totalEtapas={STEPS.length}
                    onVoltar={handleVoltar}
                    onAvancar={handleAvancar}
                    navegacaoManual={navegacaoManual}
                  />
                </motion.div>
              )}

              {/* Etapa 2: Assinatura do Contrato (NOVA ETAPA) */}
              {etapaAtual === 2 && (
                <motion.div
                  key="contrato"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                <EtapaAssinaturaContrato
                    cotacaoId={cotacao.id}
                    tokenPublico={token || cotacao.token_publico || ''}
                    clienteNome={cotacao.nome_solicitante || ''}
                    clienteEmail={cotacao.email_solicitante || ''}
                    onContratoAssinado={() => setEtapaAtual(3)}
                    readOnly={isEtapaConcluida(2)}
                  />
                  <NavegacaoEtapas
                    etapaAtual={etapaAtual}
                    etapaMaxima={etapaDoStatus}
                    totalEtapas={STEPS.length}
                    onVoltar={handleVoltar}
                    onAvancar={handleAvancar}
                    navegacaoManual={navegacaoManual}
                  />
                </motion.div>
              )}

              {/* Etapa 3: Vistoria */}
              {etapaAtual === 3 && (
                <motion.div
                  key="vistoria"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                <EtapaVistoria
                    cotacaoId={cotacao.id}
                    tipoVeiculo={cotacao.categoria === 'moto' ? 'moto' : 'carro'}
                    onComplete={() => setEtapaAtual(4)}
                    onAgendar={() => setEtapaAtual(4)}
                    readOnly={isEtapaConcluida(3)}
                    tipoVistoriaRealizada={cotacao.tipo_vistoria as 'autovistoria' | 'agendada' | undefined}
                  />
                  <NavegacaoEtapas
                    etapaAtual={etapaAtual}
                    etapaMaxima={etapaDoStatus}
                    totalEtapas={STEPS.length}
                    onVoltar={handleVoltar}
                    onAvancar={handleAvancar}
                    navegacaoManual={navegacaoManual}
                  />
                </motion.div>
              )}

              {/* Etapa 4: Pagamento */}
              {etapaAtual === 4 && (
                <motion.div
                  key="pagamento"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                <EtapaPagamentoCotacao
                    cotacaoId={cotacao.id}
                    valorAdesao={cotacao.valor_adesao || 0}
                    clienteNome={cotacao.nome_solicitante || ''}
                    clienteEmail={cotacao.email_solicitante || ''}
                    clienteCpf={cotacao.cliente_cpf || ''}
                    onPagamentoConfirmado={async () => {
                      // Invalidar e refetch para garantir dados atualizados na Etapa 5
                      await queryClient.invalidateQueries({ queryKey: ['cotacao-contratacao', token] });
                      await refetch();
                      setEtapaAtual(5);
                    }}
                    readOnly={isEtapaConcluida(4)}
                    tipoVistoria={cotacao.tipo_vistoria as 'autovistoria' | 'agendada'}
                    vistoriaAgendada={cotacao.vistoria_data_agendada ? {
                      data: cotacao.vistoria_data_agendada,
                      horario: cotacao.vistoria_horario_agendado || undefined,
                      logradouro: cotacao.vistoria_endereco_logradouro || undefined,
                      numero: cotacao.vistoria_endereco_numero || undefined,
                      bairro: cotacao.vistoria_endereco_bairro || undefined,
                      cidade: cotacao.vistoria_endereco_cidade || undefined,
                      estado: cotacao.vistoria_endereco_estado || undefined,
                    } : undefined}
                  />
                  <NavegacaoEtapas
                    etapaAtual={etapaAtual}
                    etapaMaxima={etapaDoStatus}
                    totalEtapas={STEPS.length}
                    onVoltar={handleVoltar}
                    onAvancar={handleAvancar}
                    navegacaoManual={navegacaoManual}
                  />
                </motion.div>
              )}

              {/* Etapa 5: Conclusão */}
              {etapaAtual === 5 && (
                <motion.div
                  key="conclusao"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  {/* COBERTURA TOTAL ATIVADA - Tela de boas-vindas */}
                  {cotacao?.status_contratacao === 'ativo' ? (
                    <Card className="border-green-500/30 bg-card/80 backdrop-blur-xl">
                      <CardContent className="py-12 text-center space-y-6">
                        <motion.div 
                          className="w-20 h-20 mx-auto rounded-full bg-green-500/10 flex items-center justify-center"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                        >
                          <PartyPopper className="h-10 w-10 text-green-500" />
                        </motion.div>
                        
                        <div>
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 mb-4">
                            Cobertura Total Ativada
                          </Badge>
                          <h2 className="text-2xl font-bold mb-3 text-foreground">
                            Bem-vindo à PRATIC!
                          </h2>
                          <p className="text-muted-foreground max-w-md mx-auto">
                            Seu veículo <strong className="text-foreground">{cotacao?.veiculo_placa}</strong> está protegido com <strong className="text-green-400">cobertura total</strong>.
                            Instalação e vistoria foram concluídas com sucesso!
                          </p>
                        </div>

                        {/* Checklist visual */}
                        <div className="bg-muted/30 rounded-lg p-4 max-w-md mx-auto text-left space-y-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                            <span className="text-sm text-muted-foreground">Documentos verificados</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                            <span className="text-sm text-muted-foreground">Contrato assinado</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                            <span className="text-sm text-muted-foreground">Vistoria aprovada</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                            <span className="text-sm text-muted-foreground">Rastreador instalado</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Shield className="h-5 w-5 text-primary flex-shrink-0" />
                            <span className="text-sm font-medium text-primary">Cobertura total ativada</span>
                          </div>
                        </div>

                        <div className="pt-4">
                          <p className="text-sm text-muted-foreground mb-3">
                            Baixe nosso aplicativo para acessar todos os serviços:
                          </p>
                          <div className="flex justify-center gap-4">
                            <div className="bg-muted/50 rounded-lg px-4 py-2 text-sm">
                              📱 Em breve na App Store
                            </div>
                            <div className="bg-muted/50 rounded-lg px-4 py-2 text-sm">
                              📱 Em breve no Google Play
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : docsPendentes && docsPendentes.length > 0 && associadoId ? (
                    <DocumentosPendentesPublico
                      associadoId={associadoId}
                      docsPendentes={docsPendentes}
                      onTodosEnviados={() => {
                        // Recarregar dados para atualizar estado
                        refetch();
                        refetchDocs();
                      }}
                    />
                  ) : cotacao?.tipo_vistoria === 'autovistoria' ? (
                    // ========== FLUXO AUTOVISTORIA ==========
                    // Verificar se já agendou instalação: campo da cotação OU registro na tabela OU estado local
                    (cotacao?.vistoria_completa_data_agendada || hasInstalacaoAgendada || agendamentoConcluido) ? (
                      // Instalação já agendada - mostrar tela de análise
                      <Card className="border-primary/30 bg-card/80 backdrop-blur-xl">
                        <CardContent className="py-12 text-center space-y-6">
                          <motion.div 
                            className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                          >
                            <Clock className="h-10 w-10 text-primary" />
                          </motion.div>
                          
                          <div>
                            <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 mb-4">
                              Em Análise Cadastral
                            </Badge>
                            <h2 className="text-2xl font-bold mb-3 text-foreground">
                              Sua proposta está sendo analisada
                            </h2>
                            <p className="text-muted-foreground max-w-md mx-auto">
                              Seus documentos, contrato assinado e imagens da vistoria estão sendo analisados pelo nosso setor de cadastro. Você será notificado sobre a aprovação em breve.
                            </p>
                          </div>

                          {/* Checklist visual do que foi concluído */}
                          <div className="bg-muted/30 rounded-lg p-4 max-w-md mx-auto text-left space-y-3">
                            <p className="text-sm font-medium text-foreground mb-3">O que já foi recebido:</p>
                            
                            <div className="flex items-center gap-3">
                              <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                              <span className="text-sm text-muted-foreground">Contrato assinado digitalmente</span>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                              <span className="text-sm text-muted-foreground">Autovistoria realizada (fotos do veículo)</span>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                              <span className="text-sm text-muted-foreground">Pagamento de adesão confirmado</span>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                              <span className="text-sm text-muted-foreground">Instalação do rastreador agendada</span>
                            </div>
                          </div>

                          {/* Detalhes do agendamento da instalação */}
                          {cotacao?.vistoria_completa_data_agendada && (
                            <div className="bg-muted/30 rounded-lg p-4 max-w-md mx-auto text-left space-y-3">
                              <div className="flex items-center gap-2 mb-3">
                                <CalendarCheck className="h-5 w-5 text-primary" />
                                <span className="font-medium text-foreground">Instalação Agendada</span>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
                                <div>
                                  <p className="text-sm text-muted-foreground">Data</p>
                                  <p className="font-medium">
                                    {format(new Date(cotacao.vistoria_completa_data_agendada + 'T12:00:00'), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                  </p>
                                </div>
                              </div>
                              
                              {cotacao?.vistoria_completa_horario_agendado && (
                                <div className="flex items-center gap-3">
                                  <Clock className="h-5 w-5 text-primary flex-shrink-0" />
                                  <div>
                                    <p className="text-sm text-muted-foreground">Horário</p>
                                    <p className="font-medium">{cotacao.vistoria_completa_horario_agendado}</p>
                                  </div>
                                </div>
                              )}
                              
                              {cotacao?.vistoria_completa_endereco_logradouro && (
                                <div className="flex items-start gap-3">
                                  <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                  <div>
                                    <p className="text-sm text-muted-foreground">Local</p>
                                    <p className="font-medium">
                                      {cotacao.vistoria_completa_endereco_logradouro}
                                      {cotacao.vistoria_completa_endereco_numero && `, ${cotacao.vistoria_completa_endereco_numero}`}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {cotacao.vistoria_completa_endereco_bairro}
                                      {cotacao.vistoria_completa_endereco_cidade && ` - ${cotacao.vistoria_completa_endereco_cidade}`}
                                      {cotacao.vistoria_completa_endereco_estado && `/${cotacao.vistoria_completa_endereco_estado}`}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Encaixe de horários ativado */}
                          {cotacao?.vistoria_permite_encaixe && (
                            <div className="flex items-start gap-3 bg-primary/10 border border-primary/30 rounded-lg p-4 max-w-md mx-auto">
                              <div className="p-2 rounded-full bg-primary/20 flex-shrink-0">
                                <Puzzle className="h-5 w-5 text-primary" />
                              </div>
                              <div className="text-left">
                                <span className="font-semibold text-primary">Encaixe de Horários Ativado</span>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Se um instalador estiver próximo antes do horário agendado, 
                                  ele poderá realizar a instalação antecipadamente. 
                                  Você será notificado previamente.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Aviso importante */}
                          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 max-w-md mx-auto">
                            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-left text-amber-200">
                              <strong>Próximo passo:</strong> Após a aprovação do setor de cadastro, a <strong>cobertura de Roubo e Furto</strong> será ativada. 
                              A cobertura <strong>TOTAL</strong> será ativada após a instalação do rastreador.
                            </p>
                          </div>

                          <p className="text-sm text-muted-foreground">
                            Você receberá um e-mail com a atualização do status da sua proposta.
                          </p>
                        </CardContent>
                      </Card>
                    ) : isLoadingAgendamento ? (
                      // Carregando verificação de agendamento existente
                      <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
                        <CardContent className="py-12 text-center space-y-4">
                          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                          <p className="text-muted-foreground">Verificando status do agendamento...</p>
                        </CardContent>
                      </Card>
                    ) : (
                      // Autovistoria concluída, mas ainda precisa agendar instalação
                      <AgendamentoVistoriaCompleta
                        cotacaoId={cotacao.id}
                        tipoVistoria="autovistoria"
                        clienteNome={cotacao?.vistoria_completa_responsavel_nome || cotacao?.nome_solicitante || ''}
                        clienteTelefone={cotacao?.vistoria_completa_responsavel_telefone || cotacao?.telefone1_solicitante}
                        clienteEmail={cotacao?.email_solicitante}
                        veiculoPlaca={cotacao?.veiculo_placa}
                        veiculoDescricao={`${cotacao?.veiculo_marca || ''} ${cotacao?.veiculo_modelo || ''}`.trim()}
                        onConfirmar={() => {
                          setAgendamentoConcluido(true);
                          queryClient.invalidateQueries({ queryKey: ['cotacao-contratacao'] });
                          queryClient.invalidateQueries({ queryKey: ['instalacao-existente'] });
                          queryClient.invalidateQueries({ queryKey: ['vistoria-existente'] });
                          queryClient.invalidateQueries({ queryKey: ['agendamento-base-existente'] });
                          refetch();
                        }}
                      />
                    )
                  ) : cotacao?.tipo_vistoria === 'agendada' ? (
                    // ========== FLUXO VISTORIA PRESENCIAL (AGENDADA) ==========
                    // Cliente já agendou na Etapa 3 - NUNCA mostrar formulário de agendamento aqui
                    cotacao?.vistoria_data_agendada ? (
                      // Tem dados do agendamento - mostrar detalhes
                      <Card className="border-primary/30 bg-card/80 backdrop-blur-xl">
                        <CardContent className="py-12 text-center space-y-6">
                          <motion.div 
                            className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                          >
                            <CalendarCheck className="h-10 w-10 text-primary" />
                          </motion.div>
                          
                          <div>
                            <Badge className="bg-primary/20 text-primary border-primary/30 mb-4">
                              Agendamento Confirmado
                            </Badge>
                            <h2 className="text-2xl font-bold mb-3 text-foreground">
                              Vistoria Agendada com Sucesso!
                            </h2>
                          </div>

                          {/* Detalhes do agendamento */}
                          <div className="bg-muted/30 rounded-lg p-4 max-w-md mx-auto text-left space-y-3">
                            {cotacao?.vistoria_data_agendada && (
                              <div className="flex items-center gap-3">
                                <Calendar className="h-5 w-5 text-primary flex-shrink-0" />
                                <div>
                                  <p className="text-sm text-muted-foreground">Data</p>
                                  <p className="font-medium">
                                    {format(new Date(cotacao.vistoria_data_agendada + 'T12:00:00'), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                  </p>
                                </div>
                              </div>
                            )}
                            
                            {cotacao?.vistoria_horario_agendado && (
                              <div className="flex items-center gap-3">
                                <Clock className="h-5 w-5 text-primary flex-shrink-0" />
                                <div>
                                  <p className="text-sm text-muted-foreground">Horário</p>
                                  <p className="font-medium">{cotacao.vistoria_horario_agendado}</p>
                                </div>
                              </div>
                            )}
                            
                            {cotacao?.vistoria_endereco_logradouro && (
                              <div className="flex items-start gap-3">
                                <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-sm text-muted-foreground">Local</p>
                                  <p className="font-medium">
                                    {cotacao.vistoria_endereco_logradouro}
                                    {cotacao.vistoria_endereco_numero && `, ${cotacao.vistoria_endereco_numero}`}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {cotacao.vistoria_endereco_bairro}
                                    {cotacao.vistoria_endereco_cidade && ` - ${cotacao.vistoria_endereco_cidade}`}
                                    {cotacao.vistoria_endereco_estado && `/${cotacao.vistoria_endereco_estado}`}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Encaixe de horários ativado - Vistoria Presencial */}
                          {cotacao?.vistoria_permite_encaixe && (
                            <div className="flex items-start gap-3 bg-primary/10 border border-primary/30 rounded-lg p-4 max-w-md mx-auto">
                              <div className="p-2 rounded-full bg-primary/20 flex-shrink-0">
                                <Puzzle className="h-5 w-5 text-primary" />
                              </div>
                              <div className="text-left">
                                <span className="font-semibold text-primary">Encaixe de Horários Ativado</span>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Se um vistoriador estiver próximo antes do horário agendado, 
                                  ele poderá realizar a vistoria antecipadamente. 
                                  Você será notificado previamente.
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Aviso importante */}
                          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 max-w-md mx-auto">
                            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-left text-amber-200">
                              <strong>Importante:</strong> A cobertura do seu veículo será ativada 
                              após a realização da vistoria presencial.
                            </p>
                          </div>

                          <p className="text-sm text-muted-foreground">
                            Aguarde o contato do vistoriador no dia agendado.
                          </p>
                        </CardContent>
                      </Card>
                    ) : isLoadingAgendamento ? (
                      <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
                        <CardContent className="py-12 text-center space-y-4">
                          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                          <p className="text-muted-foreground">Verificando status...</p>
                        </CardContent>
                      </Card>
                    ) : (
                      // Vistoria presencial agendada mas dados ainda não sincronizados - mostrar confirmação genérica
                      <Card className="border-primary/30 bg-card/80 backdrop-blur-xl">
                        <CardContent className="py-12 text-center space-y-4">
                          <motion.div 
                            className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                          >
                            <CalendarCheck className="h-8 w-8 text-primary" />
                          </motion.div>
                          <h2 className="text-xl font-bold text-foreground">Agendamento Confirmado!</h2>
                          <p className="text-muted-foreground">
                            Sua vistoria presencial foi agendada com sucesso.<br />
                            Aguarde o contato do vistoriador.
                          </p>
                        </CardContent>
                      </Card>
                    )
                  ) : (cotacao?.tipo_vistoria === 'agendada_base' || hasAgendamentoBase) ? (
                    // ========== FLUXO AGENDAMENTO NA BASE ==========
                    <Card className="border-primary/30 bg-card/80 backdrop-blur-xl">
                      <CardContent className="py-12 text-center space-y-6">
                        <motion.div 
                          className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                        >
                          <Building2 className="h-10 w-10 text-primary" />
                        </motion.div>
                        
                        <div>
                          <Badge className="bg-primary/20 text-primary border-primary/30 mb-4">
                            Agendamento na Base Confirmado
                          </Badge>
                          <h2 className="text-2xl font-bold mb-3 text-foreground">
                            Vistoria Agendada com Sucesso!
                          </h2>
                          <p className="text-muted-foreground max-w-md mx-auto">
                            Compareça à base PRATIC na data e horário agendados 
                            com seu veículo para realizar a vistoria.
                          </p>
                        </div>

                        {/* Detalhes do agendamento - buscar de agendamentos_base */}
                        <AgendamentoBaseResumo cotacaoId={cotacao.id} />

                        {/* Aviso importante */}
                        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 max-w-md mx-auto">
                          <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-left text-amber-200">
                            <strong>Importante:</strong> A cobertura será ativada após a realização 
                            da vistoria presencial na base.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    // ========== FALLBACK: Tipo não definido ou estado inconsistente ==========
                    <Card className="border-border/50 bg-card/80 backdrop-blur-xl">
                      <CardContent className="py-12 text-center space-y-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                        <p className="text-muted-foreground">Verificando status da sua proposta...</p>
                      </CardContent>
                    </Card>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 mt-auto relative z-10 bg-card/30 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} PRATIC - Proteção Veicular. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
