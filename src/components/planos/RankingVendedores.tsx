import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Users, Medal, FileText, TrendingUp, DollarSign, BarChart3 } from 'lucide-react';
import { useRankingVendedores, type PeriodoRanking, type TipoVendedor } from '@/hooks/useRankingVendedores';
import { usePermissions } from '@/hooks/usePermissions';
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

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

const PERIODO_LABELS: Record<PeriodoRanking, string> = {
  mes: 'este mês',
  '3meses': 'nos últimos 3 meses',
  '6meses': 'nos últimos 6 meses',
  ano: 'este ano',
};

export function RankingVendedores() {
  const [periodo, setPeriodo] = useState<PeriodoRanking>('mes');
  const [tipoFiltro, setTipoFiltro] = useState<TipoVendedor>('todos');
  
  const { isDiretor, isGerente, isSupervisor, isDesenvolvedor, isAdminMaster, isVendedorClt, isVendedorExterno } = usePermissions();
  
  const isGestor = isDiretor || isGerente || isSupervisor || isDesenvolvedor || isAdminMaster;
  
  const tipoEfetivo: TipoVendedor = isGestor 
    ? tipoFiltro 
    : (isVendedorClt ? 'interno' : isVendedorExterno ? 'externo' : 'todos');

  const { data, isLoading, error } = useRankingVendedores(periodo, tipoEfetivo);

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

  const maxVendas = data?.ranking?.[0]?.totalVendas || data?.ranking?.[0]?.cotacoesCriadas || 1;

  return (
    <div className="space-y-4">
      {/* KPI Cards no topo */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{isLoading ? '—' : (data?.total || 0)}</p>
              <p className="text-xs text-muted-foreground">Contratos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-green-600">{isLoading ? '—' : formatCurrency(data?.totalValor || 0)}</p>
              <p className="text-xs text-muted-foreground">Valor Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <BarChart3 className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">{isLoading ? '—' : (data?.totalCotacoes || 0)}</p>
              <p className="text-xs text-muted-foreground">Cotações</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{isLoading ? '—' : (data?.ranking?.length || 0)}</p>
              <p className="text-xs text-muted-foreground">Vendedores</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ranking */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <div>
                <CardTitle className="text-base">Ranking de Vendedores</CardTitle>
                <CardDescription className="text-xs">
                  Performance da equipe de vendas
                  {!isGestor && (
                    <span className="ml-1">
                      ({isVendedorClt ? 'Internos' : 'Externos'})
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isGestor && (
                <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as TipoVendedor)}>
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="interno">Internos</SelectItem>
                    <SelectItem value="externo">Externos</SelectItem>
                  </SelectContent>
                </Select>
              )}
              
              <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoRanking)}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
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
          </div>
        </CardHeader>

        <CardContent className="space-y-3 pt-0">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !data || data.ranking.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <Medal className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Nenhuma atividade registrada {PERIODO_LABELS[periodo]}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1 max-w-sm mx-auto">
                  O ranking será atualizado automaticamente conforme novos contratos e cotações forem registrados no sistema.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {data.ranking.map((vendedor) => {
                const metricaPrincipal = vendedor.totalVendas || vendedor.cotacoesCriadas;
                const percentual = (metricaPrincipal / maxVendas) * 100;
                
                return (
                  <div
                    key={vendedor.vendedorId}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                      vendedor.posicao <= 3 ? 'bg-muted/50' : 'bg-background hover:bg-muted/30'
                    )}
                  >
                    <div className="flex-shrink-0">{getMedalIcon(vendedor.posicao)}</div>

                    <Avatar className="h-9 w-9 flex-shrink-0">
                      <AvatarImage src={vendedor.avatarUrl || undefined} alt={vendedor.vendedorNome} />
                      <AvatarFallback className="text-xs">{getInitials(vendedor.vendedorNome)}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-semibold text-sm truncate">{vendedor.vendedorNome}</span>
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            'text-[10px] px-1.5 py-0 shrink-0',
                            vendedor.tipoVendedor === 'interno' 
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                              : 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                          )}
                        >
                          {vendedor.tipoVendedor === 'interno' ? 'INT' : 'EXT'}
                        </Badge>
                        {vendedor.totalVendas > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                            {vendedor.totalVendas} {vendedor.totalVendas === 1 ? 'contrato' : 'contratos'}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', getBarColor(vendedor.posicao))}
                            style={{ width: `${Math.min(percentual, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground w-8 text-right">
                          {percentual.toFixed(0)}%
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                        {vendedor.valorTotal > 0 && <span>{formatCurrency(vendedor.valorTotal)}</span>}
                        {vendedor.cotacoesCriadas > 0 && (
                          <span>{vendedor.cotacoesCriadas} cotações • {vendedor.taxaConversao.toFixed(0)}% conv.</span>
                        )}
                        {vendedor.cotacoesAceitas > 0 && (
                          <span className="text-green-600">✓ {vendedor.cotacoesAceitas} aceitas</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
