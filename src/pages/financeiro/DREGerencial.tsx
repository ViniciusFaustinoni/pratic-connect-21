import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useDREGerencial } from '@/hooks/useDREGerencial';

const fmt = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function DREGerencial() {
  const [num, setNum] = useState(6);
  const { data, isLoading } = useDREGerencial(num);

  const meses = data?.meses ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">DRE Gerencial</h1>
          <p className="text-muted-foreground">Resultado mês a mês (sócios fora do custo) com margem</p>
        </div>
        <Tabs value={String(num)} onValueChange={(v) => setNum(Number(v))}>
          <TabsList>
            <TabsTrigger value="3">3 meses</TabsTrigger>
            <TabsTrigger value="6">6 meses</TabsTrigger>
            <TabsTrigger value="12">12 meses</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Demonstrativo de resultado</CardTitle></CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Conta</TableHead>
                  {meses.map((m) => <TableHead key={m.key} className="text-right capitalize">{m.label}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Receita */}
                <TableRow className="font-semibold">
                  <TableCell className="text-green-700">RECEITA</TableCell>
                  {(data?.receita ?? []).map((v, i) => (
                    <TableCell key={i} className="text-right text-green-600">{fmt(v)}</TableCell>
                  ))}
                </TableRow>

                {/* Grupos de despesa */}
                {(data?.grupos ?? []).map((g) => (
                  <TableRow key={g.codigo}>
                    <TableCell className="pl-6 text-muted-foreground">
                      {g.codigo !== '—' ? `${g.codigo} · ` : ''}{g.nome}
                    </TableCell>
                    {g.valores.map((v, i) => (
                      <TableCell key={i} className="text-right text-destructive">{v ? `(${fmt(v)})` : '—'}</TableCell>
                    ))}
                  </TableRow>
                ))}

                {/* Total despesas */}
                <TableRow className="font-semibold border-t">
                  <TableCell>(−) DESPESAS</TableCell>
                  {(data?.despesaSemSocios ?? []).map((v, i) => (
                    <TableCell key={i} className="text-right text-destructive">({fmt(v)})</TableCell>
                  ))}
                </TableRow>

                {/* Lucro */}
                <TableRow className="font-bold bg-muted/40">
                  <TableCell>= LUCRO</TableCell>
                  {(data?.lucro ?? []).map((v, i) => (
                    <TableCell key={i} className={`text-right ${v >= 0 ? 'text-green-600' : 'text-destructive'}`}>{fmt(v)}</TableCell>
                  ))}
                </TableRow>

                {/* Margem */}
                <TableRow>
                  <TableCell className="text-muted-foreground">Margem %</TableCell>
                  {(data?.margem ?? []).map((v, i) => (
                    <TableCell key={i} className="text-right text-muted-foreground">
                      {v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                    </TableCell>
                  ))}
                </TableRow>

                {/* Sócios */}
                <TableRow>
                  <TableCell className="text-muted-foreground">(−) Sócios (fora do custo)</TableCell>
                  {(data?.socios ?? []).map((v, i) => (
                    <TableCell key={i} className="text-right text-muted-foreground">{v ? `(${fmt(v)})` : '—'}</TableCell>
                  ))}
                </TableRow>

                {/* Caixa real */}
                <TableRow className="font-semibold">
                  <TableCell>= CAIXA REAL (após sócios)</TableCell>
                  {(data?.caixaReal ?? []).map((v, i) => (
                    <TableCell key={i} className={`text-right ${v >= 0 ? 'text-foreground' : 'text-destructive'}`}>{fmt(v)}</TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
