import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

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
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
                  isCompleted && 'bg-primary text-primary-foreground cursor-pointer',
                  isCurrent && 'bg-primary text-primary-foreground ring-2 ring-primary/30',
                  !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 mx-1 mt-4',
                    isCompleted ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop: Lista vertical */}
      <div className="hidden md:block space-y-2">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <div
              key={step.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg transition-colors',
                isCurrent && 'bg-primary/10',
                isCompleted && 'cursor-pointer hover:bg-muted',
                !isCompleted && !isCurrent && 'opacity-50'
              )}
              onClick={() => isCompleted && onStepClick?.(index)}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0',
                  isCompleted && 'bg-primary text-primary-foreground',
                  isCurrent && 'bg-primary text-primary-foreground',
                  !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <div className="min-w-0">
                <p className={cn(
                  'font-medium text-sm truncate',
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
            </div>
          );
        })}
      </div>

      {/* Indicador de progresso mobile */}
      <div className="md:hidden mt-3 px-2">
        <p className="text-sm font-medium text-center">
          {steps[currentStep]?.label}
        </p>
        <p className="text-xs text-muted-foreground text-center">
          Etapa {currentStep + 1} de {steps.length}
        </p>
      </div>
    </div>
  );
}
