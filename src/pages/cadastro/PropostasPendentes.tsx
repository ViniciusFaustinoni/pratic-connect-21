import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Clock,
  Eye,
  CheckCircle,
  XCircle,
  Search,
  FileText,
  RefreshCw,
  Zap,
  MoreHorizontal,
  Trash2,
  Loader2,
  Car,
  ArrowRight,
  ClipboardList,
  Inbox,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { usePropostasPendentes, usePropostaStats, PropostaPendente } from '@/hooks/usePropostasPendentes';
import { useInstalacoesAguardandoAtivacao } from '@/hooks/useVistoriaCompletaAnalise';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeleteAssociado } from '@/hooks/useAssociados';
import { supabase } from '@/integrations/supabase/client';
import { ConfirmacaoAcaoDialog } from '@/components/associados/ConfirmacaoAcaoDialog';
import { UserAvatar } from '@/components/UserAvatar';

// ============================================
// STATUS CONFIG
// ============================================
const statusFilters = [
  { value: 'todos', label: 'Todos' },
  { value: 'assinado', label: 'Aguardando' },
  { value: 'aguard_doc', label: 'Aguard. Doc' },
  { value: 'pendente_vistoria', label: 'Pend. Vistoria' },
  { value: 'aguard_vistoria', label: 'Aguard. Vistoria' },
  { value: 'aguard_instalacao', label: 'Aguard. Instalação' },
  { value: 'agendado', label: 'Agendado' },
  { value: 'em_analise', label: 'Em Análise' },
];

const tipoEntradaOptions = [
  { value: 'todos', label: 'Todos os tipos' },
  { value: 'comum', label: 'Nova adesão' },
  { value: 'inclusao', label: 'Inclusão de veículo' },
  { value: 'troca_titularidade', label: 'Troca de titularidade' },
  { value: 'substituicao_placa', label: 'Substituição de placa' },
];

const tipoVistoriaOptions = [
  { value: 'todos', label: 'Todas' },
  { value: 'autovistoria', label: 'Autovistoria' },
  { value: 'agendada_base', label: 'Vistoria na base' },
  { value: 'agendada', label: 'Vistoria agendada' },
  { value: 'sem_vistoria', label: 'Sem vistoria definida' },
];

const slaOptions = [
  { value: 'todos', label: 'Qualquer tempo' },
  { value: 'novo', label: 'Até 24h (no prazo)' },
  { value: 'atencao', label: '24h–48h (atenção)' },
  { value: 'atrasado', label: 'Acima de 48h (atrasado)' },
];

const ordenacaoOptions = [
  { value: 'reanalise_primeiro', label: 'Reanálise primeiro' },
  { value: 'mais_antiga', label: 'Mais antiga na fila' },
  { value: 'mais_recente', label: 'Mais recente' },
  { value: 'maior_valor', label: 'Maior valor FIPE' },
];

type CaracteristicaKey = 'zero_km' | 'blindado' | 'alienado' | 'uso_app' | 'diesel' | 'cobertura_total';
const caracteristicaOptions: { key: CaracteristicaKey; label: string }[] = [
  { key: 'zero_km', label: '0KM' },
  { key: 'blindado', label: 'Blindado' },
  { key: 'alienado', label: 'Alienado' },
  { key: 'uso_app', label: 'Uso APP' },
  { key: 'diesel', label: 'Diesel' },
  { key: 'cobertura_total', label: 'Cobertura Total' },
];

