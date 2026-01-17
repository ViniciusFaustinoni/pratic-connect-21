import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Calculator, DollarSign, Percent } from 'lucide-react';
import { type SimulacaoResult, formatFipe, formatPercentual, formatCurrency } from '@/hooks/useFaixasCotas';

interface SimulacaoImpactoCardProps {
  simulacao: SimulacaoResult | null;
  isLoading?: boolean;
}

export function SimulacaoImpactoCard({ simulacao, isLoading }: SimulacaoImpactoCardProps) {
  if (!simulacao) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Simulação de Impacto
          </CardTitle>
          <CardDescription>
            Carregando dados para simulação...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const faixasComDesconto = simulacao.faixas.filter(f => f.ajustePercentual < 0);
  const faixasComAdicao = simulacao.faixas.filter(f => f.ajustePercentual > 0);

  return (
    <Card className="border-2 border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Simulação de Impacto
        </CardTitle>
        <CardDescription>
          Visualize o impacto dos ajustes percentuais no rateio
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Métricas principais */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-background rounded-lg p-3 border">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Custo Simulado
            </div>
            <p className="text-lg font-bold">{formatCurrency(simulacao.custoSimulado)}</p>
          </div>
          <div className="bg-background rounded-lg p-3 border">
            <div className="text-xs text-muted-foreground">Total de Cotas</div>
            <p className="text-lg font-bold">{simulacao.totalCotas.toLocaleString('pt-BR')}</p>
          </div>
          <div className="bg-background rounded-lg p-3 border">
            <div className="text-xs text-muted-foreground">Valor Base/Cota</div>
            <p className="text-lg font-bold">{formatCurrency(simulacao.valorBasePorCota)}</p>
          </div>
        </div>

        {/* Redistribuição */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-800 font-medium">Custo dos Descontos</p>
              <p className="text-xs text-amber-600">Valor redistribuído entre todas as cotas</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-amber-700">{formatCurrency(simulacao.custoDescontos)}</p>
            </div>
          </div>
        </div>

        {/* Novo valor base */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-800 font-medium">Novo Valor Base por Cota</p>
              <p className="text-xs text-blue-600">Após redistribuição dos descontos</p>
            </div>
            <div className="text-right flex items-center gap-2">
              <p className="text-lg font-bold text-blue-700">{formatCurrency(simulacao.novoValorBase)}</p>
              <Badge variant="outline" className="bg-blue-100 text-blue-700">
                <Percent className="h-3 w-3 mr-1" />
                {formatPercentual(simulacao.percentualAumento)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Faixas com desconto */}
        {faixasComDesconto.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-1 text-green-700">
              <TrendingDown className="h-4 w-4" />
              Faixas com DESCONTO (pagam menos)
            </p>
            <div className="space-y-1">
              {faixasComDesconto.slice(0, 3).map(faixa => (
                <div key={faixa.faixaId} className="flex items-center justify-between text-sm bg-green-50 rounded px-2 py-1">
                  <span className="text-green-800">
                    {formatFipe(faixa.fipeDe)} a {formatFipe(faixa.fipeAte)}
                  </span>
                  <span className="font-medium text-green-700">
                    {formatCurrency(faixa.valorFinalCota)}/cota ({formatPercentual(faixa.ajustePercentual)})
                  </span>
                </div>
              ))}
              {faixasComDesconto.length > 3 && (
                <p className="text-xs text-muted-foreground pl-2">
                  + {faixasComDesconto.length - 3} faixas com desconto
                </p>
              )}
            </div>
          </div>
        )}

        {/* Faixas com adição */}
        {faixasComAdicao.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium flex items-center gap-1 text-red-700">
              <TrendingUp className="h-4 w-4" />
              Faixas com ADIÇÃO (pagam mais)
            </p>
            <div className="space-y-1">
              {faixasComAdicao.slice(0, 3).map(faixa => (
                <div key={faixa.faixaId} className="flex items-center justify-between text-sm bg-red-50 rounded px-2 py-1">
                  <span className="text-red-800">
                    {formatFipe(faixa.fipeDe)} a {formatFipe(faixa.fipeAte)}
                  </span>
                  <span className="font-medium text-red-700">
                    {formatCurrency(faixa.valorFinalCota)}/cota ({formatPercentual(faixa.ajustePercentual)})
                  </span>
                </div>
              ))}
              {faixasComAdicao.length > 3 && (
                <p className="text-xs text-muted-foreground pl-2">
                  + {faixasComAdicao.length - 3} faixas com adição
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
