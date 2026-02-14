import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useEventosPorTipo, useEventosPorMes, FiltrosGlobais } from '@/hooks/useEventosDashboard';

const TIPO_CONFIG: Record<string, { label: string; cor: string }> = {
  colisao: { label: 'Colisão', cor: '#3b82f6' },
  roubo: { label: 'Roubo', cor: '#ef4444' },
  furto: { label: 'Furto', cor: '#8b5cf6' },
  incendio: { label: 'Incêndio', cor: '#f97316' },
  fenomeno_natural: { label: 'Alagamento', cor: '#06b6d4' },
  vidros: { label: 'Vidros', cor: '#22c55e' },
};

interface Props {
  filtros: FiltrosGlobais;
}

export default function EventosGraficosTipo({ filtros }: Props) {
  const { data: porTipo, isLoading: loadingTipo } = useEventosPorTipo(filtros);
  const { data: porMes, isLoading: loadingMes } = useEventosPorMes(filtros);

  const donutData = Object.entries(porTipo || {}).map(([tipo, qty]) => ({
    name: TIPO_CONFIG[tipo]?.label || tipo,
    value: qty,
    fill: TIPO_CONFIG[tipo]?.cor || '#6b7280',
  }));
  const totalDonut = donutData.reduce((t, d) => t + d.value, 0);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Donut */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Eventos por Tipo</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTipo ? (
            <div className="flex items-center justify-center h-[280px]">
              <Skeleton className="h-44 w-44 rounded-full" />
            </div>
          ) : donutData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, 'Qtd']} />
                <Legend />
                {/* Center total */}
                <text x="50%" y="48%" textAnchor="middle" className="fill-foreground text-2xl font-bold">{totalDonut}</text>
                <text x="50%" y="56%" textAnchor="middle" className="fill-muted-foreground text-xs">total</text>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
              Nenhum evento no período
            </div>
          )}
        </CardContent>
      </Card>

      {/* Barras por mês */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Eventos por Mês</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingMes ? (
            <Skeleton className="h-[280px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={porMes}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="colisao" name="Colisão" stackId="a" fill="#3b82f6" />
                <Bar dataKey="roubo" name="Roubo" stackId="a" fill="#ef4444" />
                <Bar dataKey="furto" name="Furto" stackId="a" fill="#8b5cf6" />
                <Bar dataKey="incendio" name="Incêndio" stackId="a" fill="#f97316" />
                <Bar dataKey="fenomeno_natural" name="Alagamento" stackId="a" fill="#06b6d4" />
                <Bar dataKey="vidros" name="Vidros" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
