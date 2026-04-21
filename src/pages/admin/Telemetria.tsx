import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Activity, TrendingUp } from 'lucide-react';

interface Row {
  endpoint: string;
  method: string | null;
  status_bucket: string | null;
  count: number;
  error_count: number;
  avg_ms: number | null;
  window_start: string;
  route: string | null;
}

export default function Telemetria() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-telemetria'],
    queryFn: async (): Promise<Row[]> => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('client_telemetry' as any)
        .select('endpoint, method, status_bucket, count, error_count, avg_ms, window_start, route')
        .gte('window_start', since)
        .order('window_start', { ascending: false })
        .limit(10000);
      if (error) throw error;
      return ((data as unknown) as Row[]) || [];
    },
    staleTime: 60_000,
    refetchIntervalInBackground: false,
  });

  const stats = useMemo(() => {
    if (!data) return null;
    const now = Date.now();
    const day = now - 24 * 60 * 60 * 1000;

    const byEndpoint = new Map<string, { count: number; errors: number; totalMs: number; samples: number }>();
    const byRoute = new Map<string, number>();
    let total24h = 0;
    let totalErrors24h = 0;

    for (const r of data) {
      const t = new Date(r.window_start).getTime();
      const within24h = t >= day;
      const cur = byEndpoint.get(r.endpoint) || { count: 0, errors: 0, totalMs: 0, samples: 0 };
      cur.count += r.count;
      cur.errors += r.error_count;
      cur.totalMs += (r.avg_ms || 0) * r.count;
      cur.samples += r.count;
      byEndpoint.set(r.endpoint, cur);

      if (within24h) {
        total24h += r.count;
        totalErrors24h += r.error_count;
        if (r.route) byRoute.set(r.route, (byRoute.get(r.route) || 0) + r.count);
      }
    }

    const top = Array.from(byEndpoint.entries())
      .map(([endpoint, v]) => ({
        endpoint,
        count: v.count,
        errors: v.errors,
        avgMs: v.samples ? Math.round(v.totalMs / v.samples) : 0,
        errorRate: v.count ? v.errors / v.count : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const topRoutes = Array.from(byRoute.entries())
      .map(([route, count]) => ({ route, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const errorRate24h = total24h ? totalErrors24h / total24h : 0;

    // Recomendação simples
    let recomendacao = 'Plano atual parece adequado. Continue monitorando.';
    let recomendacaoColor: 'default' | 'destructive' | 'secondary' = 'default';
    const hot = top[0];
    if (hot && hot.count > 100_000) {
      recomendacao = `Endpoint "${hot.endpoint}" passou de 100k chamadas/7d. Justifica upgrade (Pro/Team).`;
      recomendacaoColor = 'destructive';
    } else if (errorRate24h > 0.05) {
      recomendacao = `Taxa de erro nas últimas 24h: ${(errorRate24h * 100).toFixed(1)}%. Investigue antes de pagar plano maior.`;
      recomendacaoColor = 'destructive';
    } else if (hot && hot.count > 50_000) {
      recomendacao = `Endpoint "${hot.endpoint}" acima de 50k/7d. Avalie aumentar staleTime ou cache.`;
      recomendacaoColor = 'secondary';
    }

    return { top, topRoutes, total24h, totalErrors24h, errorRate24h, recomendacao, recomendacaoColor };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="m-6">
        <CardContent className="py-8 text-center text-destructive">
          Erro ao carregar telemetria. Você precisa ser diretor/admin.
        </CardContent>
      </Card>
    );
  }

  const empty = !data || data.length === 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Telemetria de Uso do Supabase</h1>
        <p className="text-muted-foreground text-sm">
          Coleta client-side agregada em janelas de 1 minuto. Dados dos últimos 7 dias.
        </p>
      </div>

      {empty ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum dado coletado ainda. Aguarde alguns minutos com usuários ativos.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Requisições (24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats!.total24h.toLocaleString('pt-BR')}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Erros (24h)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats!.totalErrors24h.toLocaleString('pt-BR')}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {(stats!.errorRate24h * 100).toFixed(2)}% de erro
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Recomendação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant={stats!.recomendacaoColor as any} className="text-xs whitespace-normal text-left h-auto py-1">
                  {stats!.recomendacao}
                </Badge>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top 20 endpoints (7 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2">Endpoint</th>
                      <th className="py-2 text-right">Chamadas</th>
                      <th className="py-2 text-right">Erros</th>
                      <th className="py-2 text-right">Erro %</th>
                      <th className="py-2 text-right">Avg ms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats!.top.map((r) => (
                      <tr key={r.endpoint} className="border-b hover:bg-muted/30">
                        <td className="py-2 font-mono text-xs">{r.endpoint}</td>
                        <td className="py-2 text-right">{r.count.toLocaleString('pt-BR')}</td>
                        <td className="py-2 text-right">{r.errors}</td>
                        <td className="py-2 text-right">
                          <span className={r.errorRate > 0.05 ? 'text-destructive font-semibold' : ''}>
                            {(r.errorRate * 100).toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2 text-right">{r.avgMs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top rotas por consumo (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats!.topRoutes.map((r) => (
                  <div key={r.route} className="flex justify-between text-sm border-b pb-1">
                    <span className="font-mono text-xs">{r.route}</span>
                    <span>{r.count.toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Critério de decisão de upgrade</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1">
              <div>• Endpoint mais quente &lt; 50k req/dia + erros &lt; 0.5% → manter plano atual.</div>
              <div>• Endpoint &gt; 100k req/dia mesmo após cortes → upgrade Pro/Team.</div>
              <div>• Picos de concorrência (timeouts persistentes) → Compute add-on, não plano.</div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
