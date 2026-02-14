import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useRelatorioPrestadores } from './hooks/useRelatorioPrestadores';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--muted-foreground))',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
];

export default function TabPrestadores() {
  const { data, isLoading } = useRelatorioPrestadores();

  if (isLoading) {
    return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const prestadores = data?.prestadores || [];
  const chamadosPorTipo = data?.chamadosPorTipo || [];

  return (
    <div className="space-y-6">
      {chamadosPorTipo.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Chamados por Tipo de Serviço</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={chamadosPorTipo} dataKey="total" nameKey="tipo" cx="50%" cy="50%" outerRadius={100} label={({ tipo, total }) => `${tipo}: ${total}`}>
                  {chamadosPorTipo.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Detalhamento por Prestador</CardTitle></CardHeader>
        <CardContent>
          {!prestadores.length ? (
            <p className="text-center text-muted-foreground py-8">Nenhum prestador com dados</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prestador</TableHead>
                  <TableHead className="text-center">Chamados</TableHead>
                  <TableHead>Serviço Principal</TableHead>
                  <TableHead className="text-center">Tempo Médio</TableHead>
                  <TableHead>Marcas Atendidas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prestadores.map((m) => (
                  <TableRow key={m.prestador_id}>
                    <TableCell className="font-medium">{m.nome}</TableCell>
                    <TableCell className="text-center"><Badge variant="secondary">{m.total_chamados}</Badge></TableCell>
                    <TableCell>{m.tipo_principal || '—'}</TableCell>
                    <TableCell className="text-center">
                      {m.tempo_medio_horas != null ? (
                        <Badge variant="secondary">{m.tempo_medio_horas}h</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {m.marcas_atendidas.slice(0, 3).map(marca => (
                          <Badge key={marca} variant="outline" className="text-xs">{marca}</Badge>
                        ))}
                        {m.marcas_atendidas.length > 3 && <Badge variant="outline" className="text-xs">+{m.marcas_atendidas.length - 3}</Badge>}
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
