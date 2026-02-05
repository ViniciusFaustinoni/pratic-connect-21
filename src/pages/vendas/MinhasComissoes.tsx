import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DollarSign, TrendingUp, Clock, CheckCircle, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMinhasComissoes } from '@/hooks/useMinhasComissoes';
import { ComissaoCard } from '@/components/comissoes/ComissaoCard';
import { ComissaoResumoMensal } from '@/components/comissoes/ComissaoResumoMensal';

export default function MinhasComissoes() {
  const { comissoes, resumoMensal, ultimosPagamentos, totalAcumulado, isLoading } = useMinhasComissoes();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const currentMonth = format(new Date(), 'MMMM yyyy', { locale: ptBR });

  const comissoesPendentes = comissoes?.filter(c => c.status === 'pendente') || [];
  const comissoesAprovadas = comissoes?.filter(c => c.status === 'aprovada') || [];
  const comissoesPagas = comissoes?.filter(c => c.status === 'paga') || [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="h-6 w-6" />
          Minhas Comissões
        </h1>
        <p className="text-muted-foreground">
          Acompanhe suas comissões e pagamentos
        </p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Este Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(
                (resumoMensal?.totalPendente || 0) +
                (resumoMensal?.totalAprovada || 0) +
                (resumoMensal?.totalPago || 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground capitalize">{currentMonth}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(resumoMensal?.totalPendente || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {resumoMensal?.quantidadePendente || 0} comissões aguardando aprovação
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Aprovadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(resumoMensal?.totalAprovada || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {resumoMensal?.quantidadeAprovada || 0} aguardando pagamento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Recebido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalAcumulado?.total || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalAcumulado?.quantidade || 0} comissões pagas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs com comissões */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Comissões</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="todas">
            <TabsList>
              <TabsTrigger value="todas">
                Todas ({comissoes?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="pendentes">
                Pendentes ({comissoesPendentes.length})
              </TabsTrigger>
              <TabsTrigger value="aprovadas">
                Aprovadas ({comissoesAprovadas.length})
              </TabsTrigger>
              <TabsTrigger value="pagas">
                Pagas ({comissoesPagas.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="todas" className="mt-4">
              <ComissoesList comissoes={comissoes} isLoading={isLoading} />
            </TabsContent>
            <TabsContent value="pendentes" className="mt-4">
              <ComissoesList comissoes={comissoesPendentes} isLoading={isLoading} />
            </TabsContent>
            <TabsContent value="aprovadas" className="mt-4">
              <ComissoesList comissoes={comissoesAprovadas} isLoading={isLoading} />
            </TabsContent>
            <TabsContent value="pagas" className="mt-4">
              <ComissoesList comissoes={comissoesPagas} isLoading={isLoading} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Últimos Pagamentos */}
      {ultimosPagamentos && ultimosPagamentos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos Pagamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ultimosPagamentos.map((pagamento) => (
                <div
                  key={pagamento.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div>
                    <div className="font-medium">
                      {format(new Date(pagamento.ano_referencia, pagamento.mes_referencia - 1), 'MMMM yyyy', { locale: ptBR })}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {pagamento.quantidade_comissoes} comissões • Pago em {format(new Date(pagamento.data_pagamento), 'dd/MM/yyyy')}
                    </div>
                  </div>
                  <div className="text-lg font-semibold text-green-600">
                    {formatCurrency(pagamento.valor_total)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ComissoesList({ comissoes, isLoading }: { comissoes?: any[]; isLoading: boolean }) {
  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  if (!comissoes || comissoes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma comissão encontrada
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3 pr-4">
        {comissoes.map((comissao) => (
          <ComissaoCard
            key={comissao.id}
            comissao={comissao}
            showVendedor={false}
            showActions={false}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
