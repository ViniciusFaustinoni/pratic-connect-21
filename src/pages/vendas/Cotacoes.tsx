import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, FileText, Send, Check, Loader2, CheckCircle, TrendingUp, Calendar as CalendarIcon, User, RefreshCw, CalendarDays, Link, ListChecks, FileUp, PenTool, CreditCard, MapPin, Clock, Trophy, Trash2, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow, format, isSameDay } from 'date-fns';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useCotacoes, useCotacoesPaginadas, useCotacoesFunilCounts, useUpdateCotacao, useDuplicarCotacao, useExcluirCotacao, type CotacaoWithRelations } from '@/hooks/useCotacoes';
import { useGerarContrato } from '@/hooks/useContratos';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useVendedores } from '@/hooks/useVendedores';
import { PermissionGate } from '@/components/PermissionGate';
// Lazy: pesados, só montam quando o usuário abre. Evita ~50 fetches na entrada da listagem.
const CotacaoFormDialog = lazy(() =>
  import('@/components/cotacoes/CotacaoFormDialog').then((m) => ({ default: m.CotacaoFormDialog }))
);
const ContratoWizard = lazy(() =>
  import('@/components/contratos/ContratoWizard').then((m) => ({ default: m.ContratoWizard }))
);
const RelatorioInteligenteCotacoesDialog = lazy(() =>
  import('@/components/vendas/RelatorioInteligenteCotacoesDialog').then((m) => ({
    default: m.RelatorioInteligenteCotacoesDialog,
  }))
);
// gerarPdfCotacao* importados dinamicamente no handler (evita 54KB no bundle inicial)
import type { PlanoParaPdf, CotacaoComparativaParaPdf } from '@/lib/gerarPdfCotacao';
import { CotacoesTable, type CotacoesTablePermissions } from '@/components/cotacoes/CotacoesTable';
import { CotacoesMobileList } from '@/components/cotacoes/CotacoesMobileList';
// Modais lazy — só baixam quando o usuário abre (reduz bundle inicial da rota)
const CotacaoDetalhesModal = lazy(() =>
  import('@/components/cotacoes/CotacaoDetalhesModal').then((m) => ({ default: m.CotacaoDetalhesModal }))
);
const EnviarEmailModal = lazy(() =>
  import('@/components/cotacoes/EnviarEmailModal').then((m) => ({ default: m.EnviarEmailModal }))
);
const VincularLeadModal = lazy(() =>
  import('@/components/cotacoes/VincularLeadModal').then((m) => ({ default: m.VincularLeadModal }))
);
const ConfirmacaoExclusaoCotacaoDialog = lazy(() =>
  import('@/components/cotacoes/ConfirmacaoExclusaoCotacaoDialog').then((m) => ({ default: m.ConfirmacaoExclusaoCotacaoDialog }))
);
const DuplicarCotacaoDialog = lazy(() =>
  import('@/components/cotacoes/DuplicarCotacaoDialog').then((m) => ({ default: m.DuplicarCotacaoDialog }))
);
const NovaEntradaDialog = lazy(() =>
  import('@/components/vendas/OutrasEntradasMenu').then((m) => ({ default: m.NovaEntradaDialog }))
);
import type { DuplicarCotacaoConfirmPayload } from '@/components/cotacoes/DuplicarCotacaoDialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useCotacoesRealtime } from '@/hooks/useCotacoesRealtime';
import { useDebounce } from '@/hooks/useDebounce';
import { Sparkles } from 'lucide-react';

// Categorização dinâmica — fallback por termos quando benefits.category não está disponível
const categorizarPorTermo = (cobLower: string): 'cobertura' | 'assistencia' | 'extra' => {
  const termos_assistencia = ['assistência', '24h', 'rastreador', 'monitoramento', 'reboque', 'guincho', 'chaveiro', 'pane', 'troca de pneu'];
  const termos_extra = ['kit gás', 'carro reserva', 'clube gás', '100% fipe', 'fipe app', 'app', 'proteção de vidros', 'cobertura de vidros'];
  
  if (termos_assistencia.some(t => cobLower.includes(t))) return 'assistencia';
  if (termos_extra.some(t => cobLower.includes(t))) return 'extra';
  return 'cobertura';
};

// Função para categorizar coberturas
const categorizarBeneficios = (coberturas: string[]) => {
  const resultado = {
    coberturas: [] as string[],
    assistencia: [] as string[],
    extras: [] as string[],
  };
  
  coberturas.forEach(cob => {
    const cobLower = cob.toLowerCase();
    let categoriaEncontrada = categorizarPorTermo(cobLower);
    
    if (categoriaEncontrada === 'cobertura') {
      resultado.coberturas.push(cob);
    } else if (categoriaEncontrada === 'assistencia') {
      resultado.assistencia.push(cob);
    } else {
      resultado.extras.push(cob);
    }
  });
  
  return resultado;
};

