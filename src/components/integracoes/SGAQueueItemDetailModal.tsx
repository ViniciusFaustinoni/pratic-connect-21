import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { SGAQueueItem } from '@/hooks/useSGAHealthCheck';

interface Props {
  item: SGAQueueItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LogRow {
  id: string;
  created_at: string | null;
  action: string;
  status: string;
  error_message: string | null;
  duracao_ms: number | null;
  request_payload: any;
  response_payload: any;
}

function fmt(d: string | null) {
  if (!d) return '—';
  try { return format(new Date(d), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }); } catch { return '—'; }
}

export function SGAQueueItemDetailModal({ item, open, onOpenChange }: Props) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['sga-queue-item-logs', item?.veiculo_id, item?.associado_id],
    enabled: !!item && open,
    queryFn: async (): Promise<LogRow[]> => {
      let q = supabase
        .from('sga_sync_logs')
        .select('id, created_at, action, status, error_message, duracao_ms, request_payload, response_payload')
        .order('created_at', { ascending: false })
        .limit(200);
      if (item?.veiculo_id) q = q.eq('veiculo_id', item.veiculo_id);
      else if (item?.associado_id) q = q.eq('associado_id', item.associado_id);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as LogRow[];
    },
  });

  const errorLogs = (logs || []).filter(l => l.status !== 'success' && l.status !== 'ok');
  const successLogs = (logs || []).filter(l => l.status === 'success' || l.status === 'ok');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Histórico de erros — {item?.associado_nome}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="outline" className="font-mono">{item?.veiculo_placa}</Badge>
            {item?.etapa_parou && <Badge variant="outline">Etapa: {item.etapa_parou}</Badge>}
            <Badge variant="outline">Tentativas: {item?.tentativas ?? 0}</Badge>
          </DialogDescription>
        </DialogHeader>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Erros</span>
            </div>
            <p className="text-2xl font-bold">{errorLogs.length}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Sucessos</span>
            </div>
            <p className="text-2xl font-bold">{successLogs.length}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Última tentativa</span>
            </div>
            <p className="text-xs font-medium pt-1">{fmt(item?.ultima_tentativa_em || null)}</p>
          </Card>
        </div>

        {/* Current error highlight */}
        {item?.erro_ultimo && (
          <Card className="p-3 border-destructive/30 bg-destructive/5">
            <p className="text-xs font-semibold text-destructive mb-1">Último erro registrado na fila</p>
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">{item.erro_ultimo}</p>
          </Card>
        )}

        {/* Timeline */}
        <ScrollArea className="h-[50vh] pr-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando histórico…
            </div>
          ) : (logs || []).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum log encontrado para este item.
            </div>
          ) : (
            <div className="space-y-2">
              {logs!.map(log => {
                const isError = log.status !== 'success' && log.status !== 'ok';
                return (
                  <Card key={log.id} className={cn('p-3', isError && 'border-destructive/30')}>
                    <div className="flex items-start gap-3">
                      {isError
                        ? <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        : <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{log.action}</span>
                          <Badge variant="outline" className={cn('text-xs',
                            isError
                              ? 'border-destructive/30 text-destructive bg-destructive/10'
                              : 'border-green-500/30 text-green-600 bg-green-500/10'
                          )}>
                            {isError ? 'Erro' : 'Sucesso'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{fmt(log.created_at)}</span>
                          {log.duracao_ms != null && (
                            <span className="text-xs text-muted-foreground">· {log.duracao_ms}ms</span>
                          )}
                        </div>
                        {log.error_message && (
                          <p className="text-sm text-foreground whitespace-pre-wrap break-words mb-2">
                            {log.error_message}
                          </p>
                        )}
                        {(log.request_payload || log.response_payload) && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              Ver payloads
                            </summary>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                              {log.request_payload && (
                                <div>
                                  <p className="text-xs font-semibold mb-1">Request</p>
                                  <pre className="bg-muted p-2 rounded text-[10px] overflow-auto max-h-48">
                                    {JSON.stringify(log.request_payload, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.response_payload && (
                                <div>
                                  <p className="text-xs font-semibold mb-1">Response</p>
                                  <pre className="bg-muted p-2 rounded text-[10px] overflow-auto max-h-48">
                                    {JSON.stringify(log.response_payload, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
