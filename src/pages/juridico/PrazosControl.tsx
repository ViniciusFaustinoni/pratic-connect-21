import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  format, differenceInDays, startOfDay, addDays, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, isSameDay, isSameMonth, isToday, isBefore,
  subMonths, addMonths,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Clock, AlertTriangle, Check, Calendar as CalendarIcon, Search,
  ExternalLink, AlertCircle, CheckCircle, XCircle, Loader2,
  ChevronLeft, ChevronRight, List, LayoutGrid, Plus, Ban,
  ArrowRightLeft, Filter,
} from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { supabase } from '@/integrations/supabase/client';
import {
  PRIORIDADE_LABELS, PRIORIDADE_COLORS, TIPO_PROCESSO_LABELS,
  TIPO_PRAZO_LABELS, TIPO_PRAZO_COLORS, TipoPrazo,
} from '@/types/juridico';
import { NovoPrazoModal } from '@/components/juridico/NovoPrazoModal';
import { useAdvogados } from '@/hooks/useAdvogados';

// ─── Helpers ───
interface PrazoEnriquecido {
  id: string;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  prioridade: string;
  status: string;
  tipo?: string;
  observacao_cumprimento?: string;
  cumprido_em?: string;
  dias_uteis?: boolean;
  hora_vencimento?: string;
  prorrogado_de?: string;
  processo_id?: string;
  processo?: { id: string; numero: string; numero_processo?: string; parte_contraria_nome: string; tipo: string };
  responsavel?: { id: string; nome: string };
  diasRestantes: number;
  vencido: boolean;
}

const getDiasRestantesBadge = (dias: number, status: string) => {
  if (status === 'cumprido') return { label: 'Cumprido', className: 'bg-green-100 text-green-800' };
  if (status === 'perdido') return { label: 'Perdido', className: 'bg-red-100 text-red-800' };
  if (status === 'cancelado') return { label: 'Cancelado', className: 'bg-muted text-muted-foreground' };
  if (dias < 0) return { label: `VENCIDO ${Math.abs(dias)}d`, className: 'bg-red-600 text-white' };
  if (dias === 0) return { label: 'HOJE', className: 'bg-red-500 text-white' };
  if (dias <= 3) return { label: `${dias}d`, className: 'bg-red-400 text-white' };
  if (dias <= 7) return { label: `${dias}d`, className: 'bg-orange-400 text-white' };
  if (dias <= 15) return { label: `${dias}d`, className: 'bg-yellow-400 text-yellow-900' };
  return { label: `${dias}d`, className: 'bg-green-100 text-green-800' };
};

