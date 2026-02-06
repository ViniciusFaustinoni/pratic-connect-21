import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { VendedorResumo } from '@/hooks/useComissoesExtended';
import { TIPO_COMISSAO_LABELS } from '@/types/comissoes';

interface ComissoesChartProps {
  resumoVendedores: VendedorResumo[];
  maxVendedores?: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const CORES_TIPO: Record<string, string> = {
  adesao: '#3b82f6', // blue-500
  recorrente: '#22c55e', // green-500
  producao: '#a855f7', // purple-500
  classificacao: '#f97316', // orange-500
  crescimento: '#06b6d4', // cyan-500
  recorde: '#eab308', // yellow-500
};

export function ComissoesChart({ resumoVendedores, maxVendedores = 10 }: ComissoesChartProps) {
  const chartData = useMemo(() => {
    const top10 = resumoVendedores.slice(0, maxVendedores);
    
    return top10.map((v) => ({
      nome: v.vendedor_nome.split(' ')[0], // Primeiro nome apenas
      nomeCompleto: v.vendedor_nome,
      adesao: v.total_adesao,
      recorrente: v.total_recorrente,
      producao: v.total_producao,
      classificacao: v.total_classificacao,
      crescimento: v.total_crescimento,
      recorde: v.total_recorde,
    }));
  }, [resumoVendedores, maxVendedores]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0);
      return (
        <div className="bg-background border rounded-lg shadow-lg p-3">
          <p className="font-semibold mb-2">{payload[0]?.payload?.nomeCompleto || label}</p>
          {payload.map((entry: any) => (
            entry.value > 0 && (
              <div key={entry.dataKey} className="flex justify-between gap-4 text-sm">
                <span style={{ color: entry.color }}>
                  {TIPO_COMISSAO_LABELS[entry.dataKey as keyof typeof TIPO_COMISSAO_LABELS] || entry.dataKey}:
                </span>
                <span className="font-medium">{formatCurrency(entry.value)}</span>
              </div>
            )
          ))}
          <div className="border-t mt-2 pt-2 flex justify-between text-sm font-semibold">
            <span>Total:</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Vendedores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Nenhum dado disponível para exibir
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top {maxVendedores} Vendedores por Tipo de Comissão</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="nome" 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                tickFormatter={(value) => formatCurrency(value)}
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                formatter={(value) => TIPO_COMISSAO_LABELS[value as keyof typeof TIPO_COMISSAO_LABELS] || value}
              />
              <Bar dataKey="adesao" stackId="a" fill={CORES_TIPO.adesao} name="adesao" />
              <Bar dataKey="recorrente" stackId="a" fill={CORES_TIPO.recorrente} name="recorrente" />
              <Bar dataKey="producao" stackId="a" fill={CORES_TIPO.producao} name="producao" />
              <Bar dataKey="classificacao" stackId="a" fill={CORES_TIPO.classificacao} name="classificacao" />
              <Bar dataKey="crescimento" stackId="a" fill={CORES_TIPO.crescimento} name="crescimento" />
              <Bar dataKey="recorde" stackId="a" fill={CORES_TIPO.recorde} name="recorde" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
