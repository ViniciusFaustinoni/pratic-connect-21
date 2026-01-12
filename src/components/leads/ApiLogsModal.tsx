import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Search, RefreshCw, Eye, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApiLeadsLogs, ApiLeadsLog } from '@/hooks/useApiLeadsLogs';
import type { ApiLeadsConfig } from '@/hooks/useApiLeadsConfig';

interface ApiLogsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ApiLeadsConfig | null;
}

export function ApiLogsModal({ open, onOpenChange, config }: ApiLogsModalProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data: logs, isLoading, refetch } = useApiLeadsLogs({
    configId: config?.id,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search,
    limit: 100,
  });

  const formatDate = (date: string) => {
    try {
      return format(new Date(date), "dd/MM HH:mm:ss", { locale: ptBR });
    } catch {
      return '-';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📊 Logs - {config?.nome || 'API'}
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex items-center gap-4 py-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="SUCESSO">Sucesso</SelectItem>
              <SelectItem value="ERRO">Erro</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar lead..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Table */}
        <ScrollArea className="h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Data/Hora</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Detalhes</TableHead>
                <TableHead className="w-20 text-right">Tempo</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Carregando logs...
                  </TableCell>
                </TableRow>
              ) : logs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum log encontrado
                  </TableCell>
                </TableRow>
              ) : (
                logs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">
                      {formatDate(log.created_at)}
                    </TableCell>
                    <TableCell>
                      {log.status === 'SUCESSO' ? (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          OK
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Erro
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.lead?.nome || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm">
                      {log.status === 'SUCESSO' 
                        ? 'Lead criado com sucesso' 
                        : log.erro || 'Erro desconhecido'}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {log.tempo_resposta_ms ? (
                        <span className="flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3" />
                          {log.tempo_resposta_ms}ms
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-96" align="end">
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm">Payload Recebido</h4>
                            <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-48">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                            {log.ip_origem && (
                              <p className="text-xs text-muted-foreground">
                                IP: {log.ip_origem}
                              </p>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
          <span>Mostrando {logs?.length || 0} logs</span>
          <Button variant="link" size="sm" onClick={() => refetch()}>
            Atualizar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