const getStatusIcon = (prazo: PrazoEnriquecido) => {
  if (prazo.status === 'cumprido') return <CheckCircle className="h-4 w-4 text-green-600" />;
  if (prazo.status === 'perdido' || prazo.vencido) return <XCircle className="h-4 w-4 text-red-600" />;
  if (prazo.status === 'cancelado') return <XCircle className="h-4 w-4 text-muted-foreground" />;
  if (prazo.diasRestantes <= 3) return <AlertCircle className="h-4 w-4 text-orange-500" />;
  return <Clock className="h-4 w-4 text-yellow-500" />;
};

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ─── Component ───
export default function PrazosControl() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<'lista' | 'calendario'>('lista');
  const [meusPrazos, setMeusPrazos] = useState(false);
  const [mesSelecionado, setMesSelecionado] = useState(new Date());
  const [diaSelecionado, setDiaSelecionado] = useState<Date | null>(null);
  const [novoPrazoOpen, setNovoPrazoOpen] = useState(false);

  // Filters
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('pendente');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroAdvogado, setFiltroAdvogado] = useState('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState('todos');

  // Modals
  const [cumprirModalOpen, setCumprirModalOpen] = useState(false);
  const [prorrogarModalOpen, setProrrogarModalOpen] = useState(false);
  const [cancelarModalOpen, setCancelarModalOpen] = useState(false);
  const [prazoSelecionado, setPrazoSelecionado] = useState<PrazoEnriquecido | null>(null);
  const [observacaoCumprimento, setObservacaoCumprimento] = useState('');
  const [novaDataProrrogacao, setNovaDataProrrogacao] = useState<Date | null>(null);
  const [motivoProrrogacao, setMotivoProrrogacao] = useState('');
  const [motivoCancelamento, setMotivoCancelamento] = useState('');

  // Current user
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);

  const { advogados } = useAdvogados({ ativo: true });

  // ─── KPI Query (unfiltered for real counts) ───
  const { data: allPrazos = [] } = useQuery({
    queryKey: ['prazos-controle-kpi'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processos_prazos')
        .select('id, data_fim, status, responsavel_id')
        .in('status', ['pendente', 'em_andamento']);
      if (error) throw error;
      return data;
    },
  });

  const kpi = useMemo(() => {
    const today = startOfDay(new Date());
    const filtered = meusPrazos && currentUserId ? allPrazos.filter(p => p.responsavel_id === currentUserId) : allPrazos;
    return {
      hoje: filtered.filter(p => isSameDay(new Date(p.data_fim), today)).length,
      semana: filtered.filter(p => { const d = new Date(p.data_fim); return d >= today && d <= addDays(today, 7); }).length,
      mes: filtered.filter(p => { const d = new Date(p.data_fim); return d >= today && d <= addDays(today, 30); }).length,
      vencidos: filtered.filter(p => isBefore(new Date(p.data_fim), today)).length,
      total: filtered.length,
    };
  }, [allPrazos, meusPrazos, currentUserId]);

  // ─── Main data query ───
  const { data: prazos = [], isLoading } = useQuery({
    queryKey: ['prazos-controle', filtroStatus, filtroTipo, filtroAdvogado, filtroPeriodo, meusPrazos, currentUserId],
    queryFn: async () => {
      let query = supabase
        .from('processos_prazos')
        .select(`*, processo:processos(id, numero, numero_processo, parte_contraria_nome, tipo), responsavel:profiles!processos_prazos_responsavel_id_fkey(id, nome)`)
        .order('data_fim', { ascending: true });

      if (filtroStatus !== 'todos') {
        if (filtroStatus === 'vencidos') {
          query = query.lt('data_fim', startOfDay(new Date()).toISOString().split('T')[0]).eq('status', 'pendente');
        } else {
          query = query.eq('status', filtroStatus);
        }
      }
      if (filtroTipo !== 'todos') query = query.eq('tipo', filtroTipo);
      if (filtroAdvogado !== 'todos') query = query.eq('responsavel_id', filtroAdvogado);
      if (meusPrazos && currentUserId) query = query.eq('responsavel_id', currentUserId);

      const today = startOfDay(new Date()).toISOString().split('T')[0];
      if (filtroPeriodo === 'hoje') query = query.eq('data_fim', today);
      else if (filtroPeriodo === 'semana') query = query.gte('data_fim', today).lte('data_fim', addDays(new Date(), 7).toISOString().split('T')[0]);
      else if (filtroPeriodo === 'mes') query = query.gte('data_fim', today).lte('data_fim', addDays(new Date(), 30).toISOString().split('T')[0]);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(p => ({
        ...p,
        diasRestantes: differenceInDays(new Date(p.data_fim), startOfDay(new Date())),
        vencido: isBefore(new Date(p.data_fim), startOfDay(new Date())) && p.status === 'pendente',
      })) as PrazoEnriquecido[];
    },
  });

  // Calendar query
  const { data: prazosCalendario = [] } = useQuery({
    queryKey: ['prazos-calendario', format(mesSelecionado, 'yyyy-MM'), meusPrazos, currentUserId],
    queryFn: async () => {
      const inicio = format(startOfMonth(mesSelecionado), 'yyyy-MM-dd');
      const fim = format(endOfMonth(mesSelecionado), 'yyyy-MM-dd');
      let query = supabase
        .from('processos_prazos')
        .select(`*, processo:processos(id, numero, numero_processo, parte_contraria_nome, tipo), responsavel:profiles!processos_prazos_responsavel_id_fkey(id, nome)`)
        .gte('data_fim', inicio).lte('data_fim', fim)
        .in('status', ['pendente', 'em_andamento'])
        .order('data_fim');
      if (meusPrazos && currentUserId) query = query.eq('responsavel_id', currentUserId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(p => ({
        ...p,
        diasRestantes: differenceInDays(new Date(p.data_fim), startOfDay(new Date())),
        vencido: isBefore(new Date(p.data_fim), startOfDay(new Date())) && p.status === 'pendente',
      })) as PrazoEnriquecido[];
    },
    enabled: viewMode === 'calendario',
  });

  // Busca client-side
  const prazosFiltrados = useMemo(() => {
    if (!busca) return prazos;
    const t = busca.toLowerCase();
    return prazos.filter(p =>
      p.descricao?.toLowerCase().includes(t) ||
      p.processo?.numero?.toLowerCase().includes(t) ||
      p.processo?.parte_contraria_nome?.toLowerCase().includes(t) ||
      p.responsavel?.nome?.toLowerCase().includes(t)
    );
  }, [prazos, busca]);

  // Calendar map
  const prazosPorDia = useMemo(() => {
    const map: Record<string, PrazoEnriquecido[]> = {};
    prazosCalendario.forEach(p => {
      const key = p.data_fim;
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    return map;
  }, [prazosCalendario]);

  // Prazos do dia selecionado
  const prazosDoDia = useMemo(() => {
    if (!diaSelecionado) return [];
    const key = format(diaSelecionado, 'yyyy-MM-dd');
    return prazosPorDia[key] || [];
  }, [diaSelecionado, prazosPorDia]);

  // ─── Mutations ───
  const cumprirMutation = useMutation({
    mutationFn: async ({ prazoId, observacao }: { prazoId: string; observacao?: string }) => {
      const { error } = await supabase.from('processos_prazos').update({ status: 'cumprido', cumprido_em: new Date().toISOString(), observacao_cumprimento: observacao, updated_at: new Date().toISOString() }).eq('id', prazoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prazos-controle'] });
      queryClient.invalidateQueries({ queryKey: ['prazos-controle-kpi'] });
      queryClient.invalidateQueries({ queryKey: ['prazos-calendario'] });
      toast.success('Prazo cumprido!');
      setCumprirModalOpen(false);
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const prorrogarMutation = useMutation({
    mutationFn: async ({ prazoId, novaData, motivo }: { prazoId: string; novaData: string; motivo: string }) => {
      const { data: current } = await supabase.from('processos_prazos').select('data_fim').eq('id', prazoId).single();
      const { error } = await supabase.from('processos_prazos').update({
        data_fim: novaData, prorrogado_de: current?.data_fim, prorrogacao_motivo: motivo, updated_at: new Date().toISOString(),
        alerta_enviado_7d: false, alerta_enviado_3d: false, alerta_enviado_1d: false, alerta_enviado_hoje: false,
      }).eq('id', prazoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prazos-controle'] });
      queryClient.invalidateQueries({ queryKey: ['prazos-controle-kpi'] });
      queryClient.invalidateQueries({ queryKey: ['prazos-calendario'] });
      toast.success('Prazo prorrogado!');
      setProrrogarModalOpen(false);
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const cancelarMutation = useMutation({
    mutationFn: async ({ prazoId, motivo }: { prazoId: string; motivo: string }) => {
      const { error } = await supabase.from('processos_prazos').update({ status: 'cancelado', cancelamento_motivo: motivo, updated_at: new Date().toISOString() }).eq('id', prazoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prazos-controle'] });
      queryClient.invalidateQueries({ queryKey: ['prazos-controle-kpi'] });
      queryClient.invalidateQueries({ queryKey: ['prazos-calendario'] });
      toast.success('Prazo cancelado!');
      setCancelarModalOpen(false);
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  // ─── Calendar grid ───
  const calendarDays = useMemo(() => {
    const start = startOfMonth(mesSelecionado);
    const end = endOfMonth(mesSelecionado);
    const days = eachDayOfInterval({ start, end });
    const startPad = getDay(start); // 0=Sun
    return { days, startPad };
  }, [mesSelecionado]);

  const getBadgeColorForDay = (dayPrazos: PrazoEnriquecido[]) => {
    if (dayPrazos.some(p => p.vencido)) return 'bg-red-600 text-white';
    const minDias = Math.min(...dayPrazos.map(p => p.diasRestantes));
    if (minDias <= 0) return 'bg-red-500 text-white';
    if (minDias <= 3) return 'bg-orange-500 text-white';
    if (minDias <= 7) return 'bg-yellow-500 text-yellow-900';
    return 'bg-blue-500 text-white';
  };

  // Action handlers
  const openCumprir = (p: PrazoEnriquecido) => { setPrazoSelecionado(p); setObservacaoCumprimento(''); setCumprirModalOpen(true); };
  const openProrrogar = (p: PrazoEnriquecido) => { setPrazoSelecionado(p); setNovaDataProrrogacao(null); setMotivoProrrogacao(''); setProrrogarModalOpen(true); };
  const openCancelar = (p: PrazoEnriquecido) => { setPrazoSelecionado(p); setMotivoCancelamento(''); setCancelarModalOpen(true); };

  // ─── Render ───
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Controle de Prazos</h1>
          <p className="text-muted-foreground">Gerencie prazos processuais, sindicâncias, ressarcimentos e outros</p>
        </div>
        <Button onClick={() => setNovoPrazoOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Novo Prazo
        </Button>
      </div>

      {/* 5 KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Vencendo Hoje', value: kpi.hoje, icon: AlertTriangle, danger: kpi.hoje > 0, onClick: () => setFiltroPeriodo('hoje') },
          { label: 'Esta Semana', value: kpi.semana, icon: CalendarIcon, danger: false, onClick: () => setFiltroPeriodo('semana') },
          { label: 'Este Mês', value: kpi.mes, icon: CalendarIcon, danger: false, onClick: () => setFiltroPeriodo('mes') },
          { label: 'Vencidos em Aberto', value: kpi.vencidos, icon: XCircle, danger: true, onClick: () => { setFiltroStatus('vencidos'); setFiltroPeriodo('todos'); } },
          { label: 'Total Ativos', value: kpi.total, icon: Clock, danger: false, onClick: () => { setFiltroStatus('pendente'); setFiltroPeriodo('todos'); } },
        ].map((card, i) => (
          <Card
            key={i}
            className={cn('cursor-pointer transition-colors hover:shadow-md', card.danger ? 'border-red-300 bg-red-50' : '')}
            onClick={card.onClick}
          >
            <CardHeader className="pb-2">
              <CardTitle className={cn('text-xs font-medium flex items-center gap-1.5', card.danger ? 'text-red-700' : 'text-muted-foreground')}>
                <card.icon className="h-3.5 w-3.5" /> {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn('text-2xl font-bold', card.danger ? 'text-red-600' : '')}>{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={meusPrazos} onCheckedChange={setMeusPrazos} id="meus" />
            <Label htmlFor="meus" className="text-sm cursor-pointer">Meus Prazos</Label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={viewMode === 'lista' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('lista')}>
            <List className="mr-1 h-4 w-4" /> Lista
          </Button>
          <Button variant={viewMode === 'calendario' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('calendario')}>
            <LayoutGrid className="mr-1 h-4 w-4" /> Calendário
          </Button>
        </div>
      </div>

      {/* Filters (list mode) */}
      {viewMode === 'lista' && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-10" />
              </div>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-full md:w-36"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendentes</SelectItem>
                  <SelectItem value="vencidos">Vencidos</SelectItem>
                  <SelectItem value="cumprido">Cumpridos</SelectItem>
                  <SelectItem value="cancelado">Cancelados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-full md:w-36"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos tipos</SelectItem>
                  {Object.entries(TIPO_PRAZO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filtroAdvogado} onValueChange={setFiltroAdvogado}>
                <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Advogado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos advogados</SelectItem>
                  {advogados.map(a => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                <SelectTrigger className="w-full md:w-32"><SelectValue placeholder="Período" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="semana">7 dias</SelectItem>
                  <SelectItem value="mes">30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── CALENDAR VIEW ─── */}
      {viewMode === 'calendario' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setMesSelecionado(subMonths(mesSelecionado, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold capitalize">
                  {format(mesSelecionado, 'MMMM yyyy', { locale: ptBR })}
                </h2>
                {!isSameMonth(mesSelecionado, new Date()) && (
                  <Button variant="outline" size="sm" onClick={() => setMesSelecionado(new Date())}>Hoje</Button>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => setMesSelecionado(addMonths(mesSelecionado, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Weekday header */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map(d => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {/* Padding */}
              {Array.from({ length: calendarDays.startPad }).map((_, i) => (
                <div key={`pad-${i}`} className="h-20" />
              ))}
              {calendarDays.days.map(day => {
                const key = format(day, 'yyyy-MM-dd');
                const dayPrazos = prazosPorDia[key] || [];
                const hasOverdue = dayPrazos.some(p => p.vencido);
                const isPast = isBefore(day, startOfDay(new Date())) && !isToday(day);

                return (
                  <div
                    key={key}
                    onClick={() => setDiaSelecionado(day)}
                    className={cn(
                      'h-20 border rounded-md p-1 cursor-pointer transition-colors hover:bg-accent/50 relative',
                      isToday(day) && 'border-primary border-2',
                      isPast && hasOverdue && 'bg-red-50',
                      diaSelecionado && isSameDay(day, diaSelecionado) && 'ring-2 ring-primary',
                    )}
                  >
                    <span className={cn('text-xs font-medium', isToday(day) && 'text-primary font-bold')}>
                      {format(day, 'd')}
                    </span>
                    {dayPrazos.length > 0 && (
                      <div className="absolute bottom-1 right-1">
                        <span className={cn('inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full text-xs font-bold', getBadgeColorForDay(dayPrazos))}>
                          {dayPrazos.length}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Day detail sheet */}
      <Sheet open={!!diaSelecionado && viewMode === 'calendario'} onOpenChange={(v) => !v && setDiaSelecionado(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {diaSelecionado && format(diaSelecionado, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {prazosDoDia.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum prazo neste dia</p>
            ) : (
              prazosDoDia.map(p => {
                const tipoLabel = TIPO_PRAZO_LABELS[(p.tipo || 'outro') as TipoPrazo] || p.tipo;
                const tipoColor = TIPO_PRAZO_COLORS[(p.tipo || 'outro') as TipoPrazo] || '';
                return (
                  <Card key={p.id} className={cn(p.vencido && 'border-red-300 bg-red-50')}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{p.descricao}</p>
                          <Badge className={cn('text-xs mt-1', tipoColor)}>{tipoLabel}</Badge>
                        </div>
                        {getStatusIcon(p)}
                      </div>
                      {p.processo && (
                        <button onClick={() => navigate(`/juridico/processos/${p.processo!.id}`)} className="text-xs text-primary hover:underline">
                          {p.processo.numero} — {p.processo.parte_contraria_nome}
                        </button>
                      )}
                      {p.responsavel && <p className="text-xs text-muted-foreground">Resp: {p.responsavel.nome}</p>}
                      {p.status === 'pendente' && (
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" variant="outline" onClick={() => openCumprir(p)}><Check className="mr-1 h-3 w-3" /> Cumprir</Button>
                          <Button size="sm" variant="outline" onClick={() => openProrrogar(p)}><ArrowRightLeft className="mr-1 h-3 w-3" /> Prorrogar</Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ─── LIST VIEW ─── */}
      {viewMode === 'lista' && (
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : prazosFiltrados.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum prazo encontrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="w-28">Tipo</TableHead>
                    <TableHead>Processo</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="w-24">Vencimento</TableHead>
                    <TableHead className="w-24">Dias</TableHead>
                    <TableHead className="w-20">Prioridade</TableHead>
                    <TableHead className="w-28 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prazosFiltrados.map(prazo => {
                    const diasBadge = getDiasRestantesBadge(prazo.diasRestantes, prazo.status);
                    const tipoLabel = TIPO_PRAZO_LABELS[(prazo.tipo || 'outro') as TipoPrazo] || prazo.tipo || 'Outro';
                    const tipoColor = TIPO_PRAZO_COLORS[(prazo.tipo || 'outro') as TipoPrazo] || '';
                    const prioridadeLabel = PRIORIDADE_LABELS[prazo.prioridade as keyof typeof PRIORIDADE_LABELS] || prazo.prioridade;
                    const prioridadeColor = PRIORIDADE_COLORS[prazo.prioridade as keyof typeof PRIORIDADE_COLORS] || '';

                    return (
                      <TableRow key={prazo.id} className={cn(prazo.vencido && 'bg-red-50')}>
                        <TableCell>{getStatusIcon(prazo)}</TableCell>
                        <TableCell>
                          <p className="font-medium text-sm line-clamp-1">{prazo.descricao}</p>
                          {prazo.dias_uteis && <span className="text-[10px] text-muted-foreground">dias úteis</span>}
                        </TableCell>
                        <TableCell><Badge className={cn('text-xs', tipoColor)}>{tipoLabel}</Badge></TableCell>
                        <TableCell>
                          {prazo.processo ? (
                            <button onClick={() => navigate(`/juridico/processos/${prazo.processo!.id}`)} className="text-sm text-primary hover:underline">
                              {prazo.processo.numero}
                            </button>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-sm">{prazo.responsavel?.nome || '-'}</TableCell>
                        <TableCell className="text-sm">{format(new Date(prazo.data_fim), 'dd/MM/yy')}</TableCell>
                        <TableCell><Badge className={diasBadge.className}>{diasBadge.label}</Badge></TableCell>
                        <TableCell><Badge className={prioridadeColor}>{prioridadeLabel}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {prazo.status === 'pendente' && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => openCumprir(prazo)} title="Cumprir"><Check className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => openProrrogar(prazo)} title="Prorrogar"><ArrowRightLeft className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => openCancelar(prazo)} title="Cancelar"><Ban className="h-4 w-4" /></Button>
                              </>
                            )}
                            {prazo.processo && (
                              <Button variant="ghost" size="icon" onClick={() => navigate(`/juridico/processos/${prazo.processo!.id}`)} title="Ver processo"><ExternalLink className="h-4 w-4" /></Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── MODALS ─── */}
      {/* Cumprir */}
      <Dialog open={cumprirModalOpen} onOpenChange={setCumprirModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cumprir Prazo</DialogTitle></DialogHeader>
          {prazoSelecionado && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{prazoSelecionado.descricao}</p>
                <p className="text-sm text-muted-foreground">Vencimento: {format(new Date(prazoSelecionado.data_fim), 'dd/MM/yyyy')}</p>
              </div>
              <div className="space-y-2">
                <Label>Observação (opcional)</Label>
                <Textarea value={observacaoCumprimento} onChange={(e) => setObservacaoCumprimento(e.target.value)} placeholder="Como o prazo foi cumprido..." rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCumprirModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => prazoSelecionado && cumprirMutation.mutate({ prazoId: prazoSelecionado.id, observacao: observacaoCumprimento || undefined })} disabled={cumprirMutation.isPending}>
              {cumprirMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prorrogar */}
      <Dialog open={prorrogarModalOpen} onOpenChange={setProrrogarModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Prorrogar Prazo</DialogTitle></DialogHeader>
          {prazoSelecionado && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{prazoSelecionado.descricao}</p>
                <p className="text-sm text-muted-foreground">Vencimento atual: {format(new Date(prazoSelecionado.data_fim), 'dd/MM/yyyy')}</p>
              </div>
              <div className="space-y-2">
                <Label>Nova data de vencimento *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !novaDataProrrogacao && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {novaDataProrrogacao ? format(novaDataProrrogacao, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={novaDataProrrogacao || undefined} onSelect={(d) => d && setNovaDataProrrogacao(d)} locale={ptBR} disabled={(d) => d <= new Date(prazoSelecionado.data_fim)} className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Motivo da prorrogação *</Label>
                <Textarea value={motivoProrrogacao} onChange={(e) => setMotivoProrrogacao(e.target.value)} placeholder="Justifique a prorrogação..." rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setProrrogarModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => prazoSelecionado && novaDataProrrogacao && prorrogarMutation.mutate({ prazoId: prazoSelecionado.id, novaData: format(novaDataProrrogacao, 'yyyy-MM-dd'), motivo: motivoProrrogacao })}
              disabled={!novaDataProrrogacao || !motivoProrrogacao.trim() || prorrogarMutation.isPending}
            >
              {prorrogarMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Prorrogar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancelar */}
      <Dialog open={cancelarModalOpen} onOpenChange={setCancelarModalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar Prazo</DialogTitle></DialogHeader>
          {prazoSelecionado && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{prazoSelecionado.descricao}</p>
              </div>
              <div className="space-y-2">
                <Label>Motivo do cancelamento *</Label>
                <Textarea value={motivoCancelamento} onChange={(e) => setMotivoCancelamento(e.target.value)} placeholder="Motivo..." rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelarModalOpen(false)}>Voltar</Button>
            <Button variant="destructive" onClick={() => prazoSelecionado && cancelarMutation.mutate({ prazoId: prazoSelecionado.id, motivo: motivoCancelamento })} disabled={!motivoCancelamento.trim() || cancelarMutation.isPending}>
              {cancelarMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Cancelar Prazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Novo Prazo Modal */}
      <NovoPrazoModal open={novoPrazoOpen} onClose={() => setNovoPrazoOpen(false)} />
    </div>
  );
}
