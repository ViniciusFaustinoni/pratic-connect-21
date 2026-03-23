import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useContaCorrenteVendedor, CCLancamento } from '@/hooks/useContaCorrenteVendedor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { formatarMoeda } from '@/utils/format';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DollarSign, Users, Loader2, Wallet, TrendingUp, Clock } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pendente: { label: 'Pendente', color: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30', variant: 'outline' },
  a_pagar: { label: 'A pagar', color: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30', variant: 'outline' },
  pago: { label: 'Pago', color: 'bg-green-500/15 text-green-600 border-green-500/30', variant: 'secondary' },
  antecipado: { label: 'Antecipado', color: 'bg-blue-500/15 text-blue-600 border-blue-500/30', variant: 'default' },
  cancelado: { label: 'Estornado', color: 'bg-red-500/15 text-red-600 border-red-500/30', variant: 'destructive' },
  em_abatimento: { label: 'Em abatimento', color: 'bg-orange-500/15 text-orange-600 border-orange-500/30', variant: 'outline' },
};

const CATEGORIA_LABELS: Record<string, string> = {
  adesao: 'Adesão',
  recorrente: 'Mensalidade',
  volante: 'Débito Volante',
  estorno: 'Estorno',
  cancelamento: 'Cancelamento',
};

function getTipoLabel(l: CCLancamento): string {
  if (l.categoria === 'adesao') return 'Adesão';
  if (l.categoria === 'recorrente' && l.parcela_numero) {
    return `Mensalidade (${l.parcela_numero}ª parcela)`;
  }
  return CATEGORIA_LABELS[l.categoria] || l.categoria;
}



// ===== ABA CONTA CORRENTE =====
function ContaCorrenteTab() {
  const { profile } = useAuth();
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [tipo, setTipo] = useState<'credito' | 'debito' | ''>('');
  const [status, setStatus] = useState('');
  const [categoria, setCategoria] = useState('');
  const [page, setPage] = useState(1);

  const vendedorId = profile?.id || '';
  const { lancamentos, totalLancamentos, isLoadingLancamentos, resumo, isLoadingResumo } = useContaCorrenteVendedor({
    vendedorId, dataInicio, dataFim, tipo, status, categoria, page, pageSize: 15,
  });

  const totalPages = Math.ceil(totalLancamentos / 15);

  return (
    <div className="space-y-4">
      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Receber (Mês)</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {isLoadingResumo ? <Loader2 className="h-5 w-5 animate-spin" /> : formatarMoeda(resumo?.a_receber_este_mes || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Já Recebido (Mês)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingResumo ? <Loader2 className="h-5 w-5 animate-spin" /> : formatarMoeda(resumo?.ja_recebido_este_mes || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingResumo ? <Loader2 className="h-5 w-5 animate-spin" /> : formatarMoeda(resumo?.total_a_receber || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Histórico Recebido</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingResumo ? <Loader2 className="h-5 w-5 animate-spin" /> : formatarMoeda(resumo?.total_historico_recebido || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Input type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); setPage(1); }} placeholder="Data início" />
            <Input type="date" value={dataFim} onChange={e => { setDataFim(e.target.value); setPage(1); }} placeholder="Data fim" />
            <Select value={tipo || 'all'} onValueChange={v => { setTipo(v === 'all' ? '' : v as any); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="credito">Crédito</SelectItem>
                <SelectItem value="debito">Débito</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status || 'all'} onValueChange={v => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="cancelado">Estornado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoria || 'all'} onValueChange={v => { setCategoria(v === 'all' ? '' : v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="adesao">Adesão</SelectItem>
                <SelectItem value="recorrente">Mensalidade</SelectItem>
                <SelectItem value="volante">Débito Volante</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="pt-4">
          {isLoadingLancamentos ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : lancamentos.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum lançamento encontrado.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lancamentos.map((l: CCLancamento) => {
                    const statusCfg = STATUS_CONFIG[l.status] || { label: l.status, color: '', variant: 'outline' as const };
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(l.data_lancamento), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>{l.descricao}</TableCell>
                        <TableCell>{getTipoLabel(l)}</TableCell>
                        <TableCell className={`text-right font-medium ${l.tipo === 'credito' ? 'text-green-600' : 'text-red-600'}`}>
                          {l.tipo === 'credito' ? '+' : '-'}{formatarMoeda(Math.abs(l.valor_liquido))}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusCfg.variant} className={statusCfg.color}>{statusCfg.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      {page > 1 && (
                        <PaginationItem>
                          <PaginationPrevious onClick={() => setPage(p => p - 1)} />
                        </PaginationItem>
                      )}
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                        <PaginationItem key={p}>
                          <PaginationLink isActive={p === page} onClick={() => setPage(p)}>{p}</PaginationLink>
                        </PaginationItem>
                      ))}
                      {page < totalPages && (
                        <PaginationItem>
                          <PaginationNext onClick={() => setPage(p => p + 1)} />
                        </PaginationItem>
                      )}
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===== DASHBOARD PRINCIPAL =====
export default function AgenciaDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Painel da Agência</h1>
        <p className="text-muted-foreground">Acompanhe sua conta corrente consolidada.</p>
      </div>

      <ContaCorrenteTab />
    </div>
  );
}