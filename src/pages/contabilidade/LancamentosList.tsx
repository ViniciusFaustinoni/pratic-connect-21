import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Eye, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EstornoDialog } from '@/components/contabilidade';
import { useLancamentos } from '@/hooks/useContabilidade';
import { format } from 'date-fns';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const calcularTotais = (partidas: Array<{ tipo: string; valor: number }> | null) => {
  if (!partidas) return { debito: 0, credito: 0 };
  const debito = partidas
    .filter((p) => p.tipo === 'debito')
    .reduce((acc, p) => acc + Number(p.valor), 0);
  const credito = partidas
    .filter((p) => p.tipo === 'credito')
    .reduce((acc, p) => acc + Number(p.valor), 0);
  return { debito, credito };
};

export default function LancamentosList() {
  const [filtros, setFiltros] = useState({
    dataInicio: '',
    dataFim: '',
    origem: '',
    status: '',
  });
  const [estornoDialog, setEstornoDialog] = useState<{ open: boolean; id: string; numero: string }>({
    open: false,
    id: '',
    numero: '',
  });

  const { data: lancamentos, isLoading } = useLancamentos(filtros);

  const statusColors: Record<string, string> = {
    ativo: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    rascunho: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    estornado: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    fechado: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  };

  const origemColors: Record<string, string> = {
    manual: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    cobranca: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    pagamento: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    sinistro: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    oficina: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    acordo: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    folha: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
    fechamento: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
  };

  const origemLabels: Record<string, string> = {
    manual: 'Manual',
    cobranca: 'Cobrança',
    pagamento: 'Pagamento',
    acordo: 'Acordo',
    sinistro: 'Sinistro',
    oficina: 'Oficina',
    folha: 'Folha',
    fechamento: 'Fechamento',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lançamentos Contábeis</h1>
          <p className="text-muted-foreground">
            Visualize e gerencie os lançamentos contábeis
          </p>
        </div>
        <Button asChild>
          <Link to="/contabilidade/lancamentos/novo">
            <Plus className="h-4 w-4 mr-2" />
            Novo Lançamento
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-5">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Data Início</label>
              <Input
                type="date"
                value={filtros.dataInicio}
                onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Data Fim</label>
              <Input
                type="date"
                value={filtros.dataFim}
                onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Origem</label>
              <Select value={filtros.origem} onValueChange={(v) => setFiltros({ ...filtros, origem: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="cobranca">Cobrança</SelectItem>
                  <SelectItem value="pagamento">Pagamento</SelectItem>
                  <SelectItem value="acordo">Acordo</SelectItem>
                  <SelectItem value="sinistro">Sinistro</SelectItem>
                  <SelectItem value="oficina">Oficina</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Status</label>
              <Select value={filtros.status} onValueChange={(v) => setFiltros({ ...filtros, status: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="estornado">Estornado</SelectItem>
                  <SelectItem value="fechado">Fechado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => setFiltros({ dataInicio: '', dataFim: '', origem: '', status: '' })}
              >
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {lancamentos?.length || 0} lançamento(s) encontrado(s)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando lançamentos...
            </div>
          ) : lancamentos?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum lançamento encontrado
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Histórico</TableHead>
                    <TableHead className="text-right">Débito</TableHead>
                    <TableHead className="text-right">Crédito</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lancamentos?.map((lancamento) => {
                    const totais = calcularTotais(lancamento.partidas);
                    return (
                      <TableRow key={lancamento.id}>
                        <TableCell className="font-mono text-sm">
                          {lancamento.numero}
                        </TableCell>
                        <TableCell>
                          {format(new Date(lancamento.data_competencia), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {lancamento.historico}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(totais.debito)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(totais.credito)}
                        </TableCell>
                        <TableCell>
                          <Badge className={origemColors[lancamento.origem] || origemColors.manual}>
                            {origemLabels[lancamento.origem] || lancamento.origem}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[lancamento.status]}>
                            {lancamento.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" asChild>
                              <Link to={`/contabilidade/lancamentos/${lancamento.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            {lancamento.status === 'ativo' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEstornoDialog({
                                  open: true,
                                  id: lancamento.id,
                                  numero: lancamento.numero,
                                })}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
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

      {/* Estorno Dialog */}
      <EstornoDialog
        open={estornoDialog.open}
        onOpenChange={(open) => setEstornoDialog({ ...estornoDialog, open })}
        lancamentoId={estornoDialog.id}
        lancamentoNumero={estornoDialog.numero}
      />
    </div>
  );
}