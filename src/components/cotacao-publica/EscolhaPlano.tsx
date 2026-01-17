import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Shield, Star, Zap, Crown } from 'lucide-react';
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
      {/* Header com título animado */}
      <motion.div 
        className="text-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          Escolha o plano ideal
        </h2>
        <p className="text-muted-foreground mt-2 max-w-md mx-auto">
          Selecione a opção que melhor atende suas necessidades de proteção
        </p>
      </motion.div>

      {/* Grid de Planos */}
      <motion.div 
        className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3"
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
                  'relative cursor-pointer overflow-hidden transition-all duration-300',
                  'border-2 hover:shadow-xl',
                  isSelected && 'border-primary ring-2 ring-primary/20 shadow-lg',
                  isRecommended && !isSelected && 'border-accent/50',
                  !isSelected && !isRecommended && 'border-border hover:border-primary/30',
                  isRecommended && 'plan-recommended'
                )}
                onClick={() => onSelectPlano(plano.id)}
              >
                {/* Badge Recomendado */}
                {isRecommended && (
                  <div className="absolute top-0 right-0 z-10">
                    <div className="bg-accent text-accent-foreground text-xs font-semibold px-3 py-1 rounded-bl-lg">
                      ⭐ Recomendado
                    </div>
                  </div>
                )}

                {/* Glow effect para selecionado */}
                {isSelected && (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/10 pointer-events-none" />
                )}

                <CardContent className="p-5 md:p-6">
                  {/* Header do Card */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center',
                      'bg-gradient-to-br from-muted to-muted/50',
                      isSelected && 'from-primary/20 to-primary/10'
                    )}>
                      {getNivelIcon(plano.nivel)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg truncate">{plano.nome}</h3>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          'text-xs',
                          plano.nivel === 'exclusive' && 'border-yellow-400/50 text-yellow-600 dark:text-yellow-400',
                          plano.nivel === 'premium' && 'border-purple-400/50 text-purple-600 dark:text-purple-400'
                        )}
                      >
                        {getNivelLabel(plano.nivel)}
                      </Badge>
                    </div>
                  </div>

                  {/* Preço */}
                  <div className="mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className={cn(
                        'text-3xl font-bold',
                        isSelected ? 'text-primary' : 'text-foreground'
                      )}>
                        {formatarMoeda(plano.valorMensal)}
                      </span>
                      <span className="text-muted-foreground text-sm">/mês</span>
                    </div>
                    {plano.valorAdesao && plano.valorAdesao > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        + {formatarMoeda(plano.valorAdesao)} de adesão
                      </p>
                    )}
                  </div>

                  {/* Divisor */}
                  <div className="h-px bg-border mb-4" />

                  {/* Coberturas */}
                  {plano.coberturas && plano.coberturas.length > 0 && (
                    <div className="space-y-2.5">
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
                          <div className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                            <Check className="h-3 w-3 text-green-500" />
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

                  {/* Indicador de Seleção */}
                  <div className="mt-5 pt-4 border-t border-border">
                    <div className="flex items-center justify-center gap-2">
                      <div
                        className={cn(
                          'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                          isSelected
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground/30'
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

      {/* Botão Continuar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Button
          className={cn(
            'w-full h-12 text-base font-semibold transition-all',
            planoSelecionadoId && 'bg-accent hover:bg-accent-hover'
          )}
          size="lg"
          onClick={onConfirmar}
          disabled={!planoSelecionadoId || isLoading}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
