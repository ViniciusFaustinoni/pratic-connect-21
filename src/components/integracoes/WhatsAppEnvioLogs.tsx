import { Search, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, Clock, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useWhatsAppEnvioLogs } from '@/hooks/useWhatsAppEnvioLogs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusConfig: Record<string, { label: string; variant: 'default' | 'destructive' | 'secondary' | 'outline'; icon: React.ReactNode }> = {
  enviada: { label: 'Enviada', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
  entregue: { label: 'Entregue', variant: 'default', icon: <CheckCircle2 className="h-3 w-3" /> },
  lida: { label: 'Lida', variant: 'default', icon: <Eye className="h-3 w-3" /> },
  enviando: { label: 'Enviando', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  pendente: { label: 'Pendente', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
  erro: { label: 'Erro', variant: 'destructive', icon: <AlertCircle className="h-3 w-3" /> },
  cancelada: { label: 'Cancelada', variant: 'outline', icon: <AlertCircle className="h-3 w-3" /> },
};

function formatPhone(phone: string) {
  if (!phone) return '—';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 13) return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  if (clean.length === 12) return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 8)}-${clean.slice(8)}`;
  return phone;
}

export function WhatsAppEnvioLogs() {
  const { logs, total, totalPaginas, isLoading, filtros, setBusca, setStatus, setPagina } = useWhatsAppEnvioLogs();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>Log de Envios</span>
          <Badge variant="outline" className="font-normal">{total} registros</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por telefone, template ou mensagem..."
              className="pl-9"
              value={filtros.busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
          <Select value={filtros.status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="enviada">Enviada</SelectItem>
              <SelectItem value="entregue">Entregue</SelectItem>
              <SelectItem value="lida">Lida</SelectItem>
              <SelectItem value="erro">Erro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabela */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum envio encontrado
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Data/Hora</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Template / Mensagem</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead>Erro</TableHead>
                  <TableHead className="w-[90px]">Provedor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TooltipProvider>
                  {logs.map((log) => {
                    const sc = statusConfig[log.status] || statusConfig.pendente;
                    const templateName = log.template_id || (log.mensagem ? log.mensagem.substring(0, 40) + (log.mensagem.length > 40 ? '...' : '') : '—');

                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-sm font-mono">
                          {formatPhone(log.telefone)}
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default">
                                {log.template_id ? (
                                  <Badge variant="outline" className="font-mono text-xs">{log.template_id}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">{templateName}</span>
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs">
                              <p className="text-xs">{log.mensagem || 'Sem conteúdo'}</p>
                              {log.template_variaveis && (
                                <p className="text-xs mt-1 text-muted-foreground">
                                  Variáveis: {JSON.stringify(log.template_variaveis)}
                                </p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Badge variant={sc.variant} className="gap-1 text-xs">
                            {sc.icon}
                            {sc.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-[180px]">
                          {log.erro_mensagem ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-destructive cursor-default truncate block">
                                  {log.erro_codigo ? `[${log.erro_codigo}] ` : ''}{log.erro_mensagem.substring(0, 50)}...
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-sm">
                                <p className="text-xs">{log.erro_mensagem}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {(log as any).provedor || 'N/A'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TooltipProvider>
              </TableBody>
            </Table>
          </div>
        )}

        {/* Paginação */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              Página {filtros.pagina} de {totalPaginas}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={filtros.pagina <= 1}
                onClick={() => setPagina(filtros.pagina - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={filtros.pagina >= totalPaginas}
                onClick={() => setPagina(filtros.pagina + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
