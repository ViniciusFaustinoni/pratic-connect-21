import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ArrowRightLeft, RefreshCw, Eye, Calendar, Search, ArrowRight,
  AlertTriangle, FileInput, FileSignature, Car, ExternalLink, PackagePlus,
} from 'lucide-react';
import { MigracoesTab } from '@/pages/cadastro/SolicitacoesMigracao';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSubstituicoes } from '@/hooks/useSubstituicaoVeiculo';
import { useConfigLimitesVeiculo } from '@/hooks/useConfigLimitesVeiculo';
import { STATUS_SUBSTITUICAO_LABELS, STATUS_SUBSTITUICAO_CORES } from '@/types/substituicao';
import type { StatusSubstituicao } from '@/types/substituicao';
import { useSolicitacoesTroca, type StatusTroca } from '@/hooks/useSolicitacoesTroca';
import { ModalDetalhesTroca } from '@/components/troca-titularidade/ModalDetalhesTroca';

// ============================================
// TROCA DE TITULARIDADE TAB (nova fonte)
// ============================================

const STATUS_TROCA_LABEL: Record<StatusTroca, string> = {
  cotacao_em_andamento: 'Cotação em andamento',
  aguardando_cadastro: 'Aguardando Cadastro',
  aguardando_monitoramento: 'Aguardando Monitoramento',
  aguardando_vistoria: 'Em Vistoria',
  liberada_para_assinatura: 'Liberada para assinatura',
  efetivada: 'Efetivada',
  reprovada_cadastro: 'Reprovada (Cadastro)',
  reprovada_monitoramento: 'Reprovada (Monitoramento)',
  cancelada: 'Cancelada',
};

const TROCA_FILTROS: Record<string, StatusTroca[]> = {
  pendentes: ['aguardando_cadastro', 'cotacao_em_andamento'],
  aguardando_monit: ['aguardando_monitoramento'],
  em_vistoria: ['aguardando_vistoria'],
  aprovadas: ['liberada_para_assinatura', 'efetivada'],
  recusadas: ['reprovada_cadastro', 'reprovada_monitoramento', 'cancelada'],
};

