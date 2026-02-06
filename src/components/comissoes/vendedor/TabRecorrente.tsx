import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DollarSign, Car, Percent, TrendingUp } from 'lucide-react';
import type { MeuRecorrente, MeuCrescimento } from '@/hooks/useMinhasComissoesExtended';
import { Skeleton } from '@/components/ui/skeleton';

interface TabRecorrenteProps {
  recorrente: MeuRecorrente | null;
  crescimento: MeuCrescimento[];
  placasAtivas: number;
  tipoConsultor: string;
  isLoading: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Faixas de recorrente (simuladas)
const FAIXAS_RECORRENTE_INTERNO = [
  { placas_min: 10, percentual: 2 },
  { placas_min: 30, percentual: 3 },
  { placas_min: 50, percentual: 4 },
  { placas_min: 100, percentual: 5 },
  { placas_min: 150, percentual: 6 },
];

const FAIXAS_RECORRENTE_EXTERNO = [
  { placas_min: 1, percentual: 3 },
  { placas_min: 50, percentual: 4 },
  { placas_min: 100, percentual: 5 },
  { placas_min: 150, percentual: 6 },
];

function getFaixaAtual(placas: number, tipo: string) {
  const faixas = tipo === 'externo' ? FAIXAS_RECORRENTE_EXTERNO : FAIXAS_RECORRENTE_INTERNO;
  let faixaAtual = faixas[0];
  for (const faixa of faixas) {
    if (placas >= faixa.placas_min) {
      faixaAtual = faixa;
    }
  }
  return faixaAtual;
}

function getProximaFaixa(placas: number, tipo: string) {
  const faixas = tipo === 'externo' ? FAIXAS_RECORRENTE_EXTERNO : FAIXAS_RECORRENTE_INTERNO;
  for (const faixa of faixas) {
    if (placas < faixa.placas_min) {
      return faixa;
    }
  }
  return null;
}

export function TabRecorrente({
  recorrente,
  crescimento,
  placasAtivas,
  tipoConsultor,
  isLoading,
}: TabRecorrenteProps) {
  const isInterno = tipoConsultor === 'interno';
  const minimoPlacasInterno = 10;
  const habilitado = !isInterno || placasAtivas >= minimoPlacasInterno;

  const faixaAtual = getFaixaAtual(placasAtivas, tipoConsultor);
  const proximaFaixa = getProximaFaixa(placasAtivas, tipoConsultor);

  // Mínimo garantido pelo crescimento
  const ultimoCrescimento = crescimento.length > 0 ? crescimento[crescimento.length - 1] : null;
  const minimoGarantido = ultimoCrescimento?.percentual_recorrente_garantido || 0;

  // Percentual efetivo
  const percentualEfetivo = Math.max(faixaAtual?.percentual || 0, minimoGarantido);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  // Se interno e não habilitado
  if (!habilitado) {
    const faltam = minimoPlacasInterno - placasAtivas;
    const progressValue = (placasAtivas / minimoPlacasInterno) * 100;

    return (
      <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/10">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-amber-700">
            <Car className="h-5 w-5" />
            Recorrente Ainda Não Habilitado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Você precisa de <span className="font-bold text-amber-700">{minimoPlacasInterno} placas ativas</span> para 
            habilitar o recebimento de comissão recorrente.
          </p>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Suas placas ativas: <span className="font-bold">{placasAtivas}</span></span>
              <span className="text-amber-700">Faltam {faltam}</span>
            </div>
            <Progress value={progressValue} className="h-3" indicatorClassName="bg-amber-500" />
          </div>

          <p className="text-sm text-muted-foreground">
            Continue vendendo para atingir a meta e desbloquear essa remuneração!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Card principal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Info do recorrente */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Car className="h-4 w-4 text-purple-600" />
              Base Ativa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-bold text-primary">{placasAtivas} placas</p>
            
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Faixa atual:</span>
                <Badge variant="outline">{faixaAtual.percentual}%</Badge>
              </div>
              {proximaFaixa && (
                <div className="flex justify-between text-blue-600">
                  <span>Próxima faixa:</span>
                  <span>{proximaFaixa.placas_min} placas = {proximaFaixa.percentual}%</span>
                </div>
              )}
              {minimoGarantido > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Mínimo garantido:</span>
                  <Badge className="bg-green-100 text-green-700">{minimoGarantido}%</Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Valor do recorrente */}
        <Card className="bg-green-50 dark:bg-green-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-green-700">
              <DollarSign className="h-4 w-4" />
              Valor Recorrente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-700 dark:text-green-400">
              {formatCurrency(recorrente?.valor_recorrente || 0)}
            </p>
            
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Boletos pagos (mês ant.):</span>
                <span className="font-medium">
                  {formatCurrency(recorrente?.total_boletos_pagos || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Percentual aplicado:</span>
                <span className="font-medium">{percentualEfetivo}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progresso para próxima faixa */}
      {proximaFaixa && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Progresso para próxima faixa
              </span>
              <span className="text-sm text-muted-foreground">
                Faltam {proximaFaixa.placas_min - placasAtivas} placas para {proximaFaixa.percentual}%
              </span>
            </div>
            <Progress 
              value={((placasAtivas - faixaAtual.placas_min) / (proximaFaixa.placas_min - faixaAtual.placas_min)) * 100} 
              className="h-3" 
            />
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
              <span>{faixaAtual.percentual}% ({faixaAtual.placas_min}+ placas)</span>
              <span>{proximaFaixa.percentual}% ({proximaFaixa.placas_min}+ placas)</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info sobre mínimo garantido */}
      {minimoGarantido > 0 && (
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-700">
              <Percent className="h-5 w-5" />
              <span className="font-medium">Mínimo Garantido por Crescimento</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Por ter atingido o marco de {ultimoCrescimento?.marco_placas} placas, 
              você tem garantido um percentual mínimo de <span className="font-bold text-green-700">{minimoGarantido}%</span> no recorrente, 
              mesmo que sua base atual seja menor.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
