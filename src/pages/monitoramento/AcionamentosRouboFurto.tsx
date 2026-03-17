import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldAlert, Clock, CheckCircle, AlertTriangle, MapPin, Search, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAcionamentosTodos, useAcionamentosContadores, useAutorizarAcionamento } from '@/hooks/useAcionamentosRouboFurtoPage';
import { useEncerrarAcionamento, ACIONAMENTO_STATUS_LABELS, TIPO_ORIGEM_LABELS } from '@/hooks/useAcionamentoRoubo';

export default function AcionamentosRouboFurto() {
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [origemFilter, setOrigemFilter] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [encerrarModal, setEncerrarModal] = useState<string | null>(null);
  const [motivoEncerramento, setMotivoEncerramento] = useState('');

  const filters: Record<string, string> = {};
  if (statusFilter !== 'todos') filters.status = statusFilter;
  if (origemFilter !== 'todos') filters.tipo_origem = origemFilter;

  const { data: acionamentos, isLoading } = useAcionamentosTodos(filters);
  const { data: contadores } = useAcionamentosContadores();
  const autorizarMutation = useAutorizarAcionamento();
  const encerrarMutation = useEncerrarAcionamento();

  const filtered = acionamentos?.filter(a => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const veiculo = a.veiculo as any;
    const associado = a.associado as any;
    return (
      veiculo?.placa?.toLowerCase().includes(term) ||
      associado?.nome?.toLowerCase().includes(term) ||
      a.protocolo_externo?.toLowerCase().includes(term)
    );
  });

  const handleEncerrar = () => {
    if (!encerrarModal || !motivoEncerramento.trim()) return;
    encerrarMutation.mutate(
      { acionamentoId: encerrarModal, motivo: motivoEncerramento },
      {
        onSuccess: () => {
          setEncerrarModal(null);
          setMotivoEncerramento('');
        },
      }
    );
  };

  const getStatusBadge = (status: string | null) => {
    const config = ACIONAMENTO_STATUS_LABELS[status || ''];
    if (!config) return <Badge variant="outline">{status}</Badge>;
    return (
      <Badge className={`${config.color} text-white border-0`}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-destructive" />
          Acionamentos Roubo / Furto
        </h1>
        <p className="text-muted-foreground text-sm">
          Gerencie e autorize acionamentos de rastreamento intensivo
        </p>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aguardando Análise</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{contadores?.solicitados ?? '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{contadores?.ativos ?? '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Encerrados Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{contadores?.encerradosHoje ?? '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contadores?.totalMes ?? '-'}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por placa, associado ou protocolo..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Status</SelectItem>
            <SelectItem value="solicitado">Solicitado</SelectItem>
            <SelectItem value="autorizado">Autorizado</SelectItem>
            <SelectItem value="enviado">Enviado</SelectItem>
            <SelectItem value="confirmado">Confirmado</SelectItem>
            <SelectItem value="encerrado">Encerrado</SelectItem>
            <SelectItem value="erro">Erro</SelectItem>
          </SelectContent>
        </Select>
        <Select value={origemFilter} onValueChange={setOrigemFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as Origens</SelectItem>
            <SelectItem value="sinistro">Sinistro</SelectItem>
            <SelectItem value="assistencia">Assistência 24h</SelectItem>
            <SelectItem value="diretoria">Diretoria</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Associado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Protocolo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !filtered?.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum acionamento encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(acionamento => {
                    const veiculo = acionamento.veiculo as any;
                    const associado = acionamento.associado as any;
                    const isSolicitado = acionamento.status === 'solicitado';
                    const isAtivo = ['solicitado', 'autorizado', 'enviado', 'confirmado'].includes(acionamento.status || '');

                    return (
                      <TableRow key={acionamento.id} className={isSolicitado ? 'bg-yellow-50/50 dark:bg-yellow-950/10' : ''}>
                        <TableCell className="font-medium">
                          <div>{veiculo?.placa || '-'}</div>
                          <div className="text-xs text-muted-foreground">
                            {veiculo?.marca} {veiculo?.modelo}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{associado?.nome || '-'}</div>
                          {associado?.telefone && (
                            <div className="text-xs text-muted-foreground">{associado.telefone}</div>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(acionamento.status)}</TableCell>
                        <TableCell className="text-sm">
                          {TIPO_ORIGEM_LABELS[acionamento.tipo_origem] || acionamento.tipo_origem}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {acionamento.solicitado_em
                            ? format(new Date(acionamento.solicitado_em), "dd/MM/yy HH:mm", { locale: ptBR })
                            : acionamento.created_at
                              ? format(new Date(acionamento.created_at), "dd/MM/yy HH:mm", { locale: ptBR })
                              : '-'}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {acionamento.protocolo_externo || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {isSolicitado && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => autorizarMutation.mutate(acionamento.id)}
                                disabled={autorizarMutation.isPending}
                              >
                                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                                Autorizar
                              </Button>
                            )}
                            {isAtivo && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEncerrarModal(acionamento.id)}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                Encerrar
                              </Button>
                            )}
                            {acionamento.ultima_posicao_lat && acionamento.ultima_posicao_lng && (
                              <Button
                                size="sm"
                                variant="ghost"
                                asChild
                              >
                                <a
                                  href={`https://www.google.com/maps?q=${acionamento.ultima_posicao_lat},${acionamento.ultima_posicao_lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <MapPin className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Encerrar */}
      <Dialog open={!!encerrarModal} onOpenChange={() => setEncerrarModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encerrar Acionamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Motivo do encerramento..."
              value={motivoEncerramento}
              onChange={e => setMotivoEncerramento(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEncerrarModal(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleEncerrar}
              disabled={!motivoEncerramento.trim() || encerrarMutation.isPending}
            >
              Confirmar Encerramento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
