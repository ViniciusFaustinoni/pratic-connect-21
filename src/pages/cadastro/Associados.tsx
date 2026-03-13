import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, MoreVertical, Loader2, 
  UserCheck, Clock, AlertTriangle, UserX,
  Eye, Edit, FileText, Receipt, Lock, Unlock, Pause, XCircle,
  MessageCircle, X, ChevronLeft, ChevronRight, Users, Download, Filter, DollarSign, Trash2,
  SlidersHorizontal, ShieldAlert, Ban
} from 'lucide-react';
import { motion } from 'framer-motion';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { BadgeCoberturaCompact } from '@/components/veiculos/BadgeCobertura';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { STATUS_ASSOCIADO_LABELS, type StatusAssociado } from '@/types/database';
import { useAssociados, useAssociadosContagem, useAssociadosCidades, useUpdateAssociadoStatus, useDeleteAssociado } from '@/hooks/useAssociados';
import { usePlanos } from '@/hooks/usePlanos';

import { AssociadoFilters } from '@/components/cadastro/AssociadoFilters';
import { ConfirmacaoAcaoDialog } from '@/components/associados/ConfirmacaoAcaoDialog';
import { useToast } from '@/hooks/use-toast';

const statusColors: Record<StatusAssociado, string> = {
  em_analise: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  pendente_vistoria: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  aprovado: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  documentacao_pendente: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  aguardando_instalacao: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  ativo: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  inadimplente: 'bg-orange-500/15 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  suspenso: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  cancelado: 'bg-muted text-muted-foreground',
  bloqueado: 'bg-destructive/15 text-destructive',
  recusado: 'bg-red-500/15 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const statusDotColors: Record<StatusAssociado, string> = {
  em_analise: 'bg-yellow-500',
  pendente_vistoria: 'bg-violet-500',
  aprovado: 'bg-blue-500',
  documentacao_pendente: 'bg-orange-500',
  aguardando_instalacao: 'bg-purple-500',
  ativo: 'bg-emerald-500',
  inadimplente: 'bg-orange-600',
  suspenso: 'bg-red-500',
  cancelado: 'bg-muted-foreground',
  bloqueado: 'bg-destructive',
  recusado: 'bg-red-600',
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function Associados() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const { isDiretor, isDesenvolvedor, isAdminMaster, isAnalistaCadastroOnly } = usePermissions();
  const canDeleteAssociados = isDiretor || isDesenvolvedor || isAdminMaster;
  
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
    acao: 'bloquear' | 'suspender' | 'cancelar' | 'excluir';
    associadoId: string;
    nomeAssociado: string;
  } | null>(null);
  const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);
  const [sheetFilters, setSheetFilters] = useState<{
    status?: StatusAssociado[];
    plano_id?: string;
    cidade?: string;
    periodo?: string;
  }>({});

  // Queries
  const { data, isLoading } = useAssociados();
  const associados = data?.associados;
  const { data: contagem } = useAssociadosContagem();
  const { data: planos } = usePlanos();
  const { data: cidades } = useAssociadosCidades();
  const updateStatus = useUpdateAssociadoStatus();
  const deleteAssociado = useDeleteAssociado();

  // Check if any filter is active
  const hasFilters = search || statusFilter !== 'all' || planoFilter !== 'all' || cidadeFilter !== 'all' || Object.keys(sheetFilters).length > 0;

  // Count active filters
  const activeFilterCount = [
    statusFilter !== 'all',
    planoFilter !== 'all',
    cidadeFilter !== 'all',
    ...(sheetFilters.status?.length ? [true] : []),
    sheetFilters.plano_id ? true : false,
    sheetFilters.cidade ? true : false,
    sheetFilters.periodo ? true : false,
  ].filter(Boolean).length;

  // Filter associados
  const filteredAssociados = useMemo(() => {
    if (!associados) return [];
    
    return associados.filter((associado) => {
      const searchLower = search.toLowerCase();
      const matchesSearch = !search || 
        associado.nome.toLowerCase().includes(searchLower) ||
        associado.cpf.includes(search) ||
        associado.telefone.includes(search) ||
        associado.veiculos?.some(v => v.placa.toLowerCase().includes(searchLower));
      
      const statusList = sheetFilters.status || (statusFilter !== 'all' ? [statusFilter] : null);
      const matchesStatus = !statusList || statusList.includes(associado.status as StatusAssociado);
      
      const planoId = sheetFilters.plano_id || (planoFilter !== 'all' ? planoFilter : null);
      const matchesPlano = !planoId || associado.plano_id === planoId;
      
      const cidadeVal = sheetFilters.cidade || (cidadeFilter !== 'all' ? cidadeFilter : null);
      const matchesCidade = !cidadeVal || associado.cidade === cidadeVal;
      
      let matchesPeriodo = true;
      if (sheetFilters.periodo && associado.data_adesao) {
        const hoje = new Date();
        const dataAdesao = new Date(associado.data_adesao);
        let dataLimite: Date;
        
        switch (sheetFilters.periodo) {
          case 'ultimo_mes':
            dataLimite = new Date(hoje.getFullYear(), hoje.getMonth() - 1, hoje.getDate());
            break;
          case 'ultimos_3_meses':
            dataLimite = new Date(hoje.getFullYear(), hoje.getMonth() - 3, hoje.getDate());
            break;
          case 'ultimo_ano':
            dataLimite = new Date(hoje.getFullYear() - 1, hoje.getMonth(), hoje.getDate());
            break;
          default:
            dataLimite = new Date(0);
        }
        matchesPeriodo = dataAdesao >= dataLimite;
      }
      
      return matchesSearch && matchesStatus && matchesPlano && matchesCidade && matchesPeriodo;
    });
  }, [associados, search, statusFilter, planoFilter, cidadeFilter, sheetFilters]);

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
    setSheetFilters({});
    setPage(1);
  };

  const handleApplySheetFilters = (filters: typeof sheetFilters) => {
    setSheetFilters(filters);
    if (filters.status?.length === 1) {
      setStatusFilter(filters.status[0]);
    }
    if (filters.plano_id) {
      setPlanoFilter(filters.plano_id);
    }
    if (filters.cidade) {
      setCidadeFilter(filters.cidade);
    }
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

    if (acaoDialog.acao === 'excluir') {
      try {
        await Promise.race([
          deleteAssociado.mutateAsync(acaoDialog.associadoId),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('Tempo excedido ao excluir. Tente novamente.')), 15000)
          ),
        ]);

        toast({
          title: 'Associado excluído',
          description: 'O associado foi removido permanentemente do sistema.',
        });
      } catch (err: any) {
        console.error('[excluir-associado] erro:', err);
        toast({
          title: 'Erro ao excluir',
          description: err?.message || 'Não foi possível excluir o associado.',
          variant: 'destructive',
        });
        throw err;
      }
      return;
    }
    
    const statusMap = {
      bloquear: 'bloqueado' as StatusAssociado,
      suspender: 'suspenso' as StatusAssociado,
      cancelar: 'cancelado' as StatusAssociado,
    };
    
    await updateStatus.mutateAsync({
      id: acaoDialog.associadoId,
      status: statusMap[acaoDialog.acao as keyof typeof statusMap],
      motivo,
    });

    if (acaoDialog.acao === 'bloquear') {
      try {
        const { data: veiculos, error: veiculosError } = await supabase
          .from('veiculos')
          .select('id, placa, chassi')
          .eq('associado_id', acaoDialog.associadoId);

        if (veiculosError) {
          console.error('Erro ao buscar veículos para blacklist:', veiculosError);
        } else if (veiculos && veiculos.length > 0) {
          for (const veiculo of veiculos) {
            const { error: blacklistError } = await supabase
              .from('blacklist_veiculos')
              .insert({
                placa: veiculo.placa.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                chassi: veiculo.chassi,
                motivo: motivo,
                justificativa: `Associado bloqueado: ${motivo}`,
                tipo_reprovacao: 'associado_bloqueado',
                veiculo_id: veiculo.id,
                associado_id: acaoDialog.associadoId,
                adicionado_por: profile?.id,
                ativo: true,
              });

            if (blacklistError) {
              console.error('Erro ao adicionar veículo à blacklist:', blacklistError);
            }
          }

          toast({
            title: 'Veículos adicionados à Blacklist',
            description: `${veiculos.length} veículo(s) foram adicionados à blacklist.`,
          });
        }
      } catch (err) {
        console.error('Erro ao processar blacklist:', err);
      }
    }
    
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

  // Totals for progress bars
  const totalAssociados = useMemo(() => {
    if (!contagem) return 1;
    return (contagem.ativo ?? 0) + (contagem.suspenso ?? 0) + (contagem.inadimplente ?? 0) + 
           (contagem.em_analise ?? 0) + (contagem.bloqueado ?? 0) + (contagem.cancelado ?? 0);
  }, [contagem]);

  const metricsCards = useMemo(() => [
    {
      key: 'all',
      label: 'Total Geral',
      value: totalAssociados,
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      borderColor: 'border-l-primary',
      ringColor: 'ring-primary',
      progress: 100,
    },
    {
      key: 'ativo',
      label: 'Ativos',
      value: contagem?.ativo ?? 0,
      icon: UserCheck,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-l-emerald-500',
      ringColor: 'ring-emerald-500',
      progress: totalAssociados ? ((contagem?.ativo ?? 0) / totalAssociados) * 100 : 0,
    },
    {
      key: 'em_analise',
      label: 'Em Análise',
      value: contagem?.em_analise ?? 0,
      icon: Clock,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-l-yellow-500',
      ringColor: 'ring-yellow-500',
      progress: totalAssociados ? ((contagem?.em_analise ?? 0) / totalAssociados) * 100 : 0,
    },
    {
      key: 'inadimplente',
      label: 'Inadimplentes',
      value: contagem?.inadimplente ?? 0,
      icon: DollarSign,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-l-orange-500',
      ringColor: 'ring-orange-500',
      progress: totalAssociados ? ((contagem?.inadimplente ?? 0) / totalAssociados) * 100 : 0,
    },
    {
      key: 'suspenso',
      label: 'Suspensos',
      value: contagem?.suspenso ?? 0,
      icon: AlertTriangle,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-l-red-500',
      ringColor: 'ring-red-500',
      progress: totalAssociados ? ((contagem?.suspenso ?? 0) / totalAssociados) * 100 : 0,
    },
    {
      key: 'bloqueado',
      label: 'Bloqueados',
      value: contagem?.bloqueado ?? 0,
      icon: ShieldAlert,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      borderColor: 'border-l-destructive',
      ringColor: 'ring-destructive',
      progress: totalAssociados ? ((contagem?.bloqueado ?? 0) / totalAssociados) * 100 : 0,
    },
  ], [contagem, totalAssociados]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold">Associados</h1>
                <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5">
                  {totalAssociados.toLocaleString()}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Gerencie os associados e suas informações
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setFiltersSheetOpen(true)}>
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Filtros Avançados
              {activeFilterCount > 0 && (
                <Badge className="ml-1.5 h-5 w-5 rounded-full p-0 text-[10px] flex items-center justify-center bg-primary text-primary-foreground">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
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
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {metricsCards.map((card, index) => {
            const Icon = card.icon;
            const isSelected = (card.key === 'all' && statusFilter === 'all') || statusFilter === card.key;
            return (
              <motion.div
                key={card.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <Card 
                  className={`cursor-pointer border-l-4 ${card.borderColor} transition-all duration-200 hover:shadow-md ${
                    isSelected ? `ring-2 ${card.ringColor} shadow-md` : 'hover:bg-card-hover'
                  }`}
                  onClick={() => {
                    if (card.key === 'all') {
                      setStatusFilter('all');
                      setSheetFilters({});
                    } else {
                      setStatusFilter(statusFilter === card.key ? 'all' : card.key);
                    }
                    setPage(1);
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`rounded-lg ${card.bgColor} p-2`}>
                        <Icon className={`h-4 w-4 ${card.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xl font-bold leading-none">{card.value.toLocaleString()}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{card.label}</p>
                      </div>
                    </div>
                    {card.key !== 'all' && (
                      <Progress 
                        value={card.progress} 
                        className="h-1 mt-2.5" 
                        indicatorClassName={card.borderColor.replace('border-l-', 'bg-')}
                      />
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors peer-focus:text-primary" />
            <Input
              placeholder="Buscar por nome, CPF, telefone ou placa..."
              className="pl-9 bg-card peer"
              value={search}
              onChange={(e) => handleFilterChange(setSearch, e.target.value)}
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={(v) => handleFilterChange(setStatusFilter, v)}>
              <SelectTrigger className="w-[150px] h-9 text-xs bg-card">
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
              <SelectTrigger className="w-[140px] h-9 text-xs bg-card">
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
              <SelectTrigger className="w-[140px] h-9 text-xs bg-card">
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
              <Button variant="ghost" onClick={clearFilters} size="sm" className="h-9 text-xs text-destructive hover:text-destructive">
                <X className="mr-1 h-3.5 w-3.5" />
                Limpar filtros
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold">Associado</TableHead>
                  <TableHead className="font-semibold">CPF</TableHead>
                  <TableHead className="font-semibold">Telefone</TableHead>
                  <TableHead className="font-semibold">Veículo</TableHead>
                  <TableHead className="font-semibold">Plano</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Adesão</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAssociados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16">
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-full bg-muted p-4">
                          <Users className="h-10 w-10 text-muted-foreground/40" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Nenhum associado encontrado</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {hasFilters 
                              ? 'Tente ajustar os filtros para encontrar o que procura'
                              : 'Comece adicionando o primeiro associado'}
                          </p>
                        </div>
                        {hasFilters ? (
                          <Button variant="outline" size="sm" onClick={clearFilters}>
                            <X className="mr-2 h-4 w-4" />
                            Limpar filtros
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => setFormDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Adicionar associado
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedAssociados.map((associado, idx) => (
                    <TableRow 
                      key={associado.id} 
                      className={`cursor-pointer transition-colors hover:bg-accent/50 ${idx % 2 === 1 ? 'bg-muted/20' : ''}`}
                    >
                      <TableCell 
                        className="font-medium"
                        onClick={() => navigate(`/cadastro/associados/${associado.id}`)}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                            {getInitials(associado.nome)}
                          </div>
                          <span className="truncate max-w-[180px]">{associado.nome}</span>
                        </div>
                      </TableCell>
                      <TableCell onClick={() => navigate(`/cadastro/associados/${associado.id}`)} className="text-muted-foreground">
                        {formatCpf(associado.cpf)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span 
                            className="text-muted-foreground cursor-pointer"
                            onClick={() => navigate(`/cadastro/associados/${associado.id}`)}
                          >
                            {formatTelefone(associado.telefone)}
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={(e) => openWhatsApp(associado.telefone, e)}
                                className="inline-flex items-center justify-center h-7 w-7 rounded-md text-emerald-600 hover:bg-emerald-500/10 transition-colors"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p>Abrir WhatsApp</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                      <TableCell onClick={() => navigate(`/cadastro/associados/${associado.id}`)}>
                        {associado.veiculos && associado.veiculos.length > 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded border border-border">
                              {associado.veiculos[0].placa}
                            </span>
                            <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                              {associado.veiculos[0].modelo}
                            </span>
                            {associado.veiculos.length > 1 && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                +{associado.veiculos.length - 1}
                              </Badge>
                            )}
                            <BadgeCoberturaCompact
                              coberturaTotal={associado.veiculos[0].cobertura_total}
                              coberturaRouboFurto={associado.veiculos[0].cobertura_roubo_furto}
                              veiculoStatus={associado.veiculos[0].status}
                            />
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell onClick={() => navigate(`/cadastro/associados/${associado.id}`)} className="text-muted-foreground">
                        {associado.planos?.nome || '—'}
                      </TableCell>
                      <TableCell onClick={() => navigate(`/cadastro/associados/${associado.id}`)}>
                        <div className="flex flex-col gap-1">
                          <Badge className={`${statusColors[associado.status]} border-0 gap-1.5`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${statusDotColors[associado.status]}`} />
                            {STATUS_ASSOCIADO_LABELS[associado.status]}
                          </Badge>
                          {(associado.status === 'cancelado' || associado.status === 'bloqueado') && (() => {
                            const ts = (associado as any).tipo_saida;
                            if (associado.status === 'bloqueado' && !ts) {
                              return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground border-border w-fit">Bloqueado Judicial</Badge>;
                            }
                            if (ts === 'cancelamento_voluntario') return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground border-border w-fit">Voluntário</Badge>;
                            if (ts === 'inadimplencia') return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300 dark:border-orange-700 w-fit">Inadimplência</Badge>;
                            if (ts === 'exclusao_diretoria') return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-300 dark:border-red-700 w-fit">Exclusão Diretoria</Badge>;
                            if (ts === 'busca_apreensao') return <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-200 border-red-400 dark:border-red-700 w-fit">Busca e Apreensão</Badge>;
                            return null;
                          })()}
                        </div>
                      </TableCell>
                      <TableCell onClick={() => navigate(`/cadastro/associados/${associado.id}`)} className="text-muted-foreground text-sm">
                        {formatDate(associado.data_adesao)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-0.5">
                          {/* Quick actions on hover */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => navigate(`/cadastro/associados/${associado.id}`)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ver detalhes</TooltipContent>
                          </Tooltip>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
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
                              {canDeleteAssociados && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => setAcaoDialog({
                                      open: true,
                                      acao: 'excluir',
                                      associadoId: associado.id,
                                      nomeAssociado: associado.nome
                                    })}
                                    className="text-destructive font-semibold"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir Permanentemente
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
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
              Mostrando <span className="font-medium text-foreground">{startIndex}-{endIndex}</span> de{' '}
              <span className="font-medium text-foreground">{filteredAssociados.length}</span> associados
            </div>
            <div className="flex items-center gap-3">
              <Select 
                value={pageSize.toString()} 
                onValueChange={(v) => { setPageSize(parseInt(v)); setPage(1); }}
              >
                <SelectTrigger className="w-[72px] h-9 text-xs bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={size.toString()}>{size}/pág</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-lg"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <ChevronLeft className="h-4 w-4 -ml-2.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-lg"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center justify-center min-w-[80px] h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium px-3">
                  {page} / {totalPages || 1}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-lg"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-lg"
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                  <ChevronRight className="h-4 w-4 -ml-2.5" />
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

        {/* Filters Sheet */}
        <AssociadoFilters
          open={filtersSheetOpen}
          onClose={() => setFiltersSheetOpen(false)}
          onApply={handleApplySheetFilters}
          initialFilters={sheetFilters}
          planos={planos}
          cidades={cidades}
        />
      </div>
    </TooltipProvider>
  );
}
