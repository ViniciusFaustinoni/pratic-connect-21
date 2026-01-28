import { useState } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Wallet, 
  Plus, 
  FileText, 
  AlertCircle, 
  ArrowRight,
  Receipt,
  CreditCard,
  List,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NovaCobrancaModal } from '@/components/financeiro/NovaCobrancaModal';
import { NovaContaPagarModal } from '@/components/financeiro/NovaContaPagarModal';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDate = (date: string) =>
  format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });

export default function FinanceiroDashboard() {
  const navigate = useNavigate();
  const [modalCobranca, setModalCobranca] = useState(false);
  const [modalDespesa, setModalDespesa] = useState(false);
  
  const mesAtual = new Date().getMonth() + 1;
  const anoAtual = new Date().getFullYear();
  const inicioMes = startOfMonth(new Date()).toISOString().split('T')[0];
  const fimMes = endOfMonth(new Date()).toISOString().split('T')[0];
  const hoje = new Date().toISOString().split('T')[0];
  const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  // Estatísticas do mês atual
  const { data: estatisticas, isLoading: loadingEstatisticas } = useQuery({
    queryKey: ['financeiro-estatisticas', mesAtual, anoAtual],
    queryFn: async () => {
      // Receitas do mês (usando asaas_cobrancas)
      const { data: cobrancas } = await supabase
        .from('asaas_cobrancas')
        .select('valor, pagamento_valor, status')
        .gte('data_vencimento', inicioMes)
        .lte('data_vencimento', fimMes);
      
      // Despesas do mês
      const { data: despesas } = await supabase
        .from('contas_pagar')
        .select('valor, valor_pago, status')
        .gte('data_vencimento', inicioMes)
        .lte('data_vencimento', fimMes);
      
      const totalFaturado = cobrancas?.reduce((acc, c) => acc + Number(c.valor || 0), 0) || 0;
      const totalRecebido = cobrancas?.reduce((acc, c) => acc + Number(c.pagamento_valor || 0), 0) || 0;
      const totalPendente = totalFaturado - totalRecebido;
      const totalDespesas = despesas?.reduce((acc, d) => acc + Number(d.valor || 0), 0) || 0;
      const totalDespesasPagas = despesas?.reduce((acc, d) => acc + Number(d.valor_pago || 0), 0) || 0;
      
      const qtdCobrancas = cobrancas?.length || 0;
      const qtdPagas = cobrancas?.filter(c => 
        c.status === 'RECEIVED' || c.status === 'CONFIRMED' || c.status === 'pago'
      ).length || 0;
      const qtdVencidas = cobrancas?.filter(c => 
        c.status === 'OVERDUE' || c.status === 'vencido'
      ).length || 0;
      
      return {
        totalFaturado,
        totalRecebido,
        totalPendente,
        totalDespesas,
        totalDespesasPagas,
        saldo: totalRecebido - totalDespesasPagas,
        qtdCobrancas,
        qtdPagas,
        qtdVencidas,
        inadimplencia: totalFaturado > 0 ? ((totalPendente / totalFaturado) * 100).toFixed(1) : '0',
      };
    }
  });

  // Cobranças vencendo hoje/amanhã
  const { data: vencendoHoje } = useQuery({
    queryKey: ['cobrancas-vencendo'],
    queryFn: async () => {
      const { data } = await supabase
        .from('asaas_cobrancas')
        .select(`
          id, valor, data_vencimento,
          associado:associados(nome, telefone)
        `)
        .in('data_vencimento', [hoje, amanha])
        .in('status', ['PENDING', 'pendente'])
        .order('data_vencimento')
        .limit(10);
      
      return data;
    }
  });

  // Últimas movimentações
  const { data: ultimasMovimentacoes } = useQuery({
    queryKey: ['ultimas-movimentacoes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('movimentacoes_financeiras')
        .select('*')
        .order('data_movimentacao', { ascending: false })
        .limit(10);
      return data;
    }
  });

  // Resumo contas a pagar
  const { data: resumoContas } = useQuery({
    queryKey: ['resumo-contas-pagar'],
    queryFn: async () => {
      const { data } = await supabase
        .from('contas_pagar')
        .select('valor, data_vencimento, status')
        .neq('status', 'pago')
        .neq('status', 'cancelado');
      
      const vencendoHoje = data?.filter(c => c.data_vencimento === hoje).length || 0;
      const vencidas = data?.filter(c => c.data_vencimento < hoje).length || 0;
      const totalPendente = data?.reduce((acc, c) => acc + Number(c.valor || 0), 0) || 0;
      
      return { vencendoHoje, vencidas, totalPendente };
    }
  });

  // Faturamento do mês
  const { data: faturamento } = useQuery({
    queryKey: ['faturamento-mes', mesAtual, anoAtual],
    queryFn: async () => {
      const { data } = await supabase
        .from('faturamentos')
        .select('*')
        .eq('referencia_mes', mesAtual)
        .eq('referencia_ano', anoAtual)
        .maybeSingle();
      return data;
    }
  });

  const mesAnoLabel = format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground capitalize">{mesAnoLabel}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/financeiro/faturamento')}>
            <FileText className="mr-2 h-4 w-4" />
            Gerar Faturamento
          </Button>
          <Button variant="outline" onClick={() => setModalCobranca(true)}>
            <Receipt className="mr-2 h-4 w-4" />
            Nova Cobrança
          </Button>
          <Button onClick={() => setModalDespesa(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Despesa
          </Button>
        </div>
      </div>

      {/* Cards KPI */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faturado</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(estatisticas?.totalFaturado || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {estatisticas?.qtdCobrancas || 0} cobranças
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recebido</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(estatisticas?.totalRecebido || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {estatisticas?.qtdPagas || 0} pagas
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Receber</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(estatisticas?.totalPendente || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {estatisticas?.qtdVencidas || 0} vencidas
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Despesas</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(estatisticas?.totalDespesas || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(estatisticas?.totalDespesasPagas || 0)} pagas
            </p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${(estatisticas?.saldo || 0) >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo</CardTitle>
            <Wallet className={`h-4 w-4 ${(estatisticas?.saldo || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(estatisticas?.saldo || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(estatisticas?.saldo || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Receitas - Despesas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Linha de Métricas */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{estatisticas?.qtdCobrancas || 0}</div>
              <p className="text-sm text-muted-foreground">Total de Cobranças</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {estatisticas?.qtdPagas || 0}
                <span className="ml-1 text-lg font-normal text-muted-foreground">
                  ({estatisticas?.qtdCobrancas ? ((estatisticas.qtdPagas / estatisticas.qtdCobrancas) * 100).toFixed(0) : 0}%)
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Pagas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{estatisticas?.qtdVencidas || 0}</div>
              <p className="text-sm text-muted-foreground">Vencidas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">{estatisticas?.inadimplencia || 0}%</div>
              <p className="text-sm text-muted-foreground">Taxa de Inadimplência</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid Principal */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coluna 1-2 */}
        <div className="space-y-6 lg:col-span-2">
          {/* Vencendo Hoje/Amanhã */}
          {vencendoHoje && vencendoHoje.length > 0 && (
            <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-yellow-800 dark:text-yellow-200">
                    {vencendoHoje.length} cobrança(s) vencendo hoje/amanhã
                  </span>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="text-yellow-700"
                    onClick={() => navigate('/financeiro/cobrancas?status=pendente')}
                  >
                    Ver todas <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
                <div className="mt-2 space-y-1">
                  {vencendoHoje.slice(0, 3).map((cobranca: any) => (
                    <div key={cobranca.id} className="flex items-center justify-between text-sm">
                      <span>{cobranca.associado?.nome || 'N/A'}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatCurrency(Number(cobranca.valor))}</span>
                        <Badge variant="outline" className="text-xs">
                          {cobranca.data_vencimento === hoje ? 'Hoje' : 'Amanhã'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Últimas Movimentações */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Últimas Movimentações</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/financeiro/extrato')}>
                Ver extrato completo <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {ultimasMovimentacoes && ultimasMovimentacoes.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ultimasMovimentacoes.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell>{formatDate(mov.data_movimentacao)}</TableCell>
                        <TableCell>
                          <Badge variant={mov.tipo === 'entrada' ? 'default' : 'destructive'}>
                            {mov.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{mov.descricao}</TableCell>
                        <TableCell className={`text-right font-medium ${mov.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                          {mov.tipo === 'entrada' ? '+' : '-'}{formatCurrency(Number(mov.valor))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  Nenhuma movimentação registrada
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gráfico Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle>Gráfico de Recebimentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-48 items-center justify-center rounded-lg border border-dashed bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  Gráfico de recebimentos por dia (em breve)
                </p>
              </div>
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
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/financeiro/faturamento')}
              >
                <FileText className="mr-2 h-4 w-4" />
                Gerar Faturamento Mensal
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/financeiro/cobrancas?status=pendente')}
              >
                <Receipt className="mr-2 h-4 w-4" />
                Ver Cobranças Pendentes
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/financeiro/contas-pagar')}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Ver Contas a Pagar
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/financeiro/extratos-bancarios')}
              >
                <List className="mr-2 h-4 w-4" />
                Conciliação Bancária
              </Button>
            </CardContent>
          </Card>

          {/* Resumo Contas a Pagar */}
          <Card>
            <CardHeader>
              <CardTitle>Resumo Contas a Pagar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Vencendo hoje</span>
                <Badge variant="outline">{resumoContas?.vencendoHoje || 0}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Vencidas</span>
                <Badge variant="destructive">{resumoContas?.vencidas || 0}</Badge>
              </div>
              <div className="border-t pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Pendente</span>
                  <span className="font-bold text-red-600">
                    {formatCurrency(resumoContas?.totalPendente || 0)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Faturamento Atual */}
          <Card>
            <CardHeader>
              <CardTitle>Faturamento Atual</CardTitle>
            </CardHeader>
            <CardContent>
              {faturamento ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={faturamento.status === 'fechado' ? 'default' : 'secondary'}>
                      {faturamento.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Cobranças</span>
                    <span className="font-medium">{faturamento.total_cobrancas || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Valor Total</span>
                    <span className="font-bold">{formatCurrency(Number(faturamento.valor_total) || 0)}</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => navigate('/financeiro/faturamento')}
                  >
                    Gerenciar
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Nenhum faturamento gerado para {format(new Date(), 'MMMM/yyyy', { locale: ptBR })}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => navigate('/financeiro/faturamento')}
                  >
                    Gerar Faturamento
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modais */}
      <NovaCobrancaModal 
        open={modalCobranca} 
        onClose={() => setModalCobranca(false)} 
      />
      <NovaContaPagarModal 
        open={modalDespesa} 
        onClose={() => setModalDespesa(false)} 
      />
    </div>
  );
}
