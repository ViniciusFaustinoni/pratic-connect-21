import { Wifi, WifiOff, Activity, Loader2, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useIntegracaoHealthCheck } from '@/hooks/useIntegracaoHealthCheck';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  integracao: string;
  titulo?: string;
}

function formatDateFull(d: string | null) {
  if (!d) return '—';
  try { return format(new Date(d), 'dd/MM/yyyy HH:mm', { locale: ptBR }); } catch { return '—'; }
}

function formatRelative(d: string | null) {
  if (!d) return '—';
  try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: ptBR }); } catch { return '—'; }
}

export function IntegracaoHealthPanel({ integracao, titulo }: Props) {
  const { lastCheck, history, isLoading, testNow } = useIntegracaoHealthCheck(integracao);

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <p className="text-sm font-medium text-muted-foreground">
                  {titulo || 'Status da Conexão'}
                </p>
                <p className="text-lg font-bold text-foreground">
                  {isLoading ? 'Carregando...' : lastCheck ? (lastCheck.conexao_ok ? 'Online' : 'Offline') : 'Não testado'}
                </p>
                {lastCheck?.tempo_resposta_ms ? (
                  <p className="text-xs text-muted-foreground">{lastCheck.tempo_resposta_ms}ms</p>
                ) : null}
              </div>
            </div>
            <Button
              size="sm"
              className="w-full mt-3"
              onClick={() => testNow.mutate()}
              disabled={testNow.isPending}
            >
              {testNow.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Activity className="h-4 w-4 mr-2" />
              )}
              Testar agora
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Último Teste</p>
                <p className="text-sm font-bold text-foreground">
                  {lastCheck ? formatRelative(lastCheck.created_at) : 'Nunca'}
                </p>
                {lastCheck && (
                  <p className="text-xs text-muted-foreground">{formatDateFull(lastCheck.created_at)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <Activity className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Taxa de Sucesso</p>
                <p className="text-lg font-bold text-foreground">
                  {history.length > 0
                    ? `${Math.round((history.filter(h => h.conexao_ok).length / history.length) * 100)}%`
                    : '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Últimos {history.length} checks
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error alert */}
      {lastCheck && !lastCheck.conexao_ok && lastCheck.erro_mensagem && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm text-destructive font-medium">
            ⚠️ {lastCheck.erro_mensagem}
          </p>
        </div>
      )}

      {/* Details */}
      {lastCheck?.detalhes && Object.keys(lastCheck.detalhes).length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Detalhes</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="flex flex-wrap gap-3">
              {Object.entries(lastCheck.detalhes).map(([key, value]) => (
                <div key={key} className="flex items-center gap-1.5 text-sm">
                  <span className="text-muted-foreground">{key.replace(/_/g, ' ')}:</span>
                  <span className="font-medium text-foreground">{String(value ?? '—')}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Histórico de Health Checks</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tempo</TableHead>
              <TableHead>Erro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Nenhum health check registrado
                </TableCell>
              </TableRow>
            ) : history.map(hc => (
              <TableRow key={hc.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDateFull(hc.created_at)}
                </TableCell>
                <TableCell>
                  {hc.conexao_ok ? (
                    <Badge variant="outline" className="text-xs border-green-500/30 text-green-600 bg-green-500/10">
                      <CheckCircle className="h-3 w-3 mr-1" /> Online
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs border-destructive/30 text-destructive bg-destructive/10">
                      <XCircle className="h-3 w-3 mr-1" /> Offline
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {hc.tempo_resposta_ms ? `${hc.tempo_resposta_ms}ms` : '—'}
                </TableCell>
                <TableCell className="max-w-[250px] truncate text-xs text-muted-foreground">
                  {hc.erro_mensagem || '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
