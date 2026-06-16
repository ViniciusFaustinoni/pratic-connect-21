import { useState } from 'react';
import { TrendingUp, TrendingDown, Scale, Wallet, Users, FileText, FileSpreadsheet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useRelatorioCustosReceitas } from '@/hooks/useRelatorioCustosReceitas';
import { exportarCustosReceitasPDF, exportarCustosReceitasXlsx } from '@/lib/financeiro/exportRelatorio';

const fmt = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export default function RelatorioCustosReceitas() {
  const agora = new Date();
  const [mesRef, setMesRef] = useState(
    `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`,
  );
  const [ano, mes] = mesRef.split('-').map(Number);
  const { data, isLoading } = useRelatorioCustosReceitas(ano, mes);

  const margem = data && data.receita > 0 ? (data.lucro / data.receita) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatório de Custos e Receitas</h1>
          <p className="text-muted-foreground">Receita, despesas por grupo, sócios e lucro do mês</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="month" value={mesRef} onChange={(e) => setMesRef(e.target.value)} className="w-40" />
          <Button variant="outline" disabled={!data} onClick={() => data && exportarCustosReceitasPDF(data, mesRef)}>
            <FileText className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" disabled={!data} onClick={() => data && exportarCustosReceitasXlsx(data, mesRef)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Kpi titulo="Receita total" valor={fmt(data?.receita ?? 0)} icon={<TrendingUp className="h-5 w-5 text-green-600" />} loading={isLoading} />
        <Kpi titulo="Despesas (sem sócios)" valor={fmt(data?.despesaSemSocios ?? 0)} icon={<TrendingDown className="h-5 w-5 text-destructive" />} loading={isLoading} />
        <Kpi titulo={`Lucro (${pct(margem)})`} valor={fmt(data?.lucro ?? 0)} icon={<Scale className="h-5 w-5 text-amber-500" />} loading={isLoading} cor={(data?.lucro ?? 0) >= 0 ? 'text-green-600' : 'text-destructive'} />
        <Kpi titulo="Caixa real (após sócios)" valor={fmt(data?.caixaReal ?? 0)} icon={<Wallet className="h-5 w-5 text-blue-600" />} loading={isLoading} cor={(data?.caixaReal ?? 0) >= 0 ? 'text-foreground' : 'text-destructive'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Receita por categoria */}
        <Card>
          <CardHeader><CardTitle className="text-base">Composição da receita</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? <SkeletonRows /> : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Categoria</TableHead><TableHead className="text-right">Valor</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.receitaPorCategoria ?? []).map((r) => (
                    <TableRow key={r.nome}>
                      <TableCell>{r.nome}</TableCell>
                      <TableCell className="text-right text-green-600">{fmt(r.valor)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold bg-muted/40">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{fmt(data?.receita ?? 0)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Despesas por grupo */}
        <Card>
          <CardHeader><CardTitle className="text-base">Despesas por grupo</CardTitle></CardHeader>
          <CardContent className="p-0">
            {isLoading ? <SkeletonRows /> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grupo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.gruposDespesa ?? []).map((g) => (
                    <TableRow key={g.codigo}>
                      <TableCell>{g.codigo !== '—' ? `${g.codigo} · ` : ''}{g.nome}</TableCell>
                      <TableCell className="text-right text-destructive">{fmt(g.valor)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{pct(g.pct)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold bg-muted/40">
                    <TableCell>Total despesas (sem sócios)</TableCell>
                    <TableCell className="text-right">{fmt(data?.despesaSemSocios ?? 0)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sócios (fora do custo) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Retiradas de sócios (não entram no custo total)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-16 w-full" /> : (data?.sociosItens.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sem despesas classificadas no grupo 2.05-Sócios neste mês.
            </p>
          ) : (
            <div className="space-y-1 text-sm">
              {data!.sociosItens.map((s) => (
                <div key={s.codigo} className="flex justify-between">
                  <span className="text-muted-foreground">{s.codigo} · {s.nome}</span>
                  <span>{fmt(s.valor)}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                <span>Total sócios</span><span>{fmt(data!.despesaSocios)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {(data?.naoClassificado ?? 0) > 0 && (
        <p className="text-xs text-muted-foreground">
          ⚠️ {fmt(data!.naoClassificado)} em despesas ainda não classificadas no plano de contas.
          Use o importador (mapeando a coluna “Conta”) para classificá-las nos grupos 2.xx.
        </p>
      )}
    </div>
  );
}

function Kpi({ titulo, valor, icon, loading, cor }: { titulo: string; valor: string; icon: React.ReactNode; loading?: boolean; cor?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{titulo}</p>{icon}
        </div>
        {loading ? <Skeleton className="h-8 w-32 mt-2" /> : <p className={`text-2xl font-bold mt-2 ${cor ?? ''}`}>{valor}</p>}
      </CardContent>
    </Card>
  );
}

function SkeletonRows() {
  return <div className="p-4 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>;
}
