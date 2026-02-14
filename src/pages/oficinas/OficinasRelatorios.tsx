import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Wrench, Clock, Car } from 'lucide-react';

const STATUS_ATIVOS = [
  'aguardando_entrada',
  'aguardando_orcamento',
  'aguardando_aprovacao',
  'em_execucao',
  'aguardando_peca',
  'pendente_assinatura',
];

const STATUS_FINALIZADOS = ['finalizado', 'concluido', 'entregue'];

interface OficinaMetrica {
  oficina_id: string;
  nome: string;
  total_em_reparo: number;
  tempo_medio_dias: number | null;
}

function useOficinasRelatorio() {
  return useQuery({
    queryKey: ['oficinas_relatorio'],
    queryFn: async () => {
      // Query 1: Oficinas com veículos em reparo
      const { data: emReparo, error: err1 } = await supabase
        .from('ordens_servico')
        .select('oficina_id, oficina:oficinas(id, nome_fantasia, razao_social)')
        .in('status', STATUS_ATIVOS as any);

      if (err1) throw err1;

      // Query 2: OS finalizadas com tempo total
      const { data: finalizadas, error: err2 } = await supabase
        .from('ordens_servico')
        .select('oficina_id, tempo_total_dias, oficina:oficinas(id, nome_fantasia, razao_social)')
        .in('status', STATUS_FINALIZADOS as any)
        .not('tempo_total_dias', 'is', null);

      if (err2) throw err2;

      // Agrupar por oficina
      const mapaOficinas = new Map<string, OficinaMetrica>();

      // Contar em reparo
      for (const os of emReparo || []) {
        if (!os.oficina_id) continue;
        const oficina = os.oficina as any;
        if (!mapaOficinas.has(os.oficina_id)) {
          mapaOficinas.set(os.oficina_id, {
            oficina_id: os.oficina_id,
            nome: oficina?.nome_fantasia || oficina?.razao_social || 'Sem nome',
            total_em_reparo: 0,
            tempo_medio_dias: null,
          });
        }
        mapaOficinas.get(os.oficina_id)!.total_em_reparo++;
      }

      // Calcular tempo médio
      const temposPorOficina = new Map<string, number[]>();
      for (const os of finalizadas || []) {
        if (!os.oficina_id || os.tempo_total_dias == null) continue;
        const oficina = os.oficina as any;
        if (!mapaOficinas.has(os.oficina_id)) {
          mapaOficinas.set(os.oficina_id, {
            oficina_id: os.oficina_id,
            nome: oficina?.nome_fantasia || oficina?.razao_social || 'Sem nome',
            total_em_reparo: 0,
            tempo_medio_dias: null,
          });
        }
        if (!temposPorOficina.has(os.oficina_id)) {
          temposPorOficina.set(os.oficina_id, []);
        }
        temposPorOficina.get(os.oficina_id)!.push(Number(os.tempo_total_dias));
      }

      for (const [id, tempos] of temposPorOficina) {
        const media = tempos.reduce((a, b) => a + b, 0) / tempos.length;
        mapaOficinas.get(id)!.tempo_medio_dias = Math.round(media * 10) / 10;
      }

      return Array.from(mapaOficinas.values()).sort((a, b) => b.total_em_reparo - a.total_em_reparo);
    },
  });
}

function getBadgeReparo(total: number) {
  if (total >= 5) return <Badge variant="destructive">{total}</Badge>;
  if (total >= 3) return <Badge className="bg-warning text-warning-foreground">{total}</Badge>;
  if (total > 0) return <Badge variant="secondary">{total}</Badge>;
  return <Badge variant="outline">0</Badge>;
}

function getBadgeTempo(dias: number | null) {
  if (dias == null) return <span className="text-muted-foreground">—</span>;
  if (dias >= 15) return <Badge variant="destructive">{dias}d</Badge>;
  if (dias >= 7) return <Badge className="bg-warning text-warning-foreground">{dias}d</Badge>;
  return <Badge variant="secondary">{dias}d</Badge>;
}

export default function OficinasRelatorios() {
  const { data: metricas, isLoading } = useOficinasRelatorio();

  const totalVeiculos = metricas?.reduce((sum, m) => sum + m.total_em_reparo, 0) || 0;
  const oficinasComReparo = metricas?.filter(m => m.total_em_reparo > 0).length || 0;
  const tempoMedioGeral = metricas?.filter(m => m.tempo_medio_dias != null);
  const mediaGeral = tempoMedioGeral && tempoMedioGeral.length > 0
    ? Math.round(tempoMedioGeral.reduce((s, m) => s + m.tempo_medio_dias!, 0) / tempoMedioGeral.length * 10) / 10
    : null;

  const chartData = metricas?.filter(m => m.total_em_reparo > 0 || m.tempo_medio_dias != null)
    .slice(0, 15)
    .map(m => ({
      nome: m.nome.length > 20 ? m.nome.substring(0, 20) + '…' : m.nome,
      'Em Reparo': m.total_em_reparo,
      'Tempo Médio (dias)': m.tempo_medio_dias || 0,
    })) || [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios de Oficinas</h1>
        <p className="text-muted-foreground">Veículos em reparo e tempo médio de conclusão por oficina</p>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3">
                <Car className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Veículos em Reparo</p>
                <p className="text-2xl font-bold">{isLoading ? '...' : totalVeiculos}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3">
                <Wrench className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Oficinas com Veículos</p>
                <p className="text-2xl font-bold">{isLoading ? '...' : oficinasComReparo}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tempo Médio Geral</p>
                <p className="text-2xl font-bold">{isLoading ? '...' : mediaGeral != null ? `${mediaGeral} dias` : '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Visão por Oficina</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" angle={-25} textAnchor="end" height={80} fontSize={12} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Em Reparo" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Tempo Médio (dias)" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Oficina</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : !metricas?.length ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma oficina com dados disponíveis</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Oficina</TableHead>
                  <TableHead className="text-center">Veículos em Reparo</TableHead>
                  <TableHead className="text-center">Tempo Médio (dias)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metricas.map((m) => (
                  <TableRow key={m.oficina_id}>
                    <TableCell className="font-medium">{m.nome}</TableCell>
                    <TableCell className="text-center">{getBadgeReparo(m.total_em_reparo)}</TableCell>
                    <TableCell className="text-center">{getBadgeTempo(m.tempo_medio_dias)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
