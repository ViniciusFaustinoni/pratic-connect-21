import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  AlertTriangle,
  Clock,
  TrendingUp,
  DollarSign,
  Eye,
  Car,
  ShieldAlert,
  ShieldX,
  Flame,
  CloudRain,
  Square,
  HelpCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Periodo = 'mes_atual' | '3meses' | 'ano' | 'todos';

const periodos: { value: Periodo; label: string }[] = [
  { value: 'mes_atual', label: 'Mês Atual' },
  { value: '3meses', label: 'Últimos 3 meses' },
  { value: 'ano', label: 'Último Ano' },
  { value: 'todos', label: 'Todos' },
];

const statusConfig: Record<string, { label: string; class: string }> = {
  comunicado: { label: 'Comunicado', class: 'bg-yellow-100 text-yellow-800' },
  em_analise: { label: 'Em Análise', class: 'bg-blue-100 text-blue-800' },
  documentacao_pendente: { label: 'Doc. Pendente', class: 'bg-orange-100 text-orange-800' },
  aguardando_vistoria: { label: 'Aguard. Vistoria', class: 'bg-purple-100 text-purple-800' },
  em_vistoria: { label: 'Em Vistoria', class: 'bg-indigo-100 text-indigo-800' },
  aguardando_parecer: { label: 'Aguard. Parecer', class: 'bg-cyan-100 text-cyan-800' },
  aprovado: { label: 'Aprovado', class: 'bg-green-100 text-green-800' },
  negado: { label: 'Negado', class: 'bg-red-100 text-red-800' },
  em_regulacao: { label: 'Em Regulação', class: 'bg-amber-100 text-amber-800' },
  em_reparo: { label: 'Em Reparo', class: 'bg-teal-100 text-teal-800' },
  pago: { label: 'Pago', class: 'bg-emerald-100 text-emerald-800' },
  encerrado: { label: 'Encerrado', class: 'bg-gray-100 text-gray-800' },
  cancelado: { label: 'Cancelado', class: 'bg-slate-100 text-slate-800' },
};

const tipoConfig: Record<string, { label: string; icon: React.ElementType }> = {
  colisao: { label: 'Colisão', icon: Car },
  roubo: { label: 'Roubo', icon: ShieldAlert },
  furto: { label: 'Furto', icon: ShieldX },
  incendio: { label: 'Incêndio', icon: Flame },
  fenomeno_natural: { label: 'Fenômeno Natural', icon: CloudRain },
  vidros: { label: 'Vidros', icon: Square },
  outro: { label: 'Outro', icon: HelpCircle },
};

const tipoCores: Record<string, string> = {
  colisao: '#3b82f6',
  roubo: '#ef4444',
  furto: '#f97316',
  incendio: '#dc2626',
  fenomeno_natural: '#06b6d4',
  vidros: '#8b5cf6',
  outro: '#6b7280',
};

