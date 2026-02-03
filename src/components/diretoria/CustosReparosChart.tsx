import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import { useCustosReparos } from '@/hooks/useCustosReparos';

interface Props {
  ano: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function CustosReparosChart({ ano }: Props) {
  const { data, isLoading } = useCustosReparos(ano);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const { meses } = data || { meses: [] };

  if (meses.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Nenhum dado disponível para o período</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolução Mensal de Custos de Reparos</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={meses}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mesLabel" />
            <YAxis 
              tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}
              label={{ value: 'R$', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={(label) => `Mês: ${label}`}
            />
            <Legend />
            <Bar 
              dataKey="peca" 
              stackId="custos"
              fill="#3b82f6" 
              name="Peças" 
            />
            <Bar 
              dataKey="mao_de_obra" 
              stackId="custos"
              fill="#22c55e" 
              name="Mão de Obra" 
            />
            <Bar 
              dataKey="servico_terceiro" 
              stackId="custos"
              fill="#f97316" 
              name="Serv. Terceiros" 
            />
            <Line 
              type="monotone" 
              dataKey="total" 
              stroke="#8b5cf6" 
              strokeWidth={2}
              dot={{ fill: '#8b5cf6' }}
              name="Total"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
