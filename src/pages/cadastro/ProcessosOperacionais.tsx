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
  MessageSquareWarning,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import { SaudeSgaTrocas } from '@/components/troca-titularidade/SaudeSgaTrocas';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { ProcessoCard, ProcessoCardList, type ProcessoCardData, type ProcessoCardBadge } from '@/components/processos/ProcessoCard';
import { useConsultoresProfiles } from '@/hooks/useConsultoresProfiles';

// ============================================
// TROCA DE TITULARIDADE TAB (nova fonte)
// ============================================

const STATUS_TROCA_LABEL: Record<StatusTroca, string> = {
  aguardando_termo_cancelamento: 'Aguardando termo de cancelamento',
  cotacao_em_andamento: 'Cotação em andamento',
  aguardando_cadastro: 'Aguardando Cadastro',
  aguardando_monitoramento: 'Aguardando Monitoramento',
  aguardando_vistoria: 'Em Vistoria',
  liberada_para_assinatura: 'Liberada para assinatura',
  efetivada: 'Efetivada',
  reprovada_cadastro: 'Reprovada (Cadastro)',
  reprovada_monitoramento: 'Reprovada (Monitoramento)',
  cancelada: 'Cancelada',
  aguardando_manutencao: 'Aguardando manutenção',
  expirada: 'Expirada',
};

const TROCA_FILTROS: Record<string, StatusTroca[]> = {
  // REGRA CANÔNICA: `aguardando_cadastro` NÃO aparece em Processos.
  // Quando o trigger trg_troca_promove_cadastro_via_cotacao promove a troca,
  // ela vira proposta da fila do Cadastro e só aparece em
  // `/cadastro/propostas` (Propostas Pendentes), com badge TROCA DE TITULARIDADE.
  // Pré-cadastro: termo pendente ou link público em andamento pelo novo titular.
  em_andamento: ['aguardando_termo_cancelamento', 'cotacao_em_andamento'],
  aguardando_monit: ['aguardando_monitoramento'],
  em_vistoria: ['aguardando_vistoria'],
  aprovadas: ['liberada_para_assinatura', 'efetivada'],
  recusadas: ['reprovada_cadastro', 'reprovada_monitoramento', 'cancelada'],
};

