import { Users, DollarSign, FileX, Handshake, Phone, MessageSquare, Mail, Play, Search, FileText, Settings, TrendingUp, AlertTriangle, ListTodo, PhoneCall, Percent } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RecuperacaoKPIs } from '@/components/cobranca/RecuperacaoKPIs';
import { DashboardGraficos } from '@/components/cobranca/DashboardGraficos';
import { TopDevedores } from '@/components/cobranca/TopDevedores';
import { AlertasCobranca } from '@/components/cobranca/AlertasCobranca';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDateTime = (date: string) =>
  format(new Date(date), "dd/MM HH:mm", { locale: ptBR });

const getPrioridadeBadge = (prioridade: number) => {
  if (prioridade >= 8) return { label: 'Alta', variant: 'destructive' as const };
  if (prioridade >= 5) return { label: 'Média', variant: 'default' as const };
  return { label: 'Normal', variant: 'secondary' as const };
};

const getMotivoLabel = (motivo: string) => {
  const motivos: Record<string, string> = {
    'vencido': 'Boleto vencido',
    'promessa_quebrada': 'Promessa quebrada',
    'acordo_quebrado': 'Acordo quebrado',
    'retorno_agendado': 'Retorno agendado',
    'primeira_cobranca': '1ª Cobrança',
    'escalonado': 'Escalonado'
  };
  return motivos[motivo] || motivo;
};

const getResultadoIcon = (tipo: string) => {
  switch (tipo) {
    case 'ligacao': return <Phone className="h-4 w-4" />;
    case 'whatsapp': return <MessageSquare className="h-4 w-4" />;
    case 'email': return <Mail className="h-4 w-4" />;
    default: return <Phone className="h-4 w-4" />;
  }
};

const getResultadoBadge = (resultado: string) => {
  const resultados: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    'atendeu': { label: 'Atendeu', variant: 'default' },
    'nao_atendeu': { label: 'Não atendeu', variant: 'secondary' },
    'promessa_pagamento': { label: 'Promessa', variant: 'default' },
    'pediu_acordo': { label: 'Pediu acordo', variant: 'outline' },
    'negou_divida': { label: 'Negou dívida', variant: 'destructive' },
    'enviado': { label: 'Enviado', variant: 'secondary' },
    'lido': { label: 'Lido', variant: 'default' }
  };
  return resultados[resultado] || { label: resultado, variant: 'secondary' as const };
};

