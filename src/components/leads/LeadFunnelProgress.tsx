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
  const currentLabel = ETAPAS[currentIndex]?.label || etapaAtual;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Progresso no Funil
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Círculos das etapas */}
        <div className="flex items-center justify-between">
          {ETAPAS.map((etapa, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const isPending = index > currentIndex;
            
            return (
              <div key={etapa.value} className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 border-2",
                    isCompleted && "bg-primary border-primary text-primary-foreground",
                    isCurrent && "bg-primary border-primary text-primary-foreground ring-4 ring-primary/20 scale-110",
                    isPending && "bg-muted border-muted-foreground/20 text-muted-foreground"
                  )}
                >
                  {isCompleted ? "✓" : index + 1}
                </div>
              </div>
            );
          })}
        </div>

        {/* Barra de progresso */}
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${((currentIndex + 1) / ETAPAS.length) * 100}%` }}
          />
        </div>

        {/* Label da etapa atual */}
        <p className="text-sm text-center">
          <span className="text-muted-foreground">Etapa {currentIndex + 1} de {ETAPAS.length}:</span>{' '}
          <span className="font-semibold text-primary">{currentLabel}</span>
        </p>
      </CardContent>
    </Card>
  );
}
