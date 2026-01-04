import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, Calendar, Target, DollarSign, Users,
  TrendingUp, MousePointer, Eye, Percent
} from 'lucide-react';
import { useCampanha, useCampanhaMetricas } from '@/hooks/useMarketing';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const statusConfig: Record<string, { label: string; className: string }> = {
  rascunho: { label: 'Rascunho', className: 'bg-gray-100 text-gray-800' },
  agendada: { label: 'Agendada', className: 'bg-blue-100 text-blue-800' },
  ativa: { label: 'Ativa', className: 'bg-green-100 text-green-800' },
  pausada: { label: 'Pausada', className: 'bg-yellow-100 text-yellow-800' },
  finalizada: { label: 'Finalizada', className: 'bg-purple-100 text-purple-800' },
  cancelada: { label: 'Cancelada', className: 'bg-red-100 text-red-800' },
};

export default function CampanhaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: campanha, isLoading } = useCampanha(id!);
  const { data: metricas, isLoading: loadingMetricas } = useCampanhaMetricas(id!);

  // Calcular totais
  const totais = metricas?.reduce((acc, m) => ({
    valor_gasto: acc.valor_gasto + (m.valor_gasto || 0),
    impressoes: acc.impressoes + (m.impressoes || 0),
    cliques: acc.cliques + (m.cliques || 0),
    leads: acc.leads + (m.leads || 0),
    conversoes: acc.conversoes + (m.conversoes || 0),
  }), { valor_gasto: 0, impressoes: 0, cliques: 0, leads: 0, conversoes: 0 });

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!campanha) {
    return (
      <div className="p-6">
        <p>Campanha não encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/marketing/campanhas')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{campanha.nome}</h1>
            <Badge className={statusConfig[campanha.status]?.className}>
              {statusConfig[campanha.status]?.label}
            </Badge>
          </div>
          <p className="text-muted-foreground">{campanha.codigo}</p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Período</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {format(new Date(campanha.data_inicio), 'dd/MM/yyyy', { locale: ptBR })}
              {campanha.data_fim && ` - ${format(new Date(campanha.data_fim), 'dd/MM/yyyy', { locale: ptBR })}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Canal</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{campanha.canal?.nome || 'Não definido'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Orçamento</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">
              R$ {(campanha.orcamento_total || 0).toLocaleString('pt-BR')}
            </p>
            <p className="text-xs text-muted-foreground">
              Gasto: R$ {(campanha.valor_gasto || 0).toLocaleString('pt-BR')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Meta de Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold">{campanha.meta_leads || 0}</p>
            <p className="text-xs text-muted-foreground">
              Conquistados: {totais?.leads || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* KPIs Acumulados */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6 text-center">
            <Eye className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-2xl font-bold">{(totais?.impressoes || 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Impressões</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <MousePointer className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-2xl font-bold">{(totais?.cliques || 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Cliques</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-2xl font-bold">{totais?.leads || 0}</p>
            <p className="text-xs text-muted-foreground">Leads</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <TrendingUp className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-2xl font-bold">{totais?.conversoes || 0}</p>
            <p className="text-xs text-muted-foreground">Conversões</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Percent className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-2xl font-bold">
              {totais?.leads ? ((totais.conversoes / totais.leads) * 100).toFixed(1) : 0}%
            </p>
            <p className="text-xs text-muted-foreground">Taxa Conversão</p>
          </CardContent>
        </Card>
      </div>

      {/* Métricas Diárias */}
      <Card>
        <CardHeader>
          <CardTitle>Métricas Diárias</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingMetricas ? (
            <Skeleton className="h-64 w-full" />
          ) : metricas?.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhuma métrica registrada ainda
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Gasto</TableHead>
                  <TableHead className="text-right">Impressões</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">CPL</TableHead>
                  <TableHead className="text-right">Conversões</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metricas?.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>
                      {format(new Date(m.data), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      R$ {(m.valor_gasto || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(m.impressoes || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">{m.cliques || 0}</TableCell>
                    <TableCell className="text-right">{(m.ctr || 0).toFixed(2)}%</TableCell>
                    <TableCell className="text-right">{m.leads || 0}</TableCell>
                    <TableCell className="text-right">
                      R$ {(m.cpl || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">{m.conversoes || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* UTMs e Observações */}
      {(campanha.utm_source || campanha.observacoes) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {campanha.utm_source && (
            <Card>
              <CardHeader>
                <CardTitle>Parâmetros UTM</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Source</span>
                  <code className="text-sm">{campanha.utm_source}</code>
                </div>
                {campanha.utm_medium && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Medium</span>
                    <code className="text-sm">{campanha.utm_medium}</code>
                  </div>
                )}
                {campanha.utm_campaign && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Campaign</span>
                    <code className="text-sm">{campanha.utm_campaign}</code>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {campanha.observacoes && (
            <Card>
              <CardHeader>
                <CardTitle>Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {campanha.observacoes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
