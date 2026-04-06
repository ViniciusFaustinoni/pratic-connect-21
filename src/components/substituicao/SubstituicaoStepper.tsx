import { Check, SkipForward } from 'lucide-react';
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
  const progress = ((Math.max(0, currentStep - 1)) / (STEPS.length - 1)) * 100;

  return (
    <div className="w-full space-y-4">
      {/* Progress bar */}
      <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Desktop Stepper */}
      <div className="hidden lg:grid grid-cols-8 gap-1">
        {STEPS.map((step) => {
          const isCompleted = completedSteps.includes(step.id);
          const isSkipped = skippedSteps.includes(step.id);
          const isCurrent = currentStep === step.id;
          const isClickable = isCompleted || step.id <= Math.max(...completedSteps, currentStep);

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => isClickable && onStepClick?.(step.id)}
              disabled={!isClickable}
              className={cn(
                'relative flex flex-col items-center gap-2 py-3 px-1 rounded-lg transition-all group',
                isClickable && 'cursor-pointer hover:bg-accent/50',
                !isClickable && 'cursor-not-allowed opacity-50',
                isCurrent && 'bg-accent/80'
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all duration-300 shrink-0',
                  isCompleted && 'bg-emerald-500 border-emerald-500 shadow-[0_0_10px_hsl(142_71%_45%/0.3)]',
                  isSkipped && !isCompleted && 'bg-muted border-muted-foreground/30',
                  isCurrent && !isCompleted && 'bg-primary border-primary shadow-[0_0_12px_hsl(var(--primary)/0.4)] scale-110',
                  !isCurrent && !isCompleted && !isSkipped && 'bg-background border-border'
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4 text-white" strokeWidth={3} />
                ) : isSkipped ? (
                  <SkipForward className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <span
                    className={cn(
                      'text-xs font-bold',
                      isCurrent ? 'text-primary-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {step.id}
                  </span>
                )}
              </div>
              <div className="text-center min-w-0">
                <p
                  className={cn(
                    'text-[11px] font-semibold leading-tight transition-colors truncate',
                    isCurrent ? 'text-foreground' : 'text-muted-foreground',
                    isCompleted && 'text-emerald-400'
                  )}
                >
                  {step.title}
                </p>
                <p className="text-[10px] text-muted-foreground/70 truncate leading-tight mt-0.5">
                  {step.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tablet Stepper */}
      <div className="hidden md:flex lg:hidden items-center justify-between gap-1">
        {STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = currentStep === step.id;
          const isSkipped = skippedSteps.includes(step.id);

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => (isCompleted || step.id <= currentStep) && onStepClick?.(step.id)}
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all shrink-0',
                  isCompleted && 'bg-emerald-500 border-emerald-500',
                  isSkipped && !isCompleted && 'bg-muted border-border',
                  isCurrent && !isCompleted && 'bg-primary border-primary scale-110',
                  !isCurrent && !isCompleted && !isSkipped && 'bg-background border-border opacity-50'
                )}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                ) : (
                  <span className={cn('text-xs font-bold', isCurrent ? 'text-primary-foreground' : 'text-muted-foreground')}>
                    {step.id}
                  </span>
                )}
              </button>
              {index < STEPS.length - 1 && (
                <div className="flex-1 mx-1.5 h-0.5 rounded-full bg-border overflow-hidden">
                  <div className={cn('h-full transition-all duration-300', isCompleted ? 'bg-emerald-500 w-full' : 'w-0')} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile Stepper */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-foreground">
            Etapa {currentStep} de {STEPS.length}
          </p>
          <p className="text-xs text-muted-foreground">
            {STEPS.find((s) => s.id === currentStep)?.title}
          </p>
        </div>
        <div className="flex gap-1">
          {STEPS.map((step) => {
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = currentStep === step.id;
            return (
              <div
                key={step.id}
                className={cn(
                  'flex-1 h-1.5 rounded-full transition-all duration-300',
                  isCompleted && 'bg-emerald-500',
                  isCurrent && !isCompleted && 'bg-primary',
                  !isCurrent && !isCompleted && 'bg-muted'
                )}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
