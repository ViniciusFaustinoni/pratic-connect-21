import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const FAIXAS = [
  { label: '1-15 dias', min: 1, max: 15, cor: '#eab308' },
  { label: '16-30 dias', min: 16, max: 30, cor: '#f97316' },
  { label: '31-60 dias', min: 31, max: 60, cor: '#ef4444' },
  { label: '61-90 dias', min: 61, max: 90, cor: '#dc2626' },
  { label: '90+ dias', min: 91, max: 99999, cor: '#7f1d1d' },
];

export function InadimplenciaIdadeChart() {
  const hoje = format(new Date(), 'yyyy-MM-dd');

  const { data: vencidas, isLoading } = useQuery({
    queryKey: ['inadimplencia-idade'],
    queryFn: async () => {
      const { data } = await supabase
        .from('asaas_cobrancas')
        .select('data_vencimento, valor')
        .in('status', ['OVERDUE', 'vencido', 'PENDING', 'pendente'])
        .lt('data_vencimento', hoje);
      return data || [];
    }
  });

  const chartData = useMemo(() => {
    const hojeDate = new Date();
    const faixasData = FAIXAS.map(f => ({ ...f, valor: 0, qtd: 0 }));

    vencidas?.forEach(c => {
      if (!c.data_vencimento) return;
      const dias = differenceInDays(hojeDate, new Date(c.data_vencimento));
      const faixa = faixasData.find(f => dias >= f.min && dias <= f.max);
      if (faixa) {
        faixa.valor += Number(c.valor || 0);
        faixa.qtd += 1;
      }
    });

    return faixasData;
  }, [vencidas]);

  const totalInadimplencia = chartData.reduce((a, b) => a + b.valor, 0);
  const totalQtd = chartData.reduce((a, b) => a + b.qtd, 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Inadimplência por Idade</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-64 w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Inadimplência por Idade</CardTitle>
          <div className="text-sm text-muted-foreground">
            {totalQtd} cobranças · <span className="font-semibold text-red-600">{formatCurrency(totalInadimplencia)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={85} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
                    <p className="font-medium">{d.label}</p>
                    <p>{d.qtd} cobranças</p>
                    <p className="font-bold text-red-600">{formatCurrency(d.valor)}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="valor" radius={[0, 4, 4, 0]} maxBarSize={35}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.cor} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
