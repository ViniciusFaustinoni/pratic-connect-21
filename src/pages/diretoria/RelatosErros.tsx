import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Bug, Search, Eye } from 'lucide-react';
import { useErrorReportsList, ErrorReport, ErrorReportStatus } from '@/hooks/useErrorReports';
import { DetalheRelatoModal } from '@/components/diretoria/DetalheRelatoModal';

const STATUS_LABELS: Record<ErrorReportStatus, { label: string; cls: string }> = {
  aberto: { label: 'Aberto', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
  em_tratamento: { label: 'Em tratamento', cls: 'bg-warning/15 text-warning border-warning/30' },
  concluido: { label: 'Concluído', cls: 'bg-primary/15 text-primary border-primary/30' },
  validado: { label: 'Validado', cls: 'bg-success/15 text-success border-success/30' },
};

export default function RelatosErros() {
  const [tab, setTab] = useState<'todos' | ErrorReportStatus>('todos');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ErrorReport | null>(null);

  const { data: reports = [], isLoading } = useErrorReportsList({ status: tab, search });

  const counts = useMemo(() => {
    return reports.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<ErrorReportStatus, number>
    );
  }, [reports]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bug className="h-6 w-6 text-destructive" />
        <h1 className="text-2xl font-bold">Relatos de Erros</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['aberto', 'em_tratamento', 'concluido', 'validado'] as ErrorReportStatus[]).map((s) => (
          <Card key={s} className="p-3">
            <p className="text-xs text-muted-foreground">{STATUS_LABELS[s].label}</p>
            <p className="text-2xl font-semibold">{counts[s] ?? 0}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="aberto">Abertos</TabsTrigger>
            <TabsTrigger value="em_tratamento">Em tratamento</TabsTrigger>
            <TabsTrigger value="concluido">Concluídos</TabsTrigger>
            <TabsTrigger value="validado">Validados</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative md:ml-auto md:w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por área, descrição, autor..."
            className="pl-8"
          />
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Autor</TableHead>
              <TableHead>Área</TableHead>
              <TableHead className="hidden md:table-cell">Descrição</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && reports.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum relato encontrado.</TableCell></TableRow>
            )}
            {reports.map((r) => {
              const sb = STATUS_LABELS[r.status];
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="font-medium truncate max-w-[160px]">{r.reporter_nome || '—'}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[160px]">{r.reporter_email}</div>
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

      <DetalheRelatoModal report={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
