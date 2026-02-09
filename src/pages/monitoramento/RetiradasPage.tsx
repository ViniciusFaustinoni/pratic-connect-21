import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import {
  Search, MoreHorizontal, Calendar, User, Car, MapPin,
  Clock, CheckCircle, XCircle, RefreshCw, AlertTriangle,
  DollarSign, Lock, Loader2, ArrowUpDown, PackageX, Radio,
  Filter, X
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useServicos, Servico, STATUS_SERVICO_COLORS, STATUS_SERVICO_LABELS } from '@/hooks/useServicos';
import { MOTIVO_RETIRADA_LABELS, type MotivoRetirada, INTEGRIDADE_APARELHO_LABELS, INTEGRIDADE_APARELHO_COLORS, type IntegridadeAparelho } from '@/types/retirada';
import { TratarAusenciaRetiradaModal } from '@/components/monitoramento/retirada/TratarAusenciaRetiradaModal';
import { AplicarMultaModal } from '@/components/monitoramento/retirada/AplicarMultaModal';
import { AgendarRetiradaModal } from '@/components/monitoramento/retirada/AgendarRetiradaModal';

// ============================================
// TIPOS E CONSTANTES
// ============================================

type StatusRetirada = 'pendente' | 'agendada' | 'em_rota' | 'em_andamento' | 'concluida' | 'nao_compareceu' | 'cancelada';

const STATUS_RETIRADA_CONFIG: Record<StatusRetirada, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-gray-100 text-gray-800' },
  agendada: { label: 'Agendada', className: 'bg-blue-100 text-blue-800' },
  em_rota: { label: 'Em Rota', className: 'bg-purple-100 text-purple-800' },
  em_andamento: { label: 'Em Andamento', className: 'bg-yellow-100 text-yellow-800' },
  concluida: { label: 'Concluída', className: 'bg-green-100 text-green-800' },
  nao_compareceu: { label: 'Não Compareceu', className: 'bg-orange-100 text-orange-800' },
  cancelada: { label: 'Cancelada', className: 'bg-gray-100 text-gray-600' },
};

interface RetiradaData extends Servico {
  motivo_retirada?: MotivoRetirada;
  solicitado_por_modulo?: string;
  cancelamento_bloqueado_ate_devolucao?: boolean;
  multa_aplicada?: boolean;
  integridade_aparelho?: IntegridadeAparelho;
  rastreador?: {
    id: string;
    codigo: string;
    imei?: string;
    plataforma?: string;
  };
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function RetiradasPage() {
  // Estados de filtro
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [motivoFilter, setMotivoFilter] = useState<string>('todos');
  const [origemFilter, setOrigemFilter] = useState<string>('todas');

  // Estados dos modais
  const [tratarAusenciaOpen, setTratarAusenciaOpen] = useState(false);
  const [aplicarMultaOpen, setAplicarMultaOpen] = useState(false);
  const [agendarModalOpen, setAgendarModalOpen] = useState(false);
  const [selectedRetirada, setSelectedRetirada] = useState<RetiradaData | null>(null);

  // Query client
  const queryClient = useQueryClient();

  // Buscar serviços de retirada
  const { data: servicosRaw, isLoading } = useServicos({
    tipo: 'vistoria_retirada',
  });

  // Cast para RetiradaData
  const retiradas: RetiradaData[] = useMemo(() => {
    if (!servicosRaw) return [];
    return servicosRaw.map(s => ({
      ...s,
      motivo_retirada: (s as any).motivo_retirada as MotivoRetirada | undefined,
      solicitado_por_modulo: (s as any).solicitado_por_modulo,
      cancelamento_bloqueado_ate_devolucao: (s as any).cancelamento_bloqueado_ate_devolucao,
      multa_aplicada: (s as any).multa_aplicada,
      integridade_aparelho: (s as any).integridade_aparelho,
      rastreador: (s as any).rastreador,
    }));
  }, [servicosRaw]);

  // Métricas
  const metricas = useMemo(() => {
    return {
      pendentes: retiradas.filter(r => r.status === 'pendente').length,
      agendadas: retiradas.filter(r => r.status === 'agendada').length,
      emCampo: retiradas.filter(r => r.status === 'em_rota' || r.status === 'em_andamento').length,
      concluidas: retiradas.filter(r => r.status === 'concluida').length,
      naoCompareceu: retiradas.filter(r => r.status === 'nao_compareceu').length,
      comMulta: retiradas.filter(r => (r as any).multa_aplicada).length,
      doCadastro: retiradas.filter(r => r.solicitado_por_modulo === 'cadastro' && r.status === 'pendente').length,
    };
  }, [retiradas]);

  // Filtrar retiradas
  const retiradasFiltradas = useMemo(() => {
    let result = retiradas;

    // Busca
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(r =>
        r.associado?.nome?.toLowerCase().includes(searchLower) ||
        r.veiculo?.placa?.toLowerCase().includes(searchLower) ||
        r.rastreador?.codigo?.toLowerCase().includes(searchLower) ||
        r.protocolo?.toLowerCase().includes(searchLower)
      );
    }

    // Status
    if (statusFilter !== 'todos') {
      result = result.filter(r => r.status === statusFilter);
    }

    // Motivo
    if (motivoFilter !== 'todos') {
      result = result.filter(r => r.motivo_retirada === motivoFilter);
    }

    // Origem
    if (origemFilter !== 'todas') {
      result = result.filter(r => r.solicitado_por_modulo === origemFilter);
    }

    return result;
  }, [retiradas, search, statusFilter, motivoFilter, origemFilter]);

