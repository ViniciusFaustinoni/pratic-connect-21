import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Plus, MoreVertical, Loader2, 
  UserCheck, Clock, AlertTriangle, UserX,
  Eye, Edit, FileText, Receipt, Lock, Unlock, Pause, XCircle,
  MessageCircle, X, ChevronLeft, ChevronRight, Users, Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { STATUS_ASSOCIADO_LABELS, type StatusAssociado } from '@/types/database';
import { useAssociados, useAssociadosMetricas, useAssociadosCidades, useUpdateAssociadoStatus } from '@/hooks/useAssociados';
import { usePlanos } from '@/hooks/usePlanos';
import { AssociadoFormDialog } from '@/components/associados/AssociadoFormDialog';
import { ConfirmacaoAcaoDialog } from '@/components/associados/ConfirmacaoAcaoDialog';
import { useToast } from '@/hooks/use-toast';

const statusColors: Record<StatusAssociado, string> = {
  em_analise: 'bg-yellow-100 text-yellow-800',
  aprovado: 'bg-blue-100 text-blue-800',
  documentacao_pendente: 'bg-orange-100 text-orange-800',
  aguardando_instalacao: 'bg-purple-100 text-purple-800',
  ativo: 'bg-green-100 text-green-800',
  inadimplente: 'bg-orange-500 text-white',
  suspenso: 'bg-red-100 text-red-800',
  cancelado: 'bg-muted text-muted-foreground',
  bloqueado: 'bg-destructive text-destructive-foreground',
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function Associados() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planoFilter, setPlanoFilter] = useState<string>('all');
  const [cidadeFilter, setCidadeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [acaoDialog, setAcaoDialog] = useState<{
    open: boolean;
    acao: 'bloquear' | 'suspender' | 'cancelar';
    associadoId: string;
    nomeAssociado: string;
  } | null>(null);

  // Queries
  const { data, isLoading } = useAssociados();
  const associados = data?.associados;
  const { data: metricas } = useAssociadosMetricas();
  const { data: planos } = usePlanos();
  const { data: cidades } = useAssociadosCidades();
  const updateStatus = useUpdateAssociadoStatus();

  // Check if any filter is active
  const hasFilters = search || statusFilter !== 'all' || planoFilter !== 'all' || cidadeFilter !== 'all';

  // Filter associados
  const filteredAssociados = useMemo(() => {
    if (!associados) return [];
    
    return associados.filter((associado) => {
      // Search filter (name, CPF, phone, or plate)
      const searchLower = search.toLowerCase();
      const matchesSearch = !search || 
        associado.nome.toLowerCase().includes(searchLower) ||
        associado.cpf.includes(search) ||
        associado.telefone.includes(search) ||
        associado.veiculos?.some(v => v.placa.toLowerCase().includes(searchLower));
      
      // Status filter
      const matchesStatus = statusFilter === 'all' || associado.status === statusFilter;
      
      // Plano filter
      const matchesPlano = planoFilter === 'all' || associado.plano_id === planoFilter;
      
      // Cidade filter
      const matchesCidade = cidadeFilter === 'all' || associado.cidade === cidadeFilter;
      
      return matchesSearch && matchesStatus && matchesPlano && matchesCidade;
    });
  }, [associados, search, statusFilter, planoFilter, cidadeFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredAssociados.length / pageSize);
  const paginatedAssociados = filteredAssociados.slice(
    (page - 1) * pageSize,
    page * pageSize
  );
  const startIndex = (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, filteredAssociados.length);

  // Reset page when filters change
  const handleFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPlanoFilter('all');
    setCidadeFilter('all');
    setPage(1);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const formatCpf = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatTelefone = (tel: string) => {
    const digits = tel.replace(/\D/g, '');
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    return tel;
  };

  const openWhatsApp = (telefone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const digits = telefone.replace(/\D/g, '');
    window.open(`https://wa.me/55${digits}`, '_blank');
  };

  const handleAcaoConfirm = async (motivo: string) => {
    if (!acaoDialog) return;
    
    const statusMap = {
      bloquear: 'bloqueado' as StatusAssociado,
      suspender: 'suspenso' as StatusAssociado,
      cancelar: 'cancelado' as StatusAssociado,
    };
    
    await updateStatus.mutateAsync({
      id: acaoDialog.associadoId,
      status: statusMap[acaoDialog.acao],
      motivo,
    });
    
    toast({
      title: 'Status atualizado',
      description: `Associado ${acaoDialog.acao === 'bloquear' ? 'bloqueado' : acaoDialog.acao === 'suspender' ? 'suspenso' : 'cancelado'} com sucesso.`,
    });
  };

  const handleDesbloquear = async (id: string) => {
    await updateStatus.mutateAsync({ id, status: 'ativo' });
    toast({
      title: 'Associado desbloqueado',
      description: 'O associado foi desbloqueado com sucesso.',
    });
  };

  const exportToExcel = useCallback((format: 'xlsx' | 'csv') => {
    const dataToExport = filteredAssociados.map((a) => ({
      'Nome': a.nome,
      'CPF': formatCpf(a.cpf),
      'Telefone': formatTelefone(a.telefone),
      'Email': a.email || '',
      'Veículo': a.veiculos?.[0] ? `${a.veiculos[0].placa} - ${a.veiculos[0].modelo}` : '',
      'Plano': a.planos?.nome || '',
      'Status': STATUS_ASSOCIADO_LABELS[a.status],
      'Data Adesão': formatDate(a.data_adesao),
      'Cidade': a.cidade || '',
      'UF': a.uf || '',
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Associados');

    const fileName = `associados_${new Date().toISOString().slice(0, 10)}.${format}`;
    
    if (format === 'csv') {
      XLSX.writeFile(wb, fileName, { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, fileName);
    }

    toast({
      title: 'Exportação concluída',
      description: `${filteredAssociados.length} associados exportados para ${format.toUpperCase()}.`,
    });
  }, [filteredAssociados, toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Associados</h1>
          <p className="text-muted-foreground">
            Gerencie os associados e suas informações
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportToExcel('xlsx')}>
                <FileText className="mr-2 h-4 w-4" />
                Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportToExcel('csv')}>
                <FileText className="mr-2 h-4 w-4" />
                CSV (.csv)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setFormDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Associado
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2">
                <UserCheck className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metricas?.ativos ?? 0}</p>
                <p className="text-xs text-muted-foreground">Associados ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-500/10 p-2">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metricas?.emAnalise ?? 0}</p>
                <p className="text-xs text-muted-foreground">Aguardando aprovação</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-500/10 p-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metricas?.inadimplentes ?? 0}</p>
                <p className="text-xs text-muted-foreground">Com boletos atrasados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-500/10 p-2">
                <UserX className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metricas?.canceladosMes ?? 0}</p>
                <p className="text-xs text-muted-foreground">Cancelados este mês</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF, telefone ou placa..."
            className="pl-9"
            value={search}
            onChange={(e) => handleFilterChange(setSearch, e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={(v) => handleFilterChange(setStatusFilter, v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(STATUS_ASSOCIADO_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={planoFilter} onValueChange={(v) => handleFilterChange(setPlanoFilter, v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os planos</SelectItem>
              {planos?.map((plano) => (
                <SelectItem key={plano.id} value={plano.id}>{plano.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={cidadeFilter} onValueChange={(v) => handleFilterChange(setCidadeFilter, v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Cidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as cidades</SelectItem>
              {cidades?.map((cidade) => (
                <SelectItem key={cidade} value={cidade}>{cidade}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="outline" onClick={clearFilters} size="sm">
              <X className="mr-1 h-4 w-4" />
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Adesão</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedAssociados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-12 w-12 text-muted-foreground/50" />
                      <p className="text-muted-foreground">Nenhum associado encontrado</p>
                      {hasFilters && (
                        <Button variant="link" onClick={clearFilters}>
                          Limpar filtros
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedAssociados.map((associado) => (
                  <TableRow key={associado.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell 
                      className="font-medium"
                      onClick={() => navigate(`/cadastro/associados/${associado.id}`)}
                    >
                      {associado.nome}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/cadastro/associados/${associado.id}`)}>
                      {formatCpf(associado.cpf)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span onClick={() => navigate(`/cadastro/associados/${associado.id}`)}>
                          {formatTelefone(associado.telefone)}
                        </span>
                        <button
                          onClick={(e) => openWhatsApp(associado.telefone, e)}
                          className="text-green-500 hover:text-green-600"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell onClick={() => navigate(`/cadastro/associados/${associado.id}`)}>
                      {associado.veiculos && associado.veiculos.length > 0 ? (
                        <div className="flex items-center gap-1">
                          <span>{associado.veiculos[0].placa} - {associado.veiculos[0].modelo}</span>
                          {associado.veiculos.length > 1 && (
                            <Badge variant="secondary" className="text-xs">
                              +{associado.veiculos.length - 1}
                            </Badge>
                          )}
                        </div>
                      ) : '—'}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/cadastro/associados/${associado.id}`)}>
                      {associado.planos?.nome || '—'}
                    </TableCell>
                    <TableCell onClick={() => navigate(`/cadastro/associados/${associado.id}`)}>
                      <Badge className={statusColors[associado.status]}>
                        {STATUS_ASSOCIADO_LABELS[associado.status]}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={() => navigate(`/cadastro/associados/${associado.id}`)}>
                      {formatDate(associado.data_adesao)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/cadastro/associados/${associado.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/cadastro/associados/${associado.id}?edit=true`)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar dados
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/cadastro/associados/${associado.id}?tab=documentos`)}>
                            <FileText className="mr-2 h-4 w-4" />
                            Ver documentos
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/cadastro/associados/${associado.id}?tab=boletos`)}>
                            <Receipt className="mr-2 h-4 w-4" />
                            Ver boletos
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {associado.status === 'bloqueado' ? (
                            <DropdownMenuItem onClick={() => handleDesbloquear(associado.id)}>
                              <Unlock className="mr-2 h-4 w-4" />
                              Desbloquear
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem 
                              onClick={() => setAcaoDialog({
                                open: true,
                                acao: 'bloquear',
                                associadoId: associado.id,
                                nomeAssociado: associado.nome
                              })}
                              className="text-destructive"
                            >
                              <Lock className="mr-2 h-4 w-4" />
                              Bloquear
                            </DropdownMenuItem>
                          )}
                          {associado.status !== 'suspenso' && associado.status !== 'cancelado' && (
                            <DropdownMenuItem 
                              onClick={() => setAcaoDialog({
                                open: true,
                                acao: 'suspender',
                                associadoId: associado.id,
                                nomeAssociado: associado.nome
                              })}
                              className="text-orange-600"
                            >
                              <Pause className="mr-2 h-4 w-4" />
                              Suspender
                            </DropdownMenuItem>
                          )}
                          {associado.status !== 'cancelado' && (
                            <DropdownMenuItem 
                              onClick={() => setAcaoDialog({
                                open: true,
                                acao: 'cancelar',
                                associadoId: associado.id,
                                nomeAssociado: associado.nome
                              })}
                              className="text-destructive"
                            >
                              <XCircle className="mr-2 h-4 w-4" />
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

      {/* Pagination */}
      {filteredAssociados.length > 0 && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Mostrando {startIndex}-{endIndex} de {filteredAssociados.length} associados
          </div>
          <div className="flex items-center gap-2">
            <Select 
              value={pageSize.toString()} 
              onValueChange={(v) => { setPageSize(parseInt(v)); setPage(1); }}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={size.toString()}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                <ChevronLeft className="h-4 w-4 -ml-2" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 text-sm">
                {page} / {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
              >
                <ChevronRight className="h-4 w-4" />
                <ChevronRight className="h-4 w-4 -ml-2" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AssociadoFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
      />

      {acaoDialog && (
        <ConfirmacaoAcaoDialog
          open={acaoDialog.open}
          onOpenChange={(open) => !open && setAcaoDialog(null)}
          acao={acaoDialog.acao}
          nomeAssociado={acaoDialog.nomeAssociado}
          onConfirm={handleAcaoConfirm}
        />
      )}
    </div>
  );
}
