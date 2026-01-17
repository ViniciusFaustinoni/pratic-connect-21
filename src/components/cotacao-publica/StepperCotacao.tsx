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
      {/* Mobile: Horizontal compacto */}
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
                  backgroundColor: isCompleted || isCurrent 
                    ? 'hsl(var(--primary))' 
                    : 'hsl(var(--muted))',
                }}
                transition={{ duration: 0.3 }}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium',
                  (isCompleted || isCurrent) && 'text-primary-foreground',
                  !isCompleted && !isCurrent && 'text-muted-foreground',
                  isCompleted && 'cursor-pointer'
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
                <div className="relative w-full h-0.5 mt-4 mx-1 bg-muted overflow-hidden">
                  <motion.div
                    initial={false}
                    animate={{ 
                      width: isCompleted ? '100%' : '0%' 
                    }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                    className="absolute inset-y-0 left-0 bg-primary"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop: Lista vertical com animações */}
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
                'relative flex items-center gap-3 p-3 rounded-lg transition-all duration-200',
                isCurrent && 'bg-primary/10 shadow-sm',
                isCompleted && 'cursor-pointer hover:bg-muted/80',
                !isCompleted && !isCurrent && 'opacity-50'
              )}
              onClick={() => isCompleted && onStepClick?.(index)}
            >
              {/* Linha conectora vertical */}
              {index < steps.length - 1 && (
                <div className="absolute left-[27px] top-12 w-0.5 h-6 bg-muted overflow-hidden">
                  <motion.div
                    initial={false}
                    animate={{ 
                      height: isCompleted ? '100%' : '0%' 
                    }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="w-full bg-primary"
                  />
                </div>
              )}

              {/* Indicador de step */}
              <motion.div
                initial={false}
                animate={{
                  backgroundColor: isCompleted || isCurrent 
                    ? 'hsl(var(--primary))' 
                    : 'hsl(var(--muted))',
                  boxShadow: isCurrent 
                    ? '0 0 0 4px hsl(var(--primary) / 0.2)' 
                    : '0 0 0 0px transparent',
                }}
                transition={{ duration: 0.3 }}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 z-10',
                  (isCompleted || isCurrent) && 'text-primary-foreground',
                  !isCompleted && !isCurrent && 'text-muted-foreground'
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
                  isCurrent && 'text-primary'
                )}>
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {step.description}
                  </p>
                )}
              </div>

              {/* Indicador visual de atual */}
              {isCurrent && (
                <motion.div
                  layoutId="currentStepIndicator"
                  className="w-1.5 h-6 bg-primary rounded-full"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Indicador de progresso mobile */}
      <motion.div 
        className="md:hidden mt-4 px-4 py-3 bg-muted/50 rounded-lg"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">
            {steps[currentStep]?.label}
          </p>
          <span className="text-xs text-muted-foreground">
            {currentStep + 1}/{steps.length}
          </span>
        </div>
        
        {/* Barra de progresso */}
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={false}
            animate={{ 
              width: `${((currentStep + 1) / steps.length) * 100}%` 
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="h-full bg-primary rounded-full"
          />
        </div>
      </motion.div>
    </div>
  );
}
