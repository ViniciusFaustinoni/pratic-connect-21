import { useState } from 'react';
import { useRastreadoresSyncQueue, type Plataforma, type RastSyncQueueItem } from '@/hooks/useRastreadoresSyncQueue';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Trash2, Activity, Clock, AlertTriangle, Send, Wifi, WifiOff, List, HeartPulse, Play, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RastreadorSyncQueueDetailModal } from './RastreadorSyncQueueDetailModal';

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    pendente: { label: 'Pendente', cls: 'border-yellow-500/30 text-yellow-600 bg-yellow-500/10' },
    processando: { label: 'Processando', cls: 'border-blue-500/30 text-blue-600 bg-blue-500/10' },
    falha: { label: 'Falha', cls: 'border-destructive/30 text-destructive bg-destructive/10' },
    falha_permanente: { label: 'Falha Permanente', cls: 'border-destructive/30 text-destructive bg-destructive/10' },
    concluido: { label: 'Concluído', cls: 'border-green-500/30 text-green-600 bg-green-500/10' },
  };
  const s = map[status || ''] || { label: status || '—', cls: 'border-muted-foreground/30 text-muted-foreground bg-muted' };
  return <Badge variant="outline" className={cn('text-xs', s.cls)}>{s.label}</Badge>;
}

function ago(d: string | null) { if (!d) return '—'; try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: ptBR }); } catch { return '—'; } }
function full(d: string | null) { if (!d) return '—'; try { return format(new Date(d), 'dd/MM/yyyy HH:mm', { locale: ptBR }); } catch { return '—'; } }

