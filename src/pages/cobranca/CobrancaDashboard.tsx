import { Users, DollarSign, FileX, Handshake, Phone, MessageSquare, Mail, Play, Search, FileText, Settings, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDate = (date: string) =>
  format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });

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
      
      // Total de boletos vencidos
      const { data: vencidos } = await supabase
        .from('cobrancas')
        .select('associado_id, valor_final, data_vencimento')
        .eq('status', 'vencido')
        .lt('data_vencimento', hoje);
      
      // Agrupar por associado
      const associadosUnicos = new Set(vencidos?.map(i => i.associado_id) || []);
      const valorTotal = vencidos?.reduce((acc, c) => acc + (c.valor_final || 0), 0) || 0;
      
      // Calcular faixas de atraso
      const hojeDate = new Date();
      let ate30 = 0, de31a60 = 0, de61a90 = 0, acima90 = 0;
      let valorAte30 = 0, valor31a60 = 0, valor61a90 = 0, valorAcima90 = 0;
      
      vencidos?.forEach(c => {
        const dias = Math.floor((hojeDate.getTime() - new Date(c.data_vencimento).getTime()) / (1000 * 60 * 60 * 24));
        if (dias <= 30) { ate30++; valorAte30 += c.valor_final || 0; }
        else if (dias <= 60) { de31a60++; valor31a60 += c.valor_final || 0; }
        else if (dias <= 90) { de61a90++; valor61a90 += c.valor_final || 0; }
        else { acima90++; valorAcima90 += c.valor_final || 0; }
      });
      
      // Acordos ativos
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
          ate30: { qtd: ate30, valor: valorAte30 },
          de31a60: { qtd: de31a60, valor: valor31a60 },
          de61a90: { qtd: de61a90, valor: valor61a90 },
          acima90: { qtd: acima90, valor: valorAcima90 }
        }
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

  // Acordos recentes
  const { data: acordosRecentes } = useQuery({
    queryKey: ['acordos-recentes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('acordos')
        .select(`
          *,
          associado:associados(nome)
        `)
        .order('created_at', { ascending: false })
        .limit(5);
      return data;
    }
  });

  // Últimos contatos
  const { data: ultimosContatos } = useQuery({
    queryKey: ['ultimos-contatos'],
    queryFn: async () => {
      const { data } = await supabase
        .from('cobranca_contatos')
        .select(`
          *,
          associado:associados(nome)
        `)
        .order('created_at', { ascending: false })
        .limit(5);
      return data;
    }
  });

  const totalFaixas = (estatisticas?.faixas.ate30.qtd || 0) +
    (estatisticas?.faixas.de31a60.qtd || 0) +
    (estatisticas?.faixas.de61a90.qtd || 0) +
    (estatisticas?.faixas.acima90.qtd || 0);

  const getPercentual = (qtd: number) => {
    if (totalFaixas === 0) return 0;
    return Math.round((qtd / totalFaixas) * 100);
  };

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
          <Button variant="outline" onClick={() => navigate('/cobranca/fila')}>
            Fila de Trabalho
          </Button>
          <Button variant="outline" onClick={() => navigate('/cobranca/acordos/novo')}>
            Novo Acordo
          </Button>
          <Button variant="outline" onClick={() => navigate('/cobranca/reguas')}>
            Régua de Cobrança
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">Inadimplentes</CardTitle>
            <Users className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">
              {loadingStats ? '...' : estatisticas?.totalInadimplentes || 0}
            </div>
            <p className="text-xs text-red-600/80 dark:text-red-400/80">associados</p>
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
            <p className="text-xs text-yellow-600/80 dark:text-yellow-400/80">total acumulado</p>
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
            <p className="text-xs text-orange-600/80 dark:text-orange-400/80">boletos</p>
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
            <p className="text-xs text-green-600/80 dark:text-green-400/80">acordos</p>
          </CardContent>
        </Card>
      </div>

      {/* Faixas de Atraso */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Até 30 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{estatisticas?.faixas.ate30.qtd || 0} boletos</div>
            <div className="text-sm text-muted-foreground">{formatCurrency(estatisticas?.faixas.ate30.valor || 0)}</div>
            <div className="text-xs text-muted-foreground mt-1">{getPercentual(estatisticas?.faixas.ate30.qtd || 0)}% do total</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">31-60 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{estatisticas?.faixas.de31a60.qtd || 0} boletos</div>
            <div className="text-sm text-muted-foreground">{formatCurrency(estatisticas?.faixas.de31a60.valor || 0)}</div>
            <div className="text-xs text-muted-foreground mt-1">{getPercentual(estatisticas?.faixas.de31a60.qtd || 0)}% do total</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">61-90 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{estatisticas?.faixas.de61a90.qtd || 0} boletos</div>
            <div className="text-sm text-muted-foreground">{formatCurrency(estatisticas?.faixas.de61a90.valor || 0)}</div>
            <div className="text-xs text-muted-foreground mt-1">{getPercentual(estatisticas?.faixas.de61a90.qtd || 0)}% do total</div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">+90 dias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{estatisticas?.faixas.acima90.qtd || 0} boletos</div>
            <div className="text-sm text-muted-foreground">{formatCurrency(estatisticas?.faixas.acima90.valor || 0)}</div>
            <div className="text-xs text-muted-foreground mt-1">{getPercentual(estatisticas?.faixas.acima90.qtd || 0)}% do total</div>
          </CardContent>
        </Card>
      </div>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1-2 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Fila de Trabalho */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Fila de Trabalho do Dia</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/cobranca/fila')}>
                Ver fila completa
              </Button>
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
                          <TableCell>
                            <Badge variant={prioridade.variant}>{prioridade.label}</Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {(item.associado as any)?.nome || '-'}
                          </TableCell>
                          <TableCell>
                            {(item.associado as any)?.whatsapp || (item.associado as any)?.telefone || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency((item.cobranca as any)?.valor_final || 0)}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {getMotivoLabel(item.motivo)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline">
                              Atender
                            </Button>
                          </TableCell>
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
            <CardHeader>
              <CardTitle>Últimos Contatos</CardTitle>
            </CardHeader>
            <CardContent>
              {ultimosContatos && ultimosContatos.length > 0 ? (
                <div className="space-y-3">
                  {ultimosContatos.map((contato) => {
                    const resultado = getResultadoBadge(contato.resultado);
                    return (
                      <div key={contato.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                        <div className="p-2 rounded-full bg-muted">
                          {getResultadoIcon(contato.tipo)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {(contato.associado as any)?.nome || 'Associado'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {contato.tipo} • {formatDateTime(contato.created_at!)}
                          </p>
                        </div>
                        <Badge variant={resultado.variant}>{resultado.label}</Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p>Nenhum contato recente</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna 3 */}
        <div className="space-y-6">
          {/* Ações Rápidas */}
          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start" variant="default">
                <Play className="mr-2 h-4 w-4" />
                Iniciar Atendimento
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Search className="mr-2 h-4 w-4" />
                Buscar Inadimplente
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <FileText className="mr-2 h-4 w-4" />
                Gerar Relatório
              </Button>
              <Button className="w-full justify-start" variant="outline" onClick={() => navigate('/cobranca/reguas')}>
                <Settings className="mr-2 h-4 w-4" />
                Configurar Régua
              </Button>
            </CardContent>
          </Card>

          {/* Acordos Recentes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Acordos Recentes</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/cobranca/acordos')}>
                Ver todos
              </Button>
            </CardHeader>
            <CardContent>
              {acordosRecentes && acordosRecentes.length > 0 ? (
                <div className="space-y-3">
                  {acordosRecentes.map((acordo) => (
                    <div key={acordo.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {(acordo.associado as any)?.nome || 'Associado'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(acordo.valor_acordo)}
                        </p>
                      </div>
                      <Badge variant={
                        acordo.status === 'ativo' ? 'default' :
                        acordo.status === 'quitado' ? 'secondary' :
                        acordo.status === 'quebrado' ? 'destructive' : 'outline'
                      }>
                        {acordo.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <p>Nenhum acordo recente</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Minha Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Minha Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contatos hoje</span>
                  <span className="font-medium">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Acordos fechados</span>
                  <span className="font-medium">0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor recuperado</span>
                  <span className="font-medium">{formatCurrency(0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
