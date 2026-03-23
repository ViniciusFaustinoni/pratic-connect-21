import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInstalacoes, useInstalacoesContagem, useInstalacaoActions, useDeleteInstalacao, InstalacaoFilters, InstalacaoWithRelations } from '@/hooks/useInstalacoes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Search, Plus, Clock, Calendar, Truck, CheckCircle, MoreHorizontal, Eye, UserPlus, X, ChevronLeft, ChevronRight, MapPin, AlertCircle, Trash2, AlertTriangle } from 'lucide-react';
import { SlaIndicador, useSlaConfig, calcularPercentualSla } from '@/components/ui/SlaIndicador';
import { cn } from '@/lib/utils';
import { STATUS_INSTALACAO_LABELS, STATUS_INSTALACAO_COLORS, PERIODO_LABELS, StatusInstalacao, PeriodoInstalacao } from '@/types/database';
import { AtribuirInstaladorDialog } from '@/components/instalacoes/AtribuirInstaladorDialog';
const formatDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');

export default function InstalacoesList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusInstalacao | ''>('');
  const [periodoFilter, setPeriodoFilter] = useState<'hoje' | 'amanha' | 'semana' | ''>('');
  const [urgentFilter, setUrgentFilter] = useState(false);
  const [atribuirDialogOpen, setAtribuirDialogOpen] = useState(false);
  const [selectedInstalacaoId, setSelectedInstalacaoId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [instalacaoToDelete, setInstalacaoToDelete] = useState<string | null>(null);

  const [searchDebounced, setSearchDebounced] = useState('');
  
  // Detectar parâmetro ?agendar=true para navegar ao agendamento
  useEffect(() => {
    if (searchParams.get('agendar') === 'true') {
      searchParams.delete('agendar');
      setSearchParams(searchParams, { replace: true });
      navigate('/monitoramento/instalacoes/agendar');
    }
  }, [searchParams, setSearchParams, navigate]);
  
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Calcular datas do filtro período
  const getDatasFromPeriodo = () => {
    const hoje = new Date();
    const hojeStr = hoje.toISOString().split('T')[0];
    
    if (periodoFilter === 'hoje') {
      return { data_inicio: hojeStr, data_fim: hojeStr };
    }
    if (periodoFilter === 'amanha') {
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);
      const amanhaStr = amanha.toISOString().split('T')[0];
      return { data_inicio: amanhaStr, data_fim: amanhaStr };
    }
    if (periodoFilter === 'semana') {
      const fimSemana = new Date(hoje);
      fimSemana.setDate(fimSemana.getDate() + 7);
      return { data_inicio: hojeStr, data_fim: fimSemana.toISOString().split('T')[0] };
    }
    return {};
  };

  const filters: InstalacaoFilters = {
    search: searchDebounced || undefined,
    status: statusFilter || undefined,
    ...getDatasFromPeriodo(),
  };

  const { data, isLoading, error } = useInstalacoes({
    filters,
    pagination: { page, pageSize: 15 },
  });

  const { data: contagem } = useInstalacoesContagem();
  const { cancelarInstalacao, isCancelando } = useInstalacaoActions();
  const deleteInstalacao = useDeleteInstalacao();
  const { data: slaConfig } = useSlaConfig();

  // Extract instalacoes and pagination from data
  const { instalacoes: rawInstalacoes, pagination } = useMemo(() => {
    if (!data) return { instalacoes: [] as InstalacaoWithRelations[], pagination: undefined };
    
    if ('instalacoes' in data) {
      return { 
        instalacoes: data.instalacoes, 
        pagination: data.pagination 
      };
    }
    
    return { instalacoes: data as InstalacaoWithRelations[], pagination: undefined };
  }, [data]);

  // Apply urgent filter client-side
  const instalacoes = useMemo(() => {
    if (!urgentFilter || !slaConfig) return rawInstalacoes;
    return rawInstalacoes.filter(inst => {
      if (inst.status === 'concluida' || inst.status === 'cancelada') return false;
      const prazoHoras = slaConfig.instalacao;
      const { percentual } = calcularPercentualSla(inst.created_at, prazoHoras);
      return percentual <= 25;
    });
  }, [rawInstalacoes, urgentFilter, slaConfig]);

  const handleFilterChange = <T,>(setter: (v: T) => void, value: T) => {
    setter(value);
    setPage(1);
  };

  return (
    <div className="space-y-6 p-6">
      {/* BREADCRUMB */}
      <nav className="flex items-center text-sm text-muted-foreground">
        <span className="hover:text-foreground cursor-pointer" onClick={() => navigate('/dashboard')}>Home</span>
        <span className="mx-2">/</span>
        <span className="hover:text-foreground cursor-pointer" onClick={() => navigate('/monitoramento/mapa')}>Monitoramento</span>
        <span className="mx-2">/</span>
        <span className="text-foreground font-medium">Instalações</span>
      </nav>

      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Instalações</h1>
        <p className="text-muted-foreground">Gerencie as instalações de rastreadores</p>
      </div>

      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card 
          className={cn("cursor-pointer transition-all hover:shadow-md", statusFilter === 'agendada' && "ring-2 ring-primary")}
          onClick={() => handleFilterChange(setStatusFilter, statusFilter === 'agendada' ? '' : 'agendada')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <Calendar className="h-5 w-5 text-blue-500 mb-1" />
                <p className="text-xs text-muted-foreground">Agendadas</p>
                <p className="text-2xl font-bold">{contagem?.agendadas || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn("cursor-pointer transition-all hover:shadow-md", statusFilter === 'em_rota' && "ring-2 ring-primary")}
          onClick={() => handleFilterChange(setStatusFilter, statusFilter === 'em_rota' ? '' : 'em_rota')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <Truck className="h-5 w-5 text-purple-500 mb-1" />
                <p className="text-xs text-muted-foreground">Em Rota</p>
                <p className="text-2xl font-bold">{contagem?.em_rota || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn("cursor-pointer transition-all hover:shadow-md", statusFilter === 'em_andamento' && "ring-2 ring-primary")}
          onClick={() => handleFilterChange(setStatusFilter, statusFilter === 'em_andamento' ? '' : 'em_andamento')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <Clock className="h-5 w-5 text-amber-500 mb-1" />
                <p className="text-xs text-muted-foreground">Em Andamento</p>
                <p className="text-2xl font-bold">{contagem?.em_andamento || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className={cn("cursor-pointer transition-all hover:shadow-md", periodoFilter === 'hoje' && "ring-2 ring-primary")}
          onClick={() => handleFilterChange(setPeriodoFilter, periodoFilter === 'hoje' ? '' : 'hoje')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <CheckCircle className="h-5 w-5 text-green-500 mb-1" />
                <p className="text-xs text-muted-foreground">Concluídas Hoje</p>
                <p className="text-2xl font-bold">{contagem?.concluidas_hoje || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FILTROS */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou placa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <Select value={statusFilter || 'all'} onValueChange={(v) => handleFilterChange(setStatusFilter, v === 'all' ? '' : v as StatusInstalacao)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="agendada">Agendada</SelectItem>
            <SelectItem value="em_rota">Em Rota</SelectItem>
            <SelectItem value="em_andamento">Em Andamento</SelectItem>
            <SelectItem value="concluida">Concluída</SelectItem>
            <SelectItem value="reagendada">Reagendada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>

        <Select value={periodoFilter || 'all'} onValueChange={(v) => handleFilterChange(setPeriodoFilter, v === 'all' ? '' : v as 'hoje' | 'amanha' | 'semana')}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="amanha">Amanhã</SelectItem>
            <SelectItem value="semana">Esta Semana</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={urgentFilter ? "destructive" : "outline"}
          size="sm"
          onClick={() => { setUrgentFilter(!urgentFilter); setPage(1); }}
        >
          <AlertTriangle className="h-4 w-4 mr-1" />
          Atenção Urgente
        </Button>

        {(search || statusFilter || periodoFilter || urgentFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatusFilter(''); setPeriodoFilter(''); setUrgentFilter(false); setPage(1); }}>
            <X className="h-4 w-4 mr-1" /> Limpar filtros
          </Button>
        )}
      </div>

      {/* TABELA */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Veículo</TableHead>
              <TableHead>Endereço</TableHead>
              <TableHead>Instalador</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {instalacoes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Calendar className="h-8 w-8" />
                    <p>Nenhuma instalação encontrada</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              instalacoes.map((inst) => (
                <TableRow key={inst.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/monitoramento/instalacoes/${inst.id}`)}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{formatDate(inst.data_agendada)}</p>
                      <p className="text-xs text-muted-foreground">{PERIODO_LABELS[inst.periodo as PeriodoInstalacao]?.split(' ')[0]}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{inst.associados?.nome || '—'}</p>
                      <p className="text-xs text-muted-foreground">{inst.associados?.telefone || '—'}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{inst.veiculos?.marca} {inst.veiculos?.modelo}</p>
                      <p className="text-xs text-muted-foreground">{inst.veiculos?.placa || '—'}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate max-w-[180px]">
                        {inst.bairro}, {inst.cidade}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {(inst.instalador?.nome || inst.instalador_responsavel?.nome || inst.profiles?.nome) ? (
                      <span className="text-sm">{inst.instalador?.nome || inst.instalador_responsavel?.nome || inst.profiles?.nome}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground italic">Não atribuído</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("text-xs", STATUS_INSTALACAO_COLORS[inst.status as StatusInstalacao])}>
                      {STATUS_INSTALACAO_LABELS[inst.status as StatusInstalacao]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/monitoramento/instalacoes/${inst.id}`); }}>
                          <Eye className="h-4 w-4 mr-2" /> Ver detalhes
                        </DropdownMenuItem>
                        {!inst.instalador_id && !inst.instalador_responsavel_id && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedInstalacaoId(inst.id); setAtribuirDialogOpen(true); }}>
                            <UserPlus className="h-4 w-4 mr-2" /> Atribuir instalador
                          </DropdownMenuItem>
                        )}
                        {inst.status !== 'concluida' && inst.status !== 'cancelada' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive"
                              disabled={isCancelando}
                              onClick={(e) => { e.stopPropagation(); cancelarInstalacao({ id: inst.id, motivo: 'Cancelada pelo admin' }); }}
                            >
                              <X className="h-4 w-4 mr-2" /> Cancelar
                            </DropdownMenuItem>
                          </>
                        )}
                        {inst.status === 'cancelada' && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setInstalacaoToDelete(inst.id); 
                                setDeleteDialogOpen(true); 
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* PAGINAÇÃO */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Mostrando {((page - 1) * 15) + 1}-{Math.min(page * 15, pagination.total)} de {pagination.total}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <span className="text-sm">Página {page} de {pagination.totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}>
              Próximo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <AtribuirInstaladorDialog
        instalacaoId={selectedInstalacaoId}
        open={atribuirDialogOpen}
        onOpenChange={setAtribuirDialogOpen}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir instalação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A instalação será permanentemente removida do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (instalacaoToDelete) {
                  deleteInstalacao.mutate(instalacaoToDelete);
                  setDeleteDialogOpen(false);
                  setInstalacaoToDelete(null);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
