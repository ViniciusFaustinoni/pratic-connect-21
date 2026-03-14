import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Building2, CheckCircle, XCircle, RefreshCw, Trash2,
  Play, Clock, AlertTriangle, Activity, Loader2, Wifi, WifiOff,
  List, Send, Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useSGAHealthCheck } from '@/hooks/useSGAHealthCheck';
import { ConfigurarIntegracaoSheet } from '@/components/integracoes/ConfigurarIntegracaoSheet';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; className: string }> = {
    pendente: { label: 'Pendente', className: 'border-yellow-500/30 text-yellow-600 bg-yellow-500/10' },
    processando: { label: 'Processando', className: 'border-blue-500/30 text-blue-600 bg-blue-500/10' },
    falha: { label: 'Falha', className: 'border-destructive/30 text-destructive bg-destructive/10' },
    falha_permanente: { label: 'Falha Permanente', className: 'border-destructive/30 text-destructive bg-destructive/10' },
    concluido: { label: 'Concluído', className: 'border-green-500/30 text-green-600 bg-green-500/10' },
  };
  const s = map[status || ''] || { label: status || '—', className: 'border-muted-foreground/30 text-muted-foreground bg-muted' };
  return <Badge variant="outline" className={cn('text-xs', s.className)}>{s.label}</Badge>;
}

function LogStatusBadge({ status }: { status: string }) {
  const isSuccess = status === 'success' || status === 'ok';
  return (
    <Badge variant="outline" className={cn('text-xs',
      isSuccess
        ? 'border-green-500/30 text-green-600 bg-green-500/10'
        : 'border-destructive/30 text-destructive bg-destructive/10'
    )}>
      {isSuccess ? 'Sucesso' : 'Erro'}
    </Badge>
  );
}

function formatDate(d: string | null) {
  if (!d) return '—';
  try {
    return formatDistanceToNow(new Date(d), { addSuffix: true, locale: ptBR });
  } catch { return '—'; }
}