function TrocaTitularidadeTab({
  scopeProfileId,
  modoUsuario,
  podeVerSaudeSga,
}: {
  scopeProfileId?: string;
  modoUsuario: 'cadastro' | 'monitoramento' | 'readonly' | 'auto';
  podeVerSaudeSga: boolean;
}) {
  const [subAba, setSubAba] = useState<keyof typeof TROCA_FILTROS>('em_andamento');
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const { data, isLoading } = useSolicitacoesTroca(TROCA_FILTROS[subAba], scopeProfileId);

  // Resolver nomes de consultores (criado_por é profile.id em solicitacoes_troca_titularidade)
  const profileIds = (data || []).map((s) => s.criado_por).filter(Boolean) as string[];
  const { data: consultores } = useConsultoresProfiles(profileIds, []);

  // REGRA CANÔNICA: aprovação documental da Troca migrou para a fila
  // Cadastro › Propostas Pendentes (com badge roxo). A aba Processos vira
  // read-only para o Cadastro — sem botões Aprovar/Reprovar, apenas
  // acompanhamento da timeline, SGA, documentos, autovistoria e termo.
  // Monitoramento mantém todos os botões intactos.
  const modoEfetivo: 'cadastro' | 'monitoramento' | 'readonly' | 'auto' =
    modoUsuario === 'cadastro' ? 'readonly' : modoUsuario;

  // Resolve modo do modal
  const solicitacaoSelecionada = data?.find(s => s.id === selecionada);
  const modoModal: 'cadastro' | 'monitoramento' | 'readonly' = (() => {
    if (modoEfetivo !== 'auto') return modoEfetivo;
    if (!solicitacaoSelecionada) return 'cadastro';
    const st = solicitacaoSelecionada.status;
    if (st === 'aguardando_monitoramento' || st === 'aguardando_vistoria' || st === 'liberada_para_assinatura') {
      return 'monitoramento';
    }
    return 'cadastro';
  })();

  const mostrarBannerCadastroReadonly = modoUsuario === 'cadastro';

  return (
    <div className="space-y-4">
      {mostrarBannerCadastroReadonly && (
        <Alert className="border-blue-200 bg-blue-50 text-blue-900">
          <Info className="h-4 w-4" />
          <AlertDescription>
            A aprovação documental das trocas é feita em{' '}
            <strong>Cadastro › Propostas Pendentes</strong> (procure pelo badge roxo{' '}
            <span className="font-semibold">TROCA DE TITULARIDADE</span>). Esta aba é
            somente para acompanhamento.
          </AlertDescription>
        </Alert>
      )}
      <Tabs value={subAba} onValueChange={(v) => setSubAba(v as keyof typeof TROCA_FILTROS)}>
        <TabsList className="w-full flex md:grid md:grid-cols-5 overflow-x-auto justify-start md:justify-center">
          <TabsTrigger value="em_andamento" className="flex-shrink-0 text-xs md:text-sm">Em andamento</TabsTrigger>
          <TabsTrigger value="aguardando_monit" className="flex-shrink-0 text-xs md:text-sm">Aguardando Monit.</TabsTrigger>
          <TabsTrigger value="em_vistoria" className="flex-shrink-0 text-xs md:text-sm">Em Vistoria</TabsTrigger>
          <TabsTrigger value="aprovadas" className="flex-shrink-0 text-xs md:text-sm">Aprovadas</TabsTrigger>
          <TabsTrigger value="recusadas" className="flex-shrink-0 text-xs md:text-sm">Recusadas</TabsTrigger>
        </TabsList>

        <TabsContent value={subAba} className="pt-4 space-y-4">
          {subAba === 'aprovadas' && podeVerSaudeSga && <SaudeSgaTrocas />}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : !data || data.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              Nenhuma solicitação nesta aba
            </CardContent></Card>
          ) : (
            <ProcessoCardList>
              {data.map((s) => {
                const badgesExtra: ProcessoCardBadge[] = [];
                if (s.termo_cancelamento_assinado_em) {
                  badgesExtra.push({ label: 'Termo assinado', tone: 'success', icon: FileSignature });
                }
                if (s.status === 'aguardando_cadastro') {
                  if (s.autovistoria_concluida_em) {
                    badgesExtra.push({ label: 'Autovistoria concluída', tone: 'success' });
                  } else {
                    const tipoVistoria = (s as any).cotacao?.tipo_vistoria as string | undefined;
                    const agendamento = (s as any).cotacao?.agendamentos_base?.[0];
                    if (tipoVistoria === 'agendada_base' || agendamento) {
                      if (agendamento?.data_agendada) {
                        const dt = new Date(`${agendamento.data_agendada}T${agendamento.horario || '00:00:00'}-03:00`);
                        const periodo = (agendamento.horario || '').startsWith('08') ? 'Manhã' : (agendamento.horario || '').startsWith('13') ? 'Tarde' : '';
                        badgesExtra.push({ label: `Vistoria base agendada ${dt.toLocaleDateString('pt-BR')} ${periodo}`, tone: 'info' });
                      } else {
                        badgesExtra.push({ label: 'Aguardando vistoria base', tone: 'info' });
                      }
                    } else if (s.termo_cancelamento_assinado_em) {
                      const a = new Date(s.termo_cancelamento_assinado_em);
                      const fimDiaBRTemUTC = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate(), 26, 59, 59, 999));
                      if (new Date() <= fimDiaBRTemUTC) {
                        badgesExtra.push({ label: 'Vistoria dispensada (mesmo dia)', tone: 'success' });
                      } else {
                        badgesExtra.push({ label: 'Aguardando autovistoria', tone: 'warning' });
                      }
                    } else {
                      badgesExtra.push({ label: 'Aguardando autovistoria', tone: 'warning' });
                    }
                  }
                }
                if ((s as any).sga_status === 'falha') {
                  badgesExtra.push({ label: 'Erro SGA', tone: 'destructive' });
                }

                const statusTone: ProcessoCardBadge['tone'] =
                  s.status === 'efetivada' || s.status === 'liberada_para_assinatura' ? 'default'
                  : s.status.startsWith('reprovada') || s.status === 'cancelada' ? 'destructive'
                  : 'secondary';

                const cardData: ProcessoCardData = {
                  id: s.id,
                  statusBadge: { label: STATUS_TROCA_LABEL[s.status], tone: statusTone },
                  badgesExtra,
                  associado: { nome: s.associado_antigo?.nome || '—' },
                  contraparte: s.novo_titular_dados?.nome ? { nome: s.novo_titular_dados.nome } : undefined,
                  veiculo: {
                    marca: s.veiculo?.marca,
                    modelo: s.veiculo?.modelo,
                    ano: s.veiculo?.ano_modelo ?? s.veiculo?.ano_fabricacao ?? undefined,
                    placa: s.veiculo?.placa,
                  },
                  consultor: s.criado_por && consultores?.byProfileId[s.criado_por]
                    ? { nome: consultores.byProfileId[s.criado_por].nome }
                    : undefined,
                  criadoEm: s.created_at,
                  motivoReprovacao: s.motivo_reprovacao,
                  onDetalhes: () => setSelecionada(s.id),
                };
                return <ProcessoCard key={s.id} data={cardData} />;
              })}
            </ProcessoCardList>
          )}
        </TabsContent>
      </Tabs>


      <ModalDetalhesTroca
        open={!!selecionada}
        onOpenChange={(o) => !o && setSelecionada(null)}
        solicitacaoId={selecionada}
        modo={modoModal}
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

