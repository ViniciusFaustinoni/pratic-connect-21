import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function ResumoMesTable() {
  const inicioMes = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const fimMes = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  const { data: cobrancas, isLoading: l1 } = useQuery({
    queryKey: ['resumo-mes-cobrancas'],
    queryFn: async () => {
      const { data } = await supabase
        .from('asaas_cobrancas')
        .select('tipo, valor, pagamento_valor, status')
        .gte('data_vencimento', inicioMes)
        .lte('data_vencimento', fimMes);
      return data || [];
    }
  });

  const { data: despesas, isLoading: l2 } = useQuery({
    queryKey: ['resumo-mes-despesas'],
    queryFn: async () => {
      const { data } = await supabase
        .from('contas_pagar')
        .select('categoria, valor, valor_pago, status')
        .gte('data_vencimento', inicioMes)
        .lte('data_vencimento', fimMes);
      return data || [];
    }
  });

  const linhas = useMemo(() => {
    const isPago = (s: string) => ['RECEIVED', 'CONFIRMED', 'pago'].includes(s);
    const rows: { item: string; previsto: number; realizado: number; bold?: boolean; separator?: boolean }[] = [];

    // Receita total
    const recPrevisto = cobrancas?.reduce((a, c) => a + Number(c.valor || 0), 0) || 0;
    const recRealizado = cobrancas?.filter(c => isPago(c.status)).reduce((a, c) => a + Number(c.pagamento_valor || 0), 0) || 0;
    rows.push({ item: 'Receita Total', previsto: recPrevisto, realizado: recRealizado, bold: true });

    // Por tipo de receita
    const tiposReceita: Record<string, { previsto: number; realizado: number }> = {};
    cobrancas?.forEach(c => {
      const tipo = c.tipo || 'outros';
      if (!tiposReceita[tipo]) tiposReceita[tipo] = { previsto: 0, realizado: 0 };
      tiposReceita[tipo].previsto += Number(c.valor || 0);
      if (isPago(c.status)) tiposReceita[tipo].realizado += Number(c.pagamento_valor || 0);
    });
    Object.entries(tiposReceita).sort((a, b) => b[1].previsto - a[1].previsto).forEach(([tipo, v]) => {
      rows.push({ item: `  ${tipo}`, previsto: v.previsto, realizado: v.realizado });
    });

    // Despesa total
    const despPrevisto = despesas?.reduce((a, d) => a + Number(d.valor || 0), 0) || 0;
    const despRealizado = despesas?.filter(d => d.status === 'pago').reduce((a, d) => a + Number(d.valor_pago || 0), 0) || 0;
    rows.push({ item: 'Despesas Total', previsto: despPrevisto, realizado: despRealizado, bold: true, separator: true });

    // Por categoria de despesa
    const catsDespesa: Record<string, { previsto: number; realizado: number }> = {};
    despesas?.forEach(d => {
      const cat = d.categoria || 'outros';
      if (!catsDespesa[cat]) catsDespesa[cat] = { previsto: 0, realizado: 0 };
      catsDespesa[cat].previsto += Number(d.valor || 0);
      if (d.status === 'pago') catsDespesa[cat].realizado += Number(d.valor_pago || 0);
    });
    Object.entries(catsDespesa).sort((a, b) => b[1].previsto - a[1].previsto).forEach(([cat, v]) => {
      rows.push({ item: `  ${cat}`, previsto: v.previsto, realizado: v.realizado });
    });

    // Saldo
    rows.push({
      item: 'Saldo',
      previsto: recPrevisto - despPrevisto,
      realizado: recRealizado - despRealizado,
      bold: true,
      separator: true,
    });

    return rows;
  }, [cobrancas, despesas]);

  const mesLabel = format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });

  if (l1 || l2) {
    return (
      <Card>
        <CardHeader><CardTitle>Resumo do Mês</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-48 w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="capitalize">Resumo – {mesLabel}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Previsto</TableHead>
              <TableHead className="text-right">Realizado</TableHead>
              <TableHead className="text-right">Desvio (%)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l, i) => {
              const desvio = l.previsto !== 0 ? ((l.realizado - l.previsto) / Math.abs(l.previsto)) * 100 : 0;
              const isPositiveDesvio = desvio >= 0;
              const isSaldo = l.item === 'Saldo';

              return (
                <TableRow
                  key={i}
                  className={`${l.separator ? 'border-t-2' : ''} ${isSaldo ? 'bg-muted/50' : ''}`}
                >
                  <TableCell className={l.bold ? 'font-bold' : 'text-muted-foreground'}>
                    {l.item}
                  </TableCell>
                  <TableCell className={`text-right ${l.bold ? 'font-bold' : ''}`}>
                    {formatCurrency(l.previsto)}
                  </TableCell>
                  <TableCell className={`text-right ${l.bold ? 'font-bold' : ''}`}>
                    {formatCurrency(l.realizado)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${isPositiveDesvio ? 'text-green-600' : 'text-red-600'}`}>
                    {desvio > 0 ? '+' : ''}{desvio.toFixed(1)}%
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
