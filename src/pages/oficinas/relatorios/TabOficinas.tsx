import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useRelatorioOficinas } from './hooks/useRelatorioOficinas';

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

export default function TabOficinas() {
  const { data: metricas, isLoading } = useRelatorioOficinas();

  const chartData = metricas?.filter(m => m.total_em_reparo > 0)
    .slice(0, 10)
    .map(m => ({
      nome: m.nome.length > 18 ? m.nome.substring(0, 18) + '…' : m.nome,
      'Em Reparo': m.total_em_reparo,
      'Finalizadas': m.total_finalizadas,
    })) || [];

  if (isLoading) {
    return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Ranking de Oficinas</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" angle={-25} textAnchor="end" height={80} fontSize={12} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Em Reparo" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Finalizadas" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Detalhamento por Oficina</CardTitle></CardHeader>
        <CardContent>
          {!metricas?.length ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma oficina com dados</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Oficina</TableHead>
                  <TableHead className="text-center">Em Reparo</TableHead>
                  <TableHead className="text-center">Finalizadas</TableHead>
                  <TableHead className="text-center">Valor Orçamentos</TableHead>
                  <TableHead className="text-center">Tempo Médio</TableHead>
                  <TableHead>Especialidades</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metricas.map((m) => (
                  <TableRow key={m.oficina_id}>
                    <TableCell className="font-medium">{m.nome}</TableCell>
                    <TableCell className="text-center">{getBadgeReparo(m.total_em_reparo)}</TableCell>
                    <TableCell className="text-center">{m.total_finalizadas}</TableCell>
                    <TableCell className="text-center">{formatCurrency(m.valor_total_orcamentos)}</TableCell>
                    <TableCell className="text-center">{getBadgeTempo(m.tempo_medio_dias)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {m.especialidades.slice(0, 3).map(e => (
                          <Badge key={e} variant="outline" className="text-xs">{e}</Badge>
                        ))}
                        {m.especialidades.length > 3 && <Badge variant="outline" className="text-xs">+{m.especialidades.length - 3}</Badge>}
                      </div>
                    </TableCell>
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