function SubstituicoesTab({ scopeAuthUserId }: { scopeAuthUserId?: string }) {
  const navigate = useNavigate();
  const { data: substituicoes, isLoading, refetch } = useSubstituicoes();
  const { data: limites } = useConfigLimitesVeiculo();
  const [subTab, setSubTab] = useState('pendentes');
  const [busca, setBusca] = useState('');

  const filtered = useMemo(() => {
    if (!substituicoes) return [];
    let items = substituicoes;
    if (scopeAuthUserId) {
      items = items.filter((s: any) => s.criado_por === scopeAuthUserId);
    }
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
  }, [substituicoes, subTab, busca, scopeAuthUserId]);

  // Resolver consultor (substituicoes_veiculo.criado_por é auth.users.id)
  const userIds = filtered.map((s: any) => s.criado_por).filter(Boolean) as string[];
  const { data: consultores } = useConsultoresProfiles([], userIds);

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
          <TabsList className="w-full sm:w-auto overflow-x-auto justify-start">
            <TabsTrigger value="pendentes" className="flex-shrink-0">
              Pendentes {pendentesCount > 0 && (
                <Badge variant="destructive" className="ml-1.5 text-xs px-1.5 py-0">{pendentesCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="aprovadas" className="flex-shrink-0">Aprovadas</TabsTrigger>
            <TabsTrigger value="rejeitadas" className="flex-shrink-0">Rejeitadas</TabsTrigger>
            <TabsTrigger value="efetivadas" className="flex-shrink-0">Efetivadas</TabsTrigger>
            <TabsTrigger value="todas" className="flex-shrink-0">Todas</TabsTrigger>
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
              <ProcessoCardList>
                {filtered.map((s: any) => {
                  const veicAntigo = `${s.veiculo_antigo_modelo || s.veiculo_antigo?.modelo || '—'}${(s.veiculo_antigo_placa || s.veiculo_antigo?.placa) ? ` (${s.veiculo_antigo_placa || s.veiculo_antigo?.placa})` : ''}`;
                  const veicNovo = `${s.veiculo_novo_modelo || s.veiculo_novo?.modelo || '—'}${(s.veiculo_novo_placa || s.veiculo_novo?.placa) ? ` (${s.veiculo_novo_placa || s.veiculo_novo?.placa})` : ''}`;
                  const fipeAlta = (s.veiculo_novo_fipe ?? 0) > (limites?.fipeLimiteAutorizacao ?? 120000);
                  const badgesExtra: ProcessoCardBadge[] = [];
                  if (fipeAlta) badgesExtra.push({ label: 'FIPE ALTA', tone: 'destructive', icon: AlertTriangle });

                  const statusLabel = STATUS_SUBSTITUICAO_LABELS[s.status as StatusSubstituicao] || s.status;
                  const statusTone: ProcessoCardBadge['tone'] =
                    s.status === 'efetivada' || s.status === 'aprovada' ? 'default'
                    : s.status === 'rejeitada' ? 'destructive'
                    : 'secondary';

                  const data: ProcessoCardData = {
                    id: s.id,
                    statusBadge: { label: statusLabel, tone: statusTone },
                    badgesExtra,
                    associado: { nome: s.associado?.nome || '—', cpf: s.associado?.cpf },
                    veiculo: {
                      modelo: `${veicAntigo} → ${veicNovo}`,
                    },
                    infoLinhas: [
                      `💰 Mensalidade ${formatCurrency(s.mensalidade_antiga)} → ${formatCurrency(s.mensalidade_nova)} · FIPE Novo ${formatCurrency(s.veiculo_novo_fipe)}`,
                    ],
                    consultor: s.criado_por && consultores?.byUserId[s.criado_por]
                      ? { nome: consultores.byUserId[s.criado_por].nome }
                      : undefined,
                    criadoEm: s.created_at,
                    criadoLabel: 'Solicitada em',
                    onDetalhes: () => navigate(`/cadastro/substituicoes/${s.id}`),
                  };
                  return <ProcessoCard key={s.id} data={data} />;
                })}
              </ProcessoCardList>
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

function InclusoesTab({ scopeAuthUserId }: { scopeAuthUserId?: string }) {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');

  const { data: cotacoes, isLoading, refetch } = useQuery({
    queryKey: ['processos-inclusoes', scopeAuthUserId],
    queryFn: async () => {
      let query = supabase
        .from('cotacoes')
        .select('id, numero, status, valor_fipe, valor_total_mensal, veiculo_marca, veiculo_modelo, veiculo_ano, veiculo_placa, token_publico, created_at, dados_extras, contrato_gerado_id')
        .filter('dados_extras->>tipo_entrada', 'eq', 'inclusao')
        .order('created_at', { ascending: false });
      if (scopeAuthUserId) query = query.eq('vendedor_id', scopeAuthUserId);
      const { data, error } = await query;
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
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>{c.numero || '—'}</span>
                          {(() => {
                            const obs = (c.dados_extras?.observacao_sga as string | undefined)?.trim();
                            const mot = (c.dados_extras?.motivo_ignorar_aviso as string | undefined)?.trim();
                            if (!obs && !mot) return null;
                            const previewSrc = obs || mot || '';
                            const preview = previewSrc.length > 140 ? previewSrc.slice(0, 137) + '…' : previewSrc;
                            return (
                              <TooltipProvider delayDuration={150}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className={mot ? 'text-destructive' : 'text-primary'}>
                                      <MessageSquareWarning className="h-3.5 w-3.5" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs whitespace-pre-wrap">
                                    {mot && <div className="font-semibold text-destructive mb-1">Aviso SGA ignorado</div>}
                                    {preview}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })()}
                        </div>
                      </TableCell>
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

function useProcessosCounts(scope?: { profileId?: string; authUserId?: string }) {
  const profileId = scope?.profileId;
  const authUserId = scope?.authUserId;
  return useQuery({
    queryKey: ['processos-counts', profileId, authUserId],
    queryFn: async () => {
      // `aguardando_cadastro` é fila do Cadastro › Propostas Pendentes — NÃO conta aqui.
      // Em Processos contamos as fases pré-cadastro (termo / link público em andamento).
      let q1 = (supabase as any)
        .from('solicitacoes_troca_titularidade')
        .select('id', { count: 'exact', head: true })
        .in('status', ['aguardando_termo_cancelamento', 'cotacao_em_andamento']);
      if (profileId) q1 = q1.eq('criado_por', profileId);

      let q2 = supabase
        .from('substituicoes_veiculo')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'aguardando_aprovacao');
      if (authUserId) q2 = q2.eq('criado_por', authUserId);

      let q3 = supabase
        .from('solicitacoes_migracao')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pendente');
      if (profileId) q3 = q3.eq('consultor_id', profileId);

      let q4 = supabase
        .from('cotacoes')
        .select('id', { count: 'exact', head: true })
        .filter('dados_extras->>tipo_entrada', 'eq', 'inclusao')
        .in('status', ['rascunho', 'enviada']);
      if (authUserId) q4 = q4.eq('vendedor_id', authUserId);

      const [titularidade, substituicoes, migracoes, inclusoes] = await Promise.all([q1, q2, q3, q4]);

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
  const { user, profile } = useAuth();
  const permissions = usePermissions();

  // Quem vê tudo: diretoria, gestão comercial, super admin e Cadastro
  const canSeeAll =
    permissions.isDiretor ||
    permissions.isAdminMaster ||
    permissions.isDesenvolvedor ||
    permissions.isGerente ||
    permissions.isSupervisorVendas ||
    !!permissions.isAnalistaCadastro ||
    !!permissions.isCoordenadorMonitoramento ||
    !!permissions.isAnalistaMonitoramento;

  const scopeToSelf = !canSeeAll;
  const scopeProfileId = scopeToSelf ? profile?.id : undefined;
  const scopeAuthUserId = scopeToSelf ? user?.id : undefined;

  // Modo do modal de troca por papel
  const isCadastro = !!permissions.isAnalistaCadastro;
  const isMonitoramento = !!permissions.isCoordenadorMonitoramento || !!permissions.isAnalistaMonitoramento;
  const modoUsuario: 'cadastro' | 'monitoramento' | 'readonly' | 'auto' =
    permissions.isDiretor || permissions.isAdminMaster || permissions.isDesenvolvedor ||
    permissions.isGerente || permissions.isSupervisorVendas
      ? 'auto'
      : isCadastro && !isMonitoramento
        ? 'cadastro'
        : isMonitoramento && !isCadastro
          ? 'monitoramento'
          : isCadastro && isMonitoramento
            ? 'auto'
            : 'readonly';

  const podeVerSaudeSga = isCadastro || canSeeAll;

  const { data: counts } = useProcessosCounts(
    scopeToSelf ? { profileId: scopeProfileId, authUserId: scopeAuthUserId } : undefined
  );
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

      {scopeToSelf && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Mostrando apenas as solicitações originadas por você.
          </AlertDescription>
        </Alert>
      )}

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
          <TrocaTitularidadeTab scopeProfileId={scopeProfileId} modoUsuario={modoUsuario} podeVerSaudeSga={podeVerSaudeSga} />
        </TabsContent>
        <TabsContent value="substituicoes">
          <SubstituicoesTab scopeAuthUserId={scopeAuthUserId} />
        </TabsContent>
        <TabsContent value="migracoes">
          <MigracoesTab scopeProfileId={scopeProfileId} hideAdminActions={scopeToSelf} />
        </TabsContent>
        <TabsContent value="inclusoes">
          <InclusoesTab scopeAuthUserId={scopeAuthUserId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
