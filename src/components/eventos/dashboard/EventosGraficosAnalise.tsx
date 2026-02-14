import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Cell, ReferenceLine,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useTaxaAprovacao, useTempoMedioPorFase, useCustosAcumulados, FiltrosGlobais } from '@/hooks/useEventosDashboard';
import { usePermissions } from '@/hooks/usePermissions';

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

  const taxaCor = (aprovacao?.taxa ?? 0) > 80 ? 'text-green-600' : (aprovacao?.taxa ?? 0) > 60 ? 'text-yellow-600' : 'text-red-600';
  const progressCor = (aprovacao?.taxa ?? 0) > 80 ? 'bg-green-500' : (aprovacao?.taxa ?? 0) > 60 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className={`grid gap-4 ${canSeeCustos ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
      {/* Taxa de Aprovação */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Taxa de Aprovação</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAprov ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-20 mx-auto" />
              <Skeleton className="h-3 w-full" />
            </div>
          ) : (
            <div className="text-center space-y-3">
              <div className={`text-4xl font-bold ${taxaCor}`}>{aprovacao?.taxa ?? 0}%</div>
              <Progress value={aprovacao?.taxa ?? 0} className="h-2" indicatorClassName={progressCor} />
              <div className="flex justify-center gap-4 text-xs text-muted-foreground">
                <span className="text-green-600 font-medium">{aprovacao?.aprovados ?? 0} aprovados</span>
                <span className="text-red-600 font-medium">{aprovacao?.reprovados ?? 0} reprovados</span>
                <span className="text-amber-600 font-medium">{aprovacao?.sindicancia ?? 0} sindicância</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Mês atual</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tempo Médio por Fase */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tempo Médio por Fase</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTempo ? (
            <Skeleton className="h-[200px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={tempoFase} layout="vertical" margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 10 }} unit="d" />
                <YAxis dataKey="fase" type="category" width={110} tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: number) => [`${v} dias`, 'Tempo']} />
                <Bar dataKey="dias" radius={[0, 4, 4, 0]}>
                  {(tempoFase || []).map((entry, i) => (
                    <Cell key={i} fill={entry.dias > entry.meta ? '#ef4444' : '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Custos Acumulados */}
      {canSeeCustos && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Custos Acumulados</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingCustos ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={custos}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v)]} />
                  <Area type="monotone" dataKey="orcamento" name="Orçamentos" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="pago" name="Indenizações" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="cotas" name="Cotas" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
