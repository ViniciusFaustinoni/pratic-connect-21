import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Download, Plus, TrendingUp, TrendingDown, Wallet, X, Receipt, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isToday, isYesterday, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { NovaMovimentacaoModal } from '@/components/financeiro/NovaMovimentacaoModal';

const categorias = [
  { value: 'todos', label: 'Todas as categorias' },
  { value: 'mensalidade', label: 'Mensalidade' },
  { value: 'adesao', label: 'Adesão' },
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

export default function Extrato() {
  const queryClient = useQueryClient();
  const [modalMovimentacao, setModalMovimentacao] = useState(false);
  
  const [filters, setFilters] = useState({
    dataInicio: startOfMonth(new Date()).toISOString().split('T')[0],
    dataFim: endOfMonth(new Date()).toISOString().split('T')[0],
    tipo: 'todos',
    categoria: 'todos',
    associado: '',
  });

  const { data: movimentacoes, isLoading } = useQuery({
    queryKey: ['movimentacoes', filters.dataInicio, filters.dataFim, filters.tipo, filters.categoria],
    queryFn: async () => {
      let query = supabase
        .from('movimentacoes_financeiras')
        .select('*')
        .order('data_movimentacao', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters.tipo && filters.tipo !== 'todos') {
        query = query.eq('tipo', filters.tipo);
      }
      if (filters.categoria && filters.categoria !== 'todos') {
        query = query.eq('categoria', filters.categoria);
      }
      if (filters.dataInicio) {
        query = query.gte('data_movimentacao', filters.dataInicio);
      }
      if (filters.dataFim) {
        query = query.lte('data_movimentacao', filters.dataFim);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;
      const movs = data ?? [];

      // Enriquecer com associado vinculado (via contrato ou direto)
      const contratoIds = Array.from(
        new Set(
          movs
            .filter((m) => m.referencia_tipo === 'contrato' && m.referencia_id)
            .map((m) => m.referencia_id as string)
        )
      );
      const associadoIdsDiretos = Array.from(
        new Set(
          movs
            .filter((m) => m.referencia_tipo === 'associado' && m.referencia_id)
            .map((m) => m.referencia_id as string)
        )
      );

      const contratoToAssociado = new Map<string, { id: string; nome: string }>();
      if (contratoIds.length > 0) {
        const { data: contratos } = await supabase
          .from('contratos')
          .select('id, associado_id, associados:associado_id (id, nome)')
          .in('id', contratoIds);
        (contratos ?? []).forEach((c: any) => {
          if (c.associados) {
            contratoToAssociado.set(c.id, { id: c.associados.id, nome: c.associados.nome });
          }
        });
      }

      const associadoMap = new Map<string, { id: string; nome: string }>();
      const associadosToFetch = Array.from(
        new Set([
          ...associadoIdsDiretos,
          ...Array.from(contratoToAssociado.values()).map((a) => a.id),
        ])
      );
      if (associadosToFetch.length > 0) {
        const { data: associados } = await supabase
          .from('associados')
          .select('id, nome')
          .in('id', associadosToFetch);
        (associados ?? []).forEach((a: any) => {
          associadoMap.set(a.id, { id: a.id, nome: a.nome });
        });
      }

      return movs.map((m) => {
        let associado: { id: string; nome: string } | null = null;
        if (m.referencia_tipo === 'contrato' && m.referencia_id) {
          const c = contratoToAssociado.get(m.referencia_id);
          if (c) associado = associadoMap.get(c.id) ?? c;
        } else if (m.referencia_tipo === 'associado' && m.referencia_id) {
          associado = associadoMap.get(m.referencia_id) ?? null;
        }
        return { ...m, associado };
      });
    }
  });

  // Filtro client-side por nome do associado
  const movimentacoesFiltradas = useMemo(() => {
    if (!movimentacoes) return undefined;
    const term = filters.associado.trim().toLowerCase();
    if (!term) return movimentacoes;
    return movimentacoes.filter((m: any) =>
      m.associado?.nome?.toLowerCase().includes(term)
    );
  }, [movimentacoes, filters.associado]);

  const resumo = useMemo(() => {
    if (!movimentacoesFiltradas) return { entradas: 0, saidas: 0, saldo: 0 };

    const entradas = movimentacoesFiltradas
      .filter((m: any) => m.tipo === 'entrada')
      .reduce((acc: number, m: any) => acc + Number(m.valor || 0), 0);

    const saidas = movimentacoesFiltradas
      .filter((m: any) => m.tipo === 'saida')
      .reduce((acc: number, m: any) => acc + Number(m.valor || 0), 0);

    return { entradas, saidas, saldo: entradas - saidas };
  }, [movimentacoesFiltradas]);

  const movimentacoesPorDia = useMemo(() => {
    if (!movimentacoesFiltradas) return {} as Record<string, any[]>;

    return movimentacoesFiltradas.reduce((acc: Record<string, any[]>, mov: any) => {
      const data = mov.data_movimentacao;
      if (!acc[data]) acc[data] = [];
      acc[data].push(mov);
      return acc;
    }, {} as Record<string, any[]>);
  }, [movimentacoesFiltradas]);

  const datasOrdenadas = useMemo(() => {
    return Object.keys(movimentacoesPorDia).sort((a, b) =>
      new Date(b).getTime() - new Date(a).getTime()
    );
  }, [movimentacoesPorDia]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDateHeader = (date: string) => {
    const parsed = parseISO(date);
    if (isToday(parsed)) return 'Hoje';
    if (isYesterday(parsed)) return 'Ontem';
    return format(parsed, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  const formatDateCell = (date: string) => {
    try {
      return format(parseISO(date), 'dd/MM/yyyy');
    } catch {
      return date;
    }
  };

  // Remove sufixo "— NOME" da descrição quando o associado já é exibido em coluna própria
  const stripAssociadoFromDescricao = (descricao: string | null, associadoNome?: string | null) => {
    if (!descricao) return '';
    if (!associadoNome) return descricao;
    return descricao.replace(/\s*[—-]\s*.+$/, '').trim() || descricao;
  };

  const getCategoriaLabel = (categoria: string) => {
    const cat = categorias.find(c => c.value === categoria);
    return cat?.label || categoria;
  };

  const limparFiltros = () => {
    setFilters({
      dataInicio: startOfMonth(new Date()).toISOString().split('T')[0],
      dataFim: endOfMonth(new Date()).toISOString().split('T')[0],
      tipo: 'todos',
      categoria: 'todos',
      associado: '',
    });
  };

  const handleExportar = () => {
    if (!movimentacoesFiltradas?.length) {
      toast.error('Nenhuma movimentação para exportar');
      return;
    }

    const headers = 'Data,Tipo,Categoria,Associado,Descrição,Valor\n';
    const rows = movimentacoesFiltradas.map((m: any) =>
      `"${m.data_movimentacao}","${m.tipo}","${m.categoria || ''}","${(m.associado?.nome || '').replace(/"/g, '""')}","${(m.descricao || '').replace(/"/g, '""')}","${m.valor}"`
    ).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extrato_${filters.dataInicio}_${filters.dataFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Extrato exportado com sucesso!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Extrato Financeiro</h1>
          <p className="text-muted-foreground">Histórico de movimentações financeiras</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportar}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button onClick={() => setModalMovimentacao(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Movimentação
          </Button>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entradas</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(resumo.entradas)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saídas</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(resumo.saidas)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo do Período</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className={`text-2xl font-bold ${resumo.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(resumo.saldo)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dataInicio">Data Início</Label>
              <Input
                id="dataInicio"
                type="date"
                value={filters.dataInicio}
                onChange={(e) => setFilters(prev => ({ ...prev, dataInicio: e.target.value }))}
                className="w-40"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dataFim">Data Fim</Label>
              <Input
                id="dataFim"
                type="date"
                value={filters.dataFim}
                onChange={(e) => setFilters(prev => ({ ...prev, dataFim: e.target.value }))}
                className="w-40"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Tipo</Label>
              <Select
                value={filters.tipo}
                onValueChange={(value) => setFilters(prev => ({ ...prev, tipo: value }))}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="entrada">Entradas</SelectItem>
                  <SelectItem value="saida">Saídas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Categoria</Label>
              <Select
                value={filters.categoria}
                onValueChange={(value) => setFilters(prev => ({ ...prev, categoria: value }))}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <Label htmlFor="associadoFiltro">Associado</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="associadoFiltro"
                  placeholder="Buscar por nome..."
                  value={filters.associado}
                  onChange={(e) => setFilters(prev => ({ ...prev, associado: e.target.value }))}
                  className="pl-8"
                />
              </div>
            </div>

            <Button variant="ghost" size="icon" onClick={limparFiltros} title="Limpar filtros">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Movimentações */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !movimentacoesFiltradas?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Receipt className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                Nenhuma movimentação encontrada
              </p>
              <p className="text-sm text-muted-foreground">
                Ajuste os filtros ou registre uma nova movimentação
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {datasOrdenadas.map((data) => (
                <div key={data}>
                  <div className="sticky top-0 bg-muted/50 px-4 py-2 rounded-md mb-2">
                    <span className="text-sm font-semibold text-muted-foreground uppercase">
                      {formatDateHeader(data)}
                    </span>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28">Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="w-[220px]">Associado</TableHead>
                        <TableHead className="w-[200px]">Categoria</TableHead>
                        <TableHead className="text-right w-32">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movimentacoesPorDia[data]?.map((mov: any) => (
                        <TableRow key={mov.id}>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDateCell(mov.data_movimentacao)}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {stripAssociadoFromDescricao(mov.descricao, mov.associado?.nome)}
                              </p>
                              {mov.observacao && (
                                <p className="text-xs text-muted-foreground">{mov.observacao}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[220px]">
                            {mov.associado ? (
                              <Link
                                to={`/cadastro/associados/${mov.associado.id}`}
                                className="text-sm text-primary hover:underline truncate block"
                                title={mov.associado.nome}
                              >
                                {mov.associado.nome}
                              </Link>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {getCategoriaLabel(mov.categoria)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`font-semibold ${mov.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                              {mov.tipo === 'entrada' ? '+' : '-'}{formatCurrency(Number(mov.valor))}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      <NovaMovimentacaoModal 
        open={modalMovimentacao} 
        onClose={() => setModalMovimentacao(false)} 
      />
    </div>
  );
}
