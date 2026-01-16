import { cn } from '@/lib/utils';
import { User, FileText, Check } from 'lucide-react';

interface Step {
  id: number;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: Step[] = [
  { id: 1, title: 'Associado', description: 'Selecione o associado', icon: User },
  { id: 2, title: 'Documento', description: 'Escolha o template', icon: FileText },
  { id: 3, title: 'Gerar', description: 'Preview e download', icon: Check },
];

interface DocumentoStepperProps {
  currentStep: number;
  completedSteps: number[];
}

export function DocumentoStepper({ currentStep, completedSteps }: DocumentoStepperProps) {
  return (
    <div className="w-full">
      {/* Desktop view */}
      <div className="hidden md:flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isCompleted = completedSteps.includes(step.id);
          const isCurrent = currentStep === step.id;
          const Icon = step.icon;

          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all',
                    isCompleted
                      ? 'bg-primary border-primary text-primary-foreground'
                      : isCurrent
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-muted border-border text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      isCurrent || isCompleted
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>

              {/* Connector line */}
              {index < STEPS.length - 1 && (
                <div className="flex-1 mx-4 h-0.5">
                  <div
                    className={cn(
                      'h-full transition-all',
                      isCompleted ? 'bg-primary' : 'bg-border'
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile view */}
      <div className="md:hidden">
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((step, index) => {
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = currentStep === step.id;

            return (
              <div key={step.id} className="flex items-center">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-all',
                    isCompleted
                      ? 'bg-primary border-primary text-primary-foreground'
                      : isCurrent
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-muted border-border text-muted-foreground'
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : step.id}
                </div>

                {/* Connector line */}
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'w-8 h-0.5 mx-1',
                      isCompleted ? 'bg-primary' : 'bg-border'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Current step info */}
        <div className="mt-4 text-center">
          <p className="text-sm font-medium text-foreground">
            {STEPS.find((s) => s.id === currentStep)?.title}
          </p>
          <p className="text-xs text-muted-foreground">
            {STEPS.find((s) => s.id === currentStep)?.description}
          </p>
        </div>
      </div>
    </div>
  );
}
