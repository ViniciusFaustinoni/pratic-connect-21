import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Car, Wrench, Package, Phone } from 'lucide-react';
import { useRelatorioGeral } from './hooks/useRelatorioGeral';

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function TabVisaoGeral() {
  const { data, isLoading } = useRelatorioGeral();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3"><Car className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Veículos em Reparo</p>
                <p className="text-2xl font-bold">{isLoading ? '...' : data?.totalVeiculosReparo}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3"><Wrench className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total Orçamentos</p>
                <p className="text-2xl font-bold">{isLoading ? '...' : formatCurrency(data?.valorTotalOrcamentos || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3"><Package className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Cotações de Peças Ativas</p>
                <p className="text-2xl font-bold">{isLoading ? '...' : data?.totalCotacoes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-3"><Phone className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Chamados Abertos</p>
                <p className="text-2xl font-bold">{isLoading ? '...' : data?.totalChamados}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {data?.osPorMarca && data.osPorMarca.length > 0 && (
        <Card>
          <CardHeader><CardTitle>OS Ativas por Marca do Veículo</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={data.osPorMarca}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="marca" angle={-25} textAnchor="end" height={80} fontSize={12} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" name="OS Ativas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