// Predicados compartilhados — usados em filtros e KPIs (mantém badge ↔ filtro coerentes)
function isPendenteVistoriaInicial(p: PropostaPendente) {
  return (
    p.status === 'assinado' &&
    p.cadastro_aprovado === true &&
    p.tipo_vistoria !== 'autovistoria' &&
    (!p.instalacao_info || p.instalacao_info.status !== 'concluida')
  );
}
function isAguardandoDoc(p: PropostaPendente) {
  return p.status === 'assinado' && p.tem_documento_pendente === true;
}
function isAgendado(p: PropostaPendente) {
  return p.status === 'assinado' && p.tipo_etapa_analise === 'agendamento_confirmado';
}
function isAguardVistoriaRF(p: PropostaPendente) {
  return (
    p.status === 'assinado' &&
    p.plano_tem_roubo_furto &&
    (!p.vistoria || !['concluida', 'aprovada', 'aprovada_ressalvas'].includes(p.vistoria.status || ''))
  );
}
function isAguardInstalacaoRF(p: PropostaPendente) {
  return (
    p.status === 'assinado' &&
    p.plano_tem_roubo_furto &&
    !!p.vistoria &&
    ['concluida', 'aprovada', 'aprovada_ressalvas'].includes(p.vistoria.status || '') &&
    (!p.instalacao_info || p.instalacao_info.status !== 'concluida')
  );
}
function horasNaFila(p: PropostaPendente): number {
  const ref = p.tempo_referencia || p.data_assinatura;
  if (!ref) return 0;
  return (Date.now() - new Date(ref).getTime()) / (1000 * 60 * 60);
}
function isCombustivelDiesel(c: string | null | undefined) {
  return !!c && /diesel/i.test(c);
}

