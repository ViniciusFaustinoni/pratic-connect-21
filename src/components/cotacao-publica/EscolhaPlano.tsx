import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Shield, Zap, Crown, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export interface PlanoOpcao {
  id: string;
  nome: string;
  codigo?: string;
  valorMensal: number;
  valorAdesao?: number;
  coberturas?: string[];
  destaque?: boolean;
  nivel?: 'basic' | 'premium' | 'exclusive';
}

interface EscolhaPlanoProps {
  planos: PlanoOpcao[];
  planoSelecionadoId: string | null;
  onSelectPlano: (planoId: string) => void;
  onConfirmar: () => void;
  isLoading?: boolean;
}

const formatarMoeda = (valor: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
};

const getNivelIcon = (nivel?: string) => {
  switch (nivel) {
    case 'exclusive':
      return <Crown className="h-5 w-5 text-yellow-400" />;
    case 'premium':
      return <Zap className="h-5 w-5 text-purple-400" />;
    default:
      return <Shield className="h-5 w-5 text-primary" />;
  }
};

const getNivelLabel = (nivel?: string) => {
  switch (nivel) {
    case 'exclusive':
      return 'Exclusive';
    case 'premium':
      return 'Premium';
    default:
      return 'Basic';
  }
};

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

      {/* Cards de Planos - Premium Dark Cards */}
      <motion.div 
        className="flex flex-wrap justify-center gap-6"
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
              className="w-full sm:w-80"
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
                      className={cn(
                        'text-xs border-border/50 bg-muted/30',
                        plano.nivel === 'exclusive' && 'border-yellow-400/30 text-yellow-400 bg-yellow-400/10',
                        plano.nivel === 'premium' && 'border-purple-400/30 text-purple-400 bg-purple-400/10'
                      )}
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
                          {visibleCoberturas.map((cobertura, idx) => (
                            <motion.div
                              key={cobertura}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2, delay: idx < MAX_VISIBLE_COBERTURAS ? 0 : 0.05 * (idx - MAX_VISIBLE_COBERTURAS) }}
                              className="flex items-center gap-2.5"
                            >
                              <div className="w-5 h-5 rounded-full bg-success/10 border border-success/20 flex items-center justify-center flex-shrink-0">
                                <Check className="h-3 w-3 text-success" />
                              </div>
                              <span className="text-sm text-muted-foreground">{cobertura}</span>
                            </motion.div>
                          ))}
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

      {/* Botão Continuar - Premium Style */}
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
    </div>
  );
}
