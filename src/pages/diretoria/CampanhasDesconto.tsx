import { useState } from 'react';
import { format, isAfter, isBefore, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Plus,
  Search,
  Ticket,
  MoreHorizontal,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Calendar,
  Percent,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CampanhaDescontoModal } from '@/components/diretoria/CampanhaDescontoModal';
import {
  useCampanhasDesconto,
  useDeleteCampanhaDesconto,
  useToggleCampanhaDescontoStatus,
} from '@/hooks/useCampanhasDesconto';
import type { CampanhaDesconto } from '@/types/campanha-desconto';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export default function CampanhasDescontoPage() {
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [campanhaEditando, setCampanhaEditando] = useState<CampanhaDesconto | null>(null);
  const [campanhaExcluindo, setCampanhaExcluindo] = useState<CampanhaDesconto | null>(null);

  const { data: campanhas, isLoading } = useCampanhasDesconto({ status: filtroStatus });
  const deleteMutation = useDeleteCampanhaDesconto();
  const toggleStatusMutation = useToggleCampanhaDescontoStatus();

  // Filtrar campanhas por busca
  const campanhasFiltradas = campanhas?.filter((c) => {
    if (!busca) return true;
    const termo = busca.toLowerCase();
    return (
      c.nome.toLowerCase().includes(termo) ||
      c.descricao?.toLowerCase().includes(termo)
    );
  });

  // Verificar status de vigência
  const getStatusVigencia = (campanha: CampanhaDesconto) => {
    const hoje = new Date();
    const inicio = parseISO(campanha.data_inicio);
    const fim = parseISO(campanha.data_fim);

    if (campanha.status === 'inativa') return 'inativa';
    if (isBefore(hoje, inicio)) return 'futura';
    if (isAfter(hoje, fim)) return 'expirada';
    if (isWithinInterval(hoje, { start: inicio, end: fim })) return 'vigente';
    return 'inativa';
  };

  const getStatusBadge = (campanha: CampanhaDesconto) => {
    const status = getStatusVigencia(campanha);
    switch (status) {
      case 'vigente':
        return <Badge className="bg-success text-success-foreground">Vigente</Badge>;
      case 'futura':
        return <Badge variant="secondary">Futura</Badge>;
      case 'expirada':
        return <Badge variant="outline" className="text-muted-foreground">Expirada</Badge>;
      case 'inativa':
      default:
        return <Badge variant="destructive">Inativa</Badge>;
    }
  };

  const handleEditar = (campanha: CampanhaDesconto) => {
    setCampanhaEditando(campanha);
    setModalAberto(true);
  };

  const handleNovaCapanha = () => {
    setCampanhaEditando(null);
    setModalAberto(true);
  };

  const handleExcluir = async () => {
    if (!campanhaExcluindo) return;
    await deleteMutation.mutateAsync(campanhaExcluindo.id);
    setCampanhaExcluindo(null);
  };

  const handleToggleStatus = async (campanha: CampanhaDesconto) => {
    const novoStatus = campanha.status === 'ativa' ? 'inativa' : 'ativa';
    await toggleStatusMutation.mutateAsync({ id: campanha.id, novoStatus });
  };

  // Contadores
  const contadores = {
    total: campanhas?.length || 0,
    ativas: campanhas?.filter((c) => c.status === 'ativa').length || 0,
    vigentes: campanhas?.filter((c) => getStatusVigencia(c) === 'vigente').length || 0,
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ticket className="h-6 w-6" />
            Campanhas de Desconto
          </h1>
          <p className="text-muted-foreground">
            Gerencie promoções e descontos para cotações
          </p>
        </div>
        <Button onClick={handleNovaCapanha}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Campanha
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Campanhas</p>
                <p className="text-2xl font-bold">{contadores.total}</p>
              </div>
              <div className="rounded-lg bg-primary/10 p-3">
                <Ticket className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Campanhas Ativas</p>
                <p className="text-2xl font-bold">{contadores.ativas}</p>
              </div>
              <div className="rounded-lg bg-success/10 p-3">
                <Power className="h-5 w-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Vigentes Agora</p>
                <p className="text-2xl font-bold text-success">{contadores.vigentes}</p>
              </div>
              <div className="rounded-lg bg-success/10 p-3">
                <Calendar className="h-5 w-5 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou descrição..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativa">Ativas</SelectItem>
                <SelectItem value="inativa">Inativas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !campanhasFiltradas?.length ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Nenhuma campanha encontrada</AlertTitle>
              <AlertDescription>
                {busca || filtroStatus !== 'todos'
                  ? 'Tente ajustar os filtros de busca'
                  : 'Crie sua primeira campanha de desconto clicando no botão acima'}
              </AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Meses</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {campanhasFiltradas?.map((campanha) => (
                  <TableRow key={campanha.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{campanha.nome}</p>
                        {campanha.descricao && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {campanha.descricao}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {campanha.tipo_beneficio === 'percentual' ? (
                          <>
                            <Percent className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{campanha.valor_beneficio}%</span>
                          </>
                        ) : (
                          <>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {formatCurrency(campanha.valor_beneficio)}
                            </span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{format(parseISO(campanha.data_inicio), 'dd/MM/yyyy', { locale: ptBR })}</p>
                        <p className="text-muted-foreground">
                          até {format(parseISO(campanha.data_fim), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{campanha.meses_aplicacao} meses</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(campanha)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditar(campanha)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(campanha)}>
                            {campanha.status === 'ativa' ? (
                              <>
                                <PowerOff className="h-4 w-4 mr-2" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <Power className="h-4 w-4 mr-2" />
                                Ativar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setCampanhaExcluindo(campanha)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal de Criação/Edição */}
      <CampanhaDescontoModal
        open={modalAberto}
        onOpenChange={setModalAberto}
        campanha={campanhaEditando}
      />

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog
        open={!!campanhaExcluindo}
        onOpenChange={(open) => !open && setCampanhaExcluindo(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a campanha "{campanhaExcluindo?.nome}"?
              Esta ação não pode ser desfeita. Cotações já criadas com esta campanha
              não serão afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluir}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
