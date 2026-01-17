import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Car, CheckCircle2 } from 'lucide-react';
import { useCotacaoContratacao } from '@/hooks/useCotacaoContratacao';
import { StepperCotacao, type Step } from '@/components/cotacao-publica/StepperCotacao';
import { EscolhaPlano } from '@/components/cotacao-publica/EscolhaPlano';
import { EtapaDadosPessoaisDocumentos } from '@/components/cotacao-publica/EtapaDadosPessoaisDocumentos';
import { EtapaAssinaturaContrato } from '@/components/cotacao-publica/EtapaAssinaturaContrato';
import { EtapaVistoria } from '@/components/cotacao-publica/EtapaVistoria';
import { EtapaPagamentoCotacao } from '@/components/cotacao-publica/EtapaPagamentoCotacao';
import type { DadosPessoaisForm } from '@/components/cotacao-publica/FormularioDadosPessoais';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatarMoeda } from '@/config/pricing';
import { motion, AnimatePresence } from 'framer-motion';

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
  } = useCotacaoContratacao(token);

  const [planoSelecionadoId, setPlanoSelecionadoId] = useState<string | null>(null);

  // Sincronizar etapa com status da cotação
  useEffect(() => {
    if (cotacao?.status_contratacao) {
      const etapa = determinarEtapa(cotacao.status_contratacao);
      setEtapaAtual(etapa);
    }
  }, [cotacao?.status_contratacao, determinarEtapa, setEtapaAtual]);

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
                onStepClick={(step) => step < etapaAtual && setEtapaAtual(step)}
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
                    clienteNome={cotacao.nome_solicitante || ''}
                    clienteEmail={cotacao.email_solicitante || ''}
                    onContratoAssinado={() => setEtapaAtual(3)}
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
                    onPagamentoConfirmado={() => setEtapaAtual(5)}
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
                  <Card className="border-success/30 bg-card/80 backdrop-blur-xl">
                    <CardContent className="py-16 text-center">
                      <motion.div 
                        className="w-20 h-20 mx-auto mb-6 rounded-full bg-success/10 flex items-center justify-center"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                      >
                        <CheckCircle2 className="h-10 w-10 text-success" />
                      </motion.div>
                      <h2 className="text-2xl font-bold mb-3 text-foreground">Proteção Ativada!</h2>
                      <p className="text-muted-foreground max-w-sm mx-auto">
                        Parabéns! Seu veículo está protegido. Você receberá um e-mail com todos os detalhes da sua cobertura.
                      </p>
                    </CardContent>
                  </Card>
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
