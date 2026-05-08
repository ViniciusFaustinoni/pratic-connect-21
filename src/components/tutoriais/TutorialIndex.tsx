import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { TutorialStep } from '@/data/tutoriais';

interface TutorialIndexProps {
  steps: TutorialStep[];
  currentStep: number;
  onSelect: (numero: number) => void;
}

export function TutorialIndex({ steps, currentStep, onSelect }: TutorialIndexProps) {
  return (
    <nav aria-label="Índice de passos" className="space-y-1">
      {steps.map((step) => {
        const isActive = step.numero === currentStep;
        const isDone = step.numero < currentStep;
        return (
          <button
            key={step.numero}
            type="button"
            onClick={() => onSelect(step.numero)}
            className={cn(
              'flex w-full items-start gap-3 rounded-md border border-transparent px-3 py-2 text-left text-sm transition-colors',
              isActive
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            <span
              className={cn(
                'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : isDone
                    ? 'border-primary/40 bg-primary/20 text-primary'
                    : 'border-border bg-background'
              )}
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : step.numero}
            </span>
            <span className="leading-tight">{step.titulo}</span>
          </button>
        );
      })}
    </nav>
  );
}
