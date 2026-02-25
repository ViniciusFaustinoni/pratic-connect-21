import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useTaxaAprovacao, useTempoMedioPorFase, useCustosAcumulados, FiltrosGlobais } from '@/hooks/useEventosDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { CheckCircle2, Timer, TrendingUp } from 'lucide-react';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
}

interface Props {
  filtros: FiltrosGlobais;
}

export default function EventosGraficosAnalise({ filtros }: Props) {
  const { isDiretor, isGerencia } = usePermissions();
  const canSeeCustos = isDiretor || isGerencia;

  const { data: aprovacao, isLoading: loadingAprov } = useTaxaAprovacao(filtros);
  const { data: tempoFase, isLoading: loadingTempo } = useTempoMedioPorFase(filtros);
  const { data: custos, isLoading: loadingCustos } = useCustosAcumulados(filtros);

  const taxa = aprovacao?.taxa ?? 0;
  const taxaCor = taxa > 80 ? 'text-emerald-600' : taxa > 60 ? 'text-amber-600' : 'text-red-500';
  const progressCor = taxa > 80 ? 'bg-emerald-500' : taxa > 60 ? 'bg-amber-500' : 'bg-red-500';
  const taxaRing = taxa > 80 ? 'ring-emerald-100' : taxa > 60 ? 'ring-amber-100' : 'ring-red-100';
  const taxaBg = taxa > 80 ? 'bg-emerald-50' : taxa > 60 ? 'bg-amber-50' : 'bg-red-50';

  return (
    <div className={`grid gap-4 ${canSeeCustos ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
      {/* Taxa de Aprovação */}
      <Card className="border-border/60">
        <CardHeader className="pb-1">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <div>
              <CardTitle className="text-base font-semibold">Taxa de Aprovação</CardTitle>
              <CardDescription className="text-xs">Mês atual</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingAprov ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-16 w-20 mx-auto rounded-xl" />
              <Skeleton className="h-2 w-full" />
            </div>
          ) : (
            <div className="flex flex-col items-center py-4 space-y-4">
              {/* Big number with ring */}
              <div className={`w-24 h-24 rounded-2xl ${taxaBg} ring-1 ${taxaRing} flex flex-col items-center justify-center`}>
                <span className={`text-3xl font-bold ${taxaCor}`}>{taxa}%</span>
              </div>

              <Progress value={taxa} className="h-1.5 w-full" indicatorClassName={progressCor} />

              <div className="flex justify-center gap-5 w-full">
                {[
                  { label: 'Aprovados', value: aprovacao?.aprovados ?? 0, color: 'text-emerald-600', dot: 'bg-emerald-500' },
                  { label: 'Reprovados', value: aprovacao?.reprovados ?? 0, color: 'text-red-500', dot: 'bg-red-500' },
                  { label: 'Sindicância', value: aprovacao?.sindicancia ?? 0, color: 'text-amber-600', dot: 'bg-amber-500' },
                ].map(item => (
                  <div key={item.label} className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
                      <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tempo Médio por Fase */}
      <Card className="border-border/60">
        <CardHeader className="pb-1">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-muted-foreground" />
            <div>
              <CardTitle className="text-base font-semibold">Tempo por Fase</CardTitle>
              <CardDescription className="text-xs">Média em dias · vermelho = acima da meta</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingTempo ? (
            <Skeleton className="h-[220px] w-full rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={tempoFase} layout="vertical" margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis 
                  type="number" 
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
                  unit="d" 
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  dataKey="fase" 
                  type="category" 
                  width={115} 
                  tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  formatter={(v: number) => [`${v} dias`, 'Tempo']} 
                  contentStyle={{ 
                    borderRadius: '8px', 
                    border: '1px solid hsl(var(--border))',
                    fontSize: '12px',
                  }} 
                />
                <Bar dataKey="dias" radius={[0, 6, 6, 0]} maxBarSize={20}>
                  {(tempoFase || []).map((entry, i) => (
                    <Cell key={i} fill={entry.dias > entry.meta ? '#ef4444' : '#3b82f6'} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Custos Acumulados */}
      {canSeeCustos && (
        <Card className="border-border/60">
          <CardHeader className="pb-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div>
                <CardTitle className="text-base font-semibold">Custos Acumulados</CardTitle>
                <CardDescription className="text-xs">Últimos 6 meses</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingCustos ? (
              <Skeleton className="h-[220px] w-full rounded-lg" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={custos} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradOrcamento" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradPago" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCotas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="mes" 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    formatter={(v: number) => [formatCurrency(v)]} 
                    contentStyle={{ 
                      borderRadius: '8px', 
                      border: '1px solid hsl(var(--border))',
                      fontSize: '12px',
                    }} 
                  />
                  <Area type="monotone" dataKey="orcamento" name="Orçamentos" stroke="#3b82f6" fill="url(#gradOrcamento)" strokeWidth={2} />
                  <Area type="monotone" dataKey="pago" name="Indenizações" stroke="#ef4444" fill="url(#gradPago)" strokeWidth={2} />
                  <Area type="monotone" dataKey="cotas" name="Cotas" stroke="#22c55e" fill="url(#gradCotas)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
