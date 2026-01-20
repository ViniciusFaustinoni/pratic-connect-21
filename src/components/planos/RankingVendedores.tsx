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
import { Trophy, Users, Medal } from 'lucide-react';
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

export function RankingVendedores() {
  const [periodo, setPeriodo] = useState<PeriodoRanking>('mes');
  const [tipoFiltro, setTipoFiltro] = useState<TipoVendedor>('todos');
  
  const { isDiretor, isGerente, isSupervisor, isDesenvolvedor, isAdminMaster, isVendedorClt, isVendedorExterno } = usePermissions();
  
  // Gestores podem ver todos e filtrar, vendedores veem apenas seu tipo
  const isGestor = isDiretor || isGerente || isSupervisor || isDesenvolvedor || isAdminMaster;
  
  // Se é vendedor, definir o filtro automaticamente pelo seu tipo
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

  const maxVendas = data?.ranking?.[0]?.totalVendas || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 text-yellow-500" />
              <div>
                <CardTitle>Ranking de Vendedores</CardTitle>
                <CardDescription>
                  Performance da equipe de vendas
                  {!isGestor && (
                    <span className="ml-1">
                      ({isVendedorClt ? 'Vendedores Internos' : 'Vendedores Externos'})
                    </span>
                  )}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Filtro de tipo - só para gestores */}
              {isGestor && (
                <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as TipoVendedor)}>
                  <SelectTrigger className="w-[140px]">
                    <Users className="h-4 w-4 mr-2" />
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
                <SelectTrigger className="w-[160px]">
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
                Nenhuma venda encontrada no período selecionado.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.ranking.map((vendedor) => {
                const percentual = (vendedor.totalVendas / maxVendas) * 100;
                
                return (
                  <div
                    key={vendedor.vendedorId}
                    className={cn(
                      'flex items-center gap-4 p-4 rounded-lg border transition-colors',
                      vendedor.posicao <= 3 ? 'bg-muted/50' : 'bg-background hover:bg-muted/30'
                    )}
                  >
                    {/* Posição */}
                    <div className="flex-shrink-0">{getMedalIcon(vendedor.posicao)}</div>

                    {/* Avatar */}
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={vendedor.avatarUrl || undefined} alt={vendedor.vendedorNome} />
                      <AvatarFallback>{getInitials(vendedor.vendedorNome)}</AvatarFallback>
                    </Avatar>

                    {/* Informações */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold truncate">{vendedor.vendedorNome}</span>
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            'text-xs shrink-0',
                            vendedor.tipoVendedor === 'interno' 
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                              : 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                          )}
                        >
                          {vendedor.tipoVendedor === 'interno' ? 'Interno' : 'Externo'}
                        </Badge>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {vendedor.totalVendas} vendas
                        </Badge>
                      </div>

                      {/* Barra de progresso */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', getBarColor(vendedor.posicao))}
                            style={{ width: `${percentual}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-12 text-right">
                          {percentual.toFixed(0)}%
                        </span>
                      </div>

                      {/* Detalhes */}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span>Valor: {formatCurrency(vendedor.valorTotal)}</span>
                        <span>Ticket: {formatCurrency(vendedor.ticketMedio)}</span>
                        <span>Conversão: {vendedor.taxaConversao.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo */}
      {data && data.ranking.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{data.total}</p>
                <p className="text-xs text-muted-foreground">Total de Vendas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{formatCurrency(data.totalValor)}</p>
                <p className="text-xs text-muted-foreground">Valor Total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{data.ranking.length}</p>
                <p className="text-xs text-muted-foreground">Vendedores Ativos</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
