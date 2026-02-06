import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Circle, Target, TrendingUp } from 'lucide-react';
import type { MeuCrescimento } from '@/hooks/useMinhasComissoesExtended';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TabCrescimentoProps {
  crescimento: MeuCrescimento[];
  placasAtivas: number;
  isLoading: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Marcos de crescimento (simulados)
const MARCOS_CRESCIMENTO = [
  { placas: 100, valor: 1000, percentual_minimo: 3 },
  { placas: 200, valor: 2000, percentual_minimo: 4 },
  { placas: 300, valor: 3000, percentual_minimo: 5 },
  { placas: 400, valor: 4000, percentual_minimo: 5.5 },
  { placas: 500, valor: 5000, percentual_minimo: 6 },
  { placas: 600, valor: 6000, percentual_minimo: 6.5 },
];

export function TabCrescimento({
  crescimento,
  placasAtivas,
  isLoading,
}: TabCrescimentoProps) {
  // Mapear marcos atingidos
  const marcosAtingidosSet = new Set(crescimento.map(c => c.marco_placas));

  // Encontrar próximo marco
  const proximoMarco = MARCOS_CRESCIMENTO.find(m => !marcosAtingidosSet.has(m.placas));
  const faltamParaProximo = proximoMarco ? proximoMarco.placas - placasAtivas : 0;

  // Último marco atingido
  const ultimoMarco = crescimento.length > 0 ? crescimento[crescimento.length - 1] : null;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Card de status atual */}
      <Card className="bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-950/20 dark:to-teal-950/20">
        <CardContent className="py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Base Ativa Atual</p>
              <p className="text-3xl font-bold text-primary">{placasAtivas}</p>
              <p className="text-xs text-muted-foreground">placas</p>
            </div>
            
            {proximoMarco && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Próximo Marco</p>
                <p className="text-3xl font-bold text-cyan-600">{proximoMarco.placas}</p>
                <p className="text-xs text-cyan-600">Faltam {faltamParaProximo}</p>
              </div>
            )}
            
            {ultimoMarco && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Recorrente Mínimo</p>
                <p className="text-3xl font-bold text-green-600">{ultimoMarco.percentual_recorrente_garantido}%</p>
                <p className="text-xs text-green-600">Garantido</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Achievement tracker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Marcos de Crescimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {MARCOS_CRESCIMENTO.map((marco) => {
              const atingido = marcosAtingidosSet.has(marco.placas);
              const dadosAtingido = crescimento.find(c => c.marco_placas === marco.placas);
              const isProximo = proximoMarco?.placas === marco.placas;

              return (
                <div
                  key={marco.placas}
                  className={`relative p-4 rounded-lg border text-center transition-all ${
                    atingido 
                      ? 'bg-green-100 border-green-300 dark:bg-green-900/30' 
                      : isProximo
                        ? 'bg-yellow-50 border-yellow-300 dark:bg-yellow-900/20 ring-2 ring-yellow-400'
                        : 'bg-muted/50 opacity-60'
                  }`}
                >
                  {atingido ? (
                    <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-2" />
                  ) : (
                    <Circle className={`h-6 w-6 mx-auto mb-2 ${isProximo ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                  )}
                  
                  <p className={`text-lg font-bold ${atingido ? 'text-green-700' : isProximo ? 'text-yellow-700' : 'text-muted-foreground'}`}>
                    {marco.placas}
                  </p>
                  <p className="text-xs text-muted-foreground">placas</p>
                  
                  {atingido ? (
                    <Badge className="mt-2 bg-green-500 text-xs">
                      {formatCurrency(dadosAtingido?.valor_pago || marco.valor)}
                    </Badge>
                  ) : isProximo ? (
                    <Badge variant="outline" className="mt-2 text-xs border-yellow-400 text-yellow-700">
                      Próximo!
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="mt-2 text-xs">
                      {formatCurrency(marco.valor)}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Histórico de conquistas */}
      {crescimento.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Histórico de Conquistas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {crescimento.map((c) => (
                <div 
                  key={c.marco_placas}
                  className="flex items-center justify-between p-3 bg-green-50/50 dark:bg-green-950/20 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">Marco {c.marco_placas} placas atingido!</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(c.data_atingido), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-700">{formatCurrency(c.valor_pago)}</p>
                    <p className="text-xs text-muted-foreground">
                      Recorrente mín: {c.percentual_recorrente_garantido}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Motivacional se sem conquistas */}
      {crescimento.length === 0 && (
        <Card className="border-cyan-200 bg-cyan-50/50 dark:bg-cyan-950/10">
          <CardContent className="py-8 text-center">
            <Target className="h-12 w-12 mx-auto mb-4 text-cyan-600" />
            <h3 className="text-lg font-semibold mb-2">Comece Sua Jornada!</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Ao atingir {MARCOS_CRESCIMENTO[0].placas} placas ativas, você ganhará 
              <span className="font-bold text-cyan-700"> {formatCurrency(MARCOS_CRESCIMENTO[0].valor)}</span> de bônus 
              e garantirá um recorrente mínimo de <span className="font-bold">{MARCOS_CRESCIMENTO[0].percentual_minimo}%</span>!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
