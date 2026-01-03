import { useState, useMemo } from 'react';
import { Plus, DollarSign, AlertTriangle, CheckCircle, Calendar, Search, 
         X, Eye, MoreHorizontal, Clock, Banknote } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, isToday, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const categorias = [
  { value: 'todos', label: 'Todas as categorias' },
  { value: 'prestador_assistencia', label: 'Prestador Assistência' },
  { value: 'oficina', label: 'Oficina' },
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'folha_pagamento', label: 'Folha de Pagamento' },
  { value: 'impostos', label: 'Impostos' },
  { value: 'aluguel', label: 'Aluguel' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'outros', label: 'Outros' },
];

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  'pendente': { label: 'Pendente', variant: 'secondary' },
  'aprovado': { label: 'Aprovado', variant: 'outline' },
  'pago': { label: 'Pago', variant: 'default' },
  'cancelado': { label: 'Cancelado', variant: 'outline' },
};

const categoriaConfig: Record<string, { label: string }> = {
  'prestador_assistencia': { label: 'Prestador' },
  'oficina': { label: 'Oficina' },
  'fornecedor': { label: 'Fornecedor' },
  'folha_pagamento': { label: 'Folha' },
  'impostos': { label: 'Impostos' },
  'aluguel': { label: 'Aluguel' },
  'servicos': { label: 'Serviços' },
  'marketing': { label: 'Marketing' },
  'outros': { label: 'Outros' },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDate = (date: string) =>
  format(parseISO(date), 'dd/MM/yyyy', { locale: ptBR });

const formatDocumento = (doc: string | null) => {
  if (!doc) return '';
  const clean = doc.replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else if (clean.length === 14) {
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return doc;
};

export default function ContasPagar() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    status: 'todos',
    categoria: 'todos',
    busca: '',
  });
  const [activeTab, setActiveTab] = useState('todas');

  const hoje = new Date().toISOString().split('T')[0];

  // Query principal - Contas
  const { data: contas, isLoading } = useQuery({
    queryKey: ['contas-pagar', filters.status, filters.categoria],
    queryFn: async () => {
      let query = supabase
        .from('contas_pagar')
        .select('*')
        .order('data_vencimento', { ascending: true });
      
      if (filters.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      }
      if (filters.categoria && filters.categoria !== 'todos') {
        query = query.eq('categoria', filters.categoria);
      }
      
      const { data, error } = await query.limit(500);
      if (error) throw error;
      return data;
    }
  });

  // Query KPIs
  const { data: kpis } = useQuery({
    queryKey: ['contas-pagar-kpis'],
    queryFn: async () => {
      const inicioMes = startOfMonth(new Date()).toISOString().split('T')[0];
      const fimMes = endOfMonth(new Date()).toISOString().split('T')[0];
      
      const { data } = await supabase
        .from('contas_pagar')
        .select('valor, valor_pago, data_vencimento, status, data_pagamento');
      
      const pendentes = data?.filter(c => c.status === 'pendente' || c.status === 'aprovado') || [];
      const vencendoHoje = pendentes.filter(c => c.data_vencimento === hoje);
      const vencidas = data?.filter(c => 
        (c.status === 'pendente' || c.status === 'aprovado') && c.data_vencimento < hoje
      ) || [];
      const pagasNoMes = data?.filter(c => 
        c.status === 'pago' && c.data_pagamento && c.data_pagamento >= inicioMes && c.data_pagamento <= fimMes
      ) || [];
      
      return {
        totalPendente: pendentes.reduce((acc, c) => acc + Number(c.valor || 0), 0),
        qtdVencendoHoje: vencendoHoje.length,
        qtdVencidas: vencidas.length,
        valorVencidas: vencidas.reduce((acc, c) => acc + Number(c.valor || 0), 0),
        valorPagoMes: pagasNoMes.reduce((acc, c) => acc + Number(c.valor_pago || 0), 0),
      };
    }
  });

  // Helpers para verificar status
  const isVencido = (conta: any) => {
    return (conta.status === 'pendente' || conta.status === 'aprovado') && conta.data_vencimento < hoje;
  };

  const isVencendoHoje = (dataVencimento: string) => {
    return isToday(parseISO(dataVencimento));
  };

  const getRowClass = (conta: any) => {
    if (isVencido(conta)) return 'bg-destructive/5';
    if (isVencendoHoje(conta.data_vencimento) && conta.status !== 'pago') {
      return 'bg-yellow-50 dark:bg-yellow-900/10';
    }
    return '';
  };

  // Filtragem client-side
  const filteredContas = useMemo(() => {
    if (!contas) return [];
    
    let result = contas;

    // Filtro por busca
    if (filters.busca) {
      const busca = filters.busca.toLowerCase();
      result = result.filter(c => 
        c.fornecedor_nome?.toLowerCase().includes(busca) ||
        c.fornecedor_documento?.includes(busca)
      );
    }

    // Filtro por tab
    if (activeTab !== 'todas') {
      if (activeTab === 'vencidas') {
        result = result.filter(c => 
          (c.status === 'pendente' || c.status === 'aprovado') && 
          c.data_vencimento < hoje
        );
      } else if (activeTab === 'pendentes') {
        result = result.filter(c => c.status === 'pendente' || c.status === 'aprovado');
      } else {
        result = result.filter(c => c.status === activeTab);
      }
    }

    return result;
  }, [contas, filters.busca, activeTab, hoje]);

  // Contadores para tabs
  const tabCounts = useMemo(() => {
    if (!contas) return { todas: 0, pendentes: 0, vencidas: 0, pago: 0, cancelado: 0 };
    
    return {
      todas: contas.length,
      pendentes: contas.filter(c => c.status === 'pendente' || c.status === 'aprovado').length,
      vencidas: contas.filter(c => 
        (c.status === 'pendente' || c.status === 'aprovado') && c.data_vencimento < hoje
      ).length,
      pago: contas.filter(c => c.status === 'pago').length,
      cancelado: contas.filter(c => c.status === 'cancelado').length,
    };
  }, [contas, hoje]);

  const handleRegistrarPagamento = (conta: any) => {
    toast.info('Modal de pagamento será implementado em breve');
  };

  const handleCancelar = (conta: any) => {
    toast.info('Funcionalidade de cancelamento será implementada em breve');
  };

  const limparFiltros = () => {
    setFilters({ status: 'todos', categoria: 'todos', busca: '' });
    setActiveTab('todas');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas a Pagar</h1>
          <p className="text-muted-foreground">Gerenciamento de despesas e pagamentos</p>
        </div>
        <Button onClick={() => toast.info('Modal de nova conta será implementado em breve')}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Conta
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Pendente</p>
                <p className="text-2xl font-bold">
                  {kpis ? formatCurrency(kpis.totalPendente) : <Skeleton className="h-8 w-24" />}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vencendo Hoje</p>
                <p className="text-2xl font-bold">
                  {kpis ? `${kpis.qtdVencendoHoje} contas` : <Skeleton className="h-8 w-20" />}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vencidas</p>
                <p className="text-2xl font-bold">
                  {kpis ? (
                    <>
                      {kpis.qtdVencidas} <span className="text-sm font-normal text-muted-foreground">({formatCurrency(kpis.valorVencidas)})</span>
                    </>
                  ) : <Skeleton className="h-8 w-32" />}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pagas no Mês</p>
                <p className="text-2xl font-bold">
                  {kpis ? formatCurrency(kpis.valorPagoMes) : <Skeleton className="h-8 w-24" />}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por fornecedor..."
                value={filters.busca}
                onChange={(e) => setFilters(prev => ({ ...prev, busca: e.target.value }))}
                className="pl-9"
              />
            </div>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.categoria}
              onValueChange={(value) => setFilters(prev => ({ ...prev, categoria: value }))}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                {categorias.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(filters.busca || filters.status !== 'todos' || filters.categoria !== 'todos') && (
              <Button variant="ghost" onClick={limparFiltros}>
                <X className="mr-2 h-4 w-4" />
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="todas">
            Todas ({tabCounts.todas})
          </TabsTrigger>
          <TabsTrigger value="pendentes">
            Pendentes ({tabCounts.pendentes})
          </TabsTrigger>
          <TabsTrigger value="vencidas">
            Vencidas ({tabCounts.vencidas})
          </TabsTrigger>
          <TabsTrigger value="pago">
            Pagas ({tabCounts.pago})
          </TabsTrigger>
          <TabsTrigger value="cancelado">
            Canceladas ({tabCounts.cancelado})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : filteredContas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Banknote className="h-8 w-8" />
                      <p>Nenhuma conta encontrada</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredContas.map((conta) => (
                  <TableRow key={conta.id} className={getRowClass(conta)}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{conta.fornecedor_nome}</p>
                        {conta.fornecedor_documento && (
                          <p className="text-sm text-muted-foreground">
                            {formatDocumento(conta.fornecedor_documento)}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {categoriaConfig[conta.categoria]?.label || conta.categoria}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(conta.valor))}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {isVencido(conta) && (
                          <AlertTriangle className="h-4 w-4 text-destructive" />
                        )}
                        {formatDate(conta.data_vencimento)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isVencido(conta) ? (
                        <Badge variant="destructive">Vencido</Badge>
                      ) : (
                        <Badge variant={statusConfig[conta.status]?.variant || 'secondary'}>
                          {statusConfig[conta.status]?.label || conta.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {conta.status !== 'pago' && conta.status !== 'cancelado' && (
                            <DropdownMenuItem onClick={() => handleRegistrarPagamento(conta)}>
                              <DollarSign className="mr-2 h-4 w-4" />
                              Registrar Pagamento
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => navigate(`/financeiro/contas-pagar/${conta.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          {conta.status !== 'pago' && conta.status !== 'cancelado' && (
                            <DropdownMenuItem 
                              onClick={() => handleCancelar(conta)}
                              className="text-destructive"
                            >
                              <X className="mr-2 h-4 w-4" />
                              Cancelar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
