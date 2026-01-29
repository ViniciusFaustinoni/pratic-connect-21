import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Target, DollarSign, BarChart3 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function RecuperacaoKPIs() {
  // Calcular valor recuperado este mês
  const { data: recuperacao, isLoading } = useQuery({
    queryKey: ['cobranca-recuperacao'],
    queryFn: async () => {
      const now = new Date();
      const inicioMes = startOfMonth(now).toISOString().split('T')[0];
      const fimMes = endOfMonth(now).toISOString().split('T')[0];
      
      // Cobranças vencidas que foram pagas este mês
      const { data: cobrancasPagas } = await supabase
        .from('cobrancas')
        .select('valor_pago, data_vencimento, data_pagamento')
        .eq('status', 'pago')
        .gte('data_pagamento', inicioMes)
        .lte('data_pagamento', fimMes)
        .lt('data_vencimento', 'data_pagamento');

      // Também considerar pagamentos do ASAAS de boletos vencidos
      const { data: asaasPagos } = await supabase
        .from('asaas_cobrancas')
        .select('pagamento_valor, data_vencimento, pagamento_data')
        .in('status', ['RECEIVED', 'CONFIRMED'])
        .gte('pagamento_data', inicioMes)
        .lte('pagamento_data', fimMes);

      // Filtrar apenas pagamentos de boletos vencidos (pagou depois do vencimento)
      const asaasRecuperados = asaasPagos?.filter(c => 
        c.data_vencimento && c.pagamento_data && 
        new Date(c.pagamento_data) > new Date(c.data_vencimento)
      ) || [];

      // Acordos pagos este mês
      const { data: acordosPagos } = await supabase
        .from('acordo_parcelas')
        .select('valor_pago, data_pagamento')
        .eq('status', 'pago')
        .gte('data_pagamento', inicioMes)
        .lte('data_pagamento', fimMes);

      const valorRecuperadoCobrancas = cobrancasPagas?.reduce((acc, c) => acc + (c.valor_pago || 0), 0) || 0;
      const valorRecuperadoAsaas = asaasRecuperados.reduce((acc, c) => acc + (c.pagamento_valor || 0), 0);
      const valorRecuperadoAcordos = acordosPagos?.reduce((acc, c) => acc + (c.valor_pago || 0), 0) || 0;
      
      const valorRecuperado = valorRecuperadoCobrancas + valorRecuperadoAsaas + valorRecuperadoAcordos;

      // Total em atraso para calcular taxa
      const { data: vencidos } = await supabase
        .from('cobrancas')
        .select('valor_final')
        .eq('status', 'vencido');

      const valorEmAtraso = vencidos?.reduce((acc, c) => acc + (c.valor_final || 0), 0) || 0;
      const taxaRecuperacao = valorEmAtraso > 0 
        ? (valorRecuperado / (valorEmAtraso + valorRecuperado)) * 100 
        : 0;

      return {
        valorRecuperado,
        taxaRecuperacao: Math.min(taxaRecuperacao, 100),
        qtdAcordosPagos: acordosPagos?.length || 0,
        qtdCobrancasRecuperadas: (cobrancasPagas?.length || 0) + asaasRecuperados.length
      };
    }
  });

  // Evolução mensal (últimos 6 meses)
  const { data: evolucao } = useQuery({
    queryKey: ['cobranca-evolucao-mensal'],
    queryFn: async () => {
      const dados = [];
      const now = new Date();

      for (let i = 5; i >= 0; i--) {
        const mes = subMonths(now, i);
        const inicioMes = startOfMonth(mes).toISOString().split('T')[0];
        const fimMes = endOfMonth(mes).toISOString().split('T')[0];

        // Cobranças pagas no mês
        const { data: pagas } = await supabase
          .from('cobrancas')
          .select('valor_pago')
          .eq('status', 'pago')
          .gte('data_pagamento', inicioMes)
          .lte('data_pagamento', fimMes);

        // Acordos pagos no mês
        const { data: acordos } = await supabase
          .from('acordo_parcelas')
          .select('valor_pago')
          .eq('status', 'pago')
          .gte('data_pagamento', inicioMes)
          .lte('data_pagamento', fimMes);

        const valorCobrancas = pagas?.reduce((acc, c) => acc + (c.valor_pago || 0), 0) || 0;
        const valorAcordos = acordos?.reduce((acc, c) => acc + (c.valor_pago || 0), 0) || 0;

        dados.push({
          mes: format(mes, 'MMM', { locale: ptBR }),
          recuperado: valorCobrancas + valorAcordos,
        });
      }

      return dados;
    }
  });

  return (
    <div className="space-y-6">
      {/* KPIs de Recuperação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
              Recuperado Este Mês
            </CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {isLoading ? '...' : formatCurrency(recuperacao?.valorRecuperado || 0)}
            </div>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">
              {recuperacao?.qtdCobrancasRecuperadas || 0} cobranças
            </p>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">
              Taxa de Recuperação
            </CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
              {isLoading ? '...' : `${(recuperacao?.taxaRecuperacao || 0).toFixed(1)}%`}
            </div>
            <p className="text-xs text-blue-600/80 dark:text-blue-400/80">
              do total inadimplente
            </p>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-400">
              Acordos Pagos
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
              {isLoading ? '...' : recuperacao?.qtdAcordosPagos || 0}
            </div>
            <p className="text-xs text-purple-600/80 dark:text-purple-400/80">
              parcelas este mês
            </p>
          </CardContent>
        </Card>

        <Card className="bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-cyan-700 dark:text-cyan-400">
              Cobranças Recuperadas
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-400">
              {isLoading ? '...' : recuperacao?.qtdCobrancasRecuperadas || 0}
            </div>
            <p className="text-xs text-cyan-600/80 dark:text-cyan-400/80">
              este mês
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Evolução Mensal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Evolução da Recuperação (6 meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            {evolucao && evolucao.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolucao}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="mes" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis 
                    tickFormatter={(value) => formatCurrency(value).replace('R$', '')}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    width={80}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Recuperado']}
                    contentStyle={{ borderRadius: '8px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="recuperado" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Carregando dados...
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
