import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bug, Search, Eye, X, History as HistoryIcon, ListChecks, LayoutList, AlertTriangle } from 'lucide-react';
import {
  useErrorReportsList,
  useReportersList,
  useErrorReportHistoryGlobal,
  ErrorReport,
  ErrorReportStatus,
} from '@/hooks/useErrorReports';
import { DetalheRelatoModal } from '@/components/diretoria/DetalheRelatoModal';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import type { DateRange } from 'react-day-picker';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useErrorReportFiles } from '@/hooks/useErrorReports';

const STATUS_LABELS: Record<ErrorReportStatus, { label: string; cls: string }> = {
  aberto: { label: 'Aberto', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
  critico: { label: 'Crítico', cls: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/40' },
  em_tratamento: { label: 'Em tratamento', cls: 'bg-warning/15 text-warning border-warning/30' },
  concluido: { label: 'Concluído', cls: 'bg-primary/15 text-primary border-primary/30' },
  validado: { label: 'Validado', cls: 'bg-success/15 text-success border-success/30' },
  descartado: { label: 'Descartado', cls: 'bg-muted text-muted-foreground border-border' },
};

// 'concluido' fica visível apenas em Histórico (a pedido). Não aparece em Fila/Tabela/contadores/filtro.
const ORDEM_FILA: ErrorReportStatus[] = ['aberto', 'em_tratamento', 'critico'];

function CardRelatoFila({ report, onOpen }: { report: ErrorReport; onOpen: (r: ErrorReport) => void }) {
  const { data: files = [] } = useErrorReportFiles(report.id);
  const sb = STATUS_LABELS[report.status];
  const firstImage = files.find((f) => f.mime_type?.startsWith('image/'));
  const idade = formatDistanceToNow(new Date(report.created_at), { addSuffix: true, locale: ptBR });

  return (
    <button
      type="button"
      onClick={() => onOpen(report)}
      className="text-left w-full rounded-lg border border-border bg-card hover:border-primary/50 hover:shadow-sm transition p-3 flex gap-3"
    >
      {firstImage?.signedUrl ? (
        <img
          src={firstImage.signedUrl}
          alt=""
          className="w-16 h-16 rounded object-cover border border-border flex-shrink-0"
        />
      ) : (
        <div className="w-16 h-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
          <Bug className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={sb.cls}>{sb.label}</Badge>
          {report.eh_retratamento && report.vezes_retratado > 0 && (
            <Badge
              variant="outline"
              className="border-orange-500/40 text-orange-600 dark:text-orange-400 bg-orange-500/10"
              title={report.ultimo_motivo_retratamento ?? undefined}
            >
              ↻ Retratamento {report.vezes_retratado}ª vez
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">{idade}</span>
        </div>
        <p className="font-medium text-sm truncate">{report.area}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{report.descricao}</p>
        <p className="text-xs text-foreground/70">
          <span className="font-medium">{report.reporter_nome || '—'}</span>
          {report.reporter_email ? ` · ${report.reporter_email}` : ''}
        </p>
      </div>
    </button>
  );
}

export default function RelatosErros() {
  const [statusFilter, setStatusFilter] = useState<'todos' | ErrorReportStatus>('todos');
  const [search, setSearch] = useState('');
  const [reporterId, setReporterId] = useState<string>('todos');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selected, setSelected] = useState<ErrorReport | null>(null);
  const [aba, setAba] = useState<'fila' | 'tabela' | 'historico'>('fila');

  const filtros = useMemo(
    () => ({
      status: statusFilter,
      search: search.trim() || undefined,
      reporterId: reporterId === 'todos' ? null : reporterId,
      dateFrom: dateRange?.from ? dateRange.from.toISOString() : null,
      dateTo: dateRange?.to ? new Date(dateRange.to.setHours(23, 59, 59, 999)).toISOString() : null,
    }),
    [statusFilter, search, reporterId, dateRange]
  );

  const { data: reportsRaw = [], isLoading } = useErrorReportsList(filtros);
  const { data: reporters = [] } = useReportersList();

  // Concluídos saem das visualizações Fila e Tabela — vivem apenas no Histórico.
  const reports = useMemo(() => reportsRaw.filter((r) => r.status !== 'concluido'), [reportsRaw]);

  const counts = useMemo(() => {
    return reports.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<ErrorReportStatus, number>
    );
  }, [reports]);

  const reportsPorStatus = useMemo(() => {
    const grupos: Record<ErrorReportStatus, ErrorReport[]> = {
      aberto: [],
      critico: [],
      em_tratamento: [],
      concluido: [],
      validado: [],
      descartado: [],
    };
    for (const r of reports) grupos[r.status].push(r);
    // mais antigo primeiro = mais urgente; retratamentos sobem ao topo de "em_tratamento"
    for (const k of Object.keys(grupos) as ErrorReportStatus[]) {
      grupos[k].sort((a, b) => {
        if (k === 'em_tratamento' && a.eh_retratamento !== b.eh_retratamento) {
          return a.eh_retratamento ? -1 : 1;
        }
        return +new Date(a.created_at) - +new Date(b.created_at);
      });
    }
    return grupos;
  }, [reports]);

  const limparFiltros = () => {
    setSearch('');
    setReporterId('todos');
    setDateRange(undefined);
    setStatusFilter('todos');
  };

  const filtrosAtivos =
    !!search || reporterId !== 'todos' || !!dateRange?.from || statusFilter !== 'todos';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bug className="h-6 w-6 text-destructive" />
        <h1 className="text-2xl font-bold">Relatos de Erros</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {(['aberto', 'critico', 'em_tratamento', 'validado', 'descartado'] as ErrorReportStatus[]).map((s) => (
          <Card
            key={s}
            className={`p-3 cursor-pointer hover:bg-muted/30 transition ${statusFilter === s ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter(statusFilter === s ? 'todos' : s)}
          >
            <p className="text-xs text-muted-foreground">{STATUS_LABELS[s].label}</p>
            <p className="text-2xl font-semibold">{counts[s] ?? 0}</p>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card className="p-3 flex flex-col md:flex-row gap-2 md:items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por área, descrição, autor..."
            className="pl-8"
          />
        </div>

        <Select value={reporterId} onValueChange={setReporterId}>
          <SelectTrigger className="w-full md:w-64">
            <SelectValue placeholder="Filtrar por usuário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os usuários</SelectItem>
            {reporters.map((r) => (
              <SelectItem key={r.reporter_id} value={r.reporter_id}>
                {r.reporter_nome || r.reporter_email || r.reporter_id.slice(0, 8)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DatePickerWithRange date={dateRange} onDateChange={setDateRange} className="w-full md:w-auto" />

        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-full md:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {(Object.keys(STATUS_LABELS) as ErrorReportStatus[]).filter((s) => s !== 'concluido').map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {filtrosAtivos && (
          <Button variant="ghost" size="sm" onClick={limparFiltros}>
            <X className="h-4 w-4 mr-1" /> Limpar
          </Button>
        )}
      </Card>

      <Tabs value={aba} onValueChange={(v) => setAba(v as any)}>
        <TabsList>
          <TabsTrigger value="fila" className="gap-1">
            <ListChecks className="h-4 w-4" /> Fila
          </TabsTrigger>
          <TabsTrigger value="tabela" className="gap-1">
            <LayoutList className="h-4 w-4" /> Tabela
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1">
            <HistoryIcon className="h-4 w-4" /> Histórico
          </TabsTrigger>
        </TabsList>

        {/* FILA */}
        <TabsContent value="fila" className="mt-4">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!isLoading && reports.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">Nenhum relato com os filtros atuais.</Card>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {ORDEM_FILA.map((s) => (
              <div key={s} className="space-y-2">
                <div className="flex items-center gap-2 sticky top-0 bg-background py-1 z-10">
                  <Badge variant="outline" className={STATUS_LABELS[s].cls}>
                    {STATUS_LABELS[s].label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {reportsPorStatus[s].length} {reportsPorStatus[s].length === 1 ? 'item' : 'itens'}
                  </span>
                </div>
                <div className="space-y-2">
                  {reportsPorStatus[s].length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Nada por aqui.</p>
                  )}
                  {reportsPorStatus[s].map((r) => (
                    <CardRelatoFila key={r.id} report={r} onOpen={setSelected} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* TABELA */}
        <TabsContent value="tabela" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Usuário (autor)</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead className="hidden md:table-cell">Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                  </TableRow>
                )}
                {!isLoading && reports.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum relato encontrado.</TableCell>
                  </TableRow>
                )}
                {reports.map((r) => {
                  const sb = STATUS_LABELS[r.status];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium truncate max-w-[180px]">{r.reporter_nome || '—'}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[180px]">{r.reporter_email}</div>
                      </TableCell>
                      <TableCell className="text-sm font-medium">{r.area}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-md truncate">
                        {r.descricao}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={sb.cls}>{sb.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>
                          <Eye className="h-4 w-4 mr-1" /> Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* HISTÓRICO GLOBAL */}
        <TabsContent value="historico" className="mt-4">
          <HistoricoGlobalTab
            reporterId={reporterId === 'todos' ? null : reporterId}
            dateFrom={filtros.dateFrom}
            dateTo={filtros.dateTo}
            search={search}
            onOpenReport={setSelected}
          />
        </TabsContent>
      </Tabs>

      <DetalheRelatoModal report={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function HistoricoGlobalTab({
  reporterId,
  dateFrom,
  dateTo,
  search,
  onOpenReport,
}: {
  reporterId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  search: string;
  onOpenReport: (r: ErrorReport) => void;
}) {
  const { data: history = [], isLoading } = useErrorReportHistoryGlobal({
    reporterId,
    dateFrom,
    dateTo,
    search: search.trim() || undefined,
  });
  const { data: allReports = [] } = useErrorReportsList({ status: 'todos' });
  const reportMap = useMemo(() => {
    const m = new Map<string, ErrorReport>();
    for (const r of allReports) m.set(r.id, r);
    return m;
  }, [allReports]);

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Quando</TableHead>
            <TableHead>Relato (autor)</TableHead>
            <TableHead>Área</TableHead>
            <TableHead>Transição</TableHead>
            <TableHead>Por</TableHead>
            <TableHead className="hidden md:table-cell">Observação</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
            </TableRow>
          )}
          {!isLoading && history.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                Nenhuma movimentação encontrada.
              </TableCell>
            </TableRow>
          )}
          {history.map((h) => {
            const fromLabel = h.from_status ? STATUS_LABELS[h.from_status].label : 'novo';
            const toLabel = STATUS_LABELS[h.to_status].label;
            return (
              <TableRow key={h.id}>
                <TableCell className="text-xs whitespace-nowrap">
                  {new Date(h.created_at).toLocaleString('pt-BR')}
                </TableCell>
                <TableCell className="text-sm">
                  <div className="font-medium truncate max-w-[180px]">
                    {h.error_reports?.reporter_nome || '—'}
                  </div>
                </TableCell>
                <TableCell className="text-sm">{h.error_reports?.area}</TableCell>
                <TableCell className="text-xs">
                  <span className="text-muted-foreground">{fromLabel}</span>
                  <span className="mx-1">→</span>
                  <Badge variant="outline" className={STATUS_LABELS[h.to_status].cls}>
                    {toLabel}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{h.changed_by_nome || '—'}</TableCell>
                <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-sm truncate">
                  {h.observacao || '—'}
                </TableCell>
                <TableCell className="text-right">
                  {reportMap.has(h.report_id) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onOpenReport(reportMap.get(h.report_id)!)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