function TrocaTitularidadeTab() {
  const [subAba, setSubAba] = useState<keyof typeof TROCA_FILTROS>('pendentes');
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const { data, isLoading } = useSolicitacoesTroca(TROCA_FILTROS[subAba]);

  return (
    <div className="space-y-4">
      <Tabs value={subAba} onValueChange={(v) => setSubAba(v as keyof typeof TROCA_FILTROS)}>
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
          <TabsTrigger value="pendentes">Aguardando Cadastro</TabsTrigger>
          <TabsTrigger value="aguardando_monit">Aguardando Monit.</TabsTrigger>
          <TabsTrigger value="em_vistoria">Em Vistoria</TabsTrigger>
          <TabsTrigger value="aprovadas">Aprovadas</TabsTrigger>
          <TabsTrigger value="recusadas">Recusadas</TabsTrigger>
        </TabsList>

        <TabsContent value={subAba} className="pt-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : !data || data.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              Nenhuma solicitação nesta aba
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {data.map(s => (
                <Card key={s.id} className="hover:shadow-md transition cursor-pointer" onClick={() => setSelecionada(s.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={
                            s.status === 'efetivada' || s.status === 'liberada_para_assinatura' ? 'default'
                            : s.status.startsWith('reprovada') || s.status === 'cancelada' ? 'destructive'
                            : 'secondary'
                          }>
                            {STATUS_TROCA_LABEL[s.status]}
                          </Badge>
                          {s.termo_cancelamento_assinado_em && (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <FileSignature className="h-3 w-3 mr-1" /> Termo assinado
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <span className="font-medium">{s.associado_antigo?.nome}</span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{s.novo_titular_dados?.nome}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Car className="h-3 w-3" />
                          {s.veiculo?.marca} {s.veiculo?.modelo} {s.veiculo?.ano} • Placa {s.veiculo?.placa}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Criada em {new Date(s.created_at).toLocaleString('pt-BR')}
                        </p>
                        {s.motivo_reprovacao && (
                          <p className="text-xs text-destructive">Motivo: {s.motivo_reprovacao}</p>
                        )}
                      </div>
                      <Button variant="outline" size="sm">Detalhes</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ModalDetalhesTroca
        open={!!selecionada}
        onOpenChange={(o) => !o && setSelecionada(null)}
        solicitacaoId={selecionada}
        modo="cadastro"
      />
    </div>
  );
}

// ============================================
// SUBSTITUIÇÕES TAB (mantida)
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
// INCLUSÕES TAB (NOVA — só visualização)
// ============================================

const INCLUSAO_STATUS_LABEL: Record<string, string> = {
  rascunho: 'Em cotação',
  enviada: 'Enviada',
  visualizada: 'Visualizada',
  em_contratacao: 'Em contratação',
  contratada: 'Contratada',
  expirada: 'Expirada',
  recusada: 'Recusada',
};

function InclusoesTab() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');

  const { data: cotacoes, isLoading, refetch } = useQuery({
    queryKey: ['processos-inclusoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotacoes')
        .select('id, numero, status, valor_fipe, valor_total_mensal, veiculo_marca, veiculo_modelo, veiculo_ano, veiculo_placa, token_publico, created_at, dados_extras, contrato_gerado_id')
        .filter('dados_extras->>tipo_entrada', 'eq', 'inclusao')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar nomes dos associados a partir do dados_extras.associado_id
  const associadoIds = useMemo(() => {
    const ids = new Set<string>();
    (cotacoes || []).forEach((c: any) => {
      const aid = c.dados_extras?.associado_id;
      if (aid) ids.add(aid);
    });
    return Array.from(ids);
  }, [cotacoes]);

  const { data: associados } = useQuery({
    queryKey: ['inclusoes-associados', associadoIds],
    queryFn: async () => {
      if (associadoIds.length === 0) return [];
      const { data, error } = await supabase
        .from('associados')
        .select('id, nome, cpf')
        .in('id', associadoIds);
      if (error) throw error;
      return data || [];
    },
    enabled: associadoIds.length > 0,
  });

  const associadosMap = useMemo(() => {
    const m: Record<string, { nome: string; cpf: string | null }> = {};
    (associados || []).forEach((a: any) => { m[a.id] = { nome: a.nome, cpf: a.cpf }; });
    return m;
  }, [associados]);

  const filtered = useMemo(() => {
    if (!cotacoes) return [];
    if (!busca.trim()) return cotacoes;
    const q = busca.toLowerCase();
    return cotacoes.filter((c: any) => {
      const assoc = associadosMap[c.dados_extras?.associado_id || ''];
      return (
        assoc?.nome?.toLowerCase().includes(q) ||
        c.veiculo_placa?.toLowerCase().includes(q) ||
        c.veiculo_modelo?.toLowerCase().includes(q) ||
        c.numero?.toLowerCase().includes(q)
      );
    });
  }, [cotacoes, busca, associadosMap]);

  const formatCurrency = (v: number | null) =>
    v != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—';

  if (isLoading) {
    return <Card><CardContent className="py-12 text-center text-muted-foreground">Carregando inclusões...</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Inclusões de veículos em associados existentes. Visualização operacional — a aprovação acontece no fluxo de contratação.
        </p>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar associado, placa, nº..."
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

      {filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          <PackagePlus className="h-10 w-10 mx-auto mb-2 opacity-40" />
          Nenhuma cotação de inclusão encontrada.
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cotação</TableHead>
                  <TableHead>Associado</TableHead>
                  <TableHead>Veículo</TableHead>
                  <TableHead>FIPE</TableHead>
                  <TableHead>Mensalidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead className="w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c: any) => {
                  const assoc = associadosMap[c.dados_extras?.associado_id || ''];
                  return (
                    <TableRow key={c.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-xs">{c.numero || '—'}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{assoc?.nome || '—'}</div>
                        {assoc?.cpf && <div className="text-xs text-muted-foreground">{assoc.cpf}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{c.veiculo_marca} {c.veiculo_modelo} {c.veiculo_ano}</div>
                        {c.veiculo_placa && <div className="text-xs text-muted-foreground">Placa {c.veiculo_placa}</div>}
                      </TableCell>
                      <TableCell className="text-sm">{formatCurrency(c.valor_fipe)}</TableCell>
                      <TableCell className="text-sm">{formatCurrency(c.valor_total_mensal)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{INCLUSAO_STATUS_LABEL[c.status] || c.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(c.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {c.token_publico && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`/cotacao/${c.token_publico}`, '_blank')}
                              title="Abrir cotação pública"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                          {c.dados_extras?.associado_id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/cadastro/associados/${c.dados_extras.associado_id}`)}
                              title="Ver associado"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================
// CONTADORES (novas fontes)
// ============================================

function useProcessosCounts() {
  return useQuery({
    queryKey: ['processos-counts'],
    queryFn: async () => {
      const [titularidade, substituicoes, migracoes, inclusoes] = await Promise.all([
        (supabase as any)
          .from('solicitacoes_troca_titularidade')
          .select('id', { count: 'exact', head: true })
          .in('status', ['aguardando_cadastro', 'cotacao_em_andamento']),
        supabase
          .from('substituicoes_veiculo')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'aguardando_aprovacao'),
        supabase
          .from('solicitacoes_migracao')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pendente'),
        supabase
          .from('cotacoes')
          .select('id', { count: 'exact', head: true })
          .filter('dados_extras->>tipo_entrada', 'eq', 'inclusao')
          .in('status', ['rascunho', 'enviada', 'visualizada', 'em_contratacao']),
      ]);

      return {
        titularidade: titularidade.count || 0,
        substituicoes: substituicoes.count || 0,
        migracoes: migracoes.count || 0,
        inclusoes: inclusoes.count || 0,
      };
    },
  });
}

// ============================================
// MAIN PAGE
// ============================================

const TAB_KEYS = ['titularidade', 'substituicoes', 'migracoes', 'inclusoes'] as const;
type TabKey = typeof TAB_KEYS[number];

export default function ProcessosOperacionais() {
  const { data: counts } = useProcessosCounts();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabKey) || 'titularidade';
  const [activeTab, setActiveTab] = useState<TabKey>(
    TAB_KEYS.includes(initialTab) ? initialTab : 'titularidade'
  );

  useEffect(() => {
    const t = searchParams.get('tab') as TabKey;
    if (t && TAB_KEYS.includes(t) && t !== activeTab) setActiveTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleTabChange = (v: string) => {
    setActiveTab(v as TabKey);
    setSearchParams((sp) => {
      sp.set('tab', v);
      return sp;
    }, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Processos Operacionais</h1>
        <p className="text-muted-foreground">
          Central única de solicitações: trocas de titularidade, substituições, migrações e inclusões de veículo.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts?.titularidade ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Titularidade pendente</p>
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
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <PackagePlus className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{counts?.inclusoes ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Inclusões em andamento</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="titularidade" className="text-xs sm:text-sm">
            <ArrowRightLeft className="h-4 w-4 mr-1 hidden sm:inline" />
            Titularidade
            {(counts?.titularidade ?? 0) > 0 && (
              <Badge className="ml-1.5 bg-blue-600 text-white text-[10px] px-1.5 py-0">{counts?.titularidade}</Badge>
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
          <TabsTrigger value="inclusoes" className="text-xs sm:text-sm">
            <PackagePlus className="h-4 w-4 mr-1 hidden sm:inline" />
            Inclusões
            {(counts?.inclusoes ?? 0) > 0 && (
              <Badge className="ml-1.5 bg-emerald-600 text-white text-[10px] px-1.5 py-0">{counts?.inclusoes}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="titularidade">
          <TrocaTitularidadeTab />
        </TabsContent>
        <TabsContent value="substituicoes">
          <SubstituicoesTab />
        </TabsContent>
        <TabsContent value="migracoes">
          <MigracoesTab />
        </TabsContent>
        <TabsContent value="inclusoes">
          <InclusoesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
