import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Car, CheckCircle2 } from 'lucide-react';
import { useCotacaoContratacao } from '@/hooks/useCotacaoContratacao';
import { StepperCotacao, type Step } from '@/components/cotacao-publica/StepperCotacao';
import { EscolhaPlano } from '@/components/cotacao-publica/EscolhaPlano';
import { FormularioDadosPessoais, type DadosPessoaisForm } from '@/components/cotacao-publica/FormularioDadosPessoais';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { formatarMoeda } from '@/config/pricing';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

const STEPS: Step[] = [
  { id: 'plano', label: 'Escolha do Plano', description: 'Selecione seu plano' },
  { id: 'dados', label: 'Dados Pessoais', description: 'Preencha seus dados' },
  { id: 'documentos', label: 'Documentos', description: 'Envie seus documentos' },
  { id: 'vistoria', label: 'Vistoria', description: 'Realize a vistoria' },
  { id: 'pagamento', label: 'Pagamento', description: 'Pague a adesão' },
  { id: 'conclusao', label: 'Conclusão', description: 'Contrato gerado' },
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
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="grid md:grid-cols-[280px_1fr] gap-6">
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-[500px] rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // Error / Not Found
  if (error || !cotacao) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="max-w-md w-full border-destructive/20">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <h1 className="text-xl font-bold mb-2">Cotação não encontrada</h1>
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
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-green-500/5 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: 'spring' }}
        >
          <Card className="max-w-md w-full border-green-500/30">
            <CardContent className="pt-8 pb-8 text-center">
              <motion.div 
                className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              >
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </motion.div>
              <h1 className="text-2xl font-bold mb-2">Contrato Gerado!</h1>
              <p className="text-muted-foreground mb-6">
                Seu contrato foi gerado com sucesso. Em breve você receberá um e-mail para assinatura.
              </p>
              <Badge variant="outline" className="text-lg px-6 py-2 border-green-500/30">
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header Premium com Logo */}
      <motion.header 
        className="bg-gradient-to-r from-[hsl(218,80%,20%)] via-[hsl(218,67%,30%)] to-[hsl(218,80%,20%)] text-white sticky top-0 z-20 shadow-lg"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, type: 'spring' }}
      >
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/pratic-logo.png" 
              alt="PRATIC" 
              className="h-12 w-12 object-contain rounded-lg bg-white/10 p-1"
            />
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
        className="bg-card border-b shadow-sm"
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
              <Badge variant="secondary" className="text-xs">
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
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-[280px_1fr] gap-8">
          {/* Stepper Sidebar */}
          <motion.aside 
            className="md:sticky md:top-28 md:self-start"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <Card className="p-4 shadow-sm">
              <StepperCotacao
                steps={STEPS}
                currentStep={etapaAtual}
                onStepClick={(step) => step < etapaAtual && setEtapaAtual(step)}
              />
            </Card>
          </motion.aside>

          {/* Step Content */}
          <div className="min-w-0">
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

              {/* Etapa 1: Dados Pessoais */}
              {etapaAtual === 1 && (
                <motion.div
                  key="dados"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  <FormularioDadosPessoais
                    onSubmit={handleSalvarDados}
                    defaultValues={dadosPessoaisDefault}
                    isLoading={isPending}
                  />
                </motion.div>
              )}

              {/* Etapa 2: Documentos - Placeholder */}
              {etapaAtual === 2 && (
                <motion.div
                  key="documentos"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  <Card className="border-dashed">
                    <CardContent className="py-16 text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-2xl">📄</span>
                      </div>
                      <h2 className="text-xl font-semibold mb-3">Envio de Documentos</h2>
                      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                        Esta etapa será implementada em breve. Por enquanto, clique em continuar.
                      </p>
                      <Button 
                        onClick={() => setEtapaAtual(3)}
                        className="bg-accent hover:bg-accent-hover"
                      >
                        Continuar
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Etapa 3: Vistoria - Placeholder */}
              {etapaAtual === 3 && (
                <motion.div
                  key="vistoria"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  <Card className="border-dashed">
                    <CardContent className="py-16 text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-2xl">🔍</span>
                      </div>
                      <h2 className="text-xl font-semibold mb-3">Vistoria</h2>
                      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                        Esta etapa será implementada em breve. Por enquanto, clique em continuar.
                      </p>
                      <Button 
                        onClick={() => setEtapaAtual(4)}
                        className="bg-accent hover:bg-accent-hover"
                      >
                        Continuar
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Etapa 4: Pagamento - Placeholder */}
              {etapaAtual === 4 && (
                <motion.div
                  key="pagamento"
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  <Card className="border-dashed">
                    <CardContent className="py-16 text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-2xl">💳</span>
                      </div>
                      <h2 className="text-xl font-semibold mb-3">Pagamento</h2>
                      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                        Esta etapa será implementada em breve. Por enquanto, clique em continuar.
                      </p>
                      <Button 
                        onClick={() => setEtapaAtual(5)}
                        className="bg-accent hover:bg-accent-hover"
                      >
                        Continuar
                      </Button>
                    </CardContent>
                  </Card>
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
                  <Card className="border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent">
                    <CardContent className="py-16 text-center">
                      <motion.div 
                        className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/10 flex items-center justify-center"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                      >
                        <CheckCircle2 className="h-10 w-10 text-green-500" />
                      </motion.div>
                      <h2 className="text-2xl font-bold mb-3">Processo Concluído!</h2>
                      <p className="text-muted-foreground max-w-sm mx-auto">
                        Seu contrato será gerado e você receberá um e-mail para assinatura digital.
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
      <footer className="border-t mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} PRATIC - Proteção Veicular. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
