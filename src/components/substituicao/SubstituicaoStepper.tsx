import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  id: number;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  { id: 1, title: 'Elegibilidade', description: 'Verificação' },
  { id: 2, title: 'Eventos', description: 'Tratamento' },
  { id: 3, title: 'Rastreador', description: 'Retirada' },
  { id: 4, title: 'Novo Veículo', description: 'Dados e FIPE' },
  { id: 5, title: 'Vistoria', description: 'Fotos e vídeo' },
  { id: 6, title: 'Benefícios', description: 'Adicionais' },
  { id: 7, title: 'Financeiro', description: 'Taxas e valores' },
  { id: 8, title: 'Conclusão', description: 'Acompanhamento' },
];

interface SubstituicaoStepperProps {
  currentStep: number;
  completedSteps: number[];
  skippedSteps?: number[];
  onStepClick?: (step: number) => void;
}

export function SubstituicaoStepper({
  currentStep,
  completedSteps,
  skippedSteps = [],
  onStepClick,
}: SubstituicaoStepperProps) {
  return (
    <div className="w-full">
      {/* Desktop Stepper */}
      <div className="hidden md:flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isSkipped = skippedSteps.includes(step.id);
          const isCurrent = currentStep === step.id;
          const isClickable = isCompleted || step.id <= Math.max(...completedSteps, currentStep);

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(step.id)}
                disabled={!isClickable}
                className={cn(
                  'flex items-center gap-3 group transition-all',
                  isClickable && 'cursor-pointer',
                  !isClickable && 'cursor-not-allowed opacity-60'
                )}
              >
                <div
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all',
                    isCompleted && 'bg-green-500 border-green-500',
                    isSkipped && !isCompleted && 'bg-muted border-border',
                    isCurrent && !isCompleted && 'bg-primary border-primary shadow-[0_0_15px_hsl(var(--primary)/0.4)]',
                    !isCurrent && !isCompleted && !isSkipped && 'bg-muted border-border group-hover:border-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5 text-white" />
                  ) : (
                    <span
                      className={cn(
                        'text-sm font-semibold',
                        isCurrent ? 'text-primary-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {step.id}
                    </span>
                  )}
                </div>
                <div className="hidden lg:block text-left">
                  <p
                    className={cn(
                      'text-sm font-medium transition-colors',
                      isCurrent ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </button>

              {index < STEPS.length - 1 && (
                <div className="flex-1 mx-4 h-0.5 rounded-full overflow-hidden bg-border">
                  <div
                    className={cn(
                      'h-full transition-all duration-300',
                      isCompleted ? 'bg-green-500 w-full' : 'bg-transparent w-0'
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile Stepper */}
      <div className="md:hidden flex items-center justify-between px-4">
        {STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = currentStep === step.id;

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <div
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all',
                  isCompleted && 'bg-green-500 border-green-500',
                  isCurrent && !isCompleted && 'bg-primary border-primary',
                  !isCurrent && !isCompleted && 'bg-muted border-border'
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4 text-white" />
                ) : (
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      isCurrent ? 'text-primary-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {step.id}
                  </span>
                )}
              </div>
              {index < STEPS.length - 1 && (
                <div className="flex-1 mx-2 h-0.5 rounded-full bg-border">
                  <div
                    className={cn(
                      'h-full transition-all duration-300',
                      isCompleted ? 'bg-green-500 w-full' : 'bg-transparent w-0'
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: Current Step Title */}
      <div className="md:hidden mt-3 text-center">
        <p className="text-sm font-medium text-foreground">
          {STEPS.find((s) => s.id === currentStep)?.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {STEPS.find((s) => s.id === currentStep)?.description}
        </p>
      </div>
    </div>
  );
}
