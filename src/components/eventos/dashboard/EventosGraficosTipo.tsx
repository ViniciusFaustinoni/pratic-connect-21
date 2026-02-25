import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useEventosPorTipo, useEventosPorMes, FiltrosGlobais } from '@/hooks/useEventosDashboard';
import { PieChartIcon, BarChart3 } from 'lucide-react';

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
      <Card className="border-border/60">
        <CardHeader className="pb-1">
          <div className="flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-muted-foreground" />
            <div>
              <CardTitle className="text-base font-semibold">Distribuição por Tipo</CardTitle>
              <CardDescription className="text-xs">Proporção de cada categoria</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingTipo ? (
            <div className="flex items-center justify-center h-[280px]">
              <Skeleton className="h-44 w-44 rounded-full" />
            </div>
          ) : donutData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={105}
                  paddingAngle={3}
                  strokeWidth={2}
                  stroke="hsl(var(--card))"
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => [value, 'Qtd']} 
                  contentStyle={{ 
                    borderRadius: '8px', 
                    border: '1px solid hsl(var(--border))',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    fontSize: '12px',
                  }} 
                />
                <Legend 
                  verticalAlign="bottom" 
                  iconType="circle" 
                  iconSize={8}
                  formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
                />
                <text x="50%" y="46%" textAnchor="middle" className="fill-foreground text-3xl font-bold">{totalDonut}</text>
                <text x="50%" y="54%" textAnchor="middle" className="fill-muted-foreground text-[11px]">eventos</text>
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
      <Card className="border-border/60">
        <CardHeader className="pb-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <div>
              <CardTitle className="text-base font-semibold">Tendência Mensal</CardTitle>
              <CardDescription className="text-xs">Últimos 6 meses empilhados por tipo</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingMes ? (
            <Skeleton className="h-[300px] w-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={porMes} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="mes" 
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  allowDecimals={false} 
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '8px', 
                    border: '1px solid hsl(var(--border))',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    fontSize: '12px',
                  }} 
                />
                <Bar dataKey="colisao" name="Colisão" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
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
