import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock,
  Eye,
  CheckCircle,
  XCircle,
  Search,
  RefreshCw,
  ShieldCheck,
  Inbox,
} from 'lucide-react';
import { usePropostasPendentes, usePropostaStats, type PropostaPendente } from '@/hooks/usePropostasPendentes';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/UserAvatar';

// ============================================
// STATUS CONFIG
// ============================================
const statusFilters = [
  { value: 'todos', label: 'Todos' },
  { value: 'assinado', label: 'Aguardando' },
  { value: 'pendente_vistoria', label: 'Pend. Vistoria' },
  { value: 'em_analise', label: 'Em Análise' },
];

function getStatusBadge(status: string | null, associadoStatus?: string | null, temDocPendente?: boolean) {
  const aguardandoDoc = (associadoStatus === 'documentacao_pendente' || temDocPendente) && status === 'assinado';

  if (aguardandoDoc) {
    return <Badge className="bg-orange-500/15 text-orange-500 border-orange-500/30 text-[10px] px-1.5">Aguard. Doc</Badge>;
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
export default function AprovacaoAssociadosMonitoramento() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  const { data: propostas, isLoading: propostasLoading } = usePropostasPendentes();
  const { data: stats, isLoading: statsLoading } = usePropostaStats();

  // Ordenar: reanálise no topo, depois por data
  const propostasFiltradas = propostas
    ?.filter((proposta) => {
      const searchLower = search.toLowerCase();
      const matchSearch = !search ||
        proposta.cliente_nome?.toLowerCase().includes(searchLower) ||
        proposta.cliente_cpf?.includes(search) ||
        proposta.veiculo_placa?.toLowerCase().includes(searchLower);
      const matchStatus = statusFilter === 'todos' || proposta.status === statusFilter;
      return matchSearch && matchStatus;
    })
    ?.sort((a, b) => {
      const aReanalise = (a.documentos_solicitados_enviados?.length || 0) > 0 ? 1 : 0;
      const bReanalise = (b.documentos_solicitados_enviados?.length || 0) > 0 ? 1 : 0;
      if (bReanalise !== aReanalise) return bReanalise - aReanalise;
      return 0;
    });

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Aprovação de Associados</h1>
          <p className="text-sm text-muted-foreground">
            Análise e aprovação de propostas para cobertura Roubo/Furto
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl bg-muted" />)
        ) : (
          <>
            {[
              { label: 'Aguardando', value: stats?.aguardando || 0, icon: <Clock className="h-3.5 w-3.5" />, color: 'warning', filter: 'assinado' },
              { label: 'Em Análise', value: stats?.emAnalise || 0, icon: <Eye className="h-3.5 w-3.5" />, color: 'info', filter: 'em_analise' },
              { label: 'Aprovados Hoje', value: stats?.aprovadosHoje || 0, icon: <CheckCircle className="h-3.5 w-3.5" />, color: 'success', filter: null },
              { label: 'Reprovados Hoje', value: stats?.reprovadosHoje || 0, icon: <XCircle className="h-3.5 w-3.5" />, color: 'destructive', filter: null },
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
            placeholder="Buscar nome, CPF ou placa..."
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
                  "group flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border transition-all cursor-pointer border-l-4",
                  "hover:bg-accent/30 hover:shadow-sm hover:translate-x-1",
                  getWaitColor(proposta.data_assinatura),
                  hasReanalise && "ring-1 ring-amber-500/30 bg-amber-500/5"
                )}
                onClick={() => navigate(`/cadastro/propostas/${proposta.id}`)}
              >
                {/* Avatar */}
                <UserAvatar
                  name={proposta.cliente_nome || proposta.associado?.nome}
                  size="sm"
                  className="flex-shrink-0"
                />

                {/* Reanálise indicator */}
                {hasReanalise && (
                  <div className="flex-shrink-0 relative">
                    <Badge className="bg-amber-500 text-white text-[9px] px-1.5 py-0 animate-pulse">
                      <RefreshCw className="h-2.5 w-2.5 mr-0.5" />
                      NOVO
                    </Badge>
                  </div>
                )}

                {/* Placa */}
                <div className="flex-shrink-0">
                  <span className="font-mono text-xs font-bold text-foreground bg-muted px-2 py-1 rounded-md">
                    {proposta.veiculo_placa || '---'}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {proposta.cliente_nome || proposta.associado?.nome || '---'}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="truncate">{proposta.veiculo_modelo || '---'}</span>
                    {(proposta.plano?.nome || proposta.plano_nome) && (
                      <>
                        <span className="text-border">•</span>
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                          {proposta.plano?.nome || proposta.plano_nome}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>

                {/* Status + Tempo */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {getStatusBadge(proposta.status, proposta.associado_status, proposta.tem_documento_pendente)}
                  <span className={cn("text-[10px] font-semibold tabular-nums", getWaitTextColor(proposta.data_assinatura))}>
                    {proposta.data_assinatura
                      ? formatDistanceToNow(new Date(proposta.data_assinatura), { locale: ptBR, addSuffix: false })
                      : '---'}
                  </span>
                </div>

                {/* Analisar button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-shrink-0 h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); navigate(`/cadastro/propostas/${proposta.id}`); }}
                >
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  Analisar
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
