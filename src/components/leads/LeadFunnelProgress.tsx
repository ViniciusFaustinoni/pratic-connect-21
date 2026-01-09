import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Check, X } from "lucide-react";
import { ETAPAS_FUNIL, normalizeEtapa } from "@/lib/lead-transitions";
import { ETAPA_LABELS, type EtapaLead } from "@/types/database";

interface LeadFunnelProgressProps {
  etapaAtual: string;
}

export function LeadFunnelProgress({ etapaAtual }: LeadFunnelProgressProps) {
  // Normaliza etapa para padrão atual
  const etapaNormalizada = normalizeEtapa(etapaAtual as EtapaLead);
  
  // Etapas de progresso (sem 'perdido' na visualização linear)
  const etapasProgresso = ETAPAS_FUNIL.filter(e => e !== 'perdido');
  
  const currentIndex = etapasProgresso.findIndex(e => e === etapaNormalizada);
  const isPerdido = etapaNormalizada === 'perdido';
  const isGanho = etapaNormalizada === 'ganho';

  return (
    <Card className={cn(
      "shadow-sm",
      isPerdido && "border-destructive/50 bg-destructive/5",
      isGanho && "border-green-500/50 bg-green-50 dark:bg-green-950/20"
    )}>
      <CardHeader className="pb-3 bg-primary/5 rounded-t-lg border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className={cn(
            "h-4 w-4",
            isPerdido ? "text-destructive" : isGanho ? "text-green-600" : "text-primary"
          )} />
          Progresso no Funil
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Se PERDIDO - Mostrar indicador especial */}
        {isPerdido ? (
          <div className="text-center py-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-destructive/20 text-destructive mb-3 shadow-inner">
              <X className="h-7 w-7" />
            </div>
            <p className="font-bold text-destructive text-lg">Lead Perdido</p>
          </div>
        ) : (
          <>
            {/* Indicadores visuais das etapas (barras de progresso) */}
            <div className="flex items-center justify-between gap-1.5">
              {etapasProgresso.map((etapa, index) => {
                const isCompleted = index < currentIndex;
                const isCurrent = index === currentIndex;
                
                return (
                  <div
                    key={etapa}
                    className={cn(
                      "h-3 flex-1 rounded-full transition-all border",
                      isCompleted && "bg-primary border-primary shadow-sm",
                      isCurrent && "bg-primary border-primary ring-2 ring-primary/40 shadow-md",
                      !isCompleted && !isCurrent && "bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600"
                    )}
                    title={ETAPA_LABELS[etapa]}
                  />
                );
              })}
            </div>

            {/* Texto da etapa atual */}
            <div className="text-center space-y-1.5 pt-2">
              <p className="text-sm text-muted-foreground font-medium">
                Etapa {currentIndex + 1} de {etapasProgresso.length}
              </p>
              <p className={cn(
                "font-bold text-xl",
                isGanho ? "text-green-600" : "text-primary"
              )}>
                {isGanho && <Check className="inline h-5 w-5 mr-1" />}
                {ETAPA_LABELS[etapaNormalizada]}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
