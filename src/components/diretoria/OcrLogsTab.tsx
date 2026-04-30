import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDown, ChevronUp, Download, ScanText, AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const statusBadge: Record<string, { label: string; className: string }> = {
  sucesso: { label: 'Sucesso', className: 'border-success/30 bg-success/10 text-success' },
  revisar: { label: 'Revisar', className: 'border-warning/30 bg-warning/10 text-warning' },
  truncado: { label: 'Truncado', className: 'border-destructive/30 bg-destructive/10 text-destructive' },
  falha: { label: 'Falha', className: 'border-destructive/30 bg-destructive/10 text-destructive' },
};

const tipoOptions = ['cnh', 'crlv', 'rg', 'comprovante_residencia', 'nota_fiscal', 'atpv', 'cnpj', 'desconhecido'];

const csvEscape = (value: unknown) => {
  const text = value === null || value === undefined ? '-' : typeof value === 'string' ? value : JSON.stringify(value);
  return `"${String(text).replace(/"/g, '""')}"`;
};

const formatJSON = (data: unknown) => {
  if (!data) return '-';
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
};

export default function OcrLogsTab() {
  const [filters, setFilters] = useState({
    status: '',
    tipo: '',
    busca: '',
    dataInicio: '',
    dataFim: '',
  });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const { data: logs, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['ocr-execution-logs', filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from('ocr_execution_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

      if (filters.status) query = query.eq('status', filters.status);
      if (filters.tipo) query = query.eq('tipo_detectado', filters.tipo);
      if (filters.dataInicio) query = query.gte('created_at', filters.dataInicio);
      if (filters.dataFim) query = query.lte('created_at', `${filters.dataFim}T23:59:59`);
      if (filters.busca.trim()) {
        const term = filters.busca.trim().replace(/[%_]/g, '');
        query = query.or(`req_id.ilike.%${term}%,modelo.ilike.%${term}%,tipo_detectado.ilike.%${term}%,motivo.ilike.%${term}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const metrics = useMemo(() => {
    const list = logs || [];
    const last24h = list.filter((l: any) => new Date(l.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000);
    const total = list.length;
    const okCount = list.filter((l: any) => l.status === 'sucesso').length;
    const truncCount = list.filter((l: any) => l.truncated).length;
    const latencias = list.map((l: any) => l.latency_ms).filter((x: any) => Number.isFinite(x));
    const avgLat = latencias.length ? Math.round(latencias.reduce((a: number, b: number) => a + b, 0) / latencias.length) : 0;
    return {
      total24h: last24h.length,
      successRate: total ? Math.round((okCount / total) * 100) : 0,
      truncRate: total ? Math.round((truncCount / total) * 100) : 0,
      avgLat,
    };
  }, [logs]);

  const handleExport = () => {
    if (!logs?.length) return;
    const csv = [
      ['Data/Hora', 'Req ID', 'Tipo esperado', 'Tipo detectado', 'Status', 'Confiança', 'Modelo', 'Latência (ms)', 'Truncado', 'Retry', 'Fallback nativo', 'Motivo'].map(csvEscape).join(';'),
      ...logs.map((l: any) => [
        format(new Date(l.created_at), 'dd/MM/yyyy HH:mm:ss'),
        l.req_id,
        l.tipo_esperado,
        l.tipo_detectado,
        l.status,
        l.confianca,
        l.modelo,
        l.latency_ms,
        l.truncated ? 'sim' : 'não',
        l.used_retry ? 'sim' : 'não',
        l.used_native_fallback ? 'sim' : 'não',
        l.motivo,
      ].map(csvEscape).join(';')),
    ].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-ocr-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <ScanText className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Execuções (24h)</p>
              <p className="text-2xl font-bold">{metrics.total24h}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <CheckCircle2 className="h-8 w-8 text-success" />
            <div>
              <p className="text-xs text-muted-foreground">Taxa de sucesso</p>
              <p className="text-2xl font-bold">{metrics.successRate}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">Taxa de truncamento</p>
              <p className="text-2xl font-bold">{metrics.truncRate}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <Clock className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Latência média</p>
              <p className="text-2xl font-bold">{metrics.avgLat} ms</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <div>
              <label className="mb-1 block text-sm font-medium">Busca</label>
              <Input
                value={filters.busca}
                onChange={(e) => setFilters((f) => ({ ...f, busca: e.target.value }))}
                placeholder="Req ID, modelo, motivo"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Status</label>
              <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v === 'all' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(statusBadge).map(([k, { label }]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Tipo de documento</label>
              <Select value={filters.tipo} onValueChange={(v) => setFilters((f) => ({ ...f, tipo: v === 'all' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {tipoOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Data início</label>
              <Input type="date" value={filters.dataInicio} onChange={(e) => setFilters((f) => ({ ...f, dataInicio: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Data fim</label>
              <Input type="date" value={filters.dataFim} onChange={(e) => setFilters((f) => ({ ...f, dataFim: e.target.value }))} />
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="flex-1">
                <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar
              </Button>
              <Button variant="outline" onClick={handleExport} disabled={!logs?.length}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Data/Hora</TableHead>
                <TableHead className="w-[90px]">Req ID</TableHead>
                <TableHead className="w-[140px]">Tipo</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead className="w-[90px]">Confiança</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead className="w-[90px]">Latência</TableHead>
                <TableHead className="w-[110px]">Flags</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="py-8 text-center">Carregando...</TableCell></TableRow>
              ) : !logs?.length ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    <ScanText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    Nenhum log de OCR encontrado
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log: any) => (
                  <Fragment key={log.id}>
                    <TableRow className="border-b-0">
                      <TableCell className="font-mono text-xs">{format(new Date(log.created_at), 'dd/MM/yy HH:mm:ss', { locale: ptBR })}</TableCell>
                      <TableCell className="font-mono text-xs">{log.req_id || '-'}</TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs">
                          <span className="font-medium">{log.tipo_detectado || '-'}</span>
                          {log.tipo_esperado && log.tipo_esperado !== log.tipo_detectado && (
                            <span className="text-muted-foreground">esperado: {log.tipo_esperado}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadge[log.status]?.className || 'border-border bg-muted'}>
                          {statusBadge[log.status]?.label || log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.confianca != null ? `${Math.round(Number(log.confianca) * 100)}%` : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.modelo || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{log.latency_ms ? `${log.latency_ms}ms` : '-'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {log.truncated && <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive text-[10px]">trunc</Badge>}
                          {log.used_retry && <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning text-[10px]">retry</Badge>}
                          {log.used_native_fallback && <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[10px]">nativo</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}>
                          {expandedRow === log.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedRow === log.id && (
                      <TableRow>
                        <TableCell colSpan={9} className="bg-muted/50">
                          <div className="space-y-4 p-4">
                            <div className="grid gap-3 text-sm md:grid-cols-3">
                              <div><span className="text-muted-foreground">Provider:</span> <span className="font-mono">{log.provider || '-'}</span></div>
                              <div><span className="text-muted-foreground">Mime:</span> <span className="font-mono">{log.mime || '-'}</span></div>
                              <div><span className="text-muted-foreground">Bytes:</span> <span className="font-mono">{log.bytes ?? '-'}</span></div>
                              <div><span className="text-muted-foreground">PDF:</span> <span className="font-mono">{log.is_pdf ? 'sim' : 'não'}</span></div>
                              <div><span className="text-muted-foreground">Texto nativo:</span> <span className="font-mono">{log.has_native_text ? `${log.native_text_len} chars` : 'não'}</span></div>
                              <div><span className="text-muted-foreground">Sugestão:</span> <span className="font-mono">{log.sugestao || '-'}</span></div>
                              <div><span className="text-muted-foreground">Legível:</span> <span className="font-mono">{log.legivel == null ? '-' : log.legivel ? 'sim' : 'não'}</span></div>
                              <div><span className="text-muted-foreground">CPF corrigido via:</span> <span className="font-mono">{log.cpf_corrigido_via || '-'}</span></div>
                              <div><span className="text-muted-foreground">URL hash:</span> <span className="font-mono">{log.arquivo_url_hash || '-'}</span></div>
                            </div>
                            {log.motivo && (
                              <div className="rounded-md border bg-background p-3">
                                <h4 className="mb-1 text-sm font-medium">Motivo</h4>
                                <p className="text-sm text-muted-foreground">{log.motivo}</p>
                              </div>
                            )}
                            {log.erro && (
                              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                                <h4 className="mb-1 text-sm font-medium text-destructive">Erro</h4>
                                <p className="text-sm text-destructive">{log.erro}</p>
                              </div>
                            )}
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                              <div>
                                <h4 className="mb-2 text-sm font-medium">Dados extraídos</h4>
                                <pre className="max-h-64 overflow-auto rounded border bg-background p-3 text-xs">{formatJSON(log.dados_extraidos)}</pre>
                              </div>
                              <div>
                                <h4 className="mb-2 text-sm font-medium">Usage (tokens)</h4>
                                <pre className="max-h-64 overflow-auto rounded border bg-background p-3 text-xs">{formatJSON(log.usage)}</pre>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
