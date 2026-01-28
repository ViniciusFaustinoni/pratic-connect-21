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
  maxReachableStep?: number;
}

export function StepperCotacao({ steps, currentStep, onStepClick, maxReachableStep }: StepperCotacaoProps) {
  // Etapa máxima alcançável (default para currentStep se não definido)
  const maxStep = maxReachableStep ?? currentStep;
  return (
    <div className="w-full">
      {/* Mobile: Horizontal compacto - Premium Dark Style */}
      <div className="flex items-center justify-between md:hidden px-2">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isReachable = index <= maxStep;

          return (
            <div
              key={step.id}
              className="flex flex-col items-center flex-1"
              onClick={() => isReachable && onStepClick?.(index)}
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
                  !isCompleted && !isCurrent && isReachable && 'bg-muted/50 text-muted-foreground border border-border/50 cursor-pointer hover:border-primary/50',
                  !isCompleted && !isCurrent && !isReachable && 'bg-muted/50 text-muted-foreground border border-border/50'
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

      {/* Desktop: Timeline Horizontal - Premium Dark Style */}
      <div className="hidden md:block">
        <div className="flex items-start justify-between w-full">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            const isReachable = index <= maxStep;

            return (
              <div key={step.id} className="flex-1 flex items-start">
                {/* Step Circle + Label */}
                <div 
                  className={cn(
                    "flex flex-col items-center flex-1",
                    isReachable && "cursor-pointer"
                  )}
                  onClick={() => isReachable && onStepClick?.(index)}
                >
                  <motion.div
                    initial={false}
                    animate={{ scale: isCurrent ? 1.1 : 1 }}
                    transition={{ duration: 0.3 }}
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold',
                      'transition-all duration-300',
                      isCompleted && 'bg-primary text-primary-foreground',
                      isCurrent && 'bg-primary text-primary-foreground step-glow-active ring-4 ring-primary/20',
                      !isCompleted && !isCurrent && isReachable && 'bg-muted/30 text-muted-foreground border border-border/50 hover:border-primary/50',
                      !isCompleted && !isCurrent && !isReachable && 'bg-muted/30 text-muted-foreground border border-border/50'
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
                  <p className={cn(
                    'text-xs font-medium mt-2 text-center max-w-[80px] leading-tight',
                    isCurrent && 'text-primary',
                    isCompleted && 'text-foreground',
                    !isCompleted && !isCurrent && 'text-muted-foreground'
                  )}>
                    {step.label}
                  </p>
                </div>

                {/* Connecting Line */}
                {index < steps.length - 1 && (
                  <div className="flex-1 h-0.5 mt-5 mx-1 bg-muted/30 rounded-full overflow-hidden">
                    <motion.div
                      initial={false}
                      animate={{ width: isCompleted ? '100%' : '0%' }}
                      transition={{ duration: 0.5, ease: 'easeInOut' }}
                      className="h-full bg-primary rounded-full"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