function formatDateFull(d: string | null) {
  if (!d) return '—';
  try {
    return format(new Date(d), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch { return '—'; }
}

export default function IntegracaoSGAHinova() {
  const navigate = useNavigate();
  const {
    healthChecks, queue, logs, pendingVehicles,
    isLoading, testConnection, reprocess, discard, triggerSync, refetchAll,
  } = useSGAHealthCheck();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [queueFilter, setQueueFilter] = useState<string>('all');

  const lastCheck = healthChecks[0];
  const filteredQueue = queueFilter === 'all'
    ? queue
    : queue.filter(q => q.status === queueFilter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/configuracoes/integracoes')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            SGA Hinova
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoramento e tratamento de erros da sincronização
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
          <Settings className="h-4 w-4 mr-2" />
          Credenciais
        </Button>
        <Button variant="outline" size="sm" onClick={refetchAll}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Connection Status + Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Connection */}
        <Card className={cn(
          'border-l-4',
          lastCheck?.conexao_ok ? 'border-l-green-500' : lastCheck ? 'border-l-destructive' : 'border-l-muted-foreground'
        )}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              {lastCheck?.conexao_ok ? (
                <Wifi className="h-8 w-8 text-green-500" />
              ) : (
                <WifiOff className="h-8 w-8 text-destructive" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Conexão API</p>
                <p className="text-lg font-bold text-foreground">
                  {lastCheck ? (lastCheck.conexao_ok ? 'Online' : 'Offline') : 'Não testado'}
                </p>
                {lastCheck?.tempo_resposta_ms && (
                  <p className="text-xs text-muted-foreground">{lastCheck.tempo_resposta_ms}ms</p>
                )}
              </div>
            </div>
            <Button
              size="sm"
              className="w-full mt-3"
              onClick={() => testConnection.mutate()}
              disabled={testConnection.isPending}
            >
              {testConnection.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Activity className="h-4 w-4 mr-2" />
              )}
              Testar agora
            </Button>
          </CardContent>
        </Card>

        {/* Queue Pending */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-500" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Fila Pendente</p>
                <p className="text-2xl font-bold text-foreground">
                  {queue.filter(q => q.status === 'pendente').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Queue Failures */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Falhas na Fila</p>
                <p className="text-2xl font-bold text-foreground">
                  {queue.filter(q => q.status === 'falha' || q.status === 'falha_permanente').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Unsynced Vehicles */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Send className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Veículos Pendentes</p>
                <p className="text-2xl font-bold text-foreground">{pendingVehicles.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Last health check info */}
      {lastCheck && (
        <p className="text-xs text-muted-foreground">
          Último health check: {formatDateFull(lastCheck.created_at)}
          {lastCheck.erro_mensagem && ` — ${lastCheck.erro_mensagem}`}
        </p>
      )}

      {/* Tabs */}
      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue" className="gap-1.5">
            <List className="h-4 w-4" /> Fila ({queue.length})
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5">
            <Activity className="h-4 w-4" /> Logs ({logs.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-1.5">
            <Send className="h-4 w-4" /> Pendentes ({pendingVehicles.length})
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-1.5">
            <Wifi className="h-4 w-4" /> Health Checks
          </TabsTrigger>
        </TabsList>

        {/* Queue Tab */}
        <TabsContent value="queue" className="space-y-4">
          <div className="flex gap-2">
            {['all', 'pendente', 'falha', 'falha_permanente'].map(f => (
              <Button
                key={f}
                variant={queueFilter === f ? 'default' : 'outline'}
                size="sm"
                onClick={() => setQueueFilter(f)}
              >
                {f === 'all' ? 'Todos' : f === 'pendente' ? 'Pendentes' : f === 'falha' ? 'Falhas' : 'Permanentes'}
              </Button>
            ))}
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Associado</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Tentativas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último Erro</TableHead>
                  <TableHead>Quando</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQueue.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhum item na fila
                    </TableCell>
                  </TableRow>
                ) : filteredQueue.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-sm">{item.associado_nome}</TableCell>
                    <TableCell className="font-mono text-sm">{item.veiculo_placa}</TableCell>
                    <TableCell className="text-sm">{item.etapa_parou || '—'}</TableCell>
                    <TableCell className="text-sm">{item.tentativas || 0}</TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground" title={item.erro_ultimo || ''}>
                      {item.erro_ultimo || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(item.ultima_tentativa_em)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Reprocessar"
                          onClick={() => reprocess.mutate(item.id)}
                          disabled={reprocess.isPending}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        {item.status !== 'falha_permanente' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            title="Descartar"
                            onClick={() => discard.mutate(item.id)}
                            disabled={discard.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erro</TableHead>
                  <TableHead>Duração</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum log encontrado
                    </TableCell>
                  </TableRow>
                ) : logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateFull(log.created_at)}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{log.action}</TableCell>
                    <TableCell><LogStatusBadge status={log.status} /></TableCell>
                    <TableCell className="max-w-[300px] truncate text-xs text-muted-foreground" title={log.error_message || ''}>
                      {log.error_message || '—'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.duracao_ms ? `${log.duracao_ms}ms` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Pending Vehicles Tab */}
        <TabsContent value="pending">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Associado</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingVehicles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Todos os veículos ativos estão sincronizados
                    </TableCell>
                  </TableRow>
                ) : pendingVehicles.map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium text-sm">{v.associado_nome}</TableCell>
                    <TableCell className="font-mono text-sm">{v.placa || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-600 bg-yellow-500/10">
                        Não enviado
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => triggerSync.mutate({ veiculoId: v.id, associadoId: v.associado_id })}
                        disabled={triggerSync.isPending}
                      >
                        <Play className="h-3.5 w-3.5 mr-1.5" />
                        Sincronizar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Health Checks History Tab */}
        <TabsContent value="health">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Conexão</TableHead>
                  <TableHead>Tempo</TableHead>
                  <TableHead>Pendentes</TableHead>
                  <TableHead>Falhas</TableHead>
                  <TableHead>Veículos Não Sync</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {healthChecks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhum health check registrado
                    </TableCell>
                  </TableRow>
                ) : healthChecks.map(hc => (
                  <TableRow key={hc.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateFull(hc.created_at)}
                    </TableCell>
                    <TableCell>
                      {hc.conexao_ok ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{hc.tempo_resposta_ms ? `${hc.tempo_resposta_ms}ms` : '—'}</TableCell>
                    <TableCell className="text-sm">{hc.fila_pendentes}</TableCell>
                    <TableCell className="text-sm">{hc.fila_falhas}</TableCell>
                    <TableCell className="text-sm">{hc.veiculos_nao_sincronizados}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {hc.erro_mensagem || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Credentials Sheet */}
      <ConfigurarIntegracaoSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        integracao="hinova"
        nomeExibicao="SGA Hinova"
        onSuccess={() => setSheetOpen(false)}
      />
    </div>
  );
}
