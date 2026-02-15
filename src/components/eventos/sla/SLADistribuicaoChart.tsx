import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { STATUS_SINISTRO_LABELS } from '@/types/sinistros';
import type { StatusSinistro } from '@/types/sinistros';

interface Props {
  distribuicao: Record<string, { dentro: number; proximo: number; estourado: number }>;
}

export function SLADistribuicaoChart({ distribuicao }: Props) {
  const data = Object.entries(distribuicao).map(([status, counts]) => ({
    status: STATUS_SINISTRO_LABELS[status as StatusSinistro] || status,
    'Dentro do SLA': counts.dentro,
    'Próximo': counts.proximo,
    'Estourado': counts.estourado,
  }));

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Distribuição por Fase</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(300, data.length * 40)}>
          <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
            <XAxis type="number" />
            <YAxis type="category" dataKey="status" width={120} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Dentro do SLA" fill="#22c55e" stackId="a" />
            <Bar dataKey="Próximo" fill="#eab308" stackId="a" />
            <Bar dataKey="Estourado" fill="#ef4444" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
