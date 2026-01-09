import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, TrendingUp, TrendingDown, DollarSign, Rocket, Medal } from 'lucide-react';
import { useRankingPlanos, type PeriodoRanking } from '@/hooks/useRankingPlanos';
import { cn } from '@/lib/utils';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const getMedalIcon = (posicao: number) => {
  switch (posicao) {
    case 1:
      return <span className="text-2xl">🥇</span>;
    case 2:
      return <span className="text-2xl">🥈</span>;
    case 3:
      return <span className="text-2xl">🥉</span>;
    default:
      return (
        <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
          {posicao}
        </span>
      );
  }
};

const getBarColor = (posicao: number) => {
  switch (posicao) {
    case 1:
      return 'bg-yellow-500';
    case 2:
      return 'bg-slate-400';
    case 3:
      return 'bg-amber-600';
    default:
      return 'bg-primary';
  }
};

export function RankingPlanos() {
  const [periodo, setPeriodo] = useState<PeriodoRanking>('mes');
  const { data, isLoading, error } = useRankingPlanos(periodo);

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            Erro ao carregar ranking. Tente novamente.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 text-yellow-500" />
              <div>
                <CardTitle>Planos Mais Vendidos</CardTitle>
                <CardDescription>Ranking atualizado em tempo real</CardDescription>
              </div>
            </div>
            <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoRanking)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mes">Mês Atual</SelectItem>
                <SelectItem value="3meses">Últimos 3 meses</SelectItem>
                <SelectItem value="6meses">Últimos 6 meses</SelectItem>
                <SelectItem value="ano">Ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !data || data.ranking.length === 0 ? (
            <div className="text-center py-12">
              <Medal className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Nenhum contrato encontrado no período selecionado.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.ranking.map((plano) => (
                <div
                  key={plano.planoId}
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-lg border transition-colors',
                    plano.posicao <= 3 ? 'bg-muted/50' : 'bg-background hover:bg-muted/30'
                  )}
                >
                  {/* Posição */}
                  <div className="flex-shrink-0">{getMedalIcon(plano.posicao)}</div>

                  {/* Informações */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold truncate">{plano.planoNome}</span>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {plano.quantidade} vendas
                      </Badge>
                    </div>

                    {/* Barra de progresso */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', getBarColor(plano.posicao))}
                          style={{ width: `${plano.percentual}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {plano.percentual.toFixed(1)}%
                      </span>
                    </div>

                    {/* Detalhes */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Ticket médio: {formatCurrency(plano.ticketMedio)}</span>
                      <span>Região: {plano.regiaoPredominate}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Insights */}
      {data && data.insights && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Plano em Alta */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Em Alta</p>
                  <p className="font-semibold truncate">
                    {data.insights.planoEmAlta?.nome || '—'}
                  </p>
                  {data.insights.planoEmAlta && (
                    <Badge className="mt-1 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                      +{data.insights.planoEmAlta.variacao}%
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Plano em Queda */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Em Queda</p>
                  <p className="font-semibold truncate">
                    {data.insights.planoEmQueda?.nome || '—'}
                  </p>
                  {data.insights.planoEmQueda && (
                    <Badge className="mt-1 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
                      {data.insights.planoEmQueda.variacao}%
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Maior Ticket */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Maior Ticket</p>
                  <p className="font-semibold truncate">
                    {data.insights.maiorTicket?.nome || '—'}
                  </p>
                  {data.insights.maiorTicket && (
                    <Badge className="mt-1 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                      {formatCurrency(data.insights.maiorTicket.valor)}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Novidade */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <Rocket className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Top Novatos</p>
                  <p className="font-semibold truncate">
                    {data.insights.novidade?.nome || '—'}
                  </p>
                  {data.insights.novidade && (
                    <Badge className="mt-1 bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                      {data.insights.novidade.quantidade} vendas
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
