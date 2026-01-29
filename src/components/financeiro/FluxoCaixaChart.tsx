import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, format, eachDayOfInterval, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatCurrencyCompact = (value: number) => {
  if (Math.abs(value) >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}k`;
  }
  return formatCurrency(value);
};

interface FluxoCaixaChartProps {
  dias?: number;
}

export function FluxoCaixaChart({ dias = 30 }: FluxoCaixaChartProps) {
  const dataFim = new Date();
  const dataInicio = subDays(dataFim, dias - 1);

  // Buscar entradas (pagamentos recebidos)
  const { data: entradas, isLoading: loadingEntradas } = useQuery({
    queryKey: ['fluxo-caixa-entradas', dias],
    queryFn: async () => {
      const { data } = await supabase
        .from('asaas_cobrancas')
        .select('pagamento_data, pagamento_valor')
        .in('status', ['RECEIVED', 'CONFIRMED', 'pago'])
        .gte('pagamento_data', dataInicio.toISOString().split('T')[0])
        .lte('pagamento_data', dataFim.toISOString().split('T')[0]);
      
      return data || [];
    }
  });

  // Buscar saídas (contas pagas)
  const { data: saidas, isLoading: loadingSaidas } = useQuery({
    queryKey: ['fluxo-caixa-saidas', dias],
    queryFn: async () => {
      const { data } = await supabase
        .from('contas_pagar')
        .select('data_pagamento, valor_pago')
        .eq('status', 'pago')
        .gte('data_pagamento', dataInicio.toISOString().split('T')[0])
        .lte('data_pagamento', dataFim.toISOString().split('T')[0]);
      
      return data || [];
    }
  });

  const chartData = useMemo(() => {
    const diasIntervalo = eachDayOfInterval({ start: dataInicio, end: dataFim });
    
    const dadosPorDia: Record<string, { entradas: number; saidas: number }> = {};
    
    // Inicializar todos os dias com 0
    diasIntervalo.forEach(dia => {
      const key = format(dia, 'yyyy-MM-dd');
      dadosPorDia[key] = { entradas: 0, saidas: 0 };
    });
    
    // Somar entradas
    entradas?.forEach(item => {
      if (item.pagamento_data) {
        const key = item.pagamento_data.split('T')[0];
        if (dadosPorDia[key]) {
          dadosPorDia[key].entradas += Number(item.pagamento_valor || 0);
        }
      }
    });
    
    // Somar saídas
    saidas?.forEach(item => {
      if (item.data_pagamento) {
        const key = item.data_pagamento.split('T')[0];
        if (dadosPorDia[key]) {
          dadosPorDia[key].saidas += Number(item.valor_pago || 0);
        }
      }
    });
    
    // Converter para array e formatar para o gráfico
    return diasIntervalo.map(dia => {
      const key = format(dia, 'yyyy-MM-dd');
      const dados = dadosPorDia[key];
      return {
        data: format(dia, 'dd/MM', { locale: ptBR }),
        dataCompleta: format(dia, "dd 'de' MMMM", { locale: ptBR }),
        Entradas: dados.entradas,
        Saídas: -dados.saidas, // Negativo para mostrar para baixo
        Saldo: dados.entradas - dados.saidas,
      };
    });
  }, [entradas, saidas, dataInicio, dataFim]);

  const isLoading = loadingEntradas || loadingSaidas;

  // Calcular totais
  const totais = useMemo(() => {
    const totalEntradas = chartData.reduce((acc, d) => acc + d.Entradas, 0);
    const totalSaidas = chartData.reduce((acc, d) => acc + Math.abs(d.Saídas), 0);
    return {
      entradas: totalEntradas,
      saidas: totalSaidas,
      saldo: totalEntradas - totalSaidas
    };
  }, [chartData]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="flex justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span className="text-muted-foreground">Entradas:</span>
          <span className="font-medium text-green-600">{formatCurrency(totais.entradas)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span className="text-muted-foreground">Saídas:</span>
          <span className="font-medium text-red-600">{formatCurrency(totais.saidas)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Saldo:</span>
          <span className={`font-bold ${totais.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totais.saldo)}
          </span>
        </div>
      </div>

      {/* Gráfico */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="data" 
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval={Math.ceil(chartData.length / 10)}
          />
          <YAxis 
            tick={{ fontSize: 10 }}
            tickFormatter={formatCurrencyCompact}
            tickLine={false}
            axisLine={false}
            width={70}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const data = payload[0]?.payload;
                return (
                  <div className="bg-background border rounded-lg shadow-lg p-3">
                    <p className="font-medium text-sm mb-2">{data.dataCompleta}</p>
                    <div className="space-y-1 text-sm">
                      <p className="text-green-600">
                        Entradas: {formatCurrency(data.Entradas)}
                      </p>
                      <p className="text-red-600">
                        Saídas: {formatCurrency(Math.abs(data.Saídas))}
                      </p>
                      <p className={`font-medium ${data.Saldo >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        Saldo: {formatCurrency(data.Saldo)}
                      </p>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeWidth={1} />
          <Bar 
            dataKey="Entradas" 
            fill="hsl(142, 76%, 36%)" 
            radius={[4, 4, 0, 0]}
            maxBarSize={20}
          />
          <Bar 
            dataKey="Saídas" 
            fill="hsl(0, 84%, 60%)" 
            radius={[0, 0, 4, 4]}
            maxBarSize={20}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
