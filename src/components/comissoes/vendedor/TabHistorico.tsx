import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { History, TrendingUp } from 'lucide-react';
import type { MeuHistoricoMensal } from '@/hooks/useMinhasComissoesExtended';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TabHistoricoProps {
  historico: MeuHistoricoMensal[];
  isLoading: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatCurrencyShort = (value: number) => {
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}k`;
  }
  return formatCurrency(value);
};

const statusBadge: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  paga: { label: 'Paga', variant: 'default' },
  aprovada: { label: 'Aprovada', variant: 'secondary' },
  pendente: { label: 'Pendente', variant: 'outline' },
};

export function TabHistorico({
  historico,
  isLoading,
}: TabHistoricoProps) {
  // Preparar dados para o gráfico (invertido para cronológico)
  const chartData = [...historico].reverse().map((h) => ({
    mes: format(new Date(h.ano, h.mes - 1), 'MMM/yy', { locale: ptBR }),
    total: h.total_geral,
    vendas: h.vendas_confirmadas,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-semibold mb-2">{label}</p>
          {payload.map((entry: any) => (
            <div key={entry.dataKey} className="flex justify-between gap-4 text-sm">
              <span style={{ color: entry.color }}>
                {entry.dataKey === 'total' ? 'Total:' : 'Vendas:'}
              </span>
              <span className="font-medium">
                {entry.dataKey === 'total' ? formatCurrency(entry.value) : entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (historico.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <History className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold mb-2">Sem Histórico</h3>
          <p className="text-muted-foreground">
            Você ainda não tem comissões registradas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Gráfico de evolução */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Evolução dos Últimos {historico.length} Meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="mes" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  yAxisId="left"
                  tickFormatter={formatCurrencyShort}
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="total"
                  name="Total Comissões"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="vendas"
                  name="Vendas"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Detalhamento Mensal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês/Ano</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right text-blue-600">Adesão</TableHead>
                  <TableHead className="text-right text-green-600">Recorr.</TableHead>
                  <TableHead className="text-right text-purple-600">Prod.</TableHead>
                  <TableHead className="text-right text-orange-600">Rank.</TableHead>
                  <TableHead className="text-right text-cyan-600">Cresc.</TableHead>
                  <TableHead className="text-right font-bold">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historico.map((h) => {
                  const mesNome = format(new Date(h.ano, h.mes - 1), 'MMM/yy', { locale: ptBR });
                  const status = statusBadge[h.status] || statusBadge.pendente;
                  
                  return (
                    <TableRow key={`${h.ano}-${h.mes}`}>
                      <TableCell className="font-medium capitalize">{mesNome}</TableCell>
                      <TableCell className="text-right">{h.vendas_confirmadas}</TableCell>
                      <TableCell className="text-right text-blue-600">
                        {h.total_adesao > 0 ? formatCurrencyShort(h.total_adesao) : '-'}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {h.total_recorrente > 0 ? formatCurrencyShort(h.total_recorrente) : '-'}
                      </TableCell>
                      <TableCell className="text-right text-purple-600">
                        {h.total_producao > 0 ? formatCurrencyShort(h.total_producao) : '-'}
                      </TableCell>
                      <TableCell className="text-right text-orange-600">
                        {h.total_ranking > 0 ? formatCurrencyShort(h.total_ranking) : '-'}
                      </TableCell>
                      <TableCell className="text-right text-cyan-600">
                        {h.total_crescimento > 0 ? formatCurrencyShort(h.total_crescimento) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {formatCurrencyShort(h.total_geral)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
