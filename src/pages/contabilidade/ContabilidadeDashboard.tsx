import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  BookOpen, 
  TrendingUp, 
  TrendingDown, 
  Calculator,
  FileText,
  BarChart3,
  Plus,
  Lock,
  Unlock,
  Calendar,
  ChevronRight,
  AlertTriangle,
  FolderTree,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ContabilidadeDashboard() {
  const navigate = useNavigate();
  const now = new Date();
  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();

  // Fechamento do período atual
  const { data: fechamento } = useQuery({
    queryKey: ['fechamento-periodo', mesAtual, anoAtual],
    queryFn: async () => {
      const { data } = await supabase
        .from('fechamentos_contabeis')
        .select('*')
        .eq('mes', mesAtual)
        .eq('ano', anoAtual)
        .maybeSingle();
      return data;
    }
  });

  // Verificar período anterior não fechado
  const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1;
  const anoAnterior = mesAtual === 1 ? anoAtual - 1 : anoAtual;

  const { data: periodoAnteriorAberto } = useQuery({
    queryKey: ['periodo-anterior-aberto', mesAnterior, anoAnterior],
    queryFn: async () => {
      const { data } = await supabase
        .from('fechamentos_contabeis')
        .select('*')
        .eq('mes', mesAnterior)
        .eq('ano', anoAnterior)
        .eq('status', 'fechado')
        .maybeSingle();
      return !data; // true se NÃO existe fechamento
    }
  });

  // Totais do período
  const { data: totaisPeriodo } = useQuery({
    queryKey: ['totais-contabeis', mesAtual, anoAtual],
    queryFn: async () => {
      const inicioMes = `${anoAtual}-${String(mesAtual).padStart(2, '0')}-01`;
      const proximoMes = mesAtual === 12 ? 1 : mesAtual + 1;
      const anoProximoMes = mesAtual === 12 ? anoAtual + 1 : anoAtual;
      const fimMes = `${anoProximoMes}-${String(proximoMes).padStart(2, '0')}-01`;

      // Buscar todas as partidas do período
      const { data: partidas } = await supabase
        .from('lancamentos_partidas')
        .select(`
          tipo,
          valor,
          conta:plano_contas!inner(tipo),
          lancamento:lancamentos_contabeis!inner(data_competencia, status)
        `)
        .eq('lancamento.status', 'ativo')
        .gte('lancamento.data_competencia', inicioMes)
        .lt('lancamento.data_competencia', fimMes);

      let totalReceitas = 0;
      let totalDespesas = 0;

      partidas?.forEach((partida: any) => {
        if (partida.conta?.tipo === 'receita' && partida.tipo === 'credito') {
          totalReceitas += partida.valor;
        }
        if (partida.conta?.tipo === 'despesa' && partida.tipo === 'debito') {
          totalDespesas += partida.valor;
        }
      });

      return {
        receitas: totalReceitas,
        despesas: totalDespesas,
        resultado: totalReceitas - totalDespesas
      };
    }
  });

  // Últimos lançamentos com partidas
  const { data: ultimosLancamentos, isLoading: lancamentosLoading } = useQuery({
    queryKey: ['ultimos-lancamentos'],
    queryFn: async () => {
      const { data } = await supabase
        .from('lancamentos_contabeis')
        .select(`
          *,
          partidas:lancamentos_partidas(
            tipo, 
            valor,
            conta:plano_contas(codigo, descricao)
          )
        `)
        .eq('status', 'ativo')
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    }
  });

  // Períodos anteriores (últimos 3 meses)
  const { data: periodosAnteriores } = useQuery({
    queryKey: ['periodos-anteriores'],
    queryFn: async () => {
      const periodos = [];
      for (let i = 1; i <= 3; i++) {
        const m = mesAtual - i <= 0 ? 12 + (mesAtual - i) : mesAtual - i;
        const a = mesAtual - i <= 0 ? anoAtual - 1 : anoAtual;
        periodos.push({ mes: m, ano: a });
      }

      const { data } = await supabase
        .from('fechamentos_contabeis')
        .select('*')
        .or(periodos.map(p => `and(mes.eq.${p.mes},ano.eq.${p.ano})`).join(','));

      return periodos.map(p => {
        const fechamento = data?.find(f => f.mes === p.mes && f.ano === p.ano);
        return {
          ...p,
          status: fechamento?.status || 'aberto'
        };
      });
    }
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatMesAno = (mes: number, ano: number) => {
    return format(new Date(ano, mes - 1), "MMMM 'de' yyyy", { locale: ptBR });
  };

  const calcularTotaisPartidas = (partidas: any[]) => {
    let debito = 0;
    let credito = 0;
    partidas?.forEach(p => {
      if (p.tipo === 'debito') debito += p.valor;
      if (p.tipo === 'credito') credito += p.valor;
    });
    return { debito, credito };
  };

  const statusPeriodo = fechamento?.status || 'aberto';
  const qtdLancamentos = ultimosLancamentos?.length || 0;
  const ultimoLancamento = ultimosLancamentos?.[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Contabilidade
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-muted-foreground capitalize">
              {formatMesAno(mesAtual, anoAtual)}
            </p>
            <Badge 
              variant={statusPeriodo === 'fechado' ? 'secondary' : 'outline'}
              className={statusPeriodo === 'fechado' 
                ? 'bg-muted text-muted-foreground' 
                : 'border-green-500 text-green-600'
              }
            >
              {statusPeriodo === 'fechado' ? (
                <><Lock className="h-3 w-3 mr-1" /> Fechado</>
              ) : (
                <><Unlock className="h-3 w-3 mr-1" /> Aberto</>
              )}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => navigate('/contabilidade/lancamentos/novo')}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Lançamento
          </Button>
          <Button variant="outline" onClick={() => navigate('/contabilidade/fechamentos')}>
            <Calendar className="h-4 w-4 mr-2" />
            Fechamento Mensal
          </Button>
        </div>
      </div>

      {/* Alerta Período Anterior */}
      {periodoAnteriorAberto && (
        <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-yellow-800 dark:text-yellow-200">
              O período anterior ({format(new Date(anoAnterior, mesAnterior - 1), 'MMMM/yyyy', { locale: ptBR })}) ainda não foi fechado.
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              className="border-yellow-500 text-yellow-700 hover:bg-yellow-100"
              onClick={() => navigate('/contabilidade/fechamentos')}
            >
              Fechar período
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receitas
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totaisPeriodo?.receitas || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Despesas
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totaisPeriodo?.despesas || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${(totaisPeriodo?.resultado || 0) >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Resultado
            </CardTitle>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
              (totaisPeriodo?.resultado || 0) >= 0 
                ? 'bg-green-100 dark:bg-green-900/30' 
                : 'bg-red-100 dark:bg-red-900/30'
            }`}>
              <Calculator className={`h-4 w-4 ${(totaisPeriodo?.resultado || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(totaisPeriodo?.resultado || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totaisPeriodo?.resultado || 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lançamentos
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <FileText className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {qtdLancamentos}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid Principal */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coluna 1-2 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Últimos Lançamentos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Últimos Lançamentos</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link to="/contabilidade/lancamentos">Ver todos</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {lancamentosLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando...
                </div>
              ) : !ultimosLancamentos || ultimosLancamentos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum lançamento encontrado
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Histórico</TableHead>
                        <TableHead className="text-right">Débito</TableHead>
                        <TableHead className="text-right">Crédito</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ultimosLancamentos.map((lancamento: any) => {
                        const totais = calcularTotaisPartidas(lancamento.partidas || []);
                        return (
                          <TableRow 
                            key={lancamento.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => navigate(`/contabilidade/lancamentos/${lancamento.id}`)}
                          >
                            <TableCell className="font-mono text-sm">
                              {lancamento.numero}
                            </TableCell>
                            <TableCell>
                              {format(new Date(lancamento.data_competencia), 'dd/MM/yyyy')}
                            </TableCell>
                            <TableCell className="max-w-[300px] truncate">
                              {lancamento.historico}
                            </TableCell>
                            <TableCell className="text-right font-medium text-red-600">
                              {formatCurrency(totais.debito)}
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-600">
                              {formatCurrency(totais.credito)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resultado por Categoria */}
          <Card>
            <CardHeader>
              <CardTitle>Resultado por Categoria</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
                <p>Despesas por categoria do mês</p>
                <p className="text-sm">(Gráfico em desenvolvimento)</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna 3 - Sidebar */}
        <div className="space-y-6">
          {/* Ações Rápidas */}
          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/contabilidade/lancamentos/novo')}
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Lançamento
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/contabilidade/balancete')}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Ver Balancete
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/contabilidade/dre')}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Ver DRE
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/contabilidade/plano-contas')}
              >
                <FolderTree className="h-4 w-4 mr-2" />
                Plano de Contas
              </Button>
            </CardContent>
          </Card>

          {/* Status do Período */}
          <Card>
            <CardHeader>
              <CardTitle>Status do Período</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Período</span>
                <span className="font-medium capitalize">
                  {format(new Date(anoAtual, mesAtual - 1), 'MMM/yyyy', { locale: ptBR })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Lançamentos</span>
                <span className="font-medium">{qtdLancamentos}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Último lançamento</span>
                <span className="font-medium">
                  {ultimoLancamento 
                    ? format(new Date(ultimoLancamento.created_at), 'dd/MM/yyyy')
                    : '-'
                  }
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge 
                  variant={statusPeriodo === 'fechado' ? 'secondary' : 'default'}
                  className={statusPeriodo === 'fechado' 
                    ? '' 
                    : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  }
                >
                  {statusPeriodo === 'fechado' ? 'Fechado' : 'Aberto'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Períodos Anteriores */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Períodos Anteriores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {periodosAnteriores?.map((periodo, index) => (
                <div 
                  key={index}
                  className="flex justify-between items-center p-2 rounded-md hover:bg-muted/50"
                >
                  <span className="text-sm capitalize">
                    {format(new Date(periodo.ano, periodo.mes - 1), 'MMMM/yyyy', { locale: ptBR })}
                  </span>
                  <Badge 
                    variant={periodo.status === 'fechado' ? 'secondary' : 'outline'}
                    className={periodo.status === 'fechado' 
                      ? '' 
                      : 'border-yellow-500 text-yellow-600'
                    }
                  >
                    {periodo.status === 'fechado' ? 'Fechado' : 'Aberto'}
                  </Badge>
                </div>
              ))}
              <Button 
                variant="ghost" 
                className="w-full justify-between text-muted-foreground"
                onClick={() => navigate('/contabilidade/fechamentos')}
              >
                Ver histórico
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
