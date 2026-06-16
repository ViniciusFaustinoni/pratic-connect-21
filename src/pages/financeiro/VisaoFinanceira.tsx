import { useState } from 'react';
import { TrendingUp, TrendingDown, Scale, Building2, Layers } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useVisaoFinanceira } from '@/hooks/useVisaoFinanceira';
import { SOLICITACAO_CATEGORIAS } from '@/hooks/useSolicitacoesFinanceiras';

const fmt = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtCompact = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const catLabel = (v: string) =>
  SOLICITACAO_CATEGORIAS.find((c) => c.value === v)?.label ?? v;

export default function VisaoFinanceira() {
  const agora = new Date();
  const [mesRef, setMesRef] = useState(
    `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`,
  );
  const [ano, mes] = mesRef.split('-').map(Number);
  const { data, isLoading } = useVisaoFinanceira(ano, mes);

  const chartCategorias = (data?.porCategoria ?? []).slice(0, 8).map((c) => ({
    nome: catLabel(c.categoria),
    valor: Math.round(c.total),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visão Financeira</h1>
          <p className="text-muted-foreground">
            Duas fotografias: consolidada (uma empresa só) e real (por empresa)
          </p>
        </div>
        <Input
          type="month"
          value={mesRef}
          onChange={(e) => setMesRef(e.target.value)}
          className="w-44"
        />
      </div>

      {/* KPIs gerais */}
      <div className="grid gap-4 md:grid-cols-3">
        <Kpi titulo="Receita (recebida)" valor={fmt(data?.receita ?? 0)}
          icon={<TrendingUp className="h-5 w-5 text-green-600" />} loading={isLoading} />
        <Kpi titulo="Despesas (pagas)" valor={fmt(data?.despesaTotal ?? 0)}
          icon={<TrendingDown className="h-5 w-5 text-destructive" />} loading={isLoading} />
        <Kpi titulo="Resultado" valor={fmt(data?.resultado ?? 0)}
          icon={<Scale className="h-5 w-5 text-amber-500" />} loading={isLoading}
          destaque={(data?.resultado ?? 0) >= 0 ? 'pos' : 'neg'} />
      </div>

      <Tabs defaultValue="consolidada">
        <TabsList>
          <TabsTrigger value="consolidada"><Layers className="mr-2 h-4 w-4" /> Consolidada (por setor)</TabsTrigger>
          <TabsTrigger value="empresa"><Building2 className="mr-2 h-4 w-4" /> Por empresa (real)</TabsTrigger>
        </TabsList>

        {/* ===== Consolidada ===== */}
        <TabsContent value="consolidada" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Despesas por categoria</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : chartCategorias.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">Sem despesas pagas no período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartCategorias} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis type="number" tickFormatter={fmtCompact} fontSize={12} />
                    <YAxis type="category" dataKey="nome" width={130} fontSize={12} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="valor" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Por empresa ===== */}
        <TabsContent value="empresa" className="space-y-4">
          <div className="rounded-md border border-amber-300/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-2 text-sm text-amber-800 dark:text-amber-300">
            💡 A receita das LTDAs é o <strong>repasse sugerido pelo % de rateio</strong> configurado.
            Quando os repasses reais forem registrados (próxima fase), a DRE usará os valores efetivos.
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">DRE por empresa</CardTitle></CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="text-right">Receita / Repasse</TableHead>
                      <TableHead className="text-right">Repasses às LTDAs</TableHead>
                      <TableHead className="text-right">Despesas</TableHead>
                      <TableHead className="text-right">Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.porEmpresa ?? []).map((e) => (
                      <TableRow key={e.id} className={e.tipo === 'associacao' ? 'bg-muted/40 font-medium' : ''}>
                        <TableCell className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {e.nome}
                        </TableCell>
                        <TableCell className="text-right text-green-600">{fmt(e.receita)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {e.repassesSaida > 0 ? fmt(e.repassesSaida) : '—'}
                        </TableCell>
                        <TableCell className="text-right text-destructive">{fmt(e.despesas)}</TableCell>
                        <TableCell className={`text-right font-semibold ${e.resultado >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                          {fmt(e.resultado)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({
  titulo, valor, icon, loading, destaque,
}: {
  titulo: string; valor: string; icon: React.ReactNode; loading?: boolean; destaque?: 'pos' | 'neg';
}) {
  const cor = destaque === 'pos' ? 'text-green-600' : destaque === 'neg' ? 'text-destructive' : '';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{titulo}</p>
          {icon}
        </div>
        {loading ? <Skeleton className="h-8 w-32 mt-2" /> : <p className={`text-2xl font-bold mt-2 ${cor}`}>{valor}</p>}
      </CardContent>
    </Card>
  );
}
