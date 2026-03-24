import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PermissionGate } from '@/components/PermissionGate';
import { useVistoriasPrestadoresDashboard, VistoriaPrestadorLink } from '@/hooks/useVistoriasPrestadoresDashboard';
import { formatarMoeda } from '@/utils/format';
import { format, subDays, isAfter, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ClipboardList, Clock, Play, CheckCircle2, DollarSign, TrendingUp, Search, Loader2 } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  aguardando: { label: 'Aguardando', variant: 'outline' },
  em_execucao: { label: 'Em Execução', variant: 'secondary' },
  concluida: { label: 'Concluída', variant: 'default' },
};

function formatDate(date: string | null) {
  if (!date) return '—';
  return format(parseISO(date), "dd/MM/yy HH:mm", { locale: ptBR });
}

export default function VistoriasPrestadoresDashboard() {
  const { data: links = [], isLoading, metricas } = useVistoriasPrestadoresDashboard();
  const [periodo, setPeriodo] = useState('30');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const [prestadorFiltro, setPrestadorFiltro] = useState('todos');
  const [busca, setBusca] = useState('');

  const prestadoresUnicos = useMemo(() => {
    const nomes = [...new Set(links.map(l => l.prestador_nome))].sort();
    return nomes;
  }, [links]);

  const filtrados = useMemo(() => {
    let result = links;

    if (periodo !== 'todos') {
      const dias = Number(periodo);
      const limite = subDays(new Date(), dias);
      result = result.filter(l => isAfter(parseISO(l.created_at), limite));
    }

    if (statusFiltro !== 'todos') {
      result = result.filter(l => l.status === statusFiltro);
    }

    if (prestadorFiltro !== 'todos') {
      result = result.filter(l => l.prestador_nome === prestadorFiltro);
    }

    if (busca.trim()) {
      const q = busca.toLowerCase();
      result = result.filter(l =>
        l.prestador_nome.toLowerCase().includes(q) ||
        l.associado_nome?.toLowerCase().includes(q) ||
        l.cidade?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [links, periodo, statusFiltro, prestadorFiltro, busca]);

  const metricasFiltradas = useMemo(() => {
    const aguardando = filtrados.filter(i => i.status === 'aguardando').length;
    const emExecucao = filtrados.filter(i => i.status === 'em_execucao').length;
    const concluidas = filtrados.filter(i => i.status === 'concluida').length;
    const valorPrevisto = filtrados.reduce((s, i) => s + (i.valor ?? 0), 0);
    const valorPago = filtrados.filter(i => i.status === 'concluida').reduce((s, i) => s + (i.valor ?? 0), 0);
    return { total: filtrados.length, aguardando, emExecucao, concluidas, valorPrevisto, valorPago };
  }, [filtrados]);

  return (
    <PermissionGate
      permission={['isDiretor', 'isAdminMaster', 'isCoordenadorMonitoramento', 'canManageContabilidade']}
      mode="any"
      fallback={<div className="p-8 text-center text-muted-foreground">Acesso restrito</div>}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vistorias — Prestadores Externos</h1>
          <p className="text-muted-foreground text-sm">Acompanhamento em tempo real das vistorias atribuídas a parceiros</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard icon={ClipboardList} label="Total" value={String(metricasFiltradas.total)} />
          <KpiCard icon={Clock} label="Aguardando" value={String(metricasFiltradas.aguardando)} className="border-l-4 border-l-yellow-500" />
          <KpiCard icon={Play} label="Em Execução" value={String(metricasFiltradas.emExecucao)} className="border-l-4 border-l-blue-500" />
          <KpiCard icon={CheckCircle2} label="Concluídas" value={String(metricasFiltradas.concluidas)} className="border-l-4 border-l-green-500" />
          <KpiCard icon={DollarSign} label="Valor Previsto" value={formatarMoeda(metricasFiltradas.valorPrevisto)} className="border-l-4 border-l-primary" />
          <KpiCard icon={TrendingUp} label="Valor Pago" value={formatarMoeda(metricasFiltradas.valorPago)} className="border-l-4 border-l-emerald-600" />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="w-48">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Período</label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Hoje</SelectItem>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="aguardando">Aguardando</SelectItem>
                <SelectItem value="em_execucao">Em Execução</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-56">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Prestador</label>
            <Select value={prestadorFiltro} onValueChange={setPrestadorFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {prestadoresUnicos.map(n => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Buscar</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Prestador, associado ou cidade..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtrados.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                Nenhuma vistoria encontrada
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prestador</TableHead>
                    <TableHead>Associado</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Atribuído em</TableHead>
                    <TableHead>Chegada</TableHead>
                    <TableHead>Conclusão</TableHead>
                    <TableHead>WhatsApp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtrados.map(link => (
                    <TableRow key={link.id}>
                      <TableCell className="font-medium">{link.prestador_nome}</TableCell>
                      <TableCell>{link.associado_nome ?? '—'}</TableCell>
                      <TableCell>{link.cidade ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_CONFIG[link.status]?.variant ?? 'outline'}>
                          {STATUS_CONFIG[link.status]?.label ?? link.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {link.valor != null ? formatarMoeda(link.valor) : '—'}
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(link.created_at)}</TableCell>
                      <TableCell className="text-xs">{formatDate(link.chegada_em)}</TableCell>
                      <TableCell className="text-xs">{formatDate(link.concluida_em)}</TableCell>
                      <TableCell>
                        <Badge variant={link.whatsapp_enviado ? 'default' : 'outline'}>
                          {link.whatsapp_enviado ? 'Sim' : 'Não'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  );
}

function KpiCard({ icon: Icon, label, value, className = '' }: { icon: any; label: string; value: string; className?: string }) {
  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-lg font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
