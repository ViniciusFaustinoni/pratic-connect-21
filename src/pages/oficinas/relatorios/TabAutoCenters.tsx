import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useRelatorioAutoCenters } from './hooks/useRelatorioAutoCenters';

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function TabAutoCenters() {
  const { data: metricas, isLoading } = useRelatorioAutoCenters();

  const chartData = metricas?.slice(0, 10).map(m => ({
    nome: m.nome.length > 18 ? m.nome.substring(0, 18) + '…' : m.nome,
    'Cotações': m.total_cotacoes,
    'Aprovadas': m.total_aprovadas,
  })) || [];

  if (isLoading) {
    return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Cotações por Auto Center</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" angle={-25} textAnchor="end" height={80} fontSize={12} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="Cotações" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Aprovadas" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Detalhamento por Auto Center</CardTitle></CardHeader>
        <CardContent>
          {!metricas?.length ? (
            <p className="text-center text-muted-foreground py-8">Nenhum auto center com dados</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Auto Center</TableHead>
                  <TableHead className="text-center">Cotações</TableHead>
                  <TableHead className="text-center">Aprovadas</TableHead>
                  <TableHead className="text-center">Pendentes</TableHead>
                  <TableHead className="text-center">Valor Aprovado</TableHead>
                  <TableHead>Marcas Cotadas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metricas.map((m) => (
                  <TableRow key={m.auto_center_id}>
                    <TableCell className="font-medium">{m.nome}</TableCell>
                    <TableCell className="text-center"><Badge variant="secondary">{m.total_cotacoes}</Badge></TableCell>
                    <TableCell className="text-center"><Badge className="bg-green-600 text-white">{m.total_aprovadas}</Badge></TableCell>
                    <TableCell className="text-center"><Badge className="bg-warning text-warning-foreground">{m.total_pendentes}</Badge></TableCell>
                    <TableCell className="text-center">{formatCurrency(m.valor_total_aprovado)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {m.marcas_cotacoes.slice(0, 3).map(marca => (
                          <Badge key={marca} variant="outline" className="text-xs">{marca}</Badge>
                        ))}
                        {m.marcas_cotacoes.length > 3 && <Badge variant="outline" className="text-xs">+{m.marcas_cotacoes.length - 3}</Badge>}
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
