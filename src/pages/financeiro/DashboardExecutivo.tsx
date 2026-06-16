import { useState } from 'react';
import {
  TrendingUp, TrendingDown, Scale, Wallet, ShieldAlert, Clock, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useDashboardExecutivo } from '@/hooks/useDashboardExecutivo';

const fmt = (v: number) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export default function DashboardExecutivo() {
  const agora = new Date();
  const [mesRef, setMesRef] = useState(`${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`);
  const [ano, mes] = mesRef.split('-').map(Number);
  const { data, isLoading } = useDashboardExecutivo(ano, mes);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard Executivo</h1>
          <p className="text-muted-foreground">Indicadores-chave do mês</p>
        </div>
        <Input type="month" value={mesRef} onChange={(e) => setMesRef(e.target.value)} className="w-40" />
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi t="Receita" v={fmt(data?.receita ?? 0)} i={<TrendingUp className="h-5 w-5 text-green-600" />} l={isLoading} />
        <Kpi t={`Lucro (${pct(data?.margem ?? 0)})`} v={fmt(data?.lucro ?? 0)} i={<Scale className="h-5 w-5 text-amber-500" />} l={isLoading} cor={(data?.lucro ?? 0) >= 0 ? 'text-green-600' : 'text-destructive'} />
        <Kpi t={`Custo técnico do risco (${pct(data?.custoTecnicoPct ?? 0)})`} v={fmt(data?.custoTecnicoRisco ?? 0)} i={<ShieldAlert className="h-5 w-5 text-destructive" />} l={isLoading} sub="Assistência + Eventos + Monitoramento" />
        <Kpi t="Saldo em bancos" v={fmt(data?.saldoBancos ?? 0)} i={<Wallet className="h-5 w-5 text-blue-600" />} l={isLoading} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Kpi t="A pagar em aberto" v={fmt(data?.aPagarAberto ?? 0)} i={<TrendingDown className="h-5 w-5 text-destructive" />} l={isLoading} />
        <Kpi t="Contas vencidas" v={String(data?.vencidasQtd ?? 0)} i={<AlertTriangle className="h-5 w-5 text-amber-500" />} l={isLoading} />
        <Kpi t="Prazo médio de pagamento" v={`${(data?.prazoMedioPagamento ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} dias`} i={<Clock className="h-5 w-5 text-muted-foreground" />} l={isLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Top 10 fornecedores (pagos no mês)</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? <Sk /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Fornecedor</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(data?.topFornecedores ?? []).map((f) => (
                    <TableRow key={f.nome}><TableCell>{f.nome}</TableCell><TableCell className="text-right">{fmt(f.valor)}</TableCell></TableRow>
                  ))}
                  {(data?.topFornecedores.length ?? 0) === 0 && (
                    <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">Sem pagamentos no mês.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Maiores grupos de despesa</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? <Sk /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Grupo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">%</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(data?.topGrupos ?? []).map((g) => (
                    <TableRow key={g.codigo}>
                      <TableCell>{g.codigo} · {g.nome}</TableCell>
                      <TableCell className="text-right text-destructive">{fmt(g.valor)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{pct(g.pct)}</TableCell>
                    </TableRow>
                  ))}
                  {(data?.topGrupos.length ?? 0) === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Sem despesas classificadas.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ t, v, i, l, cor, sub }: { t: string; v: string; i: React.ReactNode; l?: boolean; cor?: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{t}</p>{i}
        </div>
        {l ? <Skeleton className="h-8 w-28 mt-2" /> : <p className={`text-2xl font-bold mt-2 ${cor ?? ''}`}>{v}</p>}
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Sk() {
  return <div className="p-4 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>;
}
