import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, Clock, CalendarCheck, CheckCircle2, Loader2, AlertTriangle,
  MoreHorizontal, Calendar, ClipboardCheck, XCircle, Eye,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  useVistoriasManutencao, 
  useVistoriasManutencaoMetricas,
  useCancelarVistoriaManutencao,
  useMarcarNaoCompareceu,
} from '@/hooks/useVistoriaManutencao';
import {
  AgendarManutencaoModal,
  RegistrarResultadoModal,
  TratarAusenciaModal,
} from '@/components/monitoramento/manutencao';
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
import { 
  MOTIVO_MANUTENCAO_LABELS,
  MOTIVO_MANUTENCAO_COLORS,
  LOCAL_TIPO_LABELS,
  LOCAL_TIPO_COLORS,
  podeMarcarNaoCompareceu,
  type VistoriaManutencao,
  type ManutencaoFiltros,
  type MotivoManutencao,
  type LocalTipoManutencao,
} from '@/types/vistoriaManutencao';
import { STATUS_SERVICO_LABELS, STATUS_SERVICO_COLORS, PERIODO_LABELS, type StatusServico } from '@/hooks/useServicos';
import { usePermissions } from '@/hooks/usePermissions';

export default function ManutencaoRastreadoresTab() {
  const { isDiretor, isCoordenadorMonitoramento, isAnalistaMonitoramento } = usePermissions();
  const canManage = isDiretor || isCoordenadorMonitoramento || isAnalistaMonitoramento;

  const [filtros, setFiltros] = useState<ManutencaoFiltros>({});
  const [modalAgendar, setModalAgendar] = useState(false);
  const [modalResultado, setModalResultado] = useState(false);
  const [modalTratarAusencia, setModalTratarAusencia] = useState(false);
  const [vistoriaSelecionada, setVistoriaSelecionada] = useState<VistoriaManutencao | null>(null);
  const [dialogCancelar, setDialogCancelar] = useState(false);
  const [dialogNaoCompareceu, setDialogNaoCompareceu] = useState(false);

  const { data: vistorias, isLoading } = useVistoriasManutencao(filtros);
  const { data: metricas, isLoading: loadingMetricas } = useVistoriasManutencaoMetricas();
  const cancelarMutation = useCancelarVistoriaManutencao();
  const naoCompareceuMutation = useMarcarNaoCompareceu();

  const handleBuscaChange = (value: string) => {
    setFiltros(prev => ({ ...prev, busca: value || undefined }));
  };

  const handleStatusChange = (value: string) => {
    setFiltros(prev => ({ ...prev, status: value === 'todos' ? undefined : value }));
  };

  const confirmarCancelamento = async () => {
    if (!vistoriaSelecionada) return;
    const deveSuspenderProtecao = vistoriaSelecionada.status === 'nao_compareceu';
    await cancelarMutation.mutateAsync({ 
      servicoId: vistoriaSelecionada.id,
      motivo: deveSuspenderProtecao ? 'Cancelado após não comparecimento - proteção suspensa' : undefined,
      suspenderProtecao: deveSuspenderProtecao,
    });
    setDialogCancelar(false);
    setVistoriaSelecionada(null);
  };

  const confirmarNaoCompareceu = async () => {
    if (!vistoriaSelecionada) return;
    await naoCompareceuMutation.mutateAsync({ servicoId: vistoriaSelecionada.id });
    setDialogNaoCompareceu(false);
    setVistoriaSelecionada(null);
  };

  const cards = [
    { label: 'Pendentes', value: metricas?.pendentes ?? 0, icon: Clock, color: 'text-muted-foreground' },
    { label: 'Agendadas', value: metricas?.agendadas ?? 0, icon: CalendarCheck, color: 'text-blue-600' },
    { label: 'Não compareceu', value: metricas?.naoCompareceu ?? 0, icon: AlertTriangle, color: 'text-destructive' },
    { label: 'Concluídas hoje', value: metricas?.concluidasHoje ?? 0, icon: CheckCircle2, color: 'text-green-600' },
  ];

  const getStatusBadge = (status: string) => {
    const label = STATUS_SERVICO_LABELS[status as StatusServico] || status;
    const color = STATUS_SERVICO_COLORS[status as StatusServico] || 'bg-gray-100 text-gray-800';
    return <Badge variant="outline" className={color}>{label}</Badge>;
  };

  const getMotivoBadge = (motivo: string | null) => {
    if (!motivo) return null;
    const label = MOTIVO_MANUTENCAO_LABELS[motivo as MotivoManutencao] || motivo;
    const color = MOTIVO_MANUTENCAO_COLORS[motivo as MotivoManutencao] || 'bg-gray-100 text-gray-800';
    return <Badge variant="outline" className={color}>{label}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Manutenção de Rastreadores</h2>
        <p className="text-sm text-muted-foreground">Serviços de manutenção solicitados pelo monitoramento</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <card.icon className={`h-8 w-8 ${card.color}`} />
              <div>
                <p className="text-2xl font-bold">{loadingMetricas ? '-' : card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, placa ou código..."
            value={filtros.busca || ''}
            onChange={(e) => handleBuscaChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={(filtros.status as string) || 'todos'} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="agendada">Agendada</SelectItem>
            <SelectItem value="em_rota">Em rota</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="nao_compareceu">Não compareceu</SelectItem>
            <SelectItem value="concluida">Concluída</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !vistorias || vistorias.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Nenhum serviço de manutenção encontrado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Protocolo</TableHead>
                <TableHead>Associado</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Data/Período</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vistorias.map((vistoria) => (
                <TableRow 
                  key={vistoria.id}
                  className={vistoria.protecao_suspensa ? 'bg-red-50/50' : ''}
                >
                  <TableCell className="font-mono text-xs">
                    {vistoria.protocolo || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{vistoria.associado?.nome || '-'}</span>
                      <span className="text-xs text-muted-foreground">{vistoria.associado?.telefone}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{vistoria.veiculo?.placa || '-'}</span>
                      <span className="text-xs text-muted-foreground">
                        {vistoria.veiculo?.marca} {vistoria.veiculo?.modelo}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{vistoria.rastreador?.plataforma || '-'}</span>
                  </TableCell>
                  <TableCell>
                    {getMotivoBadge(vistoria.motivo_manutencao)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm">
                        {format(new Date(vistoria.data_agendada), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {PERIODO_LABELS[vistoria.periodo as keyof typeof PERIODO_LABELS] || vistoria.periodo}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(vistoria.status)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {/* ver detalhes */}}>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver detalhes
                        </DropdownMenuItem>

                        {vistoria.status === 'pendente' && canManage && (
                          <DropdownMenuItem onClick={() => { setVistoriaSelecionada(vistoria); setModalAgendar(true); }}>
                            <Calendar className="h-4 w-4 mr-2" />
                            Agendar
                          </DropdownMenuItem>
                        )}

                        {['agendada', 'em_rota', 'em_andamento'].includes(vistoria.status) && (
                          <DropdownMenuItem onClick={() => { setVistoriaSelecionada(vistoria); setModalResultado(true); }}>
                            <ClipboardCheck className="h-4 w-4 mr-2" />
                            Registrar resultado
                          </DropdownMenuItem>
                        )}

                        {vistoria.status === 'agendada' && 
                         podeMarcarNaoCompareceu(vistoria.local_tipo_manutencao as LocalTipoManutencao) && 
                         canManage && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => { setVistoriaSelecionada(vistoria); setDialogNaoCompareceu(true); }}
                              className="text-destructive"
                            >
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              Não compareceu
                            </DropdownMenuItem>
                          </>
                        )}

                        {vistoria.status === 'nao_compareceu' && canManage && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => { setVistoriaSelecionada(vistoria); setModalTratarAusencia(true); }}>
                              <AlertTriangle className="h-4 w-4 mr-2" />
                              Tratar ausência
                            </DropdownMenuItem>
                          </>
                        )}

                        {!['concluida', 'aprovada', 'cancelada', 'nao_compareceu'].includes(vistoria.status) && canManage && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => { setVistoriaSelecionada(vistoria); setDialogCancelar(true); }}
                              className="text-destructive"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancelar
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modais */}
      <AgendarManutencaoModal 
        open={modalAgendar} 
        onOpenChange={setModalAgendar}
        vistoria={vistoriaSelecionada}
      />
      <RegistrarResultadoModal 
        open={modalResultado} 
        onOpenChange={setModalResultado}
        vistoria={vistoriaSelecionada}
      />
      <TratarAusenciaModal
        open={modalTratarAusencia}
        onClose={() => setModalTratarAusencia(false)}
        vistoria={vistoriaSelecionada}
      />

      {/* Dialog Cancelar */}
      <AlertDialog open={dialogCancelar} onOpenChange={setDialogCancelar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {vistoriaSelecionada?.status === 'nao_compareceu' ? 'Cancelar e Suspender Proteção?' : 'Cancelar Manutenção?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {vistoriaSelecionada?.status === 'nao_compareceu' 
                ? 'Esta ação irá cancelar definitivamente a manutenção e SUSPENDER as proteções.'
                : 'Esta ação irá cancelar a vistoria de manutenção.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmarCancelamento}
              className={vistoriaSelecionada?.status === 'nao_compareceu' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {vistoriaSelecionada?.status === 'nao_compareceu' ? 'Sim, suspender proteção' : 'Sim, cancelar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Não Compareceu */}
      <AlertDialog open={dialogNaoCompareceu} onOpenChange={setDialogNaoCompareceu}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar como Não Compareceu?</AlertDialogTitle>
            <AlertDialogDescription>
              O associado não compareceu em 48h. As proteções serão SUSPENSAS conforme regulamento 5.12.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmarNaoCompareceu}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Suspender Proteção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
