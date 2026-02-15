import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const CORES_RECEITA = ['#22c55e', '#16a34a', '#15803d', '#166534', '#4ade80', '#86efac', '#a3e635'];
const CORES_DESPESA = ['#ef4444', '#dc2626', '#b91c1c', '#f97316', '#f59e0b', '#eab308', '#e879f9'];

export function ComposicaoReceitaDespesaChart() {
  const inicioMes = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const fimMes = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  const { data: cobrancas, isLoading: l1 } = useQuery({
    queryKey: ['composicao-receita-mes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('asaas_cobrancas')
        .select('tipo, pagamento_valor')
        .in('status', ['RECEIVED', 'CONFIRMED', 'pago'])
        .gte('pagamento_data', inicioMes)
        .lte('pagamento_data', fimMes);
      return data || [];
    }
  });

  const { data: despesas, isLoading: l2 } = useQuery({
    queryKey: ['composicao-despesa-mes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('contas_pagar')
        .select('categoria, valor_pago')
        .eq('status', 'pago')
        .gte('data_pagamento', inicioMes)
        .lte('data_pagamento', fimMes);
      return data || [];
    }
  });

  const receitaData = useMemo(() => {
    const map: Record<string, number> = {};
    cobrancas?.forEach(c => {
      const tipo = c.tipo || 'outros';
      map[tipo] = (map[tipo] || 0) + Number(c.pagamento_valor || 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [cobrancas]);

  const despesaData = useMemo(() => {
    const map: Record<string, number> = {};
    despesas?.forEach(d => {
      const cat = d.categoria || 'outros';
      map[cat] = (map[cat] || 0) + Number(d.valor_pago || 0);
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [despesas]);

  const totalReceita = receitaData.reduce((a, b) => a + b.value, 0);
  const totalDespesa = despesaData.reduce((a, b) => a + b.value, 0);

  if (l1 || l2) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card><CardHeader><CardTitle>Composição de Receitas</CardTitle></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
        <Card><CardHeader><CardTitle>Composição de Despesas</CardTitle></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    );
  }

  const renderDonut = (data: { name: string; value: number }[], cores: string[], total: number, titulo: string) => (
    <Card>
      <CardHeader><CardTitle className="text-base">{titulo}</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Sem dados no mês</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={cores[i % cores.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-sm font-bold">
                {formatCurrency(total)}
              </text>
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {renderDonut(receitaData, CORES_RECEITA, totalReceita, 'Composição de Receitas')}
      {renderDonut(despesaData, CORES_DESPESA, totalDespesa, 'Composição de Despesas')}
    </div>
  );
}