export default function CobrancaDashboard() {
  const navigate = useNavigate();

  // Estatísticas de inadimplência
  const { data: estatisticas, isLoading: loadingStats } = useQuery({
    queryKey: ['cobranca-estatisticas'],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0];
      
      const { data: vencidos } = await supabase
        .from('cobrancas')
        .select('associado_id, valor_final, data_vencimento')
        .eq('status', 'vencido')
        .lt('data_vencimento', hoje);
      
      const associadosUnicos = new Set(vencidos?.map(i => i.associado_id) || []);
      const valorTotal = vencidos?.reduce((acc, c) => acc + (c.valor_final || 0), 0) || 0;
      
      const hojeDate = new Date();
      let de1a5 = 0, de6a30 = 0, de31a60 = 0, de61a90 = 0, acima90 = 0;
      let valor1a5 = 0, valor6a30 = 0, valor31a60 = 0, valor61a90 = 0, valorAcima90 = 0;
      
      vencidos?.forEach(c => {
        const dias = Math.floor((hojeDate.getTime() - new Date(c.data_vencimento).getTime()) / 86400000);
        if (dias <= 5) { de1a5++; valor1a5 += c.valor_final || 0; }
        else if (dias <= 30) { de6a30++; valor6a30 += c.valor_final || 0; }
        else if (dias <= 60) { de31a60++; valor31a60 += c.valor_final || 0; }
        else if (dias <= 90) { de61a90++; valor61a90 += c.valor_final || 0; }
        else { acima90++; valorAcima90 += c.valor_final || 0; }
      });
      
      const { count: acordosAtivos } = await supabase
        .from('acordos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'ativo');
      
      return {
        totalInadimplentes: associadosUnicos.size,
        totalBoletos: vencidos?.length || 0,
        valorTotal,
        acordosAtivos: acordosAtivos || 0,
        faixas: {
          de1a5: { qtd: de1a5, valor: valor1a5 },
          de6a30: { qtd: de6a30, valor: valor6a30 },
          de31a60: { qtd: de31a60, valor: valor31a60 },
          de61a90: { qtd: de61a90, valor: valor61a90 },
          acima90: { qtd: acima90, valor: valorAcima90 }
        }
      };
    }
  });

  // KPIs adicionais
  const { data: kpisExtras } = useQuery({
    queryKey: ['cobranca-kpis-extras'],
    queryFn: async () => {
      const hoje = new Date();
      const hojeStr = hoje.toISOString().split('T')[0];
      const inicioHoje = hoje.toISOString().split('T')[0] + 'T00:00:00';

      const { count: negativados } = await supabase
        .from('negativacoes')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'negativado');

      const { count: filaHoje } = await supabase
        .from('cobranca_fila')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pendente', 'em_atendimento'])
        .lte('data_agendamento', hoje.toISOString());

      const { count: contatosHoje } = await supabase
        .from('cobranca_contatos')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', inicioHoje);

      // Taxa de recuperação do mês
      const inicioMes = format(startOfMonth(hoje), 'yyyy-MM-dd');
      const fimMes = format(endOfMonth(hoje), 'yyyy-MM-dd');
      const { data: pagosNoMes } = await supabase
        .from('cobrancas')
        .select('valor_final')
        .eq('status', 'pago')
        .gte('data_pagamento', inicioMes)
        .lte('data_pagamento', fimMes);

      const valorRecuperado = pagosNoMes?.reduce((acc, c) => acc + (c.valor_final || 0), 0) || 0;

      return {
        negativados: negativados || 0,
        filaHoje: filaHoje || 0,
        contatosHoje: contatosHoje || 0,
        valorRecuperado,
      };
    }
  });

  // Fila de trabalho do dia
  const { data: filaDia } = useQuery({
    queryKey: ['cobranca-fila-dia'],
    queryFn: async () => {
      const { data } = await supabase
        .from('cobranca_fila')
        .select(`
          *,
          associado:associados(nome, telefone, whatsapp),
          cobranca:cobrancas(valor_final, data_vencimento)
        `)
        .in('status', ['pendente', 'em_atendimento'])
        .lte('data_agendamento', new Date().toISOString())
        .order('prioridade', { ascending: false })
        .order('data_agendamento')
        .limit(10);
      return data;
    }
  });

  // Últimos contatos
  const { data: ultimosContatos } = useQuery({
    queryKey: ['ultimos-contatos'],
    queryFn: async () => {
      const { data } = await supabase
        .from('cobranca_contatos')
        .select(`*, associado:associados(nome)`)
        .order('created_at', { ascending: false })
        .limit(5);
      return data;
    }
  });

  // Acordos recentes
  const { data: acordosRecentes } = useQuery({
    queryKey: ['acordos-recentes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('acordos')
        .select(`*, associado:associados(nome)`)
        .order('created_at', { ascending: false })
        .limit(5);
      return data;
    }
  });

  const totalFaixas = (estatisticas?.faixas.de1a5.qtd || 0) +
    (estatisticas?.faixas.de6a30.qtd || 0) +
    (estatisticas?.faixas.de31a60.qtd || 0) +
    (estatisticas?.faixas.de61a90.qtd || 0) +
    (estatisticas?.faixas.acima90.qtd || 0);

  const getPercentual = (qtd: number) => totalFaixas === 0 ? 0 : Math.round((qtd / totalFaixas) * 100);

  const metaContatos = 30;
  const progressoContatos = Math.min(100, ((kpisExtras?.contatosHoje || 0) / metaContatos) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Central de Cobrança</h1>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/cobranca/fila')}>Fila de Trabalho</Button>
          <Button variant="outline" onClick={() => navigate('/cobranca/acordos/novo')}>Novo Acordo</Button>
          <Button variant="outline" onClick={() => navigate('/cobranca/reguas')}>Régua de Cobrança</Button>
        </div>
      </div>

      {/* 8 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
        <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">Inadimplentes</CardTitle>
            <Users className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">
              {loadingStats ? '...' : estatisticas?.totalInadimplentes || 0}
            </div>
            <p className="text-xs text-red-600/80">associados</p>
          </CardContent>
        </Card>

        <Card className="bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Valor em Atraso</CardTitle>
            <DollarSign className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
              {loadingStats ? '...' : formatCurrency(estatisticas?.valorTotal || 0)}
            </div>
            <p className="text-xs text-yellow-600/80">total acumulado</p>
          </CardContent>
        </Card>

        <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400">Boletos Vencidos</CardTitle>
            <FileX className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">
              {loadingStats ? '...' : estatisticas?.totalBoletos || 0}
            </div>
            <p className="text-xs text-orange-600/80">boletos</p>
          </CardContent>
        </Card>

        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400">Acordos Ativos</CardTitle>
            <Handshake className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              {loadingStats ? '...' : estatisticas?.acordosAtivos || 0}
            </div>
            <p className="text-xs text-green-600/80">acordos</p>
          </CardContent>
        </Card>

        {/* Novos KPIs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Negativados</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpisExtras?.negativados || 0}</div>
            <p className="text-xs text-muted-foreground">no SPC/Serasa</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Na Fila Hoje</CardTitle>
            <ListTodo className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpisExtras?.filaHoje || 0}</div>
            <p className="text-xs text-muted-foreground">tarefas pendentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Contatos Hoje</CardTitle>
            <PhoneCall className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpisExtras?.contatosHoje || 0}<span className="text-sm font-normal text-muted-foreground">/{metaContatos}</span></div>
            <Progress value={progressoContatos} className="h-1.5 mt-1" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Recuperado Mês</CardTitle>
            <Percent className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">{formatCurrency(kpisExtras?.valorRecuperado || 0)}</div>
            <p className="text-xs text-muted-foreground">neste mês</p>
          </CardContent>
        </Card>
      </div>

      {/* KPIs de Recuperação e Gráfico */}
      <RecuperacaoKPIs />

      {/* Alertas */}
      <AlertasCobranca />

      {/* Faixas de Atraso - 5 faixas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-blue-400 cursor-pointer hover:bg-muted/50" onClick={() => navigate('/cobranca/inadimplentes?faixa=1a5')}>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">1-5 dias</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{estatisticas?.faixas.de1a5.qtd || 0}</div>
            <div className="text-sm text-muted-foreground">{formatCurrency(estatisticas?.faixas.de1a5.valor || 0)}</div>
            <div className="text-xs text-muted-foreground">{getPercentual(estatisticas?.faixas.de1a5.qtd || 0)}%</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500 cursor-pointer hover:bg-muted/50" onClick={() => navigate('/cobranca/inadimplentes?faixa=6a30')}>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">6-30 dias</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{estatisticas?.faixas.de6a30.qtd || 0}</div>
            <div className="text-sm text-muted-foreground">{formatCurrency(estatisticas?.faixas.de6a30.valor || 0)}</div>
            <div className="text-xs text-muted-foreground">{getPercentual(estatisticas?.faixas.de6a30.qtd || 0)}%</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500 cursor-pointer hover:bg-muted/50" onClick={() => navigate('/cobranca/inadimplentes?faixa=31a60')}>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">31-60 dias</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{estatisticas?.faixas.de31a60.qtd || 0}</div>
            <div className="text-sm text-muted-foreground">{formatCurrency(estatisticas?.faixas.de31a60.valor || 0)}</div>
            <div className="text-xs text-muted-foreground">{getPercentual(estatisticas?.faixas.de31a60.qtd || 0)}%</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500 cursor-pointer hover:bg-muted/50" onClick={() => navigate('/cobranca/inadimplentes?faixa=61a90')}>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">61-90 dias</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{estatisticas?.faixas.de61a90.qtd || 0}</div>
            <div className="text-sm text-muted-foreground">{formatCurrency(estatisticas?.faixas.de61a90.valor || 0)}</div>
            <div className="text-xs text-muted-foreground">{getPercentual(estatisticas?.faixas.de61a90.qtd || 0)}%</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-gray-800 cursor-pointer hover:bg-muted/50" onClick={() => navigate('/cobranca/inadimplentes?faixa=acima90')}>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">90+ dias</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{estatisticas?.faixas.acima90.qtd || 0}</div>
            <div className="text-sm text-muted-foreground">{formatCurrency(estatisticas?.faixas.acima90.valor || 0)}</div>
            <div className="text-xs text-muted-foreground">{getPercentual(estatisticas?.faixas.acima90.qtd || 0)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <DashboardGraficos />

      {/* Top Devedores */}
      <TopDevedores />

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Fila de Trabalho */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Fila de Trabalho do Dia</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/cobranca/fila')}>Ver fila completa</Button>
            </CardHeader>
            <CardContent>
              {filaDia && filaDia.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Prioridade</TableHead>
                      <TableHead>Associado</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filaDia.map((item) => {
                      const prioridade = getPrioridadeBadge(item.prioridade || 5);
                      return (
                        <TableRow key={item.id}>
                          <TableCell><Badge variant={prioridade.variant}>{prioridade.label}</Badge></TableCell>
                          <TableCell className="font-medium">{(item.associado as any)?.nome || '-'}</TableCell>
                          <TableCell>{(item.associado as any)?.whatsapp || (item.associado as any)?.telefone || '-'}</TableCell>
                          <TableCell className="text-right">{formatCurrency((item.cobranca as any)?.valor_final || 0)}</TableCell>
                          <TableCell><span className="text-sm text-muted-foreground">{getMotivoLabel(item.motivo)}</span></TableCell>
                          <TableCell><Button size="sm" variant="outline">Atender</Button></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileX className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum item na fila de trabalho para hoje</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Últimos Contatos */}
          <Card>
            <CardHeader><CardTitle>Últimos Contatos</CardTitle></CardHeader>
            <CardContent>
              {ultimosContatos && ultimosContatos.length > 0 ? (
                <div className="space-y-3">
                  {ultimosContatos.map((contato) => {
                    const resultado = getResultadoBadge(contato.resultado);
                    return (
                      <div key={contato.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                        <div className="p-2 rounded-full bg-muted">{getResultadoIcon(contato.tipo)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{(contato.associado as any)?.nome || 'Associado'}</p>
                          <p className="text-sm text-muted-foreground">{contato.tipo} • {formatDateTime(contato.created_at!)}</p>
                        </div>
                        <Badge variant={resultado.variant}>{resultado.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground"><p>Nenhum contato recente</p></div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna 3 */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Ações Rápidas</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start" variant="default"><Play className="mr-2 h-4 w-4" />Iniciar Atendimento</Button>
              <Button className="w-full justify-start" variant="outline"><Search className="mr-2 h-4 w-4" />Buscar Inadimplente</Button>
              <Button className="w-full justify-start" variant="outline"><FileText className="mr-2 h-4 w-4" />Gerar Relatório</Button>
              <Button className="w-full justify-start" variant="outline" onClick={() => navigate('/cobranca/reguas')}><Settings className="mr-2 h-4 w-4" />Configurar Régua</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Acordos Recentes</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/cobranca/acordos')}>Ver todos</Button>
            </CardHeader>
            <CardContent>
              {acordosRecentes && acordosRecentes.length > 0 ? (
                <div className="space-y-3">
                  {acordosRecentes.map((acordo) => (
                    <div key={acordo.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{(acordo.associado as any)?.nome || 'Associado'}</p>
                        <p className="text-sm text-muted-foreground">{formatCurrency(acordo.valor_acordo)}</p>
                      </div>
                      <Badge variant={acordo.status === 'ativo' ? 'default' : acordo.status === 'quitado' ? 'secondary' : acordo.status === 'quebrado' ? 'destructive' : 'outline'}>
                        {acordo.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground"><p>Nenhum acordo recente</p></div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" />Minha Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contatos hoje</span>
                  <span className="font-medium">{kpisExtras?.contatosHoje || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Acordos fechados</span>
                  <span className="font-medium">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor recuperado</span>
                  <span className="font-medium">{formatCurrency(kpisExtras?.valorRecuperado || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
