import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { usePropostasPendentes, usePropostaStats, PropostaPendente } from '@/hooks/usePropostasPendentes';
import { useInstalacoesAguardandoAtivacao } from '@/hooks/useVistoriaCompletaAnalise';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeleteAssociado } from '@/hooks/useAssociados';
import { supabase } from '@/integrations/supabase/client';
import { ConfirmacaoAcaoDialog } from '@/components/associados/ConfirmacaoAcaoDialog';

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
export default function PropostasPendentes() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [ativandoRastreadorId, setAtivandoRastreadorId] = useState<string | null>(null);
  const [dialogExcluirAberto, setDialogExcluirAberto] = useState(false);
  const [associadoParaExcluir, setAssociadoParaExcluir] = useState<{ id: string; nome: string } | null>(null);

  const { isDiretor } = usePermissions();
  const { mutate: deleteAssociado, isPending: isExcluindo } = useDeleteAssociado();

  const { data: propostas, isLoading: propostasLoading, refetch } = usePropostasPendentes();
  const { data: stats, isLoading: statsLoading } = usePropostaStats();
  const { data: instalacoesPendentes, isLoading: instalacoesPendentesLoading } = useInstalacoesAguardandoAtivacao();

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
      // Reanálise no topo
      const aReanalise = (a.documentos_solicitados_enviados?.length || 0) > 0 ? 1 : 0;
      const bReanalise = (b.documentos_solicitados_enviados?.length || 0) > 0 ? 1 : 0;
      if (bReanalise !== aReanalise) return bReanalise - aReanalise;
      return 0;
    });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Propostas Pendentes</h1>
        <p className="text-sm text-muted-foreground">Contratos assinados aguardando análise</p>
      </div>

      {/* KPIs como pills compactos */}
      <div className="flex flex-wrap gap-2">
        {statsLoading ? (
          <Skeleton className="h-7 w-64 bg-muted rounded-full" />
        ) : (
          <>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning/10 border border-warning/30">
              <Clock className="h-3 w-3 text-warning" />
              <span className="text-xs font-medium text-warning">Aguardando: {stats?.aguardando || 0}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-info/10 border border-info/30">
              <Eye className="h-3 w-3 text-info" />
              <span className="text-xs font-medium text-info">Em Análise: {stats?.emAnalise || 0}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30">
              <Zap className="h-3 w-3 text-purple-500" />
              <span className="text-xs font-medium text-purple-500">Ativação: {instalacoesPendentes?.length || 0}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 border border-success/30">
              <CheckCircle className="h-3 w-3 text-success" />
              <span className="text-xs font-medium text-success">Aprovados: {stats?.aprovadosHoje || 0}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 border border-destructive/30">
              <XCircle className="h-3 w-3 text-destructive" />
              <span className="text-xs font-medium text-destructive">Reprovados: {stats?.reprovadosHoje || 0}</span>
            </div>
          </>
        )}
      </div>

      {/* Ativação de Rastreador - Banner compacto */}
      {instalacoesPendentes && instalacoesPendentes.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-purple-500/30 bg-purple-500/5">
          <Zap className="h-4 w-4 text-purple-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {instalacoesPendentes.length} instalação(ões) aguardando ativação
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-purple-500/30 text-purple-500 hover:bg-purple-500/10 text-xs flex-shrink-0"
            onClick={() => {
              const first = instalacoesPendentes[0] as any;
              if (first) navigate(`/cadastro/instalacoes/${first.id}/ativar`);
            }}
          >
            <Zap className="mr-1 h-3 w-3" />
            Ativar
          </Button>
        </div>
      )}

      {/* Filtros inline */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar nome, CPF ou placa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card border-border h-9 text-sm"
          />
        </div>
        <div className="flex gap-1 bg-muted/50 p-0.5 rounded-lg">
          {statusFilters.map(f => (
            <button
              key={f.value}
              className={cn(
                "px-3 py-1.5 text-xs rounded-md transition-colors",
                statusFilter === f.value
                  ? 'bg-card shadow-sm text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards de Propostas */}
      {propostasLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 w-full bg-muted rounded-lg" />)}
        </div>
      ) : !propostasFiltradas || propostasFiltradas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium text-sm">Nenhuma proposta encontrada</p>
          <p className="text-xs">Todas as propostas foram analisadas.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{propostasFiltradas.length} proposta(s)</p>
          {propostasFiltradas.map((proposta) => {
            const hasReanalise = (proposta.documentos_solicitados_enviados?.length || 0) > 0;
            return (
              <div
                key={proposta.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg bg-card border border-border hover:border-border-hover transition-all cursor-pointer border-l-4",
                  getWaitColor(proposta.data_assinatura),
                  hasReanalise && "ring-1 ring-amber-500/30 bg-amber-500/5"
                )}
                onClick={() => navigate(`/cadastro/propostas/${proposta.id}`)}
              >
                {/* Reanálise indicator */}
                {hasReanalise && (
                  <div className="flex-shrink-0">
                    <RefreshCw className="h-4 w-4 text-amber-500" />
                  </div>
                )}

                {/* Placa destaque */}
                <div className="flex-shrink-0 w-20">
                  <span className="font-mono text-sm font-bold text-foreground">
                    {proposta.veiculo_placa || '---'}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {proposta.cliente_nome || proposta.associado?.nome || '---'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {proposta.veiculo_modelo || '---'} • {proposta.plano?.nome || proposta.plano_nome || '---'}
                  </p>
                </div>

                {/* Status + Tempo */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {getStatusBadge(proposta.status, proposta.associado_status, proposta.tem_documento_pendente)}
                  <span className={cn("text-[10px] font-medium", getWaitTextColor(proposta.data_assinatura))}>
                    {proposta.data_assinatura
                      ? formatDistanceToNow(new Date(proposta.data_assinatura), { locale: ptBR, addSuffix: false })
                      : '---'}
                  </span>
                </div>

                {/* Ações */}
                <div className="flex-shrink-0">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => e.stopPropagation()}>
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