function getStatusBadge(
  status: string | null,
  associadoStatus?: string | null,
  temDocPendente?: boolean,
  instalacaoInfo?: any,
  tipoEtapa?: string | null,
  proposta?: { plano_tem_roubo_furto?: boolean; vistoria?: { status?: string } | null; cadastro_aprovado?: boolean; tipo_vistoria?: string | null } | null,
) {
  // Aguard. Doc só quando realmente há documento pendente do cliente
  if (temDocPendente && status === 'assinado') {
    return <Badge className="bg-orange-500/15 text-orange-500 border-orange-500/30 text-[10px] px-1.5">Aguard. Doc</Badge>;
  }

  // Cadastro já aprovou + cenário SEM autovistoria + instalação ainda não concluída
  // → "Pendente Vistoria Inicial" (vistoria presencial / vistoria-base)
  if (
    status === 'assinado' &&
    proposta?.cadastro_aprovado &&
    proposta?.tipo_vistoria !== 'autovistoria' &&
    (!instalacaoInfo || instalacaoInfo?.status !== 'concluida')
  ) {
    return <Badge className="bg-purple-500/15 text-purple-500 border-purple-500/30 text-[10px] px-1.5">Pendente Vistoria Inicial</Badge>;
  }

  // NOVO: badge "Agendado" para propostas em fase de pré-execução
  if (status === 'assinado' && tipoEtapa === 'agendamento_confirmado') {
    return <Badge className="bg-blue-500/15 text-blue-500 border-blue-500/30 text-[10px] px-1.5">Agendado</Badge>;
  }

  // Plano com R&F: docs aprovados mas vistoria ainda não concluída/aprovada
  if (
    status === 'assinado' &&
    proposta?.plano_tem_roubo_furto &&
    (!proposta?.vistoria || !['concluida', 'aprovada', 'aprovada_ressalvas'].includes(proposta.vistoria?.status || ''))
  ) {
    return <Badge className="bg-purple-500/15 text-purple-500 border-purple-500/30 text-[10px] px-1.5">Aguard. Vistoria</Badge>;
  }

  // Vistoria aprovada mas instalação ainda não concluída
  if (
    status === 'assinado' &&
    proposta?.plano_tem_roubo_furto &&
    proposta?.vistoria && ['concluida', 'aprovada', 'aprovada_ressalvas'].includes(proposta.vistoria.status || '') &&
    (!instalacaoInfo || instalacaoInfo?.status !== 'concluida')
  ) {
    return <Badge className="bg-blue-500/15 text-blue-500 border-blue-500/30 text-[10px] px-1.5">Aguard. Instalação</Badge>;
  }

  const configs: Record<string, { label: string; className: string }> = {
    assinado: { label: 'Aguardando', className: 'bg-warning/15 text-warning border-warning/30' },
    em_analise: { label: 'Em Análise', className: 'bg-info/15 text-info border-info/30' },
    pendente_vistoria: { label: 'Pend. Vistoria', className: 'bg-purple-500/15 text-purple-500 border-purple-500/30' },
    ativo: { label: 'Aprovado', className: 'bg-success/15 text-success border-success/30' },
    reprovado: { label: 'Reprovado', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  };

  const cfg = configs[status || ''] || { label: status || '?', className: 'bg-muted text-muted-foreground' };
  return <Badge className={cn(cfg.className, "text-[10px] px-1.5")}>{cfg.label}</Badge>;
}

function getWaitColor(date: string | null) {
  if (!date) return 'border-l-border';
  const hours = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
  if (hours > 48) return 'border-l-destructive';
  if (hours > 24) return 'border-l-warning';
  return 'border-l-success';
}

function getWaitTextColor(date: string | null) {
  if (!date) return 'text-muted-foreground';
  const hours = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
  if (hours > 48) return 'text-destructive';
  if (hours > 24) return 'text-warning';
  return 'text-success';
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function PropostasPendentes() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [tipoEntradaFilter, setTipoEntradaFilter] = useState<string>('todos');
  const [tipoVistoriaFilter, setTipoVistoriaFilter] = useState<string>('todos');
  const [rfFilter, setRfFilter] = useState<'todos' | 'com_rf' | 'sem_rf'>('todos');
  const [slaFilter, setSlaFilter] = useState<string>('todos');
  const [apenasReanalise, setApenasReanalise] = useState(false);
  const [caracteristicas, setCaracteristicas] = useState<Set<CaracteristicaKey>>(new Set());
  const [ordenacao, setOrdenacao] = useState<string>('reanalise_primeiro');
  const [ativandoRastreadorId, setAtivandoRastreadorId] = useState<string | null>(null);
  const [dialogExcluirAberto, setDialogExcluirAberto] = useState(false);
  const [associadoParaExcluir, setAssociadoParaExcluir] = useState<{ id: string; nome: string } | null>(null);

  const toggleCaracteristica = (key: CaracteristicaKey) => {
    setCaracteristicas(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const limparFiltros = () => {
    setSearch('');
    setStatusFilter('todos');
    setTipoEntradaFilter('todos');
    setTipoVistoriaFilter('todos');
    setRfFilter('todos');
    setSlaFilter('todos');
    setApenasReanalise(false);
    setCaracteristicas(new Set());
    setOrdenacao('reanalise_primeiro');
  };

  const totalFiltrosAtivos =
    (statusFilter !== 'todos' ? 1 : 0) +
    (tipoEntradaFilter !== 'todos' ? 1 : 0) +
    (tipoVistoriaFilter !== 'todos' ? 1 : 0) +
    (rfFilter !== 'todos' ? 1 : 0) +
    (slaFilter !== 'todos' ? 1 : 0) +
    (apenasReanalise ? 1 : 0) +
    caracteristicas.size;

  const { isDiretor } = usePermissions();
  const { mutate: deleteAssociado, isPending: isExcluindo } = useDeleteAssociado();

  const { data: propostas, isLoading: propostasLoading, refetch } = usePropostasPendentes();
  const { data: statsRaw, isLoading: statsLoading } = usePropostaStats();

  // KPIs "Aguardando" e "Em Análise" devem refletir EXATAMENTE a lista exibida
  // (a query de stats não aplica os mesmos filtros de sincronização Hinova / instalação concluída,
  // então usamos os dados já filtrados pela lista para evitar divergência).
  const stats = (() => {
    if (!propostas) return statsRaw;
    const isPendVist = (p: PropostaPendente) =>
      p.status === 'assinado' &&
      p.cadastro_aprovado === true &&
      p.tipo_vistoria !== 'autovistoria' &&
      (!p.instalacao_info || p.instalacao_info.status !== 'concluida');
    const aguardando = propostas.filter(p => p.status === 'assinado' && !isPendVist(p)).length;
    const pendVistoria = propostas.filter(isPendVist).length;
    const emAnalise = propostas.filter(p => p.status === 'em_analise').length;
    return {
      aguardando,
      pendVistoria,
      emAnalise,
      aprovadosHoje: statsRaw?.aprovadosHoje || 0,
      reprovadosHoje: statsRaw?.reprovadosHoje || 0,
    };
  })();

  // Função para ativar rastreador (mantida sem alteração)
  const handleAtivarRastreador = async (proposta: PropostaPendente) => {
    if (!proposta.instalacao_info?.rastreador_id || !proposta.associado_id) {
      toast.error('Dados insuficientes para ativação');
      return;
    }
    setAtivandoRastreadorId(proposta.id);
    try {
      const { data: veiculo } = await supabase
        .from('veiculos').select('id')
        .eq('associado_id', proposta.associado_id)
        .eq('placa', proposta.veiculo_placa).single();
      if (!veiculo) throw new Error('Veículo não encontrado');
      const plataforma = proposta.instalacao_info.rastreador_plataforma;
      if (plataforma === 'softruck') {
        const { data, error } = await supabase.functions.invoke('softruck-ativar-dispositivo', {
          body: { imei: proposta.instalacao_info.rastreador_imei, veiculoId: veiculo.id, associadoId: proposta.associado_id }
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Erro na ativação Softruck');
      } else if (plataforma === 'rede_veiculos') {
        const { data, error } = await supabase.functions.invoke('rede-veiculos-vincular-cliente', {
          body: { imei: proposta.instalacao_info.rastreador_imei, veiculoId: veiculo.id, associadoId: proposta.associado_id }
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Erro na ativação Rede Veículos');
      } else {
        await supabase.from('rastreadores').update({ status: 'instalado', veiculo_id: veiculo.id }).eq('id', proposta.instalacao_info.rastreador_id);
      }
      toast.success('Rastreador ativado com sucesso!');
      refetch();
    } catch (err: any) {
      console.error('Erro ao ativar rastreador:', err);
      toast.error('Erro ao ativar rastreador', { description: err.message || 'Tente novamente' });
    } finally {
      setAtivandoRastreadorId(null);
    }
  };

  const handleExcluirAssociado = async (motivo: string) => {
    if (!associadoParaExcluir) return;
    deleteAssociado(associadoParaExcluir.id, {
      onSuccess: () => { setDialogExcluirAberto(false); setAssociadoParaExcluir(null); refetch(); }
    });
  };

  // Ordenar: reanálise no topo, depois por data
  const propostasFiltradas = useMemo(() => {
    if (!propostas) return undefined;

    const searchLower = search.trim().toLowerCase();
    const searchDigits = search.replace(/\D/g, '');

    const filtradas = propostas.filter((p) => {
      // Busca textual ampliada: nome, CPF, CNPJ, placa, chassi, número da proposta, email, telefone
      const matchSearch =
        !searchLower ||
        p.cliente_nome?.toLowerCase().includes(searchLower) ||
        (searchDigits && p.cliente_cpf?.replace(/\D/g, '').includes(searchDigits)) ||
        (searchDigits && p.cliente_telefone?.replace(/\D/g, '').includes(searchDigits)) ||
        p.cliente_email?.toLowerCase().includes(searchLower) ||
        p.veiculo_placa?.toLowerCase().includes(searchLower) ||
        p.veiculo_chassi?.toLowerCase().includes(searchLower) ||
        p.veiculo_modelo?.toLowerCase().includes(searchLower) ||
        p.veiculo_marca?.toLowerCase().includes(searchLower) ||
        p.numero?.toLowerCase().includes(searchLower) ||
        p.plano?.nome?.toLowerCase().includes(searchLower) ||
        p.plano_nome?.toLowerCase().includes(searchLower);

      // Status (derivados sincronizados com os badges exibidos)
      let matchStatus = true;
      if (statusFilter !== 'todos') {
        const pendVist = isPendenteVistoriaInicial(p);
        switch (statusFilter) {
          case 'assinado':
            matchStatus = p.status === 'assinado' && !pendVist && !isAguardandoDoc(p) && !isAgendado(p);
            break;
          case 'aguard_doc':
            matchStatus = isAguardandoDoc(p);
            break;
          case 'pendente_vistoria':
            matchStatus = pendVist;
            break;
          case 'aguard_vistoria':
            matchStatus = isAguardVistoriaRF(p);
            break;
          case 'aguard_instalacao':
            matchStatus = isAguardInstalacaoRF(p);
            break;
          case 'agendado':
            matchStatus = isAgendado(p);
            break;
          case 'em_analise':
            matchStatus = p.status === 'em_analise';
            break;
          default:
            matchStatus = p.status === statusFilter;
        }
      }

      // Tipo de adesão
      const matchEntrada =
        tipoEntradaFilter === 'todos' || (p.tipo_entrada || 'comum') === tipoEntradaFilter;

      // Tipo de vistoria
      let matchVistoria = true;
      if (tipoVistoriaFilter !== 'todos') {
        matchVistoria =
          tipoVistoriaFilter === 'sem_vistoria'
            ? !p.tipo_vistoria
            : p.tipo_vistoria === tipoVistoriaFilter;
      }

      // Plano com/sem Roubo e Furto
      const matchRF =
        rfFilter === 'todos' ||
        (rfFilter === 'com_rf' && p.plano_tem_roubo_furto) ||
        (rfFilter === 'sem_rf' && !p.plano_tem_roubo_furto);

      // SLA (horas na fila)
      let matchSla = true;
      if (slaFilter !== 'todos') {
        const h = horasNaFila(p);
        if (slaFilter === 'novo') matchSla = h <= 24;
        else if (slaFilter === 'atencao') matchSla = h > 24 && h <= 48;
        else if (slaFilter === 'atrasado') matchSla = h > 48;
      }

      // Reanálise (cliente reenviou docs solicitados)
      const matchReanalise =
        !apenasReanalise || (p.documentos_solicitados_enviados?.length || 0) > 0;

      // Características do veículo (multi-seleção: AND)
      let matchCaracts = true;
      if (caracteristicas.size > 0) {
        matchCaracts = Array.from(caracteristicas).every((k) => {
          switch (k) {
            case 'zero_km':
              return !!(p as any).veiculo_zero_km;
            case 'blindado':
              return !!p.veiculo_blindado;
            case 'alienado':
              return !!p.veiculo_alienado;
            case 'uso_app':
              return !!p.uso_aplicativo;
            case 'diesel':
              return isCombustivelDiesel(p.veiculo_combustivel);
            case 'cobertura_total':
              return !!p.veiculo_cobertura_total;
            default:
              return true;
          }
        });
      }

      return (
        matchSearch &&
        matchStatus &&
        matchEntrada &&
        matchVistoria &&
        matchRF &&
        matchSla &&
        matchReanalise &&
        matchCaracts
      );
    });

    const refTs = (p: PropostaPendente) =>
      new Date(p.tempo_referencia || p.data_assinatura || 0).getTime();

    return [...filtradas].sort((a, b) => {
      if (ordenacao === 'reanalise_primeiro') {
        const aR = (a.documentos_solicitados_enviados?.length || 0) > 0 ? 1 : 0;
        const bR = (b.documentos_solicitados_enviados?.length || 0) > 0 ? 1 : 0;
        if (bR !== aR) return bR - aR;
        return refTs(a) - refTs(b); // depois, mais antigas primeiro
      }
      if (ordenacao === 'mais_antiga') return refTs(a) - refTs(b);
      if (ordenacao === 'mais_recente') return refTs(b) - refTs(a);
      if (ordenacao === 'maior_valor') return (b.veiculo_valor_fipe || 0) - (a.veiculo_valor_fipe || 0);
      return 0;
    });
  }, [
    propostas,
    search,
    statusFilter,
    tipoEntradaFilter,
    tipoVistoriaFilter,
    rfFilter,
    slaFilter,
    apenasReanalise,
    caracteristicas,
    ordenacao,
  ]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header melhorado */}
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <ClipboardList className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Propostas Pendentes</h1>
          <p className="text-sm text-muted-foreground">Contratos assinados aguardando análise e aprovação</p>
        </div>
      </div>

      {/* KPIs como cards interativos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl bg-muted" />)
        ) : (
          <>
            {[
              { label: 'Aguardando', value: stats?.aguardando || 0, icon: <Clock className="h-3.5 w-3.5" />, color: 'warning', filter: 'assinado' },
              { label: 'Em Análise', value: stats?.emAnalise || 0, icon: <Eye className="h-3.5 w-3.5" />, color: 'info', filter: 'em_analise' },
              { label: 'Aprovados', value: stats?.aprovadosHoje || 0, icon: <CheckCircle className="h-3.5 w-3.5" />, color: 'success', filter: null },
              { label: 'Reprovados', value: stats?.reprovadosHoje || 0, icon: <XCircle className="h-3.5 w-3.5" />, color: 'destructive', filter: null },
            ].map((kpi) => (
              <button
                key={kpi.label}
                className={cn(
                  "rounded-xl border p-3 text-left transition-all hover:shadow-sm hover:-translate-y-0.5",
                  `bg-${kpi.color}/10 border-${kpi.color}/30`,
                  kpi.filter && statusFilter === kpi.filter && "ring-2 ring-offset-1 ring-offset-background",
                  kpi.filter && statusFilter === kpi.filter && `ring-${kpi.color}/50`
                )}
                onClick={() => kpi.filter && setStatusFilter(statusFilter === kpi.filter ? 'todos' : kpi.filter)}
              >
                <div className={cn("flex items-center gap-1.5 mb-1", `text-${kpi.color}`)}>
                  {kpi.icon}
                  <span className="text-[10px] font-medium">{kpi.label}</span>
                </div>
                <p className={cn("text-xl font-bold", `text-${kpi.color}`)}>{kpi.value}</p>
              </button>
            ))}
          </>
        )}
      </div>


      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar nome, CPF, placa ou chassi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card border-border h-10 text-sm rounded-xl"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 bg-muted/50 p-0.5 rounded-xl">
            {statusFilters.map(f => (
              <button
                key={f.value}
                className={cn(
                  "px-3 py-2 text-xs rounded-lg transition-all",
                  statusFilter === f.value
                    ? 'bg-card shadow-sm text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => setStatusFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>
          {propostasFiltradas && (
            <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block">
              {propostasFiltradas.length} resultado(s)
            </span>
          )}
        </div>
      </div>

      {/* Cards de Propostas */}
      {propostasLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 w-full bg-muted rounded-xl" />)}
        </div>
      ) : !propostasFiltradas || propostasFiltradas.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <Inbox className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <p className="font-semibold text-foreground text-base">Nenhuma proposta encontrada</p>
          <p className="text-sm mt-1">Todas as propostas foram analisadas. Bom trabalho! 🎉</p>
        </div>
      ) : (
        <div className="space-y-2">
          {propostasFiltradas.map((proposta) => {
            const hasReanalise = (proposta.documentos_solicitados_enviados?.length || 0) > 0;
            return (
              <div
                key={proposta.id}
                className={cn(
                  "group p-3 sm:p-3.5 rounded-xl bg-card border border-border transition-all cursor-pointer border-l-4",
                  "hover:bg-accent/30 hover:shadow-sm sm:hover:translate-x-1",
                  getWaitColor(proposta.tempo_referencia || proposta.data_assinatura),
                  hasReanalise && "ring-1 ring-amber-500/30 bg-amber-500/5"
                )}
                onClick={() => navigate(`/cadastro/propostas/${proposta.id}`)}
              >
                {/* Linha 1 — Identificação */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <UserAvatar
                    name={proposta.cliente_nome || proposta.associado?.nome}
                    size="sm"
                    className="flex-shrink-0"
                  />

                  <div className="flex-shrink-0">
                    <span className="font-mono text-[11px] sm:text-xs font-bold text-foreground bg-muted px-1.5 sm:px-2 py-1 rounded-md">
                      {proposta.veiculo_placa || '---'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {proposta.cliente_nome || proposta.associado?.nome || '---'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {proposta.veiculo_modelo || '---'}
                    </p>
                  </div>

                  {/* Ações (sempre visíveis no mobile) */}
                  <div className="flex-shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        {ativandoRastreadorId === proposta.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover border-border">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/cadastro/propostas/${proposta.id}`); }}>
                        <Eye className="mr-2 h-4 w-4" />
                        Analisar
                      </DropdownMenuItem>
                      {proposta.instalacao_info && !proposta.instalacao_info.rastreador_ativado && proposta.instalacao_info.rastreador_id && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleAtivarRastreador(proposta); }} disabled={ativandoRastreadorId === proposta.id}>
                          <Zap className="mr-2 h-4 w-4" />
                          Ativar Rastreador
                        </DropdownMenuItem>
                      )}
                      {isDiretor && proposta.associado_id && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAssociadoParaExcluir({ id: proposta.associado_id!, nome: proposta.cliente_nome || proposta.associado?.nome || 'Associado' });
                              setDialogExcluirAberto(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir Associado
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Linha 2 — Badges e tempo */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-0 sm:pl-11">
                  {hasReanalise && (
                    <Badge className="bg-amber-500 text-white text-[9px] px-1.5 py-0 h-5 animate-pulse">
                      <RefreshCw className="h-2.5 w-2.5 mr-0.5" />
                      NOVO
                    </Badge>
                  )}
                  {getStatusBadge(proposta.status, proposta.associado_status, proposta.tem_documento_pendente, proposta.instalacao_info, proposta.tipo_etapa_analise, proposta)}
                  {(proposta.plano?.nome || proposta.plano_nome) && (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-5 max-w-[60%] truncate">
                      {proposta.plano?.nome || proposta.plano_nome}
                    </Badge>
                  )}
                  <span className={cn("ml-auto text-[10px] font-semibold tabular-nums", getWaitTextColor(proposta.tempo_referencia || proposta.data_assinatura))}>
                    {(proposta.tempo_referencia || proposta.data_assinatura)
                      ? formatDistanceToNow(new Date(proposta.tempo_referencia || proposta.data_assinatura!), { locale: ptBR, addSuffix: false })
                      : '---'}
                  </span>
                </div>

                {/* Linha 3 — Endereço de instalação (opcional) */}
                {proposta.instalacao_agendada?.endereco_logradouro && (
                  <p className="mt-1 text-[11px] text-muted-foreground truncate pl-0 sm:pl-11">
                    📍 {proposta.instalacao_agendada.endereco_logradouro}
                    {proposta.instalacao_agendada.endereco_numero && `, ${proposta.instalacao_agendada.endereco_numero}`}
                    {proposta.instalacao_agendada.endereco_bairro && ` — ${proposta.instalacao_agendada.endereco_bairro}`}
                    {proposta.instalacao_agendada.data && ` · ${proposta.instalacao_agendada.data.split('-').reverse().join('/')}`}
                    {proposta.instalacao_agendada.horario && ` ${proposta.instalacao_agendada.horario}`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmacaoAcaoDialog
        open={dialogExcluirAberto}
        onOpenChange={setDialogExcluirAberto}
        acao="excluir"
        nomeAssociado={associadoParaExcluir?.nome || ''}
        onConfirm={handleExcluirAssociado}
      />
    </div>
  );
}
