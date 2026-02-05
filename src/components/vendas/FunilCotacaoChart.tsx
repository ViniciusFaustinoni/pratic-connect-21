import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Info, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFunilCotacao, type Periodo, type EtapaFunilCotacao } from '@/hooks/useFunilCotacao';
import { cn } from '@/lib/utils';

interface FunilCotacaoChartProps {
  periodo?: Periodo;
  className?: string;
  compact?: boolean;
  onEtapaClick?: (etapaId: string) => void;
}

// Mapeamento de rotas por etapa do funil
const ETAPA_ROTAS: Record<EtapaFunilCotacao, string> = {
  novo: '/vendas/leads?etapa=novo',
  contato: '/vendas/leads?etapa=contato',
  cotacao_gerada: '/vendas/cotacoes',
  escolhendo_plano: '/vendas/cotacoes?status_contratacao=escolhendo_plano',
  enviando_docs: '/vendas/cotacoes?status_contratacao=enviando_documentos',
  termo_assinado: '/vendas/contratos?status=assinado',
  pagamento_efetuado: '/vendas/contratos?adesao_paga=true',
  vistoria_agendada: '/monitoramento/vistorias',
  proposta_concluida: '/cadastro/associados?status=ativo',
};

/**
 * Componente de visualização do Funil de Cotação
 * Exibe as 9 etapas reais do processo de cotação com navegação interativa
 */
export function FunilCotacaoChart({ periodo = '30dias', className, compact = false, onEtapaClick }: FunilCotacaoChartProps) {
  const navigate = useNavigate();
  const { data, isLoading } = useFunilCotacao(periodo);

  const handleEtapaClick = (etapaId: EtapaFunilCotacao) => {
    if (onEtapaClick) {
      onEtapaClick(etapaId);
    } else {
      navigate(ETAPA_ROTAS[etapaId]);
    }
  };

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
            <CardDescription>Clique em uma etapa para ver detalhes</CardDescription>
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
        <div className="space-y-1">
          {etapas.map((etapa, index) => {
            // Calcular largura da barra baseada na quantidade relativa
            const maxQuantidade = Math.max(...etapas.map(e => e.quantidade), 1);
            const barWidth = (etapa.quantidade / maxQuantidade) * 100;

            return (
              <TooltipProvider key={etapa.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => handleEtapaClick(etapa.id)}
                      className={cn(
                        "w-full text-left rounded-lg p-2 -mx-2 transition-all duration-200",
                        "hover:bg-primary/10 hover:scale-[1.01] cursor-pointer",
                        "focus:outline-none focus:ring-2 focus:ring-primary/20",
                        "group"
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span 
                              className="w-2.5 h-2.5 rounded-full transition-transform group-hover:scale-125" 
                              style={{ backgroundColor: etapa.cor }}
                            />
                            <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                              {index + 1}. {etapa.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground tabular-nums">
                              {etapa.quantidade}
                            </span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
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
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p className="font-medium">{etapa.label}</p>
                    <p className="text-xs text-muted-foreground">{etapa.descricao}</p>
                    <p className="text-xs mt-1">
                      {etapa.quantidade} ({etapa.percentual.toFixed(1)}% do total)
                    </p>
                    <p className="text-xs text-primary mt-1">Clique para ver lista</p>
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
        </div>
      </CardContent>
    </Card>
  );
}
