import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, AlertTriangle, Clock, RefreshCcw, Skull } from 'lucide-react';
import { useSaudeAtivacao } from '@/hooks/useSaudeAtivacao';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const tipoLabel: Record<string, string> = {
  aguardando_instalacao_72h: 'Aguardando instalação > 72h',
  assinado_orfao: 'Assinado órfão (precisa reenfileirar)',
  instalacao_em_andamento_24h: 'Instalação em andamento > 24h',
};

function sevColor(sev: string) {
  return sev === 'alta' ? 'destructive' : sev === 'media' ? 'default' : 'secondary';
}

function statusColor(s: string) {
  if (s === 'success' || s === 'resolvido') return 'default';
  if (s === 'dead_letter') return 'destructive';
  if (s === 'failed') return 'destructive';
  if (s === 'processing' || s === 'pending') return 'secondary';
  return 'outline';
}

export default function SaudeAtivacao() {
  const { limbo, fila, log, resumo, loading } = useSaudeAtivacao();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Saúde da Ativação</h1>
        <p className="text-muted-foreground">Monitora associados travados e integrações com retry pendente.</p>
      </div>

      {/* Resumo */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Em limbo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resumo.limbo_total}</div>
            <p className="text-xs text-muted-foreground">{resumo.limbo_alta} de severidade alta</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Fila pendente</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{resumo.fila_pending}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Em retry</CardTitle>
            <RefreshCcw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{resumo.fila_failed}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Dead letters</CardTitle>
            <Skull className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{resumo.fila_dead}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Última atualização</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-xs">{loading ? '...' : format(new Date(), "HH:mm:ss", { locale: ptBR })}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="limbo">
        <TabsList>
          <TabsTrigger value="limbo">Limbo ({resumo.limbo_total})</TabsTrigger>
          <TabsTrigger value="fila">Fila de integrações ({fila.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="log">Log de transições</TabsTrigger>
        </TabsList>

        <TabsContent value="limbo">
          <Card>
            <CardContent className="pt-6">
              <ScrollArea className="h-[500px]">
                {(limbo.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum associado em limbo. ✅</p>
                ) : (
                  <div className="space-y-2">
                    {(limbo.data ?? []).map((a) => (
                      <div key={a.id} className="flex items-start justify-between border rounded-md p-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={sevColor(a.severidade) as any}>{a.severidade}</Badge>
                            <span className="font-medium text-sm">{tipoLabel[a.tipo] ?? a.tipo}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Associado: <code>{a.associado_id?.slice(0,8) ?? '-'}</code>
                            {a.instalacao_id ? <> · Instalação: <code>{a.instalacao_id.slice(0,8)}</code></> : null}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Detectado em {format(new Date(a.primeira_deteccao_em), "dd/MM HH:mm")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fila">
          <Card>
            <CardContent className="pt-6">
              <ScrollArea className="h-[500px]">
                {(fila.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Fila vazia. ✅</p>
                ) : (
                  <div className="space-y-2">
                    {(fila.data ?? []).map((it) => (
                      <div key={it.id} className="border rounded-md p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant={statusColor(it.status) as any}>{it.status}</Badge>
                            <span className="font-medium">{it.integration}:{it.operation}</span>
                            <span className="text-xs text-muted-foreground">tent. {it.attempts}/{it.max_attempts}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {it.next_attempt_at ? `próx: ${format(new Date(it.next_attempt_at), "dd/MM HH:mm")}` : ''}
                          </span>
                        </div>
                        {it.last_error && (
                          <p className="text-xs text-destructive mt-1 line-clamp-2">{it.last_error}</p>
                        )}
                        {it.correlation_id && <p className="text-xs text-muted-foreground mt-1"><code>{it.correlation_id}</code></p>}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="log">
          <Card>
            <CardContent className="pt-6">
              <ScrollArea className="h-[500px]">
                <div className="space-y-1 text-sm">
                  {(log.data ?? []).map((l: any) => (
                    <div key={l.id} className="border-b pb-1 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-muted-foreground text-xs">{format(new Date(l.created_at), "dd/MM HH:mm:ss")}</span>
                        {' · '}
                        <code className="text-xs">{l.from_status ?? '∅'} → {l.to_status}</code>
                        {' · '}
                        <span className="text-xs">{l.source}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{l.associado_id?.slice(0,8)}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
