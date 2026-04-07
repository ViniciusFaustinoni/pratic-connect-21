import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Car, ArrowRightLeft, CheckCircle2, Clock, Loader2, CreditCard, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { useSubstituicaoPublica } from '@/hooks/useSubstituicaoPublica';
import { StepperCotacao, type Step } from '@/components/cotacao-publica/StepperCotacao';
import { formatarMoeda } from '@/utils/format';
import { STATUS_SUBSTITUICAO_LABELS } from '@/types/substituicao';

const STEPS: Step[] = [
  { id: 'resumo', label: 'Resumo', description: 'Dados da troca' },
  { id: 'vistoria', label: 'Vistoria', description: 'Fotos do veículo' },
  { id: 'pagamento', label: 'Pagamento', description: 'Taxas e valores' },
  { id: 'acompanhamento', label: 'Acompanhamento', description: 'Status da troca' },
];

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3 } },
};

function determinarEtapa(status: string): number {
  switch (status) {
    case 'iniciada':
    case 'aguardando_retirada':
      return 0; // Resumo
    case 'aguardando_vistoria':
      return 1; // Vistoria
    case 'aguardando_financeiro':
      return 2; // Pagamento
    case 'aguardando_aprovacao':
    case 'aprovada':
    case 'efetivada':
    case 'rejeitada':
    case 'cancelada_pelo_associado':
      return 3; // Acompanhamento
    default:
      return 0;
  }
}

