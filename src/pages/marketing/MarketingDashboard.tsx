import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Target, TrendingUp, Users, DollarSign, 
  BarChart3, ArrowUpRight, ArrowDownRight,
  Megaphone, Gift, Link2, Plus
} from 'lucide-react';
import { useMarketingStats, useCampanhas, useIndicacoes } from '@/hooks/useMarketing';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MarketingDashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading: loadingStats } = useMarketingStats();
  const { data: campanhas, isLoading: loadingCampanhas } = useCampanhas({ status: 'ativa' });
  const { data: indicacoes, isLoading: loadingIndicacoes } = useIndicacoes({ status: 'convertido' });

  const indicacoesPendentes = indicacoes?.filter(i => !i.recompensa_paga) || [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Marketing</h1>
          <p className="text-muted-foreground">
            Gerencie campanhas, canais e indicações
          </p>
        </div>
        <Button onClick={() => navigate('/marketing/campanhas')}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Leads do Mês</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.leadsMes || 0}</div>
                <p className="text-xs text-muted-foreground">
                  <span className="text-green-600 flex items-center gap-0.5">
                    <ArrowUpRight className="h-3 w-3" /> +12% vs mês anterior
                  </span>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">CPL Médio</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  R$ {(stats?.cplMedio || 0).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Custo por lead
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {(stats?.taxaConversao || 0).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats?.conversoesMes || 0} conversões
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Investimento</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  R$ {(stats?.investimentoMes || 0).toLocaleString('pt-BR')}
                </div>
                <p className="text-xs text-muted-foreground">
                  Este mês
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card 
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => navigate('/marketing/campanhas')}
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <Megaphone className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium">Campanhas</p>
              <p className="text-sm text-muted-foreground">
                {stats?.campanhasAtivas || 0} ativas
              </p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => navigate('/marketing/indicacoes')}
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-green-600">
              <Gift className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium">Indicações</p>
              <p className="text-sm text-muted-foreground">
                {stats?.indicacoesMes || 0} este mês
              </p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => navigate('/marketing/canais')}
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
              <Target className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium">Canais</p>
              <p className="text-sm text-muted-foreground">
                Gestão de origem
              </p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => navigate('/marketing/utms')}
        >
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
              <Link2 className="h-6 w-6" />
            </div>
            <div>
              <p className="font-medium">UTMs</p>
              <p className="text-sm text-muted-foreground">
                Gerador de links
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campanhas Ativas e Indicações Pendentes */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Campanhas Ativas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Campanhas Ativas
              <Button variant="ghost" size="sm" onClick={() => navigate('/marketing/campanhas')}>
                Ver todas
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCampanhas ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : campanhas?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma campanha ativa
              </p>
            ) : (
              <div className="space-y-3">
                {campanhas?.slice(0, 5).map(campanha => (
                  <div 
                    key={campanha.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/marketing/campanhas/${campanha.id}`)}
                  >
                    <div>
                      <p className="font-medium">{campanha.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {campanha.codigo} • {campanha.canal?.nome || 'Sem canal'}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Ativa
                      </Badge>
                      {campanha.meta_leads && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Meta: {campanha.meta_leads} leads
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Indicações Pendentes de Recompensa */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Recompensas Pendentes
              <Badge variant="secondary">{indicacoesPendentes.length}</Badge>
            </CardTitle>
            <CardDescription>
              Indicações convertidas aguardando pagamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingIndicacoes ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : indicacoesPendentes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma recompensa pendente
              </p>
            ) : (
              <div className="space-y-3">
                {indicacoesPendentes.slice(0, 5).map(indicacao => (
                  <div 
                    key={indicacao.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <p className="font-medium">{indicacao.indicador_nome}</p>
                      <p className="text-xs text-muted-foreground">
                        Indicou: {indicacao.indicado_nome}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-green-600">
                        R$ {(indicacao.valor_recompensa || 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {indicacao.data_conversao && format(new Date(indicacao.data_conversao), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
