import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DollarSign, Target, TrendingUp } from 'lucide-react';
import type { MeuResumoTipo } from '@/hooks/useMinhasComissoesExtended';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface TabProducaoProps {
  resumoProducao: MeuResumoTipo | undefined;
  vendasConfirmadas: number;
  isLoading: boolean;
}

interface FaixaProducao {
  id: string;
  placas_min: number;
  placas_max: number | null;
  valor_bonus: number;
  descricao: string | null;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

function useFaixasProducao() {
  return useQuery({
    queryKey: ['faixas-producao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('faixas_producao')
        .select('*')
        .eq('is_active', true)
        .order('placas_min', { ascending: true });

      if (error) throw error;
      return (data || []) as FaixaProducao[];
    },
    staleTime: 1000 * 60 * 10,
  });
}

function getFaixaAtual(faixas: FaixaProducao[], placas: number) {
  let faixaAtual: FaixaProducao | null = null;
  for (const faixa of faixas) {
    if (placas >= faixa.placas_min) {
      faixaAtual = faixa;
    }
  }
  return faixaAtual;
}

function getProximaFaixa(faixas: FaixaProducao[], placas: number) {
  for (const faixa of faixas) {
    if (placas < faixa.placas_min) {
      return faixa;
    }
  }
  return null;
}

export function TabProducao({
  resumoProducao,
  vendasConfirmadas,
  isLoading,
}: TabProducaoProps) {
  const { data: faixas = [], isLoading: loadingFaixas } = useFaixasProducao();

  const minimoPlacas = faixas.length > 0 ? faixas[0].placas_min : 30;
  const habilitado = vendasConfirmadas >= minimoPlacas;

  const faixaAtual = getFaixaAtual(faixas, vendasConfirmadas);
  const proximaFaixa = getProximaFaixa(faixas, vendasConfirmadas);

  const valorProducao = resumoProducao?.valor_total || faixaAtual?.valor_bonus || 0;

  if (isLoading || loadingFaixas) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (faixas.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          Nenhuma faixa de produção configurada.
        </CardContent>
      </Card>
    );
  }

  // Se não atingiu mínimo
  if (!habilitado) {
    const faltam = minimoPlacas - vendasConfirmadas;
    const progressValue = (vendasConfirmadas / minimoPlacas) * 100;

    return (
      <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/10">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-purple-700">
            <Target className="h-5 w-5" />
            Bonificação de Produção
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Para habilitar a bonificação de produção, você precisa atingir 
            <span className="font-bold text-purple-700"> {minimoPlacas} placas confirmadas</span> na campanha.
          </p>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Suas placas confirmadas: <span className="font-bold">{vendasConfirmadas}</span></span>
              <span className="text-purple-700">Faltam {faltam}</span>
            </div>
            <Progress value={progressValue} className="h-3" indicatorClassName="bg-purple-500" />
          </div>

          <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
            <p className="text-sm text-purple-800 dark:text-purple-300">
              🎯 Ao atingir {minimoPlacas} placas, você receberá: 
              <span className="font-bold ml-1">{formatCurrency(faixas[0].valor_bonus)}</span>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Card principal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Info de produção */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-600" />
              Placas Confirmadas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-bold text-primary">{vendasConfirmadas}</p>
            
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Faixa atingida:</span>
                <Badge variant="outline" className="bg-purple-50">
                  {faixaAtual?.placas_min}+ placas
                </Badge>
              </div>
              {proximaFaixa && (
                <div className="flex justify-between text-purple-600">
                  <span>Próxima faixa:</span>
                  <span>{proximaFaixa.placas_min} placas = {formatCurrency(proximaFaixa.valor_bonus)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Valor da produção */}
        <Card className="bg-purple-50 dark:bg-purple-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-purple-700">
              <DollarSign className="h-4 w-4" />
              Valor Produção
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-purple-700 dark:text-purple-400">
              {formatCurrency(valorProducao)}
            </p>
            
            <p className="text-sm text-muted-foreground mt-2">
              Bonificação por atingir {faixaAtual?.placas_min}+ placas confirmadas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progresso para próxima faixa */}
      {proximaFaixa && faixaAtual && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Próxima faixa de produção
              </span>
              <span className="text-sm text-muted-foreground">
                Faltam {proximaFaixa.placas_min - vendasConfirmadas} placas
              </span>
            </div>
            <Progress 
              value={((vendasConfirmadas - faixaAtual.placas_min) / (proximaFaixa.placas_min - faixaAtual.placas_min)) * 100} 
              className="h-3" 
              indicatorClassName="bg-purple-500"
            />
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
              <span>{formatCurrency(faixaAtual.valor_bonus)} ({faixaAtual.placas_min}+ placas)</span>
              <span>{formatCurrency(proximaFaixa.valor_bonus)} ({proximaFaixa.placas_min}+ placas)</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de faixas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tabela de Faixas de Produção</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {faixas.map((faixa) => {
              const atingida = vendasConfirmadas >= faixa.placas_min;
              return (
                <div
                  key={faixa.id}
                  className={`p-3 rounded-lg border text-center ${
                    atingida 
                      ? 'bg-purple-100 border-purple-300 dark:bg-purple-900/30' 
                      : 'bg-muted/50'
                  }`}
                >
                  <p className={`text-lg font-bold ${atingida ? 'text-purple-700' : 'text-muted-foreground'}`}>
                    {faixa.placas_min}+ placas
                  </p>
                  <p className={`text-sm ${atingida ? 'text-purple-600' : 'text-muted-foreground'}`}>
                    {formatCurrency(faixa.valor_bonus)}
                  </p>
                  {atingida && (
                    <Badge className="mt-1 bg-purple-500">Atingida ✓</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
