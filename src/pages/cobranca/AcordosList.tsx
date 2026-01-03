import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Handshake, Search, Filter, Eye, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAcordos } from '@/hooks/useAcordos';
import { format } from 'date-fns';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatCpf = (cpf: string) => {
  const clean = cpf?.replace(/\D/g, '') || '';
  if (clean.length !== 11) return cpf;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
};

const getStatusBadge = (status: string) => {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    'ativo': { label: 'Ativo', variant: 'default' },
    'pendente': { label: 'Aguardando Entrada', variant: 'secondary' },
    'quitado': { label: 'Quitado', variant: 'outline' },
    'quebrado': { label: 'Quebrado', variant: 'destructive' },
    'cancelado': { label: 'Cancelado', variant: 'secondary' }
  };
  return map[status] || { label: status, variant: 'secondary' as const };
};

const AcordosList = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  const { acordos, isLoading } = useAcordos(statusFilter ? { status: statusFilter } : undefined);

  // Estatísticas
  const stats = {
    ativos: acordos.filter(a => a.status === 'ativo').length,
    quitados: acordos.filter(a => a.status === 'quitado').length,
    quebrados: acordos.filter(a => a.status === 'quebrado').length,
    valorTotal: acordos.filter(a => a.status === 'ativo').reduce((acc, a) => acc + (a.valor_acordo || 0), 0)
  };

  // Filtro por busca
  const filteredAcordos = acordos.filter(a => {
    if (!search) return true;
    const termo = search.toLowerCase();
    return (
      a.numero?.toLowerCase().includes(termo) ||
      a.associado?.nome?.toLowerCase().includes(termo) ||
      a.associado?.cpf?.includes(termo)
    );
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Handshake className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Acordos</h1>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.ativos}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Quitados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats.quitados}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Quebrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{stats.quebrados}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Valor em Acordos Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(stats.valorTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, nome ou CPF..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="pendente">Aguardando Entrada</SelectItem>
                <SelectItem value="quitado">Quitados</SelectItem>
                <SelectItem value="quebrado">Quebrados</SelectItem>
                <SelectItem value="cancelado">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Associado</TableHead>
                <TableHead className="text-right">Valor Original</TableHead>
                <TableHead className="text-right">Valor Acordo</TableHead>
                <TableHead className="text-center">Parcelas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAcordos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum acordo encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredAcordos.map((acordo) => {
                  const status = getStatusBadge(acordo.status || '');
                  return (
                    <TableRow key={acordo.id}>
                      <TableCell className="font-mono font-medium">
                        {acordo.numero || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{acordo.associado?.nome}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatCpf(acordo.associado?.cpf || '')}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(acordo.valor_original)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(acordo.valor_acordo)}
                      </TableCell>
                      <TableCell className="text-center">
                        {acordo.qtd_parcelas}x de {formatCurrency(acordo.valor_parcela)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {acordo.created_at && format(new Date(acordo.created_at), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/cobranca/acordos/${acordo.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AcordosList;
