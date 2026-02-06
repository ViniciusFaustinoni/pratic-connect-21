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
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { AlertTriangle, FileWarning } from 'lucide-react';
import type { MinhaDeducao } from '@/hooks/useMinhasComissoesExtended';
import { TIPO_DEDUCAO_LABELS } from '@/types/comissoes';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TabDeducoesProps {
  deducoes: MinhaDeducao[];
  totalDeducoes: number;
  isLoading: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const TIPO_CORES: Record<string, string> = {
  repasse_volante: '#6b7280', // gray
  taxa_cartao: '#3b82f6', // blue
  pendencia_associado: '#f97316', // orange
  cancelamento: '#ef4444', // red
  inadimplencia_2_boletos: '#ea580c', // orange-600
  fraude: '#991b1b', // red-800
};

const TIPO_BADGES: Record<string, string> = {
  repasse_volante: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  taxa_cartao: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  pendencia_associado: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  cancelamento: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  inadimplencia_2_boletos: 'bg-orange-200 text-orange-900 dark:bg-orange-800 dark:text-orange-200',
  fraude: 'bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-200',
};

export function TabDeducoes({
  deducoes,
  totalDeducoes,
  isLoading,
}: TabDeducoesProps) {
  // Agrupar por tipo para o gráfico
  const deducoesPorTipo = deducoes.reduce((acc, d) => {
    if (!acc[d.tipo]) {
      acc[d.tipo] = 0;
    }
    acc[d.tipo] += d.valor;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(deducoesPorTipo).map(([tipo, valor]) => ({
    name: TIPO_DEDUCAO_LABELS[tipo] || tipo,
    value: valor,
    color: TIPO_CORES[tipo] || '#6b7280',
  }));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (deducoes.length === 0) {
    return (
      <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
        <CardContent className="py-12 text-center">
          <FileWarning className="h-16 w-16 mx-auto mb-4 text-green-600/50" />
          <h3 className="text-lg font-semibold text-green-700 mb-2">
            Nenhuma Dedução! 🎉
          </h3>
          <p className="text-muted-foreground">
            Você não tem deduções registradas neste mês. Continue assim!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo com gráfico */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Total de deduções */}
        <Card className="bg-red-50/50 dark:bg-red-950/10 border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              Total de Deduções do Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-700 dark:text-red-400">
              -{formatCurrency(totalDeducoes)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {deducoes.length} {deducoes.length === 1 ? 'dedução' : 'deduções'} registradas
            </p>
          </CardContent>
        </Card>

        {/* Gráfico pizza */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Distribuição por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={60}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '12px' }}
                    formatter={(value) => <span className="text-xs">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de deduções */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhamento das Deduções</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Associado</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deducoes.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <Badge className={TIPO_BADGES[d.tipo] || TIPO_BADGES.repasse_volante}>
                        {TIPO_DEDUCAO_LABELS[d.tipo] || d.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {d.descricao || '-'}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {d.associado_nome || '-'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {d.contrato_numero || (d.contrato_id ? d.contrato_id.slice(0, 8) : '-')}
                    </TableCell>
                    <TableCell className="text-right font-medium text-red-600">
                      -{formatCurrency(d.valor)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(d.aplicada_em), 'dd/MM', { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Legenda dos tipos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tipos de Dedução</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            {Object.entries(TIPO_DEDUCAO_LABELS).map(([tipo, label]) => (
              <div key={tipo} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: TIPO_CORES[tipo] || '#6b7280' }}
                />
                <span className="text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