export default function SubstituicaoPublica() {
  const { token } = useParams<{ token: string }>();
  const { data: substituicao, isLoading, error } = useSubstituicaoPublica(token);

  const etapaAtual = substituicao ? determinarEtapa(substituicao.status) : 0;

  // Loading
  if (isLoading) {
    return (
      <div className="dark min-h-screen public-premium-bg p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-24 w-full rounded-xl bg-white/5" />
          <Skeleton className="h-16 w-full rounded-xl bg-white/5" />
          <Skeleton className="h-[400px] w-full rounded-xl bg-white/5" />
        </div>
      </div>
    );
  }

  // Error / Not Found
  if (error || !substituicao) {
    return (
      <div className="dark min-h-screen public-premium-bg flex items-center justify-center p-4">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-[120px]" />
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
              <h1 className="text-xl font-bold mb-2 text-foreground">Substituição não encontrada</h1>
              <p className="text-muted-foreground">
                Este link não existe, expirou ou está incorreto.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const statusLabel = STATUS_SUBSTITUICAO_LABELS[substituicao.status as keyof typeof STATUS_SUBSTITUICAO_LABELS] || substituicao.status;

  return (
    <div className="dark min-h-screen public-premium-bg relative">
      {/* Ambient glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)]" />
      </div>

      {/* Header Premium */}
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
                src="/logos/logo-icon-light.png"
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
            <ArrowRightLeft className="h-3 w-3 mr-1.5" />
            Substituição
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
                {substituicao.veiculo_antigo_modelo || 'Veículo atual'}
              </span>
              {substituicao.veiculo_antigo_placa && (
                <Badge variant="secondary" className="text-xs bg-white/5 border-white/10 font-mono">
                  {substituicao.veiculo_antigo_placa}
                </Badge>
              )}
            </div>
            {substituicao.veiculo_novo_modelo && (
              <>
                <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground/50" />
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="font-medium text-primary">
                    {substituicao.veiculo_novo_modelo}
                  </span>
                  {substituicao.veiculo_novo_placa && (
                    <Badge variant="secondary" className="text-xs bg-primary/10 border-primary/20 font-mono">
                      {substituicao.veiculo_novo_placa}
                    </Badge>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8 relative z-10">
        <div className="space-y-8">
          {/* Stepper */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <Card className="p-4 stepper-card-premium">
              <StepperCotacao
                steps={STEPS}
                currentStep={etapaAtual}
                maxReachableStep={etapaAtual}
              />
            </Card>
          </motion.div>

          {/* Step Content */}
          <AnimatePresence mode="wait">
            {/* Etapa 0: Resumo */}
            {etapaAtual === 0 && (
              <motion.div key="resumo" variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <Card className="bg-card/80 backdrop-blur-xl border-border/50">
                  <CardContent className="py-8 space-y-6">
                    <div className="text-center space-y-2">
                      <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                        <ArrowRightLeft className="h-8 w-8 text-primary" />
                      </div>
                      <h2 className="text-xl font-bold text-foreground">Substituição em andamento</h2>
                      <p className="text-muted-foreground text-sm">
                        Sua solicitação de troca de veículo está sendo processada pela equipe PRATIC.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      {/* Veículo antigo */}
                      <div className="p-4 rounded-xl border border-border/50 bg-muted/20">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Veículo Atual</p>
                        <p className="font-semibold text-foreground">{substituicao.veiculo_antigo_modelo || '—'}</p>
                        {substituicao.veiculo_antigo_placa && (
                          <p className="text-sm text-muted-foreground font-mono">{substituicao.veiculo_antigo_placa}</p>
                        )}
                        {substituicao.veiculo_antigo_fipe && (
                          <p className="text-xs text-muted-foreground mt-1">FIPE: {formatarMoeda(substituicao.veiculo_antigo_fipe)}</p>
                        )}
                      </div>

                      {/* Veículo novo */}
                      <div className="p-4 rounded-xl border border-primary/30 bg-primary/5">
                        <p className="text-xs text-primary uppercase tracking-wider mb-2">Novo Veículo</p>
                        {substituicao.veiculo_novo_modelo ? (
                          <>
                            <p className="font-semibold text-foreground">{substituicao.veiculo_novo_modelo}</p>
                            {substituicao.veiculo_novo_placa && (
                              <p className="text-sm text-muted-foreground font-mono">{substituicao.veiculo_novo_placa}</p>
                            )}
                            {substituicao.veiculo_novo_fipe && (
                              <p className="text-xs text-muted-foreground mt-1">FIPE: {formatarMoeda(substituicao.veiculo_novo_fipe)}</p>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">Aguardando definição...</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-2 p-3 rounded-lg border border-border/50 bg-muted/10">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <Badge variant="outline" className="text-xs">{statusLabel}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Etapa 1: Vistoria */}
            {etapaAtual === 1 && (
              <motion.div key="vistoria" variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <Card className="bg-card/80 backdrop-blur-xl border-border/50">
                  <CardContent className="py-8 text-center space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center">
                      <Shield className="h-8 w-8 text-amber-500" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground">Vistoria do novo veículo</h2>
                    <p className="text-muted-foreground text-sm max-w-md mx-auto">
                      A equipe PRATIC irá lhe enviar o link de autovistoria ou entrar em contato para agendar a vistoria presencial. Aguarde as instruções.
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Aguardando vistoria...</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Etapa 2: Pagamento */}
            {etapaAtual === 2 && (
              <motion.div key="pagamento" variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <Card className="bg-card/80 backdrop-blur-xl border-border/50">
                  <CardContent className="py-8 space-y-6">
                    <div className="text-center space-y-2">
                      <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                        <CreditCard className="h-8 w-8 text-primary" />
                      </div>
                      <h2 className="text-xl font-bold text-foreground">Pagamento da substituição</h2>
                      <p className="text-muted-foreground text-sm">
                        Valores referentes à troca de veículo
                      </p>
                    </div>

                    <div className="space-y-3 max-w-sm mx-auto">
                      {substituicao.taxa_substituicao > 0 && (
                        <div className="flex justify-between items-center p-3 rounded-lg border border-border/50 bg-muted/10">
                          <span className="text-sm text-muted-foreground">Taxa de substituição</span>
                          <span className="font-semibold text-foreground">{formatarMoeda(substituicao.taxa_substituicao)}</span>
                        </div>
                      )}
                      {substituicao.valor_prorata && substituicao.valor_prorata > 0 && (
                        <div className="flex justify-between items-center p-3 rounded-lg border border-border/50 bg-muted/10">
                          <span className="text-sm text-muted-foreground">Pro-rata</span>
                          <span className="font-semibold text-foreground">{formatarMoeda(substituicao.valor_prorata)}</span>
                        </div>
                      )}
                      {substituicao.diferenca_mensalidade && substituicao.diferenca_mensalidade > 0 && (
                        <div className="flex justify-between items-center p-3 rounded-lg border border-border/50 bg-muted/10">
                          <span className="text-sm text-muted-foreground">Diferença mensalidade</span>
                          <span className="font-semibold text-foreground">{formatarMoeda(substituicao.diferenca_mensalidade)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-center gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                      <Clock className="h-4 w-4 text-amber-500" />
                      <span className="text-sm text-amber-400">Aguardando confirmação de pagamento</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Etapa 3: Acompanhamento */}
            {etapaAtual === 3 && (
              <motion.div key="acompanhamento" variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <Card className="bg-card/80 backdrop-blur-xl border-border/50">
                  <CardContent className="py-8 text-center space-y-6">
                    {substituicao.status === 'efetivada' ? (
                      <>
                        <motion.div
                          className="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                        >
                          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                        </motion.div>
                        <h2 className="text-xl font-bold text-foreground">Substituição concluída!</h2>
                        <p className="text-muted-foreground text-sm max-w-md mx-auto">
                          A troca de veículo foi efetivada com sucesso. Seu novo veículo já está protegido pela PRATIC.
                        </p>
                      </>
                    ) : substituicao.status === 'rejeitada' ? (
                      <>
                        <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                          <AlertTriangle className="h-8 w-8 text-destructive" />
                        </div>
                        <h2 className="text-xl font-bold text-foreground">Substituição não aprovada</h2>
                        <p className="text-muted-foreground text-sm max-w-md mx-auto">
                          Infelizmente a substituição não foi aprovada. Entre em contato com a PRATIC para mais detalhes.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                          <Clock className="h-8 w-8 text-primary" />
                        </div>
                        <h2 className="text-xl font-bold text-foreground">Em análise</h2>
                        <p className="text-muted-foreground text-sm max-w-md mx-auto">
                          Sua substituição está em análise pela equipe PRATIC. Você receberá uma notificação assim que houver uma atualização.
                        </p>
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">Atualização automática a cada 30s</span>
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-center gap-2 p-3 rounded-lg border border-border/50 bg-muted/10">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      <Badge variant="outline" className="text-xs">{statusLabel}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
