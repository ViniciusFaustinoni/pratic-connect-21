import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line
} from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(value);

function classifyDias(dias: number) {
  if (dias <= 5) return '1-5d';
  if (dias <= 30) return '6-30d';
  if (dias <= 60) return '31-60d';
  if (dias <= 90) return '61-90d';
  return '90+d';
}

export function DashboardGraficos() {
  // Inadimplência por faixa — últimos 6 meses
  const { data: faixaData, isLoading: loadingFaixa } = useQuery({
    queryKey: ['grafico-faixas-6m'],
    queryFn: async () => {
      const hoje = new Date();
      const meses: { label: string; start: string; end: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(hoje, i);
        meses.push({
          label: format(d, 'MMM/yy', { locale: ptBR }),
          start: format(startOfMonth(d), 'yyyy-MM-dd'),
          end: format(endOfMonth(d), 'yyyy-MM-dd'),
        });
      }

      const { data: cobrancas } = await supabase
        .from('cobrancas')
        .select('valor_final, data_vencimento, status')
        .in('status', ['vencido', 'pago'])
        .gte('data_vencimento', meses[0].start)
        .lte('data_vencimento', meses[meses.length - 1].end);

      return meses.map(m => {
        const doMes = cobrancas?.filter(c => c.data_vencimento >= m.start && c.data_vencimento <= m.end && c.status === 'vencido') || [];
        const endDate = new Date(m.end);
        const result: Record<string, number> = { '1-5d': 0, '6-30d': 0, '31-60d': 0, '61-90d': 0, '90+d': 0 };
        doMes.forEach(c => {
          const dias = Math.floor((endDate.getTime() - new Date(c.data_vencimento).getTime()) / 86400000);
          const faixa = classifyDias(dias);
          result[faixa] += c.valor_final || 0;
        });
        return { mes: m.label, ...result };
      });
    },
    staleTime: 5 * 60 * 1000,
  });

  // Recuperação mensal — últimos 12 meses
  const { data: recuperacaoData, isLoading: loadingRecuperacao } = useQuery({
    queryKey: ['grafico-recuperacao-12m'],
    queryFn: async () => {
      const hoje = new Date();
      const meses: { label: string; start: string; end: string }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = subMonths(hoje, i);
        meses.push({
          label: format(d, 'MMM/yy', { locale: ptBR }),
          start: format(startOfMonth(d), 'yyyy-MM-dd'),
          end: format(endOfMonth(d), 'yyyy-MM-dd'),
        });
      }

      const { data: cobrancas } = await supabase
        .from('cobrancas')
        .select('valor_final, data_vencimento, data_pagamento, status')
        .gte('data_vencimento', meses[0].start);

      return meses.map(m => {
        const entrou = cobrancas?.filter(c =>
          c.data_vencimento >= m.start && c.data_vencimento <= m.end && (c.status === 'vencido' || (c.status === 'pago' && c.data_pagamento && c.data_pagamento > c.data_vencimento))
        ).reduce((acc, c) => acc + (c.valor_final || 0), 0) || 0;

        const recuperado = cobrancas?.filter(c =>
          c.data_pagamento && c.data_pagamento >= m.start && c.data_pagamento <= m.end && c.status === 'pago' && c.data_vencimento < c.data_pagamento
        ).reduce((acc, c) => acc + (c.valor_final || 0), 0) || 0;

        return { mes: m.label, inadimplencia: entrou, recuperado };
      });
    },
    staleTime: 5 * 60 * 1000,
  });

  // Funil da régua
  const { data: funilData, isLoading: loadingFunil } = useQuery({
    queryKey: ['grafico-funil-regua'],
    queryFn: async () => {
      const { count: whatsapp } = await supabase
        .from('cobranca_contatos')
        .select('*', { count: 'exact', head: true })
        .eq('tipo', 'whatsapp');

      const { count: ligacoes } = await supabase
        .from('cobranca_contatos')
        .select('*', { count: 'exact', head: true })
        .eq('tipo', 'ligacao')
        .eq('resultado', 'atendeu');

      const { count: acordos } = await supabase
        .from('acordos')
        .select('*', { count: 'exact', head: true });

      const { count: negativados } = await supabase
        .from('negativacoes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'negativado');

      return [
        { etapa: 'WhatsApp', valor: whatsapp || 0, fill: 'hsl(var(--chart-1))' },
        { etapa: 'Ligações', valor: ligacoes || 0, fill: 'hsl(var(--chart-2))' },
        { etapa: 'Acordos', valor: acordos || 0, fill: 'hsl(var(--chart-3))' },
        { etapa: 'Negativados', valor: negativados || 0, fill: 'hsl(var(--chart-4))' },
      ];
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Inadimplência por Faixa */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inadimplência por Faixa (6 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingFaixa ? <Skeleton className="h-[280px]" /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={faixaData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis tickFormatter={formatCurrency} className="text-xs" />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="1-5d" stackId="a" fill="hsl(210, 80%, 60%)" name="1-5 dias" />
                <Bar dataKey="6-30d" stackId="a" fill="hsl(45, 90%, 50%)" name="6-30 dias" />
                <Bar dataKey="31-60d" stackId="a" fill="hsl(30, 90%, 55%)" name="31-60 dias" />
                <Bar dataKey="61-90d" stackId="a" fill="hsl(0, 70%, 55%)" name="61-90 dias" />
                <Bar dataKey="90+d" stackId="a" fill="hsl(0, 0%, 25%)" name="90+ dias" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Recuperação Mensal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recuperação Mensal (12 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRecuperacao ? <Skeleton className="h-[280px]" /> : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={recuperacaoData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis tickFormatter={formatCurrency} className="text-xs" />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Line type="monotone" dataKey="inadimplencia" stroke="hsl(0, 70%, 55%)" name="Entrou inadimplência" strokeWidth={2} />
                <Line type="monotone" dataKey="recuperado" stroke="hsl(142, 70%, 45%)" name="Recuperado" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Funil da Régua */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Efetividade da Régua (Funil)</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingFunil ? <Skeleton className="h-[200px]" /> : (
            <div className="flex items-end gap-4 justify-center h-[200px]">
              {funilData?.map((item, i) => {
                const maxVal = Math.max(...(funilData?.map(d => d.valor) || [1]), 1);
                const height = Math.max(20, (item.valor / maxVal) * 160);
                return (
                  <div key={item.etapa} className="flex flex-col items-center gap-2">
                    <span className="text-lg font-bold">{item.valor}</span>
                    <div
                      className="rounded-t-md w-20 transition-all"
                      style={{ height, backgroundColor: item.fill }}
                    />
                    <span className="text-xs text-muted-foreground text-center">{item.etapa}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
