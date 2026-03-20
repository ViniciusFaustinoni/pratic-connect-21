import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowRightLeft, RotateCcw, RefreshCw, Eye, User, Calendar, Search, ArrowRight, AlertTriangle, FileInput, CheckCircle, XCircle, Loader2, ShieldCheck, ClipboardList } from 'lucide-react';
import { MigracoesTab } from '@/pages/cadastro/SolicitacoesMigracao';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSubstituicoes } from '@/hooks/useSubstituicaoVeiculo';
import { useConfigLimitesVeiculo } from '@/hooks/useConfigLimitesVeiculo';
import { STATUS_SUBSTITUICAO_LABELS, STATUS_SUBSTITUICAO_CORES } from '@/types/substituicao';
import type { StatusSubstituicao } from '@/types/substituicao';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';

// ============================================
// TROCA DE TITULARIDADE TAB
// ============================================

function TrocaTitularidadeTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isGerencia } = usePermissions();

  const [aprovarId, setAprovarId] = useState<string | null>(null);
  const [rejeitarId, setRejeitarId] = useState<string | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [cenarioResultado, setCenarioResultado] = useState<Record<string, string>>({});

  const { data: solicitacoes, isLoading } = useQuery({
    queryKey: ['processos-troca-titularidade'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_solicitacoes_ia')
        .select(`
          *,
          associado:associados!chat_solicitacoes_ia_associado_id_fkey(id, nome, cpf, telefone)
        `)
        .eq('tipo', 'troca_titularidade')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Buscar serviços vinculados para Cenário B (status da vistoria em tempo real)
  const cenarioBIds = useMemo(() => {
    if (!solicitacoes) return [];
    return solicitacoes
      .filter((s: any) => {
        const dados = s.dados as any;
        return s.status === 'aprovado' && dados?.cenario_aplicado === 'B';
      })
      .map((s: any) => s.id);
  }, [solicitacoes]);

  const { data: servicosVinculados } = useQuery({
    queryKey: ['servicos-troca-titularidade', cenarioBIds],
    queryFn: async () => {
      if (!cenarioBIds.length) return [];
      const { data, error } = await supabase
        .from('servicos')
        .select('id, status, solicitacao_id')
        .in('solicitacao_id', cenarioBIds)
        .eq('origem', 'troca_titularidade');
      if (error) throw error;
      return data || [];
    },
    enabled: cenarioBIds.length > 0,
  });

  const servicosPorSolicitacao = useMemo(() => {
    const map: Record<string, string> = {};
    servicosVinculados?.forEach((s: any) => {
      if (s.solicitacao_id) map[s.solicitacao_id] = s.status;
    });
    return map;
  }, [servicosVinculados]);

  const aprovarMutation = useMutation({
    mutationFn: async (solicitacaoId: string) => {
      const { data, error } = await supabase.functions.invoke('aprovar-solicitacao-ia', {
        body: { solicitacao_id: solicitacaoId, acao: 'aprovar' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data, solicitacaoId) => {
      if (data?.cenario) {
        setCenarioResultado(prev => ({ ...prev, [solicitacaoId]: data.cenario }));
      }
      queryClient.invalidateQueries({ queryKey: ['processos-troca-titularidade'] });
      queryClient.invalidateQueries({ queryKey: ['processos-counts'] });
      toast.success(
        data?.cenario === 'A'
          ? 'Aprovado — Cenário A: vistoria dispensada'
          : 'Aprovado — Cenário B: vistoria agendada'
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao aprovar solicitação');
    },
  });

  const rejeitarMutation = useMutation({
    mutationFn: async ({ solicitacaoId, motivo }: { solicitacaoId: string; motivo: string }) => {
      const { data, error } = await supabase.functions.invoke('aprovar-solicitacao-ia', {
        body: { solicitacao_id: solicitacaoId, acao: 'rejeitar', motivo },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processos-troca-titularidade'] });
      queryClient.invalidateQueries({ queryKey: ['processos-counts'] });
      toast.success('Solicitação rejeitada');
      setRejeitarId(null);
      setMotivoRejeicao('');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao rejeitar solicitação');
    },
  });

  const statusConfig: Record<string, { label: string; className: string }> = {
    pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-800 border-amber-200' },
    aprovado: { label: 'Aprovado', className: 'bg-green-100 text-green-800 border-green-200' },
    rejeitado: { label: 'Rejeitado', className: 'bg-red-100 text-red-800 border-red-200' },
    em_andamento: { label: 'Em Andamento', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando solicitações...</div>;
  }

  if (!solicitacoes?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <ArrowRightLeft className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-lg font-medium">Nenhuma solicitação de troca de titularidade</p>
        <p className="text-sm">As solicitações aparecerão aqui quando forem realizadas pelo app ou WhatsApp.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {solicitacoes.map((sol: any) => {
        const dados = sol.dados as any;
        const novoTitular = sol.dados_novo_titular as any;
        const cfg = statusConfig[sol.status] || statusConfig.pendente;
        const associado = sol.associado as any;
        const isPendente = sol.status === 'pendente';
        const isAprovado = sol.status === 'aprovado';
        const isRejeitado = sol.status === 'rejeitado';
        const cenario = cenarioResultado[sol.id] || dados?.cenario_aplicado || (
          sol.resultado_id && sol.status === 'aprovado'
            ? (sol.resultado_id === sol.id ? 'A' : 'B')
            : null
        );
        const efetivado = !!dados?.efetivado_em;
        const statusServico = servicosPorSolicitacao[sol.id];

        return (
          <Card key={sol.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{associado?.nome || 'Associado não encontrado'}</span>
                    <Badge className={cfg.className}>{cfg.label}</Badge>
                    {isAprovado && cenario === 'A' && (
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Vistoria dispensada
                      </Badge>
                    )}
                    {isAprovado && cenario === 'B' && (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                        <ClipboardList className="h-3 w-3 mr-1" />
                        Vistoria agendada
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {associado?.cpf && <p>CPF: {associado.cpf}</p>}
                    {novoTitular?.nome && (
                      <p className="text-foreground">
                        <span className="text-muted-foreground">Novo titular:</span> {novoTitular.nome}
                        {novoTitular.cpf && ` — CPF: ${novoTitular.cpf}`}
                      </p>
                    )}
                    {dados?.motivo && <p>Motivo: {dados.motivo}</p>}
                    {isRejeitado && sol.motivo_rejeicao && (
                      <p className="text-destructive font-medium">Motivo da rejeição: {sol.motivo_rejeicao}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(sol.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  {isPendente && isGerencia && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-green-700 border-green-300 hover:bg-green-50"
                        onClick={() => setAprovarId(sol.id)}
                        disabled={aprovarMutation.isPending}
                      >
                        {aprovarMutation.isPending && aprovarMutation.variables === sol.id
                          ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          : <CheckCircle className="h-4 w-4 mr-1" />
                        }
                        Aprovar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-700 border-red-300 hover:bg-red-50"
                        onClick={() => setRejeitarId(sol.id)}
                        disabled={rejeitarMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Rejeitar
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/cadastro/associados/${sol.associado_id}`)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Ver Ficha
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Dialog de confirmação de aprovação */}
      <AlertDialog open={!!aprovarId} onOpenChange={(open) => !open && setAprovarId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar aprovação</AlertDialogTitle>
            <AlertDialogDescription>
              O sistema determinará automaticamente se é Cenário A (vistoria dispensada) ou Cenário B (vistoria obrigatória) com base nas configurações salvas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={aprovarMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (aprovarId) aprovarMutation.mutate(aprovarId);
                setAprovarId(null);
              }}
              disabled={aprovarMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {aprovarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
              Confirmar Aprovação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de rejeição com motivo */}
      <AlertDialog open={!!rejeitarId} onOpenChange={(open) => { if (!open) { setRejeitarId(null); setMotivoRejeicao(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rejeitar solicitação</AlertDialogTitle>
            <AlertDialogDescription>
              Informe o motivo da rejeição. O associado será notificado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Motivo da rejeição (obrigatório)..."
            value={motivoRejeicao}
            onChange={(e) => setMotivoRejeicao(e.target.value)}
            className="min-h-[80px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rejeitarMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (rejeitarId && motivoRejeicao.trim()) {
                  rejeitarMutation.mutate({ solicitacaoId: rejeitarId, motivo: motivoRejeicao.trim() });
                }
              }}
              disabled={rejeitarMutation.isPending || !motivoRejeicao.trim()}
              className="bg-destructive hover:bg-destructive/90"
            >
              {rejeitarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
              Confirmar Rejeição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
// ============================================
// REATIVAÇÕES TAB
// ============================================

function ReativacoesTab() {
  const navigate = useNavigate();

  const { data: reativacoes, isLoading } = useQuery({
    queryKey: ['processos-reativacoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_solicitacoes_ia')
        .select(`
          *,
          associado:associados!chat_solicitacoes_ia_associado_id_fkey(id, nome, cpf, telefone, status)
        `)
        .eq('tipo', 'reativacao')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const statusConfig: Record<string, { label: string; className: string }> = {
    pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-800 border-amber-200' },
    aprovado: { label: 'Aprovado', className: 'bg-green-100 text-green-800 border-green-200' },
    rejeitado: { label: 'Rejeitado', className: 'bg-red-100 text-red-800 border-red-200' },
    em_andamento: { label: 'Em Andamento', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando reativações...</div>;
  }

  if (!reativacoes?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <RotateCcw className="h-12 w-12 mb-3 opacity-40" />
        <p className="text-lg font-medium">Nenhuma solicitação de reativação</p>
        <p className="text-sm">Solicitações de reativação de associados aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reativacoes.map((sol: any) => {
        const dados = sol.dados as any;
        const cfg = statusConfig[sol.status] || statusConfig.pendente;
        const associado = sol.associado as any;

        return (
          <Card key={sol.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{associado?.nome || 'Associado não encontrado'}</span>
                    <Badge className={cfg.className}>{cfg.label}</Badge>
                    {associado?.status && (
                      <Badge variant="outline" className="text-xs">{associado.status}</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {associado?.cpf && <p>CPF: {associado.cpf}</p>}
                    {dados?.motivo && <p>Motivo: {dados.motivo}</p>}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(sol.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/cadastro/associados/${sol.associado_id}`)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Ver Ficha
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================
// SUBSTITUIÇÕES TAB (inline)
// ============================================

const SUB_TAB_FILTERS: Record<string, StatusSubstituicao[] | null> = {
  pendentes: ['aguardando_aprovacao'],
  aprovadas: ['aprovada'],
  rejeitadas: ['rejeitada'],
  efetivadas: ['efetivada'],
  todas: null,
};

function SubstituicoesTab() {
  const navigate = useNavigate();
  const { data: substituicoes, isLoading, refetch } = useSubstituicoes();
  const { data: limites } = useConfigLimitesVeiculo();
  const [subTab, setSubTab] = useState('pendentes');
  const [busca, setBusca] = useState('');

  const filtered = useMemo(() => {
    if (!substituicoes) return [];
    let items = substituicoes;
    const statusFilter = SUB_TAB_FILTERS[subTab];
    if (statusFilter) {
      items = items.filter((s) => statusFilter.includes(s.status as StatusSubstituicao));
    }
    if (busca.trim()) {
      const q = busca.toLowerCase();
      items = items.filter(
        (s) =>
          s.associado?.nome?.toLowerCase().includes(q) ||
          s.veiculo_antigo_placa?.toLowerCase().includes(q) ||
          s.veiculo_novo_placa?.toLowerCase().includes(q)
      );
    }
    return items;
  }, [substituicoes, subTab, busca]);

  const pendentesCount = useMemo(
    () => substituicoes?.filter((s) => s.status === 'aguardando_aprovacao').length ?? 0,
    [substituicoes]
  );

  const formatCurrency = (v: number | null) =>
    v != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—';

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="pendentes">
              Pendentes {pendentesCount > 0 && (
                <Badge variant="destructive" className="ml-1.5 text-xs px-1.5 py-0">{pendentesCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="aprovadas">Aprovadas</TabsTrigger>
            <TabsTrigger value="rejeitadas">Rejeitadas</TabsTrigger>
            <TabsTrigger value="efetivadas">Efetivadas</TabsTrigger>
            <TabsTrigger value="todas">Todas</TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar associado ou placa..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {Object.keys(SUB_TAB_FILTERS).map((tabKey) => (
          <TabsContent key={tabKey} value={tabKey} className="mt-4">
            {isLoading ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando...</CardContent></Card>
            ) : filtered.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma substituição encontrada.</CardContent></Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Associado</TableHead>
                        <TableHead>Veículo Antigo</TableHead>
                        <TableHead>Veículo Novo</TableHead>
                        <TableHead>Mensalidade</TableHead>
                        <TableHead>FIPE Nova</TableHead>
                        <TableHead>Data Solicitação</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-20">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((s) => (
                        <TableRow
                          key={s.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/cadastro/substituicoes/${s.id}`)}
                        >
                          <TableCell className="font-medium">{s.associado?.nome || '—'}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {s.veiculo_antigo_modelo || s.veiculo_antigo?.modelo || '—'}
                              <span className="text-muted-foreground ml-1">
                                {s.veiculo_antigo_placa || s.veiculo_antigo?.placa || ''}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {s.veiculo_novo_modelo || s.veiculo_novo?.modelo || '—'}
                              <span className="text-muted-foreground ml-1">
                                {s.veiculo_novo_placa || s.veiculo_novo?.placa || ''}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              {formatCurrency(s.mensalidade_antiga)} → {formatCurrency(s.mensalidade_nova)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {formatCurrency(s.veiculo_novo_fipe)}
                              {(s.veiculo_novo_fipe ?? 0) > (limites?.fipeLimiteAutorizacao ?? 120000) && (
                                <Badge variant="destructive" className="text-[10px] px-1">
                                  <AlertTriangle className="h-3 w-3 mr-0.5" />FIPE ALTA
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(s.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge className={STATUS_SUBSTITUICAO_CORES[s.status as StatusSubstituicao] || 'bg-gray-100 text-gray-800'}>
                              {STATUS_SUBSTITUICAO_LABELS[s.status as StatusSubstituicao] || s.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ============================================
// CONTADORES
// ============================================

function useProcessosCounts() {
  return useQuery({
    queryKey: ['processos-counts'],
    queryFn: async () => {
      const [titularidade, reativacao, substituicoes, migracoes] = await Promise.all([
        supabase
          .from('chat_solicitacoes_ia')
          .select('id', { count: 'exact', head: true })
          .eq('tipo', 'troca_titularidade')
          .eq('status', 'pendente'),
        supabase
          .from('chat_solicitacoes_ia')
          .select('id', { count: 'exact', head: true })
          .eq('tipo', 'reativacao')
          .eq('status', 'pendente'),
        supabase
          .from('substituicoes_veiculo')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'aguardando_aprovacao'),
        supabase
          .from('solicitacoes_migracao')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pendente'),
      ]);

      return {
        titularidade: titularidade.count || 0,
        reativacao: reativacao.count || 0,
        substituicoes: substituicoes.count || 0,
        migracoes: migracoes.count || 0,
      };
    },
  });
}

// ============================================
// MAIN PAGE
// ============================================

export default function ProcessosOperacionais() {
  const { data: counts } = useProcessosCounts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Processos Operacionais</h1>
        <p className="text-muted-foreground">
          Central de gestão de trocas de titularidade, reativações, substituições e migrações.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts?.titularidade ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Trocas pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 text-green-700">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts?.reativacao ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Reativações pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts?.substituicoes ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Substituições pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
              <FileInput className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts?.migracoes ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Migrações pendentes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="titularidade" className="w-full">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="titularidade" className="text-xs sm:text-sm">
            <ArrowRightLeft className="h-4 w-4 mr-1 hidden sm:inline" />
            Titularidade
            {(counts?.titularidade ?? 0) > 0 && (
              <Badge className="ml-1.5 bg-blue-600 text-white text-[10px] px-1.5 py-0">{counts?.titularidade}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="reativacao" className="text-xs sm:text-sm">
            <RotateCcw className="h-4 w-4 mr-1 hidden sm:inline" />
            Reativação
            {(counts?.reativacao ?? 0) > 0 && (
              <Badge className="ml-1.5 bg-green-600 text-white text-[10px] px-1.5 py-0">{counts?.reativacao}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="substituicoes" className="text-xs sm:text-sm">
            <RefreshCw className="h-4 w-4 mr-1 hidden sm:inline" />
            Substituições
            {(counts?.substituicoes ?? 0) > 0 && (
              <Badge className="ml-1.5 bg-amber-600 text-white text-[10px] px-1.5 py-0">{counts?.substituicoes}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="migracoes" className="text-xs sm:text-sm">
            <FileInput className="h-4 w-4 mr-1 hidden sm:inline" />
            Migrações
            {(counts?.migracoes ?? 0) > 0 && (
              <Badge className="ml-1.5 bg-purple-600 text-white text-[10px] px-1.5 py-0">{counts?.migracoes}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="titularidade">
          <TrocaTitularidadeTab />
        </TabsContent>
        <TabsContent value="reativacao">
          <ReativacoesTab />
        </TabsContent>
        <TabsContent value="substituicoes">
          <SubstituicoesTab />
        </TabsContent>
        <TabsContent value="migracoes">
          <MigracoesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