export default function Cotacoes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCotacaoForm, setShowCotacaoForm] = useState(false);
  const [showNovaEntrada, setShowNovaEntrada] = useState(false);
  const [showContratoWizard, setShowContratoWizard] = useState(false);
  const [selectedCotacaoId, setSelectedCotacaoId] = useState<string>('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedCotacaoEmail, setSelectedCotacaoEmail] = useState<CotacaoWithRelations | null>(null);
  const [leadIdFromUrl, setLeadIdFromUrl] = useState<string | null>(null);
  const [showVincularModal, setShowVincularModal] = useState(false);
  const [cotacaoParaVincular, setCotacaoParaVincular] = useState<CotacaoWithRelations | null>(null);
  const [cotacaoParaExcluir, setCotacaoParaExcluir] = useState<string | null>(null);
  const [mesFilter, setMesFilter] = useState<string>('all');
  const [cotacaoParaDuplicar, setCotacaoParaDuplicar] = useState<CotacaoWithRelations | null>(null);
  const [cotacaoParaContinuar, setCotacaoParaContinuar] = useState<CotacaoWithRelations | null>(null);
  const [cotacaoConfirmarDuplicar, setCotacaoConfirmarDuplicar] = useState<CotacaoWithRelations | null>(null);
  const [ignorarPlacaIds, setIgnorarPlacaIds] = useState<string[]>([]);
  const [copiandoWhatsApp, setCopiandoWhatsApp] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('em_andamento');
  
  // Filtros
  const [dataFilter, setDataFilter] = useState<Date | undefined>(undefined);
  const [consultorFilter, setConsultorFilter] = useState<string>('all');
  const [filtroOrfas, setFiltroOrfas] = useState(false);
  const [etapaFunilFilter, setEtapaFunilFilter] = useState<string>('all');
  
  // Seleção em lote
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showExclusaoLoteDialog, setShowExclusaoLoteDialog] = useState(false);
  
  // Modal de detalhes
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [cotacaoSelecionada, setCotacaoSelecionada] = useState<CotacaoWithRelations | null>(null);
  const [showRelatorioDialog, setShowRelatorioDialog] = useState(false);

  const permissions = usePermissions();
  const { profile, user } = useAuth();
  
  const { data: vendedores } = useVendedores();

  const search = useDebounce(searchInput, 350);

  const PAGE_SIZE = 50;
  const [pageEmAndamento, setPageEmAndamento] = useState(1);
  const [pageFinalizadas, setPageFinalizadas] = useState(1);

  // Reset de paginação ao mudar busca/filtros relevantes
  useEffect(() => {
    setPageEmAndamento(1);
    setPageFinalizadas(1);
  }, [search, permissions.cotacao.viewScope, permissions.userId]);

  const isEmAndamentoTab = activeTab === 'em_andamento';
  const currentPage = isEmAndamentoTab ? pageEmAndamento : pageFinalizadas;
  const setCurrentPage = isEmAndamentoTab ? setPageEmAndamento : setPageFinalizadas;

  const { data: paginatedResult, isLoading, isFetching } = useCotacoesPaginadas({
    vendedorId: permissions.userId,
    viewScope: permissions.cotacao.viewScope,
    searchTerm: search,
    page: currentPage,
    pageSize: PAGE_SIZE,
    statusGroup: isEmAndamentoTab ? 'em_andamento' : 'finalizadas',
  });
  const cotacoes = paginatedResult?.data;
  const totalPaginaAtual = paginatedResult?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalPaginaAtual / PAGE_SIZE));

  // Contadores do funil calculados no servidor — independente do array carregado
  const { data: funilCounts } = useCotacoesFunilCounts({
    vendedorId: permissions.userId,
    viewScope: permissions.cotacao.viewScope,
    searchTerm: search,
  });
  
  const updateCotacao = useUpdateCotacao();
  const gerarContrato = useGerarContrato();
  const duplicarCotacao = useDuplicarCotacao();
  const excluirCotacao = useExcluirCotacao();
  const queryClient = useQueryClient();
  
  // Realtime só na aba "Em Andamento" — finalizadas mudam pouco e geram pressão.
  useCotacoesRealtime({ enabled: isEmAndamentoTab });

  useEffect(() => {
    const leadParam = searchParams.get('lead');
    const novoParam = searchParams.get('novo');
    const tipoEntrada = searchParams.get('tipo_entrada');
    const associadoId = searchParams.get('associado_id');
    
    if (leadParam) {
      setLeadIdFromUrl(leadParam);
      setShowCotacaoForm(true);
      searchParams.delete('lead');
      setSearchParams(searchParams, { replace: true });
    } else if (tipoEntrada === 'substituicao' || tipoEntrada === 'inclusao') {
      // Substituição/Inclusão: abrir modal de cotação direto
      // Os dados do associado/veículo antigo serão salvos em dados_extras na cotação
      setShowCotacaoForm(true);
      // Limpar params após abrir
      const newParams = new URLSearchParams();
      setSearchParams(newParams, { replace: true });
    } else if (novoParam === 'true') {
      setShowNovaEntrada(true);
      searchParams.delete('novo');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const formatRelativeTime = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Filtros adicionais aplicados sobre o resultado já paginado/filtrado pelo servidor.
  // IMPORTANTE: a busca textual NÃO é reaplicada aqui — ela já é feita server-side
  // em useCotacoesPaginadas. Reaplicá-la causava lista vazia quando o servidor já
  // havia limitado a 50 itens (ex: tab "Em Andamento" mostrava 0 com 295 no funil).
  const filteredCotacoes = useMemo(() => {
    return (cotacoes || []).filter((cotacao) => {
      const matchesStatus = statusFilter === 'all' || cotacao.status === statusFilter;

      let matchesMes = true;
      if (mesFilter !== 'all') {
        const cotacaoDate = new Date(cotacao.created_at);
        const [year, month] = mesFilter.split('-').map(Number);
        matchesMes = cotacaoDate.getFullYear() === year && cotacaoDate.getMonth() === month - 1;
      }

      let matchesData = true;
      if (dataFilter) {
        const cotacaoDate = new Date(cotacao.created_at);
        matchesData = isSameDay(cotacaoDate, dataFilter);
      }

      let matchesConsultor = true;
      if (consultorFilter !== 'all') {
        matchesConsultor = cotacao.vendedor_id === consultorFilter;
      }

      let matchesOrfas = true;
      if (filtroOrfas) {
        matchesOrfas = !cotacao.lead_id;
      }

      let matchesEtapa = true;
      if (etapaFunilFilter !== 'all') {
        const sc = cotacao.status_contratacao || '';
        const st = cotacao.status;
        switch (etapaFunilFilter) {
          case 'rascunho': matchesEtapa = st === 'rascunho'; break;
          case 'enviada': matchesEtapa = st === 'enviada' && !sc; break;
          case 'escolhendo_plano': matchesEtapa = ['escolhendo_plano', 'plano_escolhido'].includes(sc); break;
          case 'enviando_documentos': matchesEtapa = ['enviando_documentos', 'dados_preenchidos'].includes(sc); break;
          case 'em_analise': matchesEtapa = sc === 'em_analise'; break;
          case 'assinando_contrato': matchesEtapa = sc === 'assinando_contrato'; break;
          case 'pagando_taxa': matchesEtapa = sc === 'pagando_taxa'; break;
          case 'agendando_vistoria': matchesEtapa = sc === 'agendando_vistoria'; break;
          case 'concluido': matchesEtapa = st === 'aceita' || sc === 'concluido'; break;
          case 'perdida': matchesEtapa = ['recusada', 'expirada'].includes(st); break;
          default: matchesEtapa = true;
        }
      }

      return matchesStatus && matchesMes && matchesData && matchesConsultor && matchesOrfas && matchesEtapa;
    });
  }, [cotacoes, statusFilter, mesFilter, dataFilter, consultorFilter, filtroOrfas, etapaFunilFilter]);

  // Ordenação cronológica — mais recentes primeiro
  const sortedCotacoes = useMemo(() => {
    return [...filteredCotacoes].sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [filteredCotacoes]);

  // Separação Em Andamento vs Finalizadas
  const STATUS_EM_ANDAMENTO = ['rascunho', 'enviada'];
  const STATUS_FINALIZADAS = ['aceita', 'recusada', 'expirada'];

  const cotacoesEmAndamento = useMemo(() => {
    return sortedCotacoes.filter(c => 
      STATUS_EM_ANDAMENTO.includes(c.status) && c.status_contratacao !== 'concluido'
    );
  }, [sortedCotacoes]);

  const cotacoesFinalizadas = useMemo(() => {
    return [...sortedCotacoes.filter(c => 
      STATUS_FINALIZADAS.includes(c.status) || c.status_contratacao === 'concluido'
    )].sort((a, b) => {
      // Ordenar por data de finalização (updated_at) desc, depois por consultor
      const dateA = new Date(a.updated_at || a.created_at).getTime();
      const dateB = new Date(b.updated_at || b.created_at).getTime();
      return dateB - dateA;
    });
  }, [sortedCotacoes]);

  // Totais SEM filtros — preferimos os contadores do servidor (RPC) para refletir
  // a base completa mesmo quando o array carregado está limitado.
  const cotacoesEmAndamentoTotal = useMemo(() => {
    if (funilCounts) return funilCounts.em_andamento_total;
    return (cotacoes || []).filter(c =>
      STATUS_EM_ANDAMENTO.includes(c.status) && c.status_contratacao !== 'concluido'
    ).length;
  }, [cotacoes, funilCounts]);

  const cotacoesFinalizadasTotal = useMemo(() => {
    if (funilCounts) return funilCounts.finalizadas_total;
    return (cotacoes || []).filter(c =>
      STATUS_FINALIZADAS.includes(c.status) || c.status_contratacao === 'concluido'
    ).length;
  }, [cotacoes, funilCounts]);
  
  const mesesDisponiveis = [...new Set((cotacoes || []).map(c => {
    const date = new Date(c.created_at);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }))].sort().reverse();
  
  const formatMesLabel = (mes: string) => {
    const [year, month] = mes.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const handleRowClick = (cotacao: CotacaoWithRelations) => {
    setCotacaoSelecionada(cotacao);
    setShowDetalhesModal(true);
  };

  const handleDuplicar = (cotacao: CotacaoWithRelations) => {
    // Abre primeiro o diálogo de confirmação (motivo + ação na original)
    setCotacaoConfirmarDuplicar(cotacao);
  };

  const handleContinuarCotacao = (cotacao: CotacaoWithRelations) => {
    setCotacaoParaContinuar(cotacao);
    setShowDetalhesModal(false);
    setShowCotacaoForm(true);
  };

  const handleConfirmarDuplicacao = async (payload: DuplicarCotacaoConfirmPayload) => {
    if (!cotacaoConfirmarDuplicar) return;
    const original = cotacaoConfirmarDuplicar;
    try {
      const nova = await duplicarCotacao.mutateAsync({
        cotacaoId: original.id,
        motivo: payload.motivo,
        acaoOriginal: payload.acaoOriginal,
      });
      setCotacaoConfirmarDuplicar(null);
      // Se "manter": ignorar a placa da original (continua existindo no banco)
      // Se "excluir": original já foi removida, sem necessidade de ignorar.
      setIgnorarPlacaIds(payload.acaoOriginal === 'manter' ? [original.id] : []);
      // Abre o formulário com os dados da nova cotação para refinamento
      setCotacaoParaDuplicar({ ...original, ...nova } as CotacaoWithRelations);
      setShowCotacaoForm(true);
    } catch {
      // toast de erro já tratado no hook
    }
  };

  const handleExcluir = (id: string) => {
    setCotacaoParaExcluir(id);
    setShowExclusaoLoteDialog(true);
    setSelectedIds(new Set([id]));
  };

  const handleExcluirEmLote = async (motivo: string) => {
    const ids = Array.from(selectedIds);
    let sucesso = 0;
    let erro = 0;
    
    for (const id of ids) {
      try {
        await excluirCotacao.mutateAsync({ cotacaoId: id, motivo });
        sucesso++;
      } catch {
        erro++;
      }
    }
    
    setSelectedIds(new Set());
    setCotacaoParaExcluir(null);
    
    if (erro === 0) {
      toast.success(`${sucesso} cotação(ões) excluída(s) com sucesso`);
    } else {
      toast.warning(`${sucesso} excluída(s), ${erro} com erro`);
    }
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds(prev => {
      if (prev.size === sortedCotacoes.length) return new Set();
      return new Set(sortedCotacoes.map(c => c.id));
    });
  }, [sortedCotacoes]);

  const handleMarkAsEnviada = async (id: string, leadId?: string | null) => {
    try {
      await updateCotacao.mutateAsync({ id, status: 'enviada' });
      
      if (leadId) {
        await supabase
          .from('leads')
          .update({ etapa: 'cotacao_enviada', updated_at: new Date().toISOString() })
          .eq('id', leadId);
        
        queryClient.invalidateQueries({ queryKey: ['leads'] });
      }
      
      toast.success('Cotação marcada como enviada');
    } catch (error) {
      toast.error('Erro ao atualizar cotação');
    }
  };

  const handleBaixarPdf = async (cotacao: CotacaoWithRelations) => {
    try {
      const planosComparacao = cotacao.dados_extras?.planos_comparacao;
      
      if (planosComparacao && planosComparacao.length > 0) {
        const valorAdesao = cotacao.valor_adesao || 0;
        
        const planosParaPdf: PlanoParaPdf[] = planosComparacao.map(plano => ({
          nome: plano.nome,
          valorMensal: plano.valorMensal,
          valorAdesao: plano.valorAdesao ?? valorAdesao,
          coberturas: plano.coberturas || [],
          naoInclui: plano.naoInclui || [],
          coberturaFipe: plano.coberturaFipe || 100,
          cota: plano.cota || '',
          cotaPercentual: plano.cotaPercentual,
          cotaMinima: plano.cotaMinima,
          cotaDesagio: plano.cotaDesagio,
          cotaMinimaDesagio: plano.cotaMinimaDesagio,
          adicionalMensal: plano.adicionalMensal,
          anoMinimo: plano.anoMinimo,
          alertaDesagio: plano.alertaDesagio,
          coberturasRemovidas: plano.coberturasRemovidas,
        }));

        const cotacaoComparativa: CotacaoComparativaParaPdf = {
          numero: cotacao.numero,
          created_at: cotacao.created_at,
          validade_dias: cotacao.validade_dias,
          nome_solicitante: cotacao.leads?.nome || cotacao.nome_solicitante,
          telefone1_solicitante: cotacao.leads?.telefone || cotacao.telefone1_solicitante,
          email_solicitante: cotacao.leads?.email || cotacao.email_solicitante,
          veiculo_marca: cotacao.veiculo_marca,
          veiculo_modelo: cotacao.veiculo_modelo,
          veiculo_ano: cotacao.veiculo_ano,
          veiculo_placa: cotacao.veiculo_placa,
          valor_fipe: cotacao.valor_fipe,
          planosComparar: planosParaPdf,
        };

        const pdfMod = await import('@/lib/gerarPdfCotacao');
        await pdfMod.gerarPdfCotacaoComparativa(cotacaoComparativa);
      } else {
        const pdfMod = await import('@/lib/gerarPdfCotacao');
        await pdfMod.gerarPdfCotacao(cotacao);
      }
      
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF');
    }
  };

  const handleOpenContratoWizard = (cotacaoId: string) => {
    setSelectedCotacaoId(cotacaoId);
    setShowContratoWizard(true);
    setShowDetalhesModal(false);
  };

  const handleContratoCreated = (contratoId: string) => {
    navigate('/vendas/contratos', { 
      state: { openContrato: contratoId } 
    });
  };

  const handleOpenEmailModal = (cotacao: CotacaoWithRelations) => {
    setSelectedCotacaoEmail(cotacao);
    setShowEmailModal(true);
  };

  // Função de fallback para gerar mensagem localmente
  const gerarMensagemFallback = (
    cotacao: CotacaoWithRelations,
    planos: Array<{ nome: string; valorMensal: number; coberturas: string[]; naoInclui?: string[] }>
  ): string => {
    const nomeCliente = cotacao.leads?.nome || cotacao.nome_solicitante || '';
    const primeiroNome = nomeCliente.split(' ')[0];
    const veiculo = `${cotacao.veiculo_marca} ${cotacao.veiculo_modelo} ${cotacao.veiculo_ano}`;
    
    let mensagem = `Olá${primeiroNome ? ` ${primeiroNome}` : ''}! 🚗\n\n`;
    mensagem += `Preparamos uma cotação especial para seu *${veiculo}*.\n\n`;
    mensagem += `💰 *Valor FIPE:* R$ ${cotacao.valor_fipe?.toLocaleString('pt-BR')}\n\n`;
    
    planos.forEach((plano, index) => {
      if (planos.length > 1) {
        mensagem += `━━━━━━━━━━━━━━━━━━\n`;
        mensagem += `📦 *OPÇÃO ${index + 1}: ${plano.nome}*\n`;
      } else {
        mensagem += `📦 *Plano:* ${plano.nome}\n`;
      }
      mensagem += `💵 *Mensalidade:* R$ ${plano.valorMensal.toFixed(2)}/mês\n\n`;
      
      const beneficios = categorizarBeneficios(plano.coberturas || []);
      
      if (beneficios.coberturas.length > 0) {
        mensagem += `🛡️ *Coberturas:*\n`;
        beneficios.coberturas.forEach(c => {
          mensagem += `✓ ${c}\n`;
        });
        mensagem += `\n`;
      }
      
      if (beneficios.assistencia.length > 0) {
        mensagem += `🚗 *Assistência 24h:*\n`;
        beneficios.assistencia.forEach(c => {
          mensagem += `✓ ${c}\n`;
        });
        mensagem += `\n`;
      }
      
      if (beneficios.extras.length > 0) {
        mensagem += `✨ *Benefícios Extras:*\n`;
        beneficios.extras.forEach(c => {
          mensagem += `✓ ${c}\n`;
        });
        mensagem += `\n`;
      }
      
      if (beneficios.coberturas.length === 0 && beneficios.assistencia.length === 0 && beneficios.extras.length === 0 && plano.coberturas && plano.coberturas.length > 0) {
        mensagem += `✅ *Benefícios inclusos:*\n`;
        plano.coberturas.forEach(c => {
          mensagem += `✓ ${c}\n`;
        });
        mensagem += `\n`;
      }
      
      if (plano.naoInclui && plano.naoInclui.length > 0) {
        mensagem += `❌ *Não inclui:*\n`;
        plano.naoInclui.forEach(n => {
          mensagem += `• ${n}\n`;
        });
        mensagem += `\n`;
      }
    });
    
    if (planos.length > 1) {
      mensagem += `━━━━━━━━━━━━━━━━━━\n\n`;
    }
    
    mensagem += `📝 *Taxa de Adesão:* R$ ${cotacao.valor_adesao?.toFixed(2)}\n`;
    mensagem += `⏰ Cotação válida por ${cotacao.validade_dias || 7} dias.\n\n`;
    
    if (cotacao.token_publico) {
      mensagem += `🔗 *Veja mais detalhes:*\n`;
      mensagem += `${window.location.origin}/cotacao/${cotacao.token_publico}\n\n`;
    }
    
    mensagem += `Qual opção te interessou mais? Estou à disposição! 😊`;
    
    return mensagem;
  };

  const copiarParaWhatsApp = async (cotacao: CotacaoWithRelations) => {
    const planosComparacao = cotacao.dados_extras?.planos_comparacao as Array<{
      nome: string;
      valorMensal: number;
      coberturas?: string[];
      naoInclui?: string[];
    }> | undefined;
    
    let planos: Array<{ nome: string; valorMensal: number; coberturas: string[]; naoInclui?: string[] }> = [];
    
    if (planosComparacao && planosComparacao.length > 0) {
      planos = planosComparacao.map(p => ({
        nome: p.nome,
        valorMensal: p.valorMensal,
        coberturas: p.coberturas || [],
        naoInclui: p.naoInclui || [],
      }));
    } else if (cotacao.planos) {
      planos = [{
        nome: cotacao.planos.nome,
        valorMensal: cotacao.valor_total_mensal || 0,
        coberturas: (cotacao.planos.coberturas as string[]) || [],
      }];
    }
    
    if (planos.length === 0) {
      const mensagemSimples = 
        `Olá! 🚗\n\n` +
        `Segue sua cotação de proteção veicular:\n\n` +
        `📋 *Cotação Nº:* ${cotacao.numero}\n` +
        `🚙 *Veículo:* ${cotacao.veiculo_marca} ${cotacao.veiculo_modelo} ${cotacao.veiculo_ano}\n` +
        `💰 *Valor FIPE:* R$ ${cotacao.valor_fipe?.toLocaleString('pt-BR')}\n\n` +
        `💵 *VALOR MENSAL: R$ ${cotacao.valor_total_mensal?.toFixed(2)}*\n\n` +
        `📝 Taxa de Adesão: R$ ${cotacao.valor_adesao?.toFixed(2)}\n\n` +
        `⏰ Cotação válida por ${cotacao.validade_dias || 7} dias.\n\n` +
        `Posso te ajudar com mais alguma informação?`;
      
      await navigator.clipboard.writeText(mensagemSimples);
      toast.success('Mensagem copiada! Cole no WhatsApp.');
      return;
    }
    
    const planosEnriquecidos = planos.map(p => ({
      ...p,
      beneficiosPorCategoria: categorizarBeneficios(p.coberturas || []),
    }));
    
    const dadosCotacao = {
      cliente: { nome: cotacao.leads?.nome || cotacao.nome_solicitante || 'Cliente' },
      veiculo: {
        marca: cotacao.veiculo_marca || '',
        modelo: cotacao.veiculo_modelo || '',
        ano: cotacao.veiculo_ano || 0,
        placa: cotacao.veiculo_placa,
      },
      valorFipe: cotacao.valor_fipe || 0,
      valorAdesao: cotacao.valor_adesao || 0,
      validadeDias: cotacao.validade_dias || 7,
      planos: planosEnriquecidos,
      linkCotacao: cotacao.token_publico 
        ? `${window.location.origin}/cotacao/${cotacao.token_publico}` 
        : undefined,
    };
    
    setCopiandoWhatsApp(cotacao.id);
    try {
      const { data, error } = await supabase.functions.invoke('gerar-mensagem-whatsapp', {
        body: dadosCotacao,
      });
      
      if (error) throw error;
      
      if (data?.mensagem) {
        await navigator.clipboard.writeText(data.mensagem);
        toast.success('Mensagem personalizada copiada! Cole no WhatsApp.');
      } else {
        throw new Error('Resposta sem mensagem');
      }
    } catch (error) {
      console.warn('Erro ao gerar mensagem com IA, usando fallback:', error);
      const mensagemFallback = gerarMensagemFallback(cotacao, planos);
      await navigator.clipboard.writeText(mensagemFallback);
      toast.success('Mensagem copiada! Cole no WhatsApp.');
    } finally {
      setCopiandoWhatsApp(null);
    }
  };

  const clearFilters = () => {
    setSearchInput('');
    setStatusFilter('all');
    setMesFilter('all');
    setDataFilter(undefined);
    setConsultorFilter('all');
    setFiltroOrfas(false);
    setEtapaFunilFilter('all');
    setSelectedIds(new Set());
  };

  const hasActiveFilters = search || statusFilter !== 'all' || mesFilter !== 'all' || dataFilter || consultorFilter !== 'all' || filtroOrfas || etapaFunilFilter !== 'all';

  // Stats - 9 status do fluxo de cotação. Quando temos contagens server-side
  // (funilCounts), usamos elas para refletir a base inteira; senão caímos no
  // array carregado (compatibilidade).
  const statusStats = useMemo(() => {
    const fc = funilCounts;
    const fromArray = (predicate: (c: CotacaoWithRelations) => boolean) =>
      (cotacoes || []).filter(predicate).length;
    const items = [
      { label: 'Rascunho', icon: FileText, color: 'text-gray-500', bg: 'bg-gray-500/15', count: fc?.rascunho ?? fromArray(c => c.status === 'rascunho') },
      { label: 'Link Enviado', icon: Link, color: 'text-blue-500', bg: 'bg-blue-500/15', count: fc?.enviada ?? fromArray(c => c.status === 'enviada') },
      { label: 'Escolhendo Plano', icon: ListChecks, color: 'text-indigo-500', bg: 'bg-indigo-500/15', count: fc?.escolhendo_plano ?? fromArray(c => ['escolhendo_plano', 'plano_escolhido'].includes(c.status_contratacao || '')) },
      { label: 'Enviando Docs', icon: FileUp, color: 'text-cyan-500', bg: 'bg-cyan-500/15', count: fc?.enviando_documentos ?? fromArray(c => ['enviando_documentos', 'dados_preenchidos'].includes(c.status_contratacao || '')) },
      { label: 'Assinando Contrato', icon: PenTool, color: 'text-purple-500', bg: 'bg-purple-500/15', count: fc?.assinando_contrato ?? fromArray(c => c.status_contratacao === 'assinando_contrato') },
      { label: 'Pagando Taxa', icon: CreditCard, color: 'text-amber-500', bg: 'bg-amber-500/15', count: fc?.pagando_taxa ?? fromArray(c => c.status_contratacao === 'pagando_taxa') },
      { label: 'Agendando Vistoria', icon: MapPin, color: 'text-orange-500', bg: 'bg-orange-500/15', count: fc?.agendando_vistoria ?? fromArray(c => c.status_contratacao === 'agendando_vistoria') },
      { label: 'Em Análise', icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/15', count: fc?.em_analise ?? fromArray(c => c.status_contratacao === 'em_analise') },
      { label: 'Fechado', icon: Trophy, color: 'text-green-500', bg: 'bg-green-500/15', count: fc?.concluido ?? fromArray(c => c.status === 'aceita' || c.status_contratacao === 'concluido') },
    ];
    return items;
  }, [cotacoes, funilCounts]);

  // Função para obter permissões de cada cotação
  const getPermissions = (cotacao: CotacaoWithRelations): CotacoesTablePermissions => {
    const isOwner = cotacao.vendedor_id === permissions.userId;
    const contratoAtivo = ['assinado', 'ativo'].includes(cotacao.contrato?.status || '');
    const canDelete = permissions.cotacao.canDelete || (isOwner && !contratoAtivo);
    
    let deleteReason: string | undefined;
    if (!canDelete) {
      if (contratoAtivo) {
        deleteReason = 'Cotações com contrato ativo não podem ser excluídas';
      } else {
        deleteReason = 'Apenas o vendedor responsável ou diretores podem excluir';
      }
    }
    
    return {
      canEdit: (permissions.cotacao.canEdit && (!permissions.cotacao.canEditOwnOnly || isOwner)) && !contratoAtivo,
      canDelete,
      deleteReason,
      canSend: permissions.cotacao.canSend && (!permissions.cotacao.canEditOwnOnly || isOwner),
      canDuplicate: permissions.cotacao.canDuplicate,
      canGenerateContract: permissions.cotacao.canGenerateContract && (!permissions.cotacao.canEditOwnOnly || isOwner),
    };
  };

  // Spinner inline (dentro da tabela) — não desmonta header/filtros/input

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cotações</h1>
          <p className="text-sm text-muted-foreground">
            {permissions.cotacao.viewScope === 'all' 
              ? `Gerencie todas as cotações`
              : 'Gerencie suas cotações'}
            {funilCounts && funilCounts.total > 0 && (
              <span className="text-foreground font-medium"> · {funilCounts.total} no total</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {permissions.isDiretor && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setShowRelatorioDialog(true)}
            >
              <Sparkles className="h-4 w-4" />
              Relatório Inteligente
            </Button>
          )}
          <PermissionGate permission="cotacao.canCreate">
            <Button 
              className="gap-2 shadow-md hover:shadow-lg transition-all" 
              onClick={() => setShowNovaEntrada(true)}
            >
              <Plus className="h-4 w-4" />
              Nova Cotação
            </Button>
          </PermissionGate>
          <NovaEntradaDialog
            open={showNovaEntrada}
            onOpenChange={setShowNovaEntrada}
            onNovaCotacao={() => setShowCotacaoForm(true)}
          />
          {showRelatorioDialog && (
            <Suspense fallback={null}>
              <RelatorioInteligenteCotacoesDialog
                open={showRelatorioDialog}
                onOpenChange={setShowRelatorioDialog}
              />
            </Suspense>
          )}
        </div>
      </div>

      {/* Stats Bar - Pills flutuantes */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {statusStats.map((item) => {
          const isInactive = item.count === 0;
          return (
            <div 
              key={item.label} 
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl border min-w-fit cursor-default select-none",
                "transition-all duration-200 hover:scale-[1.03] hover:shadow-sm",
                isInactive 
                  ? "opacity-50 bg-muted/20 border-transparent" 
                  : "bg-card border-border/60 shadow-sm"
              )}
            >
              <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", item.bg)}>
                <item.icon className={cn("h-3.5 w-3.5", item.color)} />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className={cn("text-base font-bold leading-none", item.color)}>{item.count}</span>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap leading-none">{item.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Card mobile: total de cotações (visível mesmo com filtros aplicados) */}
      {funilCounts && funilCounts.total > 0 && (
        <div className="md:hidden">
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between">
            <div className="text-sm">
              <span className="text-muted-foreground">Você tem </span>
              <span className="font-bold text-primary">{funilCounts.total}</span>
              <span className="text-muted-foreground"> cotação(ões) no total</span>
            </div>
            {hasActiveFilters && (
              <Button size="sm" variant="ghost" onClick={clearFilters} className="h-7 px-2 text-xs">
                Limpar filtros
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Tabs Em Andamento / Finalizadas */}
      <Tabs value={activeTab} onValueChange={(v) => {
        setActiveTab(v);
        // Reset do filtro de Status — ele só existe em "Em Andamento" e fica "fantasma" entre abas
        setStatusFilter('all');
      }} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="em_andamento" className="gap-2">
            Em Andamento
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {cotacoesEmAndamentoTotal}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="finalizadas" className="gap-2">
            Finalizadas
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {cotacoesFinalizadasTotal}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Filtros - Barra unificada */}
        <div className={cn(
          "flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl",
          "bg-muted/30 border border-border/40"
        )}>
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              placeholder="Buscar lead, veículo ou número..."
              className="pl-9 h-9 border-0 bg-background/80 shadow-sm focus-visible:ring-1"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          {activeTab === 'em_andamento' && (
            <>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-9 border-0 bg-background/80 shadow-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="enviada">Enviada</SelectItem>
                  <SelectItem value="visualizada">Visualizada</SelectItem>
                </SelectContent>
              </Select>
              <Select value={mesFilter} onValueChange={setMesFilter}>
                <SelectTrigger className="w-[150px] h-9 border-0 bg-background/80 shadow-sm">
                  <CalendarIcon className="h-4 w-4 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos períodos</SelectItem>
                  {mesesDisponiveis.map((mes) => (
                    <SelectItem key={mes} value={mes}>{formatMesLabel(mes)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          <Select value={etapaFunilFilter} onValueChange={setEtapaFunilFilter}>
            <SelectTrigger className="w-[200px] h-9 border-0 bg-background/80 shadow-sm">
              <ListChecks className="h-4 w-4 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Etapa do funil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etapas</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="enviada">Enviada — aguardando cliente</SelectItem>
              <SelectItem value="escolhendo_plano">Escolhendo plano</SelectItem>
              <SelectItem value="enviando_documentos">Enviando documentos</SelectItem>
              <SelectItem value="em_analise">Documentos em análise</SelectItem>
              <SelectItem value="assinando_contrato">Aguardando assinatura</SelectItem>
              <SelectItem value="pagando_taxa">Pagando taxa</SelectItem>
              <SelectItem value="agendando_vistoria">Agendando vistoria</SelectItem>
              <SelectItem value="concluido">Convertida em associado</SelectItem>
              <SelectItem value="perdida">Perdida / expirada</SelectItem>
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className={cn(
                  "h-9 px-3 border-0 bg-background/80 shadow-sm",
                  !dataFilter && "text-muted-foreground"
                )}
              >
                <CalendarDays className="h-4 w-4 mr-1.5" />
                {dataFilter ? format(dataFilter, 'dd/MM') : 'Data'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dataFilter}
                onSelect={setDataFilter}
                initialFocus
                className="p-3 pointer-events-auto"
              />
              {dataFilter && (
                <div className="p-2 border-t">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full" 
                    onClick={() => setDataFilter(undefined)}
                  >
                    Limpar
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {permissions.cotacao.viewScope !== 'own' && (
            <Select value={consultorFilter} onValueChange={setConsultorFilter}>
              <SelectTrigger className="w-[160px] h-9 border-0 bg-background/80 shadow-sm">
                <User className="h-4 w-4 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Consultor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos consultores</SelectItem>
                {vendedores?.map((v) => (
                  <SelectItem key={v.user_id} value={v.user_id}>{v.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {activeTab === 'em_andamento' && (permissions.cotacao.canDelete || permissions.userId) && (
            <Button
              variant={filtroOrfas ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setFiltroOrfas(!filtroOrfas);
                setSelectedIds(new Set());
              }}
              className={cn(
                "h-9 px-3 shadow-sm",
                !filtroOrfas && "border-0 bg-background/80"
              )}
            >
              <AlertTriangle className="h-4 w-4 mr-1.5" />
              Sem Lead
            </Button>
          )}
          
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearFilters} 
              className="h-9 text-muted-foreground hover:text-foreground animate-in fade-in-0 slide-in-from-left-2 duration-200"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Limpar
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                {[search, statusFilter !== 'all', mesFilter !== 'all', dataFilter, consultorFilter !== 'all', filtroOrfas, etapaFunilFilter !== 'all'].filter(Boolean).length}
              </Badge>
            </Button>
          )}
        </div>

        {/* Barra de seleção em lote */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-destructive/10 border border-destructive/20 animate-in fade-in-0 slide-in-from-top-2 duration-200">
            <span className="text-sm font-medium text-destructive">
              {selectedIds.size} cotação(ões) selecionada(s)
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowExclusaoLoteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Excluir selecionadas
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="text-muted-foreground"
            >
              Limpar seleção
            </Button>
          </div>
        )}

        {/* Tab Em Andamento */}
        <TabsContent value="em_andamento">
          {cotacoesEmAndamentoTotal > 0 && cotacoesEmAndamento.length === 0 && hasActiveFilters && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  Você tem <strong>{cotacoesEmAndamentoTotal}</strong> cotação(ões) em andamento, mas os filtros ativos estão ocultando todas.
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={clearFilters} className="shrink-0">
                Limpar filtros
              </Button>
            </div>
          )}
          <div className="hidden md:block">
            <CotacoesTable 
              cotacoes={cotacoesEmAndamento}
              onRowClick={handleRowClick}
              onCopiarWhatsApp={copiarParaWhatsApp}
              onPdf={handleBaixarPdf}
              onDuplicar={handleDuplicar}
              onContinuar={handleContinuarCotacao}
              onExcluir={handleExcluir}
              copiandoWhatsAppId={copiandoWhatsApp}
              getPermissions={getPermissions}
              selectable={true}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleAll={toggleSelectAll}
            />
          </div>
          <div className="md:hidden">
            <CotacoesMobileList
              cotacoes={cotacoesEmAndamento}
              onRowClick={handleRowClick}
              onCopiarWhatsApp={copiarParaWhatsApp}
              onPdf={handleBaixarPdf}
              onDuplicar={handleDuplicar}
              onContinuar={handleContinuarCotacao}
              onExcluir={handleExcluir}
              copiandoWhatsAppId={copiandoWhatsApp}
              getPermissions={getPermissions}
              selectable={true}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
            />
          </div>
        </TabsContent>

        {/* Tab Finalizadas */}
        <TabsContent value="finalizadas">
          {cotacoesFinalizadasTotal > 0 && cotacoesFinalizadas.length === 0 && hasActiveFilters && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  Você tem <strong>{cotacoesFinalizadasTotal}</strong> cotação(ões) finalizadas, mas os filtros ativos estão ocultando todas.
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={clearFilters} className="shrink-0">
                Limpar filtros
              </Button>
            </div>
          )}
          <div className="hidden md:block">
            <CotacoesTable 
              cotacoes={cotacoesFinalizadas}
              onRowClick={handleRowClick}
              onCopiarWhatsApp={copiarParaWhatsApp}
              onPdf={handleBaixarPdf}
              onDuplicar={handleDuplicar}
              onContinuar={handleContinuarCotacao}
              onExcluir={handleExcluir}
              copiandoWhatsAppId={copiandoWhatsApp}
              getPermissions={getPermissions}
              selectable={true}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleAll={toggleSelectAll}
              groupByDate={true}
            />
          </div>
          <div className="md:hidden">
            <CotacoesMobileList
              cotacoes={cotacoesFinalizadas}
              onRowClick={handleRowClick}
              onCopiarWhatsApp={copiarParaWhatsApp}
              onPdf={handleBaixarPdf}
              onDuplicar={handleDuplicar}
              onContinuar={handleContinuarCotacao}
              onExcluir={handleExcluir}
              copiandoWhatsAppId={copiandoWhatsApp}
              getPermissions={getPermissions}
              selectable={true}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              groupByDate={true}
            />
          </div>
        </TabsContent>

        {/* Paginação server-side (50/página) — vale para a aba ativa */}
        {totalPaginaAtual > PAGE_SIZE && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 py-3 border-t border-border/40 mt-2">
            <div className="text-xs text-muted-foreground">
              Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
              {' · '}
              {totalPaginaAtual} resultado(s)
              {isFetching && <span className="ml-2 italic">atualizando…</span>}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1 || isFetching}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages || isFetching}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Tabs>

      {/* Modal de Detalhes — lazy + só monta quando abre */}
      {showDetalhesModal && cotacaoSelecionada && (
        <Suspense fallback={null}>
          <CotacaoDetalhesModal
            open={showDetalhesModal}
            onOpenChange={setShowDetalhesModal}
            cotacao={cotacaoSelecionada}
            onCopiarWhatsApp={copiarParaWhatsApp}
            onPdf={handleBaixarPdf}
            onEmail={handleOpenEmailModal}
            onGerarContrato={handleOpenContratoWizard}
            onAceitar={(id) => updateCotacao.mutate({ id, status: 'aceita' })}
            onDuplicar={handleDuplicar}
            onContinuar={handleContinuarCotacao}
            isCopiandoWhatsApp={copiandoWhatsApp === cotacaoSelecionada?.id}
            isGerandoContrato={gerarContrato.isPending}
            canGenerateContract={cotacaoSelecionada ? getPermissions(cotacaoSelecionada).canGenerateContract : false}
            canSend={cotacaoSelecionada ? getPermissions(cotacaoSelecionada).canSend : false}
          />
        </Suspense>
      )}

      {/* Dialogs — lazy mount: só sobem quando o usuário abre, evitando ~50 fetches no carregamento da listagem */}
      {showCotacaoForm && (
        <Suspense fallback={null}>
          <CotacaoFormDialog
            open={showCotacaoForm}
            onOpenChange={(open) => {
              setShowCotacaoForm(open);
              if (!open) {
                setLeadIdFromUrl(null);
                setCotacaoParaDuplicar(null);
                setCotacaoParaContinuar(null);
                setIgnorarPlacaIds([]);
              }
            }}
            leadId={leadIdFromUrl || undefined}
            ignorarPlacaDuplicadaIds={ignorarPlacaIds}
            cotacaoBase={cotacaoParaDuplicar ? {
              valor_fipe: cotacaoParaDuplicar.valor_fipe,
              valor_adicional: cotacaoParaDuplicar.valor_adicional,
              valor_adesao: cotacaoParaDuplicar.valor_adesao,
              validade_dias: cotacaoParaDuplicar.validade_dias,
              veiculo_marca: cotacaoParaDuplicar.veiculo_marca,
              veiculo_modelo: cotacaoParaDuplicar.veiculo_modelo,
              veiculo_ano: cotacaoParaDuplicar.veiculo_ano,
              veiculo_placa: cotacaoParaDuplicar.veiculo_placa,
              codigo_fipe: cotacaoParaDuplicar.codigo_fipe,
              categoria: cotacaoParaDuplicar.categoria,
              regiao: cotacaoParaDuplicar.regiao,
              nome_solicitante: cotacaoParaDuplicar.nome_solicitante || cotacaoParaDuplicar.leads?.nome || null,
              telefone1_solicitante: cotacaoParaDuplicar.telefone1_solicitante || cotacaoParaDuplicar.leads?.telefone || null,
              email_solicitante: cotacaoParaDuplicar.email_solicitante || cotacaoParaDuplicar.leads?.email || null,
              lead_id: cotacaoParaDuplicar.lead_id,
              plano_id: cotacaoParaDuplicar.plano_id,
              dados_extras: cotacaoParaDuplicar.dados_extras as any,
            } : null}
            cotacaoParaEditar={cotacaoParaContinuar ? {
              id: cotacaoParaContinuar.id,
              valor_fipe: cotacaoParaContinuar.valor_fipe,
              valor_adicional: cotacaoParaContinuar.valor_adicional,
              valor_adesao: cotacaoParaContinuar.valor_adesao,
              validade_dias: cotacaoParaContinuar.validade_dias,
              veiculo_marca: cotacaoParaContinuar.veiculo_marca,
              veiculo_modelo: cotacaoParaContinuar.veiculo_modelo,
              veiculo_ano: cotacaoParaContinuar.veiculo_ano,
              veiculo_placa: cotacaoParaContinuar.veiculo_placa,
              codigo_fipe: cotacaoParaContinuar.codigo_fipe,
              categoria: cotacaoParaContinuar.categoria,
              regiao: cotacaoParaContinuar.regiao,
              nome_solicitante: cotacaoParaContinuar.nome_solicitante || cotacaoParaContinuar.leads?.nome || null,
              telefone1_solicitante: cotacaoParaContinuar.telefone1_solicitante || cotacaoParaContinuar.leads?.telefone || null,
              email_solicitante: cotacaoParaContinuar.email_solicitante || cotacaoParaContinuar.leads?.email || null,
              lead_id: cotacaoParaContinuar.lead_id,
              plano_id: cotacaoParaContinuar.plano_id,
              indicador_id: cotacaoParaContinuar.indicador_id,
              indicador_nome: cotacaoParaContinuar.indicador_nome,
              dados_extras: cotacaoParaContinuar.dados_extras as any,
            } : null}
            onSuccess={() => {
              setActiveTab('em_andamento');
              setStatusFilter('all');
              setMesFilter('all');
              setDataFilter(undefined);
              setConsultorFilter('all');
              setFiltroOrfas(false);
              setEtapaFunilFilter('all');
              setSearchInput('');
              toast.success('Cotação salva! Exibindo em "Em Andamento".');
            }}
          />
        </Suspense>
      )}
      {showContratoWizard && (
        <Suspense fallback={null}>
          <ContratoWizard
            open={showContratoWizard}
            onOpenChange={setShowContratoWizard}
            cotacaoId={selectedCotacaoId}
            onContratoCreated={handleContratoCreated}
          />
        </Suspense>
      )}
      {selectedCotacaoEmail && (
        <Suspense fallback={null}>
          <EnviarEmailModal
            open={showEmailModal}
            onOpenChange={setShowEmailModal}
            cotacao={selectedCotacaoEmail}
            onSuccess={() => handleMarkAsEnviada(selectedCotacaoEmail.id, selectedCotacaoEmail.lead_id)}
          />
        </Suspense>
      )}

      {showVincularModal && (
        <Suspense fallback={null}>
          <VincularLeadModal
            open={showVincularModal}
            onOpenChange={setShowVincularModal}
            cotacaoId={cotacaoParaVincular?.id || ''}
            leadAtualId={cotacaoParaVincular?.lead_id}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
            }}
          />
        </Suspense>
      )}

      {cotacaoConfirmarDuplicar && (
        <Suspense fallback={null}>
          <DuplicarCotacaoDialog
            open={!!cotacaoConfirmarDuplicar}
            onOpenChange={(open) => {
              if (!open) setCotacaoConfirmarDuplicar(null);
            }}
            cotacao={cotacaoConfirmarDuplicar ? {
              id: cotacaoConfirmarDuplicar.id,
              numero: cotacaoConfirmarDuplicar.numero,
              vendedor_id: cotacaoConfirmarDuplicar.vendedor_id,
              status: cotacaoConfirmarDuplicar.status,
            } : null}
            vendedorOriginalNome={cotacaoConfirmarDuplicar?.vendedor?.nome || null}
            currentUserId={user?.id}
            isSubmitting={duplicarCotacao.isPending}
            onConfirm={handleConfirmarDuplicacao}
          />
        </Suspense>
      )}

      {showExclusaoLoteDialog && (
        <Suspense fallback={null}>
          <ConfirmacaoExclusaoCotacaoDialog
            open={showExclusaoLoteDialog}
            onOpenChange={(open) => {
              setShowExclusaoLoteDialog(open);
              if (!open) setCotacaoParaExcluir(null);
            }}
            quantidade={selectedIds.size}
            onConfirm={handleExcluirEmLote}
          />
        </Suspense>
      )}
    </div>
  );
}