  // Limpar filtros
  const limparFiltros = () => {
    setSearch('');
    setStatusFilter('todos');
    setMotivoFilter('todos');
    setOrigemFilter('todas');
  };

  // Handlers
  const handleTratarAusencia = (retirada: RetiradaData) => {
    setSelectedRetirada(retirada);
    setTratarAusenciaOpen(true);
  };

  const handleAplicarMulta = (retirada: RetiradaData) => {
    setSelectedRetirada(retirada);
    setAplicarMultaOpen(true);
  };

  const handleAgendar = (retirada: RetiradaData) => {
    setSelectedRetirada(retirada);
    setAgendarModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PackageX className="h-6 w-6 text-red-600" />
          Gestão de Retiradas
        </h1>
        <p className="text-muted-foreground">
          Gerencie as retiradas de rastreadores
        </p>
      </div>

      {/* Alerta de retiradas do Cadastro */}
      {metricas.doCadastro > 0 && (
        <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-700 dark:text-orange-300">
            <strong>{metricas.doCadastro}</strong> retirada(s) solicitada(s) pelo Cadastro aguardando agendamento.
            Clique em "Agendar" para definir data e técnico.
          </AlertDescription>
        </Alert>
      )}

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setStatusFilter('pendente')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricas.pendentes}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setStatusFilter('agendada')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Agendadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{metricas.agendadas}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setStatusFilter('em_rota')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Em Campo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{metricas.emCampo}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setStatusFilter('concluida')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Concluídas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metricas.concluidas}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setStatusFilter('nao_compareceu')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Não Compareceu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{metricas.naoCompareceu}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              Com Multa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{metricas.comMulta}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors border-orange-200" onClick={() => setOrigemFilter('cadastro')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-orange-600 flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Do Cadastro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{metricas.doCadastro}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, placa ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Status</SelectItem>
            {Object.entries(STATUS_RETIRADA_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={motivoFilter} onValueChange={setMotivoFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Motivo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Motivos</SelectItem>
            {Object.entries(MOTIVO_RETIRADA_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={origemFilter} onValueChange={setOrigemFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas Origens</SelectItem>
            <SelectItem value="cadastro">Cadastro</SelectItem>
            <SelectItem value="monitoramento">Monitoramento</SelectItem>
            <SelectItem value="financeiro">Financeiro</SelectItem>
          </SelectContent>
        </Select>

        {(search || statusFilter !== 'todos' || motivoFilter !== 'todos' || origemFilter !== 'todas') && (
          <Button variant="ghost" size="sm" onClick={limparFiltros}>
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Tabela */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Protocolo</TableHead>
              <TableHead>Associado</TableHead>
              <TableHead>Veículo</TableHead>
              <TableHead>Rastreador</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Data Agendada</TableHead>
              <TableHead>Técnico</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Skeleton loading
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 10 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : retiradasFiltradas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <PackageX className="h-8 w-8" />
                    <p>Nenhuma retirada encontrada</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              retiradasFiltradas.map((retirada) => {
                const statusConfig = STATUS_RETIRADA_CONFIG[retirada.status as StatusRetirada] || STATUS_RETIRADA_CONFIG.pendente;
                const integridade = retirada.integridade_aparelho;

                return (
                  <TableRow 
                    key={retirada.id}
                    className={cn(
                      // Destacar se danificado
                      integridade && integridade !== 'integro' && 'bg-amber-50 dark:bg-amber-950/20',
                      // Destacar se bloqueio de cancelamento
                      retirada.cancelamento_bloqueado_ate_devolucao && 'border-l-4 border-l-orange-500'
                    )}
                  >
                    <TableCell className="font-mono text-sm">
                      {retirada.protocolo || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium truncate max-w-[150px]">
                          {retirada.associado?.nome || '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm">
                            {retirada.veiculo?.marca} {retirada.veiculo?.modelo}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {retirada.veiculo?.placa}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Radio className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">
                          {retirada.rastreador?.codigo || '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {retirada.motivo_retirada ? (
                        <Badge variant="outline" className="text-xs">
                          {MOTIVO_RETIRADA_LABELS[retirada.motivo_retirada]}
                        </Badge>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {retirada.data_agendada ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(retirada.data_agendada), 'dd/MM/yyyy', { locale: ptBR })}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Não agendada</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {retirada.profissional?.nome || (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={cn('text-xs', statusConfig.className)}>
                          {statusConfig.label}
                        </Badge>
                        {retirada.multa_aplicada && (
                          <Badge variant="destructive" className="text-xs">
                            <DollarSign className="h-3 w-3 mr-0.5" />
                            Multa
                          </Badge>
                        )}
                        {integridade && integridade !== 'integro' && (
                          <Badge className={cn('text-xs', INTEGRIDADE_APARELHO_COLORS[integridade])}>
                            {INTEGRIDADE_APARELHO_LABELS[integridade]}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {retirada.solicitado_por_modulo === 'cadastro' ? (
                        <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
                          <Lock className="h-3 w-3 mr-0.5" />
                          Cadastro
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground capitalize">
                          {retirada.solicitado_por_modulo || 'monitoramento'}
                        </span>
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
                          {retirada.status === 'pendente' && (
                            <DropdownMenuItem onClick={() => handleAgendar(retirada)}>
                              <Calendar className="h-4 w-4 mr-2" />
                              Agendar
                            </DropdownMenuItem>
                          )}
                          {retirada.status === 'agendada' && (
                            <DropdownMenuItem onClick={() => handleAgendar(retirada)}>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Reagendar
                            </DropdownMenuItem>
                          )}
                          {retirada.status === 'nao_compareceu' && (
                            <DropdownMenuItem onClick={() => handleTratarAusencia(retirada)}>
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              Tratar Ausência
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleAplicarMulta(retirada)}>
                            <DollarSign className="h-4 w-4 mr-2" />
                            Aplicar Multa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modais */}
      <TratarAusenciaRetiradaModal
        open={tratarAusenciaOpen}
        onClose={() => {
          setTratarAusenciaOpen(false);
          setSelectedRetirada(null);
        }}
        retirada={selectedRetirada}
      />

      {selectedRetirada && (
        <AplicarMultaModal
          open={aplicarMultaOpen}
          onOpenChange={(open) => {
            setAplicarMultaOpen(open);
            if (!open) setSelectedRetirada(null);
          }}
          retirada={{
            id: selectedRetirada.id,
            associado: selectedRetirada.associado ? {
              nome: selectedRetirada.associado.nome,
              cpf: selectedRetirada.associado.cpf || '',
            } : null,
            rastreador: selectedRetirada.rastreador ? {
              codigo: selectedRetirada.rastreador.codigo,
            } : null,
            integridade: selectedRetirada.integridade_aparelho,
          }}
        />
      )}

      <AgendarRetiradaModal
        open={agendarModalOpen}
        onOpenChange={(open) => {
          setAgendarModalOpen(open);
          if (!open) setSelectedRetirada(null);
        }}
        retirada={selectedRetirada}
      />
    </div>
  );
}
