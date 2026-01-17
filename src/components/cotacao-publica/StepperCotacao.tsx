import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface Step {
  id: string;
  label: string;
  description?: string;
}

interface StepperCotacaoProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
}

export function StepperCotacao({ steps, currentStep, onStepClick }: StepperCotacaoProps) {
  return (
    <div className="w-full">
      {/* Mobile: Horizontal compacto - Premium Dark Style */}
      <div className="flex items-center justify-between md:hidden px-2">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <div
              key={step.id}
              className="flex flex-col items-center flex-1"
              onClick={() => isCompleted && onStepClick?.(index)}
            >
              <motion.div
                initial={false}
                animate={{
                  scale: isCurrent ? 1.1 : 1,
                }}
                transition={{ duration: 0.3 }}
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium relative',
                  'transition-all duration-300',
                  isCompleted && 'bg-primary text-primary-foreground cursor-pointer',
                  isCurrent && 'bg-primary text-primary-foreground step-glow-active',
                  !isCompleted && !isCurrent && 'bg-muted/50 text-muted-foreground border border-border/50'
                )}
              >
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                  >
                    <Check className="h-4 w-4" />
                  </motion.div>
                ) : (
                  index + 1
                )}
              </motion.div>
              {index < steps.length - 1 && (
                <div className="relative w-full h-0.5 mt-4 mx-1 bg-muted/30 overflow-hidden rounded-full">
                  <motion.div
                    initial={false}
                    animate={{ 
                      width: isCompleted ? '100%' : '0%' 
                    }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                    className="absolute inset-y-0 left-0 bg-primary rounded-full"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop: Lista vertical com animações - Premium Dark Style */}
      <div className="hidden md:block space-y-1">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                'relative flex items-center gap-3 p-3 rounded-xl transition-all duration-200',
                isCurrent && 'bg-primary/10 border border-primary/20',
                isCompleted && 'cursor-pointer hover:bg-muted/30',
                !isCompleted && !isCurrent && 'opacity-40'
              )}
              onClick={() => isCompleted && onStepClick?.(index)}
            >
              {/* Linha conectora vertical - Premium gradient */}
              {index < steps.length - 1 && (
                <div className="absolute left-[27px] top-14 w-0.5 h-5 bg-muted/20 overflow-hidden rounded-full">
                  <motion.div
                    initial={false}
                    animate={{ 
                      height: isCompleted ? '100%' : '0%' 
                    }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="w-full bg-gradient-to-b from-primary to-primary/50 rounded-full"
                  />
                </div>
              )}

              {/* Indicador de step - Premium */}
              <motion.div
                initial={false}
                animate={{
                  scale: isCurrent ? 1.05 : 1,
                }}
                transition={{ duration: 0.3 }}
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 z-10',
                  'transition-all duration-300',
                  isCompleted && 'bg-primary text-primary-foreground',
                  isCurrent && 'bg-primary text-primary-foreground step-glow-active',
                  !isCompleted && !isCurrent && 'bg-muted/30 text-muted-foreground border border-border/50'
                )}
              >
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                  >
                    <Check className="h-4 w-4" />
                  </motion.div>
                ) : (
                  index + 1
                )}
              </motion.div>

              {/* Texto */}
              <div className="min-w-0 flex-1">
                <p className={cn(
                  'font-medium text-sm truncate transition-colors',
                  isCurrent && 'text-primary',
                  isCompleted && 'text-foreground',
                  !isCompleted && !isCurrent && 'text-muted-foreground'
                )}>
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {step.description}
                  </p>
                )}
              </div>

              {/* Indicador visual de atual */}
              {isCurrent && (
                <motion.div
                  layoutId="currentStepIndicator"
                  className="w-1.5 h-8 bg-gradient-to-b from-primary to-primary/50 rounded-full"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Indicador de progresso mobile - Premium Dark */}
      <motion.div 
        className="md:hidden mt-4 px-4 py-3 bg-muted/20 backdrop-blur-sm rounded-xl border border-border/30"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-foreground">
            {steps[currentStep]?.label}
          </p>
          <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted/30">
            {currentStep + 1}/{steps.length}
          </span>
        </div>
        
        {/* Barra de progresso - Premium gradient */}
        <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
          <motion.div
            initial={false}
            animate={{ 
              width: `${((currentStep + 1) / steps.length) * 100}%` 
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-primary via-primary to-primary/70 rounded-full"
          />
        </div>
      </motion.div>
    </div>
  );
}
