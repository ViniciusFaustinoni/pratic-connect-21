import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Shield, Zap, Crown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

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

export function EscolhaPlano({
  planos,
  planoSelecionadoId,
  onSelectPlano,
  onConfirmar,
  isLoading,
}: EscolhaPlanoProps) {
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

      {/* Grid de Planos - Premium Dark Cards */}
      <motion.div 
        className="grid gap-5 md:gap-6 md:grid-cols-2 lg:grid-cols-3"
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
            >
              <Card
                className={cn(
                  'plan-card-premium relative cursor-pointer overflow-hidden',
                  'bg-card/60 backdrop-blur-xl border border-border/50',
                  'transition-all duration-300',
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

                <CardContent className="p-6">
                  {/* Header do Card */}
                  <div className="flex items-center gap-3 mb-5">
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center',
                      'bg-gradient-to-br from-muted/80 to-muted/40 border border-border/50',
                      isSelected && 'from-primary/20 to-primary/10 border-primary/30'
                    )}>
                      {getNivelIcon(plano.nivel)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg text-foreground truncate">{plano.nome}</h3>
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
                  </div>

                  {/* Preço - Destaque Premium */}
                  <div className="mb-5">
                    <div className="flex items-baseline gap-1">
                      <span className={cn(
                        'text-4xl font-bold tracking-tight',
                        isSelected ? 'text-primary' : 'text-foreground'
                      )}>
                        {formatarMoeda(plano.valorMensal)}
                      </span>
                      <span className="text-muted-foreground text-sm">/mês</span>
                    </div>
                    {plano.valorAdesao && plano.valorAdesao > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        + {formatarMoeda(plano.valorAdesao)} de adesão
                      </p>
                    )}
                  </div>

                  {/* Divisor com gradiente */}
                  <div className="h-px bg-gradient-to-r from-transparent via-border/50 to-transparent mb-5" />

                  {/* Coberturas */}
                  {plano.coberturas && plano.coberturas.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Coberturas incluídas
                      </p>
                      {plano.coberturas.slice(0, 5).map((cobertura, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + idx * 0.05 }}
                          className="flex items-center gap-2.5"
                        >
                          <div className="w-5 h-5 rounded-full bg-success/10 border border-success/20 flex items-center justify-center flex-shrink-0">
                            <Check className="h-3 w-3 text-success" />
                          </div>
                          <span className="text-sm text-muted-foreground">{cobertura}</span>
                        </motion.div>
                      ))}
                      {plano.coberturas.length > 5 && (
                        <p className="text-xs text-primary font-medium pl-7">
                          + {plano.coberturas.length - 5} coberturas adicionais
                        </p>
                      )}
                    </div>
                  )}

                  {/* Indicador de Seleção - Premium */}
                  <div className="mt-6 pt-5 border-t border-border/30">
                    <div className="flex items-center justify-center gap-2">
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                          isSelected
                            ? 'border-primary bg-primary shadow-lg shadow-primary/30'
                            : 'border-muted-foreground/30 bg-transparent'
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <span className={cn(
                        'text-sm font-medium',
                        isSelected ? 'text-primary' : 'text-muted-foreground'
                      )}>
                        {isSelected ? 'Selecionado' : 'Selecionar plano'}
                      </span>
                    </div>
                  </div>
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
