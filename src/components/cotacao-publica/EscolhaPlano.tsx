import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, X, Shield, Zap, Crown, Sparkles, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { isCoberturaRemovida, getRestricaoCategoria } from '@/data/restricoesCategorias';
import { formatarMoeda } from '@/utils/format';

export interface PlanoOpcao {
  id: string;
  nome: string;
  codigo?: string;
  valorMensal: number;
  valorAdesao?: number;
  coberturas?: string[];
  destaque?: boolean;
  nivel?: string;
  categoriaVeiculo?: string;
}

interface EscolhaPlanoProps {
  planos: PlanoOpcao[];
  planoSelecionadoId: string | null;
  onSelectPlano: (planoId: string) => void;
  onConfirmar: () => void;
  isLoading?: boolean;
  categoriaVeiculo?: string;
  readOnly?: boolean;
}

// Mapa extensível de estilos por nível — novos níveis usam fallback automático
const NIVEL_CONFIG: Record<string, { icon: typeof Crown; iconClass: string; badgeClass: string; label: string }> = {
  exclusive: {
    icon: Crown,
    iconClass: 'text-yellow-400',
    badgeClass: 'border-yellow-400/30 text-yellow-400 bg-yellow-400/10',
    label: 'Exclusive',
  },
  premium: {
    icon: Zap,
    iconClass: 'text-purple-400',
    badgeClass: 'border-purple-400/30 text-purple-400 bg-purple-400/10',
    label: 'Premium',
  },
  basic: {
    icon: Shield,
    iconClass: 'text-primary',
    badgeClass: 'border-border/50 bg-muted/30',
    label: 'Basic',
  },
};

const DEFAULT_NIVEL = {
  icon: Shield,
  iconClass: 'text-primary',
  badgeClass: 'border-border/50 bg-muted/30',
};

const getNivelConfig = (nivel?: string) => {
  if (nivel && NIVEL_CONFIG[nivel]) return NIVEL_CONFIG[nivel];
  return { ...DEFAULT_NIVEL, label: nivel ? nivel.charAt(0).toUpperCase() + nivel.slice(1) : 'Padrão' };
};

const getNivelIcon = (nivel?: string) => {
  const config = getNivelConfig(nivel);
  const Icon = config.icon;
  return <Icon className={cn('h-5 w-5', config.iconClass)} />;
};

