import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

const ETAPAS = [
  { value: 'novo', label: 'Novo' },
  { value: 'contato', label: 'Contato' },
  { value: 'qualificado', label: 'Qualificado' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'fechamento', label: 'Fechamento' },
];

interface LeadFunnelProgressProps {
  etapaAtual: string;
}

export function LeadFunnelProgress({ etapaAtual }: LeadFunnelProgressProps) {
  const currentIndex = ETAPAS.findIndex(e => e.value === etapaAtual);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Progresso no Funil
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Progress Line */}
          <div className="absolute top-3 left-3 right-3 h-0.5 bg-muted" />
          <div 
            className="absolute top-3 left-3 h-0.5 bg-primary transition-all duration-500"
            style={{ width: `${(currentIndex / (ETAPAS.length - 1)) * 100}%` }}
          />
          
          {/* Etapas */}
          <div className="relative flex justify-between">
            {ETAPAS.map((etapa, index) => {
              const isCompleted = index < currentIndex;
              const isCurrent = index === currentIndex;
              const isPending = index > currentIndex;
              
              return (
                <div key={etapa.value} className="flex flex-col items-center">
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300 border-2",
                      isCompleted && "bg-primary border-primary text-primary-foreground",
                      isCurrent && "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20",
                      isPending && "bg-background border-muted-foreground/30 text-muted-foreground"
                    )}
                  >
                    {isCompleted ? "✓" : index + 1}
                  </div>
                  <span
                    className={cn(
                      "text-xs mt-2 text-center max-w-[60px]",
                      isCurrent && "font-semibold text-primary",
                      isPending && "text-muted-foreground",
                      isCompleted && "text-muted-foreground"
                    )}
                  >
                    {etapa.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
