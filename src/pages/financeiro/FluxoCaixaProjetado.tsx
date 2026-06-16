import { useState } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, LineChart as LineChartIcon, AlertTriangle,
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFluxoCaixa } from '@/hooks/useFluxoCaixa';

const fmt = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtCompact = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

export default function FluxoCaixaProjetado() {
  const [horizonte, setHorizonte] = useState(6);
  const { data, isLoading } = useFluxoCaixa(horizonte);

  const chartData = (data?.buckets ?? []).map((b) => ({
    nome: b.label,
    Entradas: Math.round(b.entradas),
    Saídas: Math.round(b.saidas),
    Saldo: Math.round(b.saldoAcumulado),
  }));

  const saldoNegativo = (data?.buckets ?? []).some((b) => b.saldoAcumulado < 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fluxo de Caixa Projetado</h1>
          <p className="text-muted-foreground">
            A receber × a pagar em aberto, partindo do saldo bancário atual
          </p>
        </div>
        <Tabs value={String(horizonte)} onValueChange={(v) => setHorizonte(Number(v))}>
          <TabsList>
            <TabsTrigger value="3">3 meses</TabsTrigger>
            <TabsTrigger value="6">6 meses</TabsTrigger>
            <TabsTrigger value="12">12 meses</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi titulo="Saldo atual (bancos)" valor={fmt(data?.saldoAtual ?? 0)}
          icon={<Wallet className="h-5 w-5 text-blue-500" />} loading={isLoading} />
        <Kpi titulo="A receber (aberto)" valor={fmt(data?.totalAReceber ?? 0)}
          icon={<TrendingUp className="h-5 w-5 text-green-600" />} loading={isLoading} />
        <Kpi titulo="A pagar (aberto)" valor={fmt(data?.totalAPagar ?? 0)}
          icon={<TrendingDown className="h-5 w-5 text-destructive" />} loading={isLoading} />
        <Kpi titulo={`Saldo projetado (${horizonte}m)`} valor={fmt(data?.saldoProjetado ?? 0)}
          icon={<LineChartIcon className="h-5 w-5 text-amber-500" />} loading={isLoading}
          alerta={(data?.saldoProjetado ?? 0) < 0} />
      </div>

      {saldoNegativo && !isLoading && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Atenção: o saldo projetado fica <strong>negativo</strong> em algum período do horizonte.
        </div>
      )}

      {/* Gráfico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Projeção por período</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="nome" fontSize={12} />
                <YAxis tickFormatter={fmtCompact} fontSize={12} width={56} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="Entradas" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Saídas" fill="#dc2626" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="Saldo" stroke="#d97706" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhamento</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Entradas</TableHead>
                  <TableHead className="text-right">Saídas</TableHead>
                  <TableHead className="text-right">Resultado</TableHead>
                  <TableHead className="text-right">Saldo acumulado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.buckets ?? []).map((b) => (
                  <TableRow key={b.key} className={b.vencidas ? 'bg-muted/40' : ''}>
                    <TableCell className="font-medium capitalize">
                      {b.vencidas ? '⚠️ Vencidas' : b.label}
                    </TableCell>
                    <TableCell className="text-right text-green-600">{fmt(b.entradas)}</TableCell>
                    <TableCell className="text-right text-destructive">{fmt(b.saidas)}</TableCell>
                    <TableCell className={`text-right ${b.resultado >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                      {fmt(b.resultado)}
                    </TableCell>
                    <TableCell className={`text-right font-semibold ${b.saldoAcumulado >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                      {fmt(b.saldoAcumulado)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  titulo, valor, icon, loading, alerta,
}: { titulo: string; valor: string; icon: React.ReactNode; loading?: boolean; alerta?: boolean }) {
  return (
    <Card className={alerta ? 'border-destructive/50' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{titulo}</p>
          {icon}
        </div>
        {loading ? (
          <Skeleton className="h-8 w-32 mt-2" />
        ) : (
          <p className={`text-2xl font-bold mt-2 ${alerta ? 'text-destructive' : ''}`}>{valor}</p>
        )}
      </CardContent>
    </Card>
  );
}