function PlataformaSection({ plataforma }: { plataforma: Plataforma }) {
  const { queue, counts, logs, pendentes, health, reprocess, discard, enqueue, testConnection, refetchAll } = useRastreadoresSyncQueue(plataforma);
  const last = health[0];
  const [filter, setFilter] = useState<string>('all');
  const [detail, setDetail] = useState<RastSyncQueueItem | null>(null);
  const filtered = filter === 'all' ? queue : queue.filter((q: any) => q.status === filter);
  const label = plataforma === 'softruck' ? 'Softruck' : 'Rede Veículos';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{label}</h3>
          <p className="text-xs text-muted-foreground">Fila de vínculos rastreador ↔ veículo ↔ usuário na plataforma</p>
        </div>
        <Button variant="outline" size="sm" onClick={refetchAll}><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={cn('border-l-4', last?.conexao_ok ? 'border-l-green-500' : last ? 'border-l-destructive' : 'border-l-muted-foreground')}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              {last?.conexao_ok ? <Wifi className="h-8 w-8 text-green-500" /> : <WifiOff className="h-8 w-8 text-destructive" />}
              <div className="flex-1">
                <p className="text-sm font-medium text-muted-foreground">Conexão API</p>
                <p className="text-lg font-bold">{last ? (last.conexao_ok ? 'Online' : 'Offline') : 'Não testado'}</p>
                {last?.tempo_resposta_ms && <p className="text-xs text-muted-foreground">{last.tempo_resposta_ms}ms</p>}
              </div>
            </div>
            <Button size="sm" className="w-full mt-3" onClick={() => testConnection.mutate()} disabled={testConnection.isPending}>
              {testConnection.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Activity className="h-4 w-4 mr-2" />}
              Testar agora
            </Button>
          </CardContent>
        </Card>

        <Card><CardContent className="p-5"><div className="flex items-center gap-3">
          <Clock className="h-8 w-8 text-yellow-500" />
          <div><p className="text-sm font-medium text-muted-foreground">Fila Pendente</p><p className="text-2xl font-bold">{counts.pendente}</p></div>
        </div></CardContent></Card>

        <Card><CardContent className="p-5"><div className="flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div><p className="text-sm font-medium text-muted-foreground">Falhas na Fila</p><p className="text-2xl font-bold">{counts.falha + counts.falha_permanente}</p></div>
        </div></CardContent></Card>

        <Card><CardContent className="p-5"><div className="flex items-center gap-3">
          <Send className="h-8 w-8 text-primary" />
          <div><p className="text-sm font-medium text-muted-foreground">Rastreadores Pendentes</p><p className="text-2xl font-bold">{pendentes.length}</p></div>
        </div></CardContent></Card>
      </div>

      {last && (
        <p className="text-xs text-muted-foreground">Último health check: {full(last.created_at)}{last.erro_mensagem && ` — ${last.erro_mensagem}`}</p>
      )}

      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue" className="gap-1.5"><List className="h-4 w-4" />Fila ({counts.total})</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5"><Activity className="h-4 w-4" />Logs ({logs.length})</TabsTrigger>
          <TabsTrigger value="pending" className="gap-1.5"><Send className="h-4 w-4" />Pendentes ({pendentes.length})</TabsTrigger>
          <TabsTrigger value="health" className="gap-1.5"><HeartPulse className="h-4 w-4" />Health Check</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(['all','pendente','falha','falha_permanente','concluido'] as const).map(f => {
              const c = f==='all'?counts.total : (counts as any)[f] ?? 0;
              const lbl = f==='all'?'Todos':f==='pendente'?'Pendentes':f==='falha'?'Falhas':f==='falha_permanente'?'Permanentes':'Concluídos';
              return (
                <Button key={f} variant={filter===f?'default':'outline'} size="sm" onClick={() => setFilter(f)} className="gap-2">
                  {lbl}<Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">{c}</Badge>
                </Button>
              );
            })}
          </div>
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>IMEI</TableHead><TableHead>Placa</TableHead><TableHead>Associado</TableHead>
                <TableHead>Tentativas</TableHead><TableHead>Status</TableHead><TableHead>Último Erro</TableHead>
                <TableHead>Quando</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum item na fila</TableCell></TableRow>
                ) : filtered.map((item: any) => (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetail(item)}>
                    <TableCell className="font-mono text-xs">{item.imei || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{item.veiculo_placa || '—'}</TableCell>
                    <TableCell className="text-sm">{item.associado_nome || '—'}</TableCell>
                    <TableCell className="text-sm">{item.tentativas ?? 0}/{item.max_tentativas ?? 5}</TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={item.erro_ultimo || ''}>{item.erro_ultimo || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{ago(item.ultima_tentativa_em || item.created_at)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Reprocessar"
                          onClick={() => reprocess.mutate(item.id)} disabled={reprocess.isPending}>
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        {item.status !== 'falha_permanente' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Descartar"
                            onClick={() => discard.mutate(item.id)} disabled={discard.isPending}>
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

        <TabsContent value="logs">
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Operação</TableHead><TableHead>Status</TableHead>
                <TableHead>Erro</TableHead><TableHead>Duração</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem logs</TableCell></TableRow>
                ) : logs.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs whitespace-nowrap">{full(l.created_at)}</TableCell>
                    <TableCell className="text-sm font-medium">{l.operacao}</TableCell>
                    <TableCell><Badge variant="outline" className={cn('text-xs', l.status === 'success' || l.status === 'ok' ? 'border-green-500/30 text-green-600 bg-green-500/10' : 'border-destructive/30 text-destructive bg-destructive/10')}>{l.status}</Badge></TableCell>
                    <TableCell className="max-w-[300px] truncate text-xs text-muted-foreground" title={l.erro_mensagem || ''}>{l.erro_mensagem || '—'}</TableCell>
                    <TableCell className="text-xs">{l.duracao_ms ? `${l.duracao_ms}ms` : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>IMEI</TableHead><TableHead>Placa</TableHead><TableHead>Associado</TableHead>
                <TableHead>Motivo</TableHead><TableHead className="text-right">Ação</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {pendentes.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Todos os rastreadores instalados estão vinculados</TableCell></TableRow>
                ) : pendentes.map((p: any) => (
                  <TableRow key={p.rastreador_id}>
                    <TableCell className="font-mono text-xs">{p.imei || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{p.veiculo_placa || '—'}</TableCell>
                    <TableCell className="text-sm">{p.associado_nome || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{p.motivo}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => enqueue.mutate(p.rastreador_id)} disabled={enqueue.isPending}>
                        <Play className="h-3.5 w-3.5 mr-1.5" />Sincronizar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="health">
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Status</TableHead><TableHead>Tempo</TableHead>
                <TableHead>Pendentes</TableHead><TableHead>Falhas</TableHead><TableHead>Não vinc.</TableHead><TableHead>Erro</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {health.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum check registrado</TableCell></TableRow>
                ) : health.map((h: any) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs whitespace-nowrap">{full(h.created_at)}</TableCell>
                    <TableCell>{h.conexao_ok ? <Badge variant="outline" className="border-green-500/30 text-green-600 bg-green-500/10 text-xs">OK</Badge> : <Badge variant="outline" className="border-destructive/30 text-destructive bg-destructive/10 text-xs">Falha</Badge>}</TableCell>
                    <TableCell className="text-xs">{h.tempo_resposta_ms ? `${h.tempo_resposta_ms}ms` : '—'}</TableCell>
                    <TableCell className="text-xs">{h.fila_pendentes ?? 0}</TableCell>
                    <TableCell className="text-xs">{h.fila_falhas ?? 0}</TableCell>
                    <TableCell className="text-xs">{h.rastreadores_nao_vinculados ?? 0}</TableCell>
                    <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground" title={h.erro_mensagem || ''}>{h.erro_mensagem || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <RastreadorSyncQueueDetailModal item={detail} open={!!detail} onOpenChange={(o) => !o && setDetail(null)} />
    </div>
  );
}

export function PlataformasSyncPanel() {
  return (
    <Tabs defaultValue="softruck" className="space-y-4">
      <TabsList>
        <TabsTrigger value="softruck">Softruck</TabsTrigger>
        <TabsTrigger value="rede_veiculos">Rede Veículos</TabsTrigger>
      </TabsList>
      <TabsContent value="softruck"><PlataformaSection plataforma="softruck" /></TabsContent>
      <TabsContent value="rede_veiculos"><PlataformaSection plataforma="rede_veiculos" /></TabsContent>
    </Tabs>
  );
}
