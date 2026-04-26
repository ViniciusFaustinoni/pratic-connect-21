import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Users, TrendingUp, DollarSign, Target, Percent } from 'lucide-react';
import { useCanais, usePerformanceCanais, useCampanhas } from '@/hooks/useMarketing';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const tipoLabels: Record<string, string> = {
  organico: 'Orgânico', pago: 'Pago', referral: 'Indicação', direto: 'Direto',
  social: 'Social', email: 'E-mail', offline: 'Offline',
};

export default function CanalDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: canais, isLoading } = useCanais();
  const { data: performance } = usePerformanceCanais();
  const { data: campanhas } = useCampanhas({ canal_id: id });

  const canal = canais?.find(c => c.id === id);
  const perf = performance?.find(p => p.id === id);

  // Leads do canal (últimos 12 meses)
  const { data: leadsHistorico } = useQuery({
    queryKey: ['canal-leads-historico', id],
    queryFn: async () => {
      const hoje = new Date();
      const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      const resultado = [];
      
      for (let i = 11; i >= 0; i--) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
        const inicio = d.toISOString();
        const fim = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
        
        const { count } = await supabase.from('leads').select('*', { count: 'exact', head: true })
          .eq('origem', (canal?.nome?.toLowerCase().replace(/\s/g, '_') || '') as any)
          .gte('created_at', inicio).lt('created_at', fim);
        
        resultado.push({ mesLabel: meses[d.getMonth()], leads: count || 0 });
      }
      return resultado;
    },
    enabled: !!canal,
    staleTime: 1000 * 60 * 5,
  });

  // Leads recentes
  const { data: leadsRecentes } = useQuery({
    queryKey: ['canal-leads-recentes', id, canal?.nome],
    queryFn: async () => {
      const { data } = await supabase.from('leads')
        .select('id, nome, telefone, etapa, created_at')
        .eq('origem', (canal?.nome?.toLowerCase().replace(/\s/g, '_') || '') as any)
        .order('created_at', { ascending: false }).limit(20);
      return data || [];
    },
    enabled: !!canal,
  });

  if (isLoading) return <div className="p-6"><Skeleton className="h-96" /></div>;
  if (!canal) return <div className="p-6"><p>Canal não encontrado</p></div>;

  const cac = perf?.conversoes ? ((perf.investimento_total || 0) / perf.conversoes) : 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/marketing/canais')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{canal.nome}</h1>
            <Badge variant="outline">{tipoLabels[canal.tipo] || canal.tipo}</Badge>
            <Badge variant={canal.ativo ? 'default' : 'secondary'}>{canal.ativo ? 'Ativo' : 'Inativo'}</Badge>
          </div>
          {canal.descricao && <p className="text-muted-foreground">{canal.descricao}</p>}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <Card><CardContent className="pt-4 text-center">
          <Users className="h-5 w-5 mx-auto text-blue-600 mb-1" />
          <p className="text-2xl font-bold">{perf?.total_leads || 0}</p>
          <p className="text-xs text-muted-foreground">Total Leads</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <TrendingUp className="h-5 w-5 mx-auto text-green-600 mb-1" />
          <p className="text-2xl font-bold text-green-600">{perf?.conversoes || 0}</p>
          <p className="text-xs text-muted-foreground">Conversões</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <Percent className="h-5 w-5 mx-auto text-purple-600 mb-1" />
          <p className="text-2xl font-bold">{(perf?.taxa_conversao || 0).toFixed(1)}%</p>
          <p className="text-xs text-muted-foreground">Taxa Conversão</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <DollarSign className="h-5 w-5 mx-auto text-orange-600 mb-1" />
          <p className="text-2xl font-bold">R$ {(perf?.cpl_medio || 0).toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">CPL</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 text-center">
          <Target className="h-5 w-5 mx-auto text-red-600 mb-1" />
          <p className="text-2xl font-bold">R$ {cac.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">CAC</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="historico">
        <TabsList>
          <TabsTrigger value="historico">Métricas Históricas</TabsTrigger>
          <TabsTrigger value="campanhas">Campanhas ({campanhas?.length || 0})</TabsTrigger>
          <TabsTrigger value="leads">Leads ({leadsRecentes?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle>Leads por Mês (12 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              {leadsHistorico ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={leadsHistorico}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="mesLabel" />
                    <YAxis />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="leads" name="Leads" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <Skeleton className="h-64" />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campanhas">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Investido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campanhas?.length ? campanhas.map(c => (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/marketing/campanhas/${c.id}`)}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell><Badge variant={c.status === 'ativa' ? 'default' : 'secondary'}>{c.status}</Badge></TableCell>
                      <TableCell>{format(new Date(c.data_inicio), 'dd/MM/yy', { locale: ptBR })}</TableCell>
                      <TableCell className="text-right">R$ {(c.valor_gasto || 0).toLocaleString('pt-BR')}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma campanha vinculada</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadsRecentes?.length ? leadsRecentes.map((lead: any) => (
                    <TableRow key={lead.id} className="cursor-pointer" onClick={() => navigate(`/vendas/leads/${lead.id}`)}>
                      <TableCell className="font-medium">{lead.nome}</TableCell>
                      <TableCell>{lead.telefone}</TableCell>
                      <TableCell><Badge variant="outline">{lead.etapa}</Badge></TableCell>
                      <TableCell>{format(new Date(lead.created_at), 'dd/MM/yy', { locale: ptBR })}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum lead encontrado</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