function getDataInicial(periodo: Periodo): Date | null {
  const agora = new Date();
  if (periodo === 'mes_atual') return startOfMonth(agora);
  if (periodo === '3meses') return subMonths(agora, 3);
  if (periodo === 'ano') return subMonths(agora, 12);
  return null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export default function SinistrosDashboard() {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<Periodo>('mes_atual');
  const dataInicial = getDataInicial(periodo);

  // Query: Métricas gerais
  const { data: metricas, isLoading: loadingMetricas } = useQuery({
    queryKey: ['sinistros-metricas', periodo],
    queryFn: async () => {
      let query = supabase
        .from('sinistros')
        .select('status, tipo, valor_fipe, valor_indenizacao, valor_pago, created_at');

      if (dataInicial) {
        query = query.gte('created_at', dataInicial.toISOString());
      }

      const { data: sinistros } = await query;

      const total = sinistros?.length || 0;
      const abertos = sinistros?.filter(s =>
        !['encerrado', 'cancelado', 'pago', 'negado'].includes(s.status)
      ).length || 0;
      const aprovados = sinistros?.filter(s =>
        ['aprovado', 'pago', 'em_regulacao', 'em_reparo'].includes(s.status)
      ).length || 0;

      const valorTotalAprovado = sinistros?.reduce((acc, s) =>
        acc + (s.valor_indenizacao || 0), 0
      ) || 0;
      const valorTotalPago = sinistros?.reduce((acc, s) =>
        acc + (s.valor_pago || 0), 0
      ) || 0;

      const taxaAprovacao = total > 0
        ? ((aprovados / total) * 100).toFixed(1)
        : '0.0';

      return {
        total,
        abertos,
        aprovados,
        taxaAprovacao,
        valorTotalAprovado,
        valorTotalPago,
      };
    }
  });

  // Query: Sinistros por tipo
  const { data: porTipo, isLoading: loadingTipo } = useQuery({
    queryKey: ['sinistros-por-tipo', periodo],
    queryFn: async () => {
      let query = supabase.from('sinistros').select('tipo, created_at');

      if (dataInicial) {
        query = query.gte('created_at', dataInicial.toISOString());
      }

      const { data } = await query;

      const contagem: Record<string, number> = {};
      data?.forEach(s => {
        contagem[s.tipo] = (contagem[s.tipo] || 0) + 1;
      });

      return Object.entries(contagem).map(([tipo, quantidade]) => ({
        tipo: tipoConfig[tipo]?.label || tipo,
        quantidade,
        cor: tipoCores[tipo] || '#6b7280',
      }));
    }
  });

  // Query: Sinistros por mês (últimos 6 meses)
  const { data: porMes, isLoading: loadingMes } = useQuery({
    queryKey: ['sinistros-por-mes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sinistros')
        .select('created_at')
        .gte('created_at', subMonths(new Date(), 6).toISOString());

      const porMesMap: Record<string, number> = {};
      data?.forEach(s => {
        const mes = format(new Date(s.created_at), 'MMM/yy', { locale: ptBR });
        porMesMap[mes] = (porMesMap[mes] || 0) + 1;
      });

      // Garantir ordem cronológica
      const ultimos6Meses = [];
      for (let i = 5; i >= 0; i--) {
        const mes = format(subMonths(new Date(), i), 'MMM/yy', { locale: ptBR });
        ultimos6Meses.push({
          mes,
          total: porMesMap[mes] || 0
        });
      }

      return ultimos6Meses;
    }
  });

  // Query: Últimos 10 sinistros
  const { data: ultimosSinistros, isLoading: loadingUltimos } = useQuery({
    queryKey: ['sinistros-ultimos'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sinistros')
        .select(`
          id, protocolo, tipo, status, created_at,
          associado:associados(nome),
          veiculo:veiculos(placa, marca, modelo)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      return data || [];
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard de Sinistros</h1>
          <p className="text-muted-foreground">
            Análise completa dos sinistros da associação
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {periodos.map((p) => (
            <Button
              key={p.value}
              variant={periodo === p.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriodo(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Sinistros</CardTitle>
            <AlertTriangle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {loadingMetricas ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{metricas?.total || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Aberto</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            {loadingMetricas ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{metricas?.abertos || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Aprovação</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {loadingMetricas ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{metricas?.taxaAprovacao}%</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total Pago</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            {loadingMetricas ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {formatCurrency(metricas?.valorTotalPago || 0)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Gráfico Pizza - Por Tipo */}
        <Card>
          <CardHeader>
            <CardTitle>Sinistros por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTipo ? (
              <div className="flex items-center justify-center h-[300px]">
                <Skeleton className="h-48 w-48 rounded-full" />
              </div>
            ) : porTipo && porTipo.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={porTipo}
                    dataKey="quantidade"
                    nameKey="tipo"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ tipo, percent }) =>
                      `${tipo} (${(percent * 100).toFixed(0)}%)`
                    }
                    labelLine={false}
                  >
                    {porTipo.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.cor} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mb-2" />
                <p>Nenhum sinistro no período</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico Barras - Por Mês */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMes ? (
              <div className="flex items-center justify-center h-[300px]">
                <Skeleton className="h-full w-full" />
              </div>
            ) : porMes && porMes.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={porMes}>
                  <XAxis dataKey="mes" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mb-2" />
                <p>Nenhum sinistro nos últimos 6 meses</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Últimos Sinistros */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Últimos Sinistros</CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate('/eventos/sinistros')}>
            Ver Todos
          </Button>
        </CardHeader>
        <CardContent>
          {loadingUltimos ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : ultimosSinistros && ultimosSinistros.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Associado</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ultimosSinistros.map((sinistro) => {
                  const TipoIcon = tipoConfig[sinistro.tipo]?.icon || HelpCircle;
                  const status = statusConfig[sinistro.status] || {
                    label: sinistro.status,
                    class: 'bg-gray-100 text-gray-800'
                  };

                  return (
                    <TableRow key={sinistro.id}>
                      <TableCell className="font-medium">{sinistro.protocolo}</TableCell>
                      <TableCell>
                        {format(new Date(sinistro.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>{(sinistro.associado as any)?.nome || '-'}</TableCell>
                      <TableCell>
                        {(sinistro.veiculo as any)?.placa || '-'}
                        {(sinistro.veiculo as any)?.modelo && (
                          <span className="text-muted-foreground text-xs ml-1">
                            ({(sinistro.veiculo as any)?.modelo})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <TipoIcon className="h-4 w-4" />
                          <span>{tipoConfig[sinistro.tipo]?.label || sinistro.tipo}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={status.class}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/eventos/sinistros/${sinistro.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mb-2" />
              <p>Nenhum sinistro registrado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