const getNivelLabel = (nivel?: string) => getNivelConfig(nivel).label;
const getNivelBadgeClass = (nivel?: string) => getNivelConfig(nivel).badgeClass;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const cardVariants = {
  hidden: { 
    opacity: 0, 
    y: 30,
    scale: 0.95,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

const MAX_VISIBLE_COBERTURAS = 6;

export function EscolhaPlano({
  planos,
  planoSelecionadoId,
  onSelectPlano,
  onConfirmar,
  isLoading,
  categoriaVeiculo,
  readOnly = false,
}: EscolhaPlanoProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleExpand = (planoId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(planoId)) {
        newSet.delete(planoId);
      } else {
        newSet.add(planoId);
      }
      return newSet;
    });
  };

  // Encontrar plano selecionado para modo read-only
  const planoSelecionado = planos.find(p => p.id === planoSelecionadoId);

  // Verificar se há restrições de categoria
  const restricao = categoriaVeiculo ? getRestricaoCategoria(categoriaVeiculo) : null;

  // Modo read-only: mostrar apenas resumo do plano escolhido
  if (readOnly && planoSelecionado) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="text-center">
          <Badge className="bg-success/10 text-success border-success/30 mb-4">
            <Check className="h-3 w-3 mr-1" />
            Plano Escolhido
          </Badge>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {planoSelecionado.nome}
          </h2>
          <p className="text-muted-foreground">
            Você selecionou este plano para proteção do seu veículo
          </p>
        </div>

        <Card className="max-w-md mx-auto border-success/30 bg-card/80 backdrop-blur-xl">
          <CardContent className="p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
              {getNivelIcon(planoSelecionado.nivel)}
            </div>
            <Badge 
              variant="outline" 
              className={cn('text-xs mb-3', getNivelBadgeClass(planoSelecionado.nivel))}
            >
              {getNivelLabel(planoSelecionado.nivel)}
            </Badge>
            <div className="space-y-3 mt-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Valor mensal</p>
                <div className="text-3xl font-bold text-foreground">
                  {formatarMoeda(planoSelecionado.valorMensal)}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </div>
              </div>
              {planoSelecionado.valorAdesao != null && planoSelecionado.valorAdesao > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Taxa de adesão</p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatarMoeda(planoSelecionado.valorAdesao)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header com título animado - Premium Dark Style */}
      <motion.div 
        className="text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-4">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">Proteção Completa</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
          Escolha o plano ideal
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto text-lg">
          Selecione a opção que melhor atende suas necessidades de proteção
        </p>
      </motion.div>

      {/* Alerta de restrições de categoria */}
      {restricao && restricao.mensagemAlerta && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Alert className="border-amber-500/50 bg-amber-500/10 max-w-6xl mx-auto">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-700 dark:text-amber-400">
              {restricao.mensagemAlerta}
            </AlertDescription>
          </Alert>
        </motion.div>
      )}

      {/* Cards de Planos - Grid centralizado */}
      <motion.div 
        className="flex flex-wrap justify-center gap-6 max-w-6xl mx-auto"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {planos.map((plano, index) => {
          const isSelected = plano.id === planoSelecionadoId;
          const isRecommended = plano.destaque;

          return (
            <motion.div
              key={plano.id}
              variants={cardVariants}
              whileHover={{ 
                scale: 1.02,
                transition: { duration: 0.2 },
              }}
              whileTap={{ scale: 0.98 }}
              className="w-full max-w-sm"
            >
              <Card
                className={cn(
                  'plan-card-premium relative cursor-pointer overflow-hidden',
                  'bg-card/60 backdrop-blur-xl border border-border/50',
                  'transition-all duration-300',
                  'min-h-[520px] flex flex-col',
                  isSelected && 'plan-card-selected',
                  isRecommended && !isSelected && 'plan-card-recommended',
                  !isSelected && !isRecommended && 'hover:border-primary/30 hover:bg-card/80',
                )}
                onClick={() => onSelectPlano(plano.id)}
              >
                {/* Badge Recomendado - Premium Style */}
                {isRecommended && (
                  <div className="absolute top-0 right-0 z-10">
                    <div className="recommended-badge flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-bl-xl">
                      <Sparkles className="h-3.5 w-3.5" />
                      Recomendado
                    </div>
                  </div>
                )}

                {/* Glow effect para selecionado */}
                {isSelected && (
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                )}

                <CardContent className="p-6 flex flex-col flex-grow">
                  {/* Header: Nome + Badge */}
                  <div className="mb-4 text-center">
                    <h3 className="text-xl font-bold text-foreground mb-2">{plano.nome}</h3>
                    <Badge 
                      variant="outline" 
                      className={cn('text-xs', getNivelBadgeClass(plano.nivel))}
                    >
                      {getNivelLabel(plano.nivel)}
                    </Badge>
                  </div>

                  {/* Preço - Destaque Grande */}
                  <div className="mb-4 text-center">
                    <div className="flex items-baseline justify-center gap-1 flex-wrap">
                      <span className={cn(
                        'text-4xl font-bold tracking-tight',
                        isSelected ? 'text-primary' : 'text-foreground'
                      )}>
                        {formatarMoeda(plano.valorMensal)}
                      </span>
                      <span className="text-muted-foreground text-base">/mês</span>
                    </div>
                    {plano.valorAdesao && plano.valorAdesao > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        + {formatarMoeda(plano.valorAdesao)} de adesão
                      </p>
                    )}
                  </div>

                  {/* Descrição curta */}
                  <p className="text-sm text-muted-foreground mb-6 text-center">
                    Proteção completa para seu veículo com coberturas abrangentes
                  </p>

                  {/* BOTÃO 3D DE SELEÇÃO */}
                  <Button
                    variant={isRecommended ? "default" : "outline"}
                    className={cn(
                      'w-full h-12 font-semibold rounded-lg transition-all duration-200',
                      isRecommended && !isSelected && 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30',
                      !isRecommended && !isSelected && 'border-2 border-border/60 hover:border-primary/50 hover:bg-primary/5',
                      isSelected && 'bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/40'
                    )}
                  >
                    {isSelected ? 'Selecionado ✓' : 'Selecionar'}
                  </Button>

                  {/* Divisor com gradiente */}
                  <div className="h-px bg-gradient-to-r from-transparent via-border/50 to-transparent my-6" />

                  {/* Coberturas */}
                  {plano.coberturas && plano.coberturas.length > 0 && (() => {
                    const coberturas = plano.coberturas || [];
                    const isExpanded = expandedCards.has(plano.id);
                    const hasMore = coberturas.length > MAX_VISIBLE_COBERTURAS;
                    const visibleCoberturas = isExpanded ? coberturas : coberturas.slice(0, MAX_VISIBLE_COBERTURAS);
                    const hiddenCount = coberturas.length - MAX_VISIBLE_COBERTURAS;

                    return (
                      <div className="space-y-3 flex-grow">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Coberturas incluídas
                        </p>
                        <AnimatePresence mode="sync">
                          {visibleCoberturas.map((cobertura, idx) => {
                            const isRemovida = isCoberturaRemovida(cobertura, categoriaVeiculo || plano.categoriaVeiculo);
                            
                            return (
                              <motion.div
                                key={cobertura}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2, delay: idx < MAX_VISIBLE_COBERTURAS ? 0 : 0.05 * (idx - MAX_VISIBLE_COBERTURAS) }}
                                className="flex items-center gap-2.5"
                              >
                                {isRemovida ? (
                                  <>
                                    <div className="w-5 h-5 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center flex-shrink-0">
                                      <X className="h-3 w-3 text-destructive" />
                                    </div>
                                    <span className="text-sm text-muted-foreground line-through">{cobertura}</span>
                                    <span className="text-xs text-destructive ml-auto">(não disponível)</span>
                                  </>
                                ) : (
                                  <>
                                    <div className="w-5 h-5 rounded-full bg-success/10 border border-success/20 flex items-center justify-center flex-shrink-0">
                                      <Check className="h-3 w-3 text-success" />
                                    </div>
                                    <span className="text-sm text-muted-foreground">{cobertura}</span>
                                  </>
                                )}
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>

                        {hasMore && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(plano.id);
                            }}
                            className="w-full mt-2 text-primary hover:text-primary/80 hover:bg-primary/5 h-9"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="h-4 w-4 mr-1" />
                                Ver menos
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4 mr-1" />
                                Ver mais {hiddenCount} coberturas
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Botão Continuar - Premium Style - Ocultar em modo readOnly */}
      {!readOnly && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Button
            className={cn(
              'w-full h-14 text-base font-semibold transition-all rounded-xl',
              'bg-accent hover:bg-accent-hover text-accent-foreground',
              'shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30',
              !planoSelecionadoId && 'opacity-50 cursor-not-allowed'
            )}
            size="lg"
            onClick={onConfirmar}
            disabled={!planoSelecionadoId || isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Carregando...
              </span>
            ) : (
              'Continuar com este plano'
            )}
          </Button>
        </motion.div>
      )}
    </div>
  );
}
