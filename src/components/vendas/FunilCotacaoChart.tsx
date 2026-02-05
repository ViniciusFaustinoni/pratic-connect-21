import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFunilCotacao, type Periodo } from '@/hooks/useFunilCotacao';
import { cn } from '@/lib/utils';

interface FunilCotacaoChartProps {
  periodo?: Periodo;
  className?: string;
  compact?: boolean;
}

/**
 * Componente de visualização do Funil de Cotação
 * Exibe as 9 etapas reais do processo de cotação
 */
export function FunilCotacaoChart({ periodo = '30dias', className, compact = false }: FunilCotacaoChartProps) {
  const { data, isLoading } = useFunilCotacao(periodo);

  if (isLoading || !data) {
    return (
      <Card className={cn("border-border bg-card", className)}>
        <CardHeader>
          <Skeleton className="h-6 w-40 bg-muted" />
          <Skeleton className="h-4 w-60 bg-muted" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24 bg-muted" />
                <Skeleton className="h-2 w-full bg-muted" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { etapas, totalCotacoes, cotacoesSemLead, taxaConversao } = data;

  return (
    <Card className={cn("border-border bg-card", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <TrendingUp className="h-5 w-5 text-primary" />
              Funil de Cotação
            </CardTitle>
            <CardDescription>Jornada real do cliente no processo de cotação</CardDescription>
          </div>
          {cotacoesSemLead > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    {cotacoesSemLead} sem lead
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{cotacoesSemLead} cotações criadas sem lead vinculado</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {etapas.map((etapa, index) => {
            // Calcular largura da barra baseada na quantidade relativa
            const maxQuantidade = Math.max(...etapas.map(e => e.quantidade), 1);
            const barWidth = (etapa.quantidade / maxQuantidade) * 100;

            return (
              <TooltipProvider key={etapa.id}>
                <Tooltip>
                  <TooltipTrigger className="w-full text-left">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-2.5 h-2.5 rounded-full" 
                            style={{ backgroundColor: etapa.cor }}
                          />
                          <span className="text-muted-foreground">
                            {index + 1}. {etapa.label}
                          </span>
                        </div>
                        <span className="font-medium text-foreground tabular-nums">
                          {etapa.quantidade}
                        </span>
                      </div>
                      {!compact && (
                        <div className="relative h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div 
                            className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                            style={{ 
                              width: `${barWidth}%`,
                              backgroundColor: etapa.cor 
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="font-medium">{etapa.label}</p>
                    <p className="text-xs text-muted-foreground">{etapa.descricao}</p>
                    <p className="text-xs mt-1">
                      {etapa.quantidade} ({etapa.percentual.toFixed(1)}% do total)
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>

        {/* Rodapé com totais e taxa de conversão */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Total de cotações: <span className="font-medium text-foreground">{totalCotacoes}</span>
            </span>
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs",
                taxaConversao >= 10 && "bg-success/10 text-success border-success",
                taxaConversao < 10 && taxaConversao >= 5 && "bg-warning/10 text-warning border-warning",
                taxaConversao < 5 && "bg-muted text-muted-foreground"
              )}
            >
              Taxa de conversão: {taxaConversao.toFixed(1)}%
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Conversão = Propostas Concluídas ÷ Cotações Geradas
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
