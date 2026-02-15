import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subMonths, format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatCurrencyCompact = (value: number) => {
  if (Math.abs(value) >= 1000) return `R$ ${(value / 1000).toFixed(0)}k`;
  return `R$ ${value.toFixed(0)}`;
};

export function ReceitaDespesa12MesesChart() {
  const hoje = new Date();
  const inicio12m = format(startOfMonth(subMonths(hoje, 11)), 'yyyy-MM-dd');
  const fimMes = format(endOfMonth(hoje), 'yyyy-MM-dd');

  const { data: receitas, isLoading: l1 } = useQuery({
    queryKey: ['receita-12m'],
    queryFn: async () => {
      const { data } = await supabase
        .from('asaas_cobrancas')
        .select('pagamento_data, pagamento_valor')
        .in('status', ['RECEIVED', 'CONFIRMED', 'pago'])
        .gte('pagamento_data', inicio12m)
        .lte('pagamento_data', fimMes);
      return data || [];
    }
  });

  const { data: despesas, isLoading: l2 } = useQuery({
    queryKey: ['despesa-12m'],
    queryFn: async () => {
      const { data } = await supabase
        .from('contas_pagar')
        .select('data_pagamento, valor_pago')
        .eq('status', 'pago')
        .gte('data_pagamento', inicio12m)
        .lte('data_pagamento', fimMes);
      return data || [];
    }
  });

  const chartData = useMemo(() => {
    const meses: Record<string, { receita: number; despesa: number; label: string }> = {};
    for (let i = 11; i >= 0; i--) {
      const m = subMonths(hoje, i);
      const key = format(m, 'yyyy-MM');
      meses[key] = { receita: 0, despesa: 0, label: format(m, 'MMM/yy', { locale: ptBR }) };
    }

    receitas?.forEach(r => {
      if (r.pagamento_data) {
        const key = r.pagamento_data.substring(0, 7);
        if (meses[key]) meses[key].receita += Number(r.pagamento_valor || 0);
      }
    });

    despesas?.forEach(d => {
      if (d.data_pagamento) {
        const key = d.data_pagamento.substring(0, 7);
        if (meses[key]) meses[key].despesa += Number(d.valor_pago || 0);
      }
    });

    return Object.values(meses).map(m => ({
      mes: m.label,
      Receita: m.receita,
      Despesa: m.despesa,
      Saldo: m.receita - m.despesa,
    }));
  }, [receitas, despesas]);

  if (l1 || l2) {
    return (
      <Card>
        <CardHeader><CardTitle>Receita vs Despesa (12 meses)</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-72 w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Receita vs Despesa (12 meses)</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={formatCurrencyCompact} tickLine={false} axisLine={false} width={65} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                    <p className="font-medium mb-1">{d.mes}</p>
                    <p className="text-green-600">Receita: {formatCurrency(d.Receita)}</p>
                    <p className="text-red-600">Despesa: {formatCurrency(d.Despesa)}</p>
                    <p className={`font-medium ${d.Saldo >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      Saldo: {formatCurrency(d.Saldo)}
                    </p>
                  </div>
                );
              }}
            />
            <Legend />
            <Bar dataKey="Receita" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} maxBarSize={30} />
            <Bar dataKey="Despesa" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} maxBarSize={30} />
            <Line type="monotone" dataKey="Saldo" stroke="hsl(220, 70%, 50%)" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
