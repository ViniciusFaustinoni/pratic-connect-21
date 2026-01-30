import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, FileText, Send, Check, X, Loader2, MessageCircle, FileDown, Mail, FileSignature, Eye, Link2, Copy, Trash2, MoreHorizontal, Car, Calendar as CalendarIcon, User, Phone, RefreshCw, Clock, CheckCircle, TrendingUp, CalendarDays } from 'lucide-react';
import { formatDistanceToNow, format, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import type { StatusCotacao } from '@/types/database';
import { useCotacoes, useUpdateCotacao, useDuplicarCotacao, useExcluirCotacao, type CotacaoWithRelations } from '@/hooks/useCotacoes';
import { useGerarContrato } from '@/hooks/useContratos';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useVendedores } from '@/hooks/useVendedores';
import { PermissionGate } from '@/components/PermissionGate';
import { CotacaoFormDialog } from '@/components/cotacoes/CotacaoFormDialog';
import { ContratoWizard } from '@/components/contratos/ContratoWizard';
import { EnviarEmailModal } from '@/components/cotacoes/EnviarEmailModal';
import { VincularLeadModal } from '@/components/cotacoes/VincularLeadModal';
import { gerarPdfCotacao, gerarPdfCotacaoComparativa, type PlanoParaPdf, type CotacaoComparativaParaPdf } from '@/lib/gerarPdfCotacao';
import { CotacaoCard, type CotacaoCardPermissions } from '@/components/cotacoes/CotacaoCard';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useCotacoesRealtime } from '@/hooks/useCotacoesRealtime';

type StatusCotacaoExtended = StatusCotacao | 'visualizada';

const statusConfig: Record<StatusCotacaoExtended, { 
  label: string; 
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof FileText 
}> = {
  rascunho: { 
    label: 'Rascunho', 
    color: 'text-yellow-600 dark:text-yellow-400', 
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-l-yellow-500',
    icon: FileText 
  },
  enviada: { 
    label: 'Enviada', 
    color: 'text-blue-600 dark:text-blue-400', 
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-l-blue-500',
    icon: Send 
  },
  visualizada: { 
    label: 'Visualizada', 
    color: 'text-cyan-600 dark:text-cyan-400', 
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-l-cyan-500',
    icon: Eye 
  },
  aceita: { 
    label: 'Aceita', 
    color: 'text-green-600 dark:text-green-400', 
    bgColor: 'bg-green-500/20',
    borderColor: 'border-l-green-500',
    icon: Check 
  },
  recusada: { 
    label: 'Recusada', 
    color: 'text-red-600 dark:text-red-400', 
    bgColor: 'bg-red-500/20',
    borderColor: 'border-l-red-500',
    icon: X 
  },
  expirada: { 
    label: 'Expirada', 
    color: 'text-muted-foreground', 
    bgColor: 'bg-muted',
    borderColor: 'border-l-muted-foreground',
    icon: FileText 
  },
};

export default function Cotacoes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCotacaoForm, setShowCotacaoForm] = useState(false);
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
  
  // Novos filtros para finalizadas
  const [dataFilter, setDataFilter] = useState<Date | undefined>(undefined);
  const [consultorFilter, setConsultorFilter] = useState<string>('all');

  // Permissões
  const permissions = usePermissions();
  const { profile, user } = useAuth();
  
  // Buscar vendedores para filtro de consultor (só para gestores)
  const { data: vendedores } = useVendedores();
  
  // Buscar cotações com filtro baseado em permissão
  const { data: cotacoes, isLoading } = useCotacoes({
    vendedorId: permissions.userId,
    viewScope: permissions.cotacao.viewScope,
  });
  
  const updateCotacao = useUpdateCotacao();
  const gerarContrato = useGerarContrato();
  const duplicarCotacao = useDuplicarCotacao();
  const excluirCotacao = useExcluirCotacao();
  const queryClient = useQueryClient();
  
  // Ativar realtime para atualizações automáticas
  useCotacoesRealtime();

  // Detectar parâmetro ?lead=xxx para abrir modal com dados do lead
  useEffect(() => {
    const leadParam = searchParams.get('lead');
    if (leadParam) {
      setLeadIdFromUrl(leadParam);
      setShowCotacaoForm(true);
      searchParams.delete('lead');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Helper functions
  const formatRelativeTime = (dateStr: string) => {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR });
  };

  const formatPhone = (phone?: string | null) => {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0,2)}) ${cleaned.slice(2,6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const filteredCotacoes = (cotacoes || []).filter((cotacao) => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      cotacao.numero.toLowerCase().includes(searchLower) ||
      (cotacao.leads?.nome?.toLowerCase().includes(searchLower) ?? false) ||
      (cotacao.veiculo_placa?.toLowerCase().includes(searchLower) ?? false) ||
      (cotacao.veiculo_marca?.toLowerCase().includes(searchLower) ?? false) ||
      (cotacao.veiculo_modelo?.toLowerCase().includes(searchLower) ?? false);
    const matchesStatus = statusFilter === 'all' || cotacao.status === statusFilter;
    
    let matchesMes = true;
    if (mesFilter !== 'all') {
      const cotacaoDate = new Date(cotacao.created_at);
      const [year, month] = mesFilter.split('-').map(Number);
      matchesMes = cotacaoDate.getFullYear() === year && cotacaoDate.getMonth() === month - 1;
    }
    
    return matchesSearch && matchesStatus && matchesMes;
  });

  // Ordenação inteligente
  const sortedCotacoes = [...filteredCotacoes].sort((a, b) => {
    // Prioridade 1: Sem lead vinculado (precisam de ação urgente)
    if (!a.lead_id && b.lead_id) return -1;
    if (a.lead_id && !b.lead_id) return 1;
    
    // Prioridade 2: Por status
    const statusOrder: Record<string, number> = {
      rascunho: 1,
      enviada: 2,
      visualizada: 3,
      aceita: 4,
      recusada: 5,
      expirada: 6,
    };
    const statusDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
    if (statusDiff !== 0) return statusDiff;
    
    // Prioridade 3: Mais recentes primeiro
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  
  // Gerar lista de meses disponíveis
  const mesesDisponiveis = [...new Set((cotacoes || []).map(c => {
    const date = new Date(c.created_at);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }))].sort().reverse();
  
  const formatMesLabel = (mes: string) => {
    const [year, month] = mes.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const handleDuplicar = (cotacao: CotacaoWithRelations) => {
    setCotacaoParaDuplicar(cotacao);
    setShowCotacaoForm(true);
  };

  const handleExcluir = (id: string) => {
    setCotacaoParaExcluir(id);
  };

  const confirmarExclusao = () => {
    if (cotacaoParaExcluir) {
      excluirCotacao.mutate(cotacaoParaExcluir);
      setCotacaoParaExcluir(null);
    }
  };

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
      
      // Se há planos em dados_extras (1 ou mais), usar PDF comparativo
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

        await gerarPdfCotacaoComparativa(cotacaoComparativa);
      } else {
        // Fallback: sem dados_extras, usar PDF padrão
        await gerarPdfCotacao(cotacao);
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
  };

  // Handler para quando contrato for criado - redirecionar para contratos com drawer aberto
  const handleContratoCreated = (contratoId: string) => {
    navigate('/vendas/contratos', { 
      state: { openContrato: contratoId } 
    });
  };

  const handleOpenEmailModal = (cotacao: CotacaoWithRelations) => {
    setSelectedCotacaoEmail(cotacao);
    setShowEmailModal(true);
  };

  const enviarWhatsApp = (cotacao: CotacaoWithRelations) => {
    const telefone = cotacao.leads?.telefone?.replace(/\D/g, '');
    if (!telefone) {
      toast.error('Lead sem telefone cadastrado');
      return;
    }

    const coberturas = cotacao.planos?.coberturas as string[] | undefined;
    const beneficiosTexto = coberturas?.slice(0, 5).map(c => `✓ ${c}`).join('\n') || '✓ Proteção completa';
    
    const mensagem = encodeURIComponent(
      `Olá ${cotacao.leads?.nome || 'Cliente'}! 🚗\n\n` +
      `Segue sua cotação de proteção veicular:\n\n` +
      `📋 *Cotação Nº:* ${cotacao.numero}\n` +
      `📦 *Plano:* ${cotacao.planos?.nome || 'Proteção Veicular'}\n` +
      `💰 *Valor FIPE:* R$ ${cotacao.valor_fipe?.toLocaleString('pt-BR')}\n\n` +
      `💵 *VALOR MENSAL: R$ ${cotacao.valor_total_mensal?.toFixed(2)}*\n\n` +
      `✅ *Principais Benefícios:*\n` +
      `${beneficiosTexto}\n\n` +
      `📝 Taxa de Adesão: R$ ${cotacao.valor_adesao?.toFixed(2)}\n\n` +
      `⏰ Cotação válida por ${cotacao.validade_dias || 7} dias.\n\n` +
      `Posso te ajudar com mais alguma informação?`
    );

    window.open(`https://wa.me/55${telefone}?text=${mensagem}`, '_blank');
    handleMarkAsEnviada(cotacao.id, cotacao.lead_id);
  };

  const copiarParaWhatsApp = async (cotacao: CotacaoWithRelations) => {
    const coberturas = cotacao.planos?.coberturas as string[] | undefined;
    const beneficiosTexto = coberturas?.slice(0, 5).map(c => `✓ ${c}`).join('\n') || '✓ Proteção completa';
    
    const mensagem = 
      `Olá! 🚗\n\n` +
      `Segue sua cotação de proteção veicular:\n\n` +
      `📋 *Cotação Nº:* ${cotacao.numero}\n` +
      `🚙 *Veículo:* ${cotacao.veiculo_marca} ${cotacao.veiculo_modelo} ${cotacao.veiculo_ano}\n` +
      `📦 *Plano:* ${cotacao.planos?.nome || 'Proteção Veicular'}\n` +
      `💰 *Valor FIPE:* R$ ${cotacao.valor_fipe?.toLocaleString('pt-BR')}\n\n` +
      `💵 *VALOR MENSAL: R$ ${cotacao.valor_total_mensal?.toFixed(2)}*\n\n` +
      `✅ *Principais Benefícios:*\n` +
      `${beneficiosTexto}\n\n` +
      `📝 Taxa de Adesão: R$ ${cotacao.valor_adesao?.toFixed(2)}\n\n` +
      `⏰ Cotação válida por ${cotacao.validade_dias || 7} dias.\n\n` +
      `Posso te ajudar com mais alguma informação?`;

    try {
      await navigator.clipboard.writeText(mensagem);
      toast.success('Mensagem copiada! Cole no WhatsApp.');
    } catch (error) {
      toast.error('Erro ao copiar mensagem');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setMesFilter('all');
    setDataFilter(undefined);
    setConsultorFilter('all');
  };

  const hasActiveFilters = search || statusFilter !== 'all' || mesFilter !== 'all' || dataFilter || consultorFilter !== 'all';

  // Stats
  const stats = {
    total: cotacoes?.length || 0,
    rascunhos: cotacoes?.filter((c) => c.status === 'rascunho').length || 0,
    enviadas: cotacoes?.filter((c) => c.status === 'enviada').length || 0,
    aceitas: cotacoes?.filter((c) => c.status === 'aceita').length || 0,
    taxa: cotacoes && cotacoes.length > 0
      ? Math.round(
          (cotacoes.filter((c) => c.status === 'aceita').length /
            cotacoes.filter((c) => c.status !== 'rascunho').length) *
            100
        ) || 0
      : 0,
  };

  // Separar cotações em andamento e fechadas
  const emAndamento = sortedCotacoes.filter(c => 
    ['rascunho', 'enviada', 'visualizada'].includes(c.status)
  );
  
  // Aplicar filtros adicionais nas fechadas
  const fechadasBase = sortedCotacoes.filter(c => 
    ['aceita', 'recusada', 'expirada'].includes(c.status)
  );
  
  const fechadas = fechadasBase.filter(cotacao => {
    // Filtrar por data específica
    let matchesData = true;
    if (dataFilter) {
      const cotacaoDate = new Date(cotacao.created_at);
      matchesData = isSameDay(cotacaoDate, dataFilter);
    }
    
    // Filtrar por consultor
    let matchesConsultor = true;
    if (consultorFilter !== 'all') {
      matchesConsultor = cotacao.vendedor_id === consultorFilter;
    }
    
    return matchesData && matchesConsultor;
  });
  
  // Agrupar finalizadas por data para exibição
  const finalizadasPorData = useMemo(() => {
    const grupos: Record<string, CotacaoWithRelations[]> = {};
    
    fechadas.forEach(cotacao => {
      const data = format(new Date(cotacao.created_at), 'yyyy-MM-dd');
      if (!grupos[data]) grupos[data] = [];
      grupos[data].push(cotacao);
    });
    
    return Object.entries(grupos)
      .sort(([a], [b]) => b.localeCompare(a)) // Mais recente primeiro
      .map(([data, cotacoes]) => ({
        data,
        dataFormatada: format(new Date(data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
        cotacoes,
      }));
  }, [fechadas]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cotação</h1>
          <p className="text-muted-foreground">
            {permissions.cotacao.viewScope === 'all' 
              ? 'Gerencie todas as cotações e acompanhe propostas'
              : 'Gerencie suas cotações e acompanhe propostas'}
          </p>
        </div>
        <PermissionGate permission="cotacao.canCreate">
          <Button className="gap-2" onClick={() => setShowCotacaoForm(true)}>
            <Plus className="h-4 w-4" />
            Nova Cotação
          </Button>
        </PermissionGate>
      </div>

      {/* Stats Cards - Mais chamativo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Cotações</p>
                <p className="text-3xl font-bold text-primary">{stats.total}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Enviadas</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.enviadas}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Send className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Aceitas</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.aceitas}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Taxa Conversão</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.taxa}%</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-wrap">
        <div className="flex-1 min-w-48 space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Buscar</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Lead, veículo ou número..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="enviada">Enviada</SelectItem>
              <SelectItem value="visualizada">Visualizada</SelectItem>
              <SelectItem value="aceita">Aceita</SelectItem>
              <SelectItem value="recusada">Recusada</SelectItem>
              <SelectItem value="expirada">Expirada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Período</label>
          <Select value={mesFilter} onValueChange={setMesFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <CalendarIcon className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Todos os períodos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os períodos</SelectItem>
              {mesesDisponiveis.map((mes) => (
                <SelectItem key={mes} value={mes}>{formatMesLabel(mes)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Filtro de Data Específica (para finalizadas) */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Data</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className={cn(
                  "w-full sm:w-40 justify-start text-left font-normal",
                  !dataFilter && "text-muted-foreground"
                )}
              >
                <CalendarDays className="h-4 w-4 mr-2" />
                {dataFilter ? format(dataFilter, 'dd/MM/yyyy') : 'Todos os dias'}
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
                    Limpar data
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {/* Filtro de Consultor (apenas para gestores) */}
        {permissions.cotacao.viewScope !== 'own' && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Consultor</label>
            <Select value={consultorFilter} onValueChange={setConsultorFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <User className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Todos os consultores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os consultores</SelectItem>
                {vendedores?.map((v) => (
                  <SelectItem key={v.user_id} value={v.user_id}>{v.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10">
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Tabs de Em Andamento e Fechadas */}
      <Tabs defaultValue="andamento" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="andamento" className="gap-2">
            <Clock className="h-4 w-4" />
            Em Andamento
            <Badge variant="secondary" className="ml-1 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
              {emAndamento.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="fechadas" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Finalizadas
            <Badge variant="secondary" className="ml-1 bg-green-500/20 text-green-600 dark:text-green-400">
              {fechadas.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="andamento" className="mt-4 space-y-3">
          {emAndamento.length === 0 ? (
            <Card className="border-dashed border-yellow-500/50">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50 text-yellow-500" />
                <p className="font-medium">Nenhuma cotação em andamento</p>
                <p className="text-sm">Crie uma nova cotação para começar</p>
              </CardContent>
            </Card>
          ) : (
            emAndamento.map((cotacao) => {
              // Calcular permissões específicas para cada cotação
              const isOwner = cotacao.vendedor_id === permissions.userId;
              const cardPermissions: CotacaoCardPermissions = {
                canEdit: permissions.cotacao.canEdit && (!permissions.cotacao.canEditOwnOnly || isOwner),
                canDelete: permissions.cotacao.canDelete,
                canSend: permissions.cotacao.canSend && (!permissions.cotacao.canEditOwnOnly || isOwner),
                canDuplicate: permissions.cotacao.canDuplicate,
                canGenerateContract: permissions.cotacao.canGenerateContract && (!permissions.cotacao.canEditOwnOnly || isOwner),
              };

              return (
                <CotacaoCard 
                  key={cotacao.id}
                  cotacao={cotacao}
                  tipo="andamento"
                  navigate={navigate}
                  formatRelativeTime={formatRelativeTime}
                  formatPhone={formatPhone}
                  formatCurrency={formatCurrency}
                  onVincular={(c) => {
                    setCotacaoParaVincular(c);
                    setShowVincularModal(true);
                  }}
                  onWhatsApp={enviarWhatsApp}
                  onEmail={handleOpenEmailModal}
                  onAceitar={(id) => {
                    updateCotacao.mutate({ id, status: 'aceita' });
                  }}
                  onPdf={handleBaixarPdf}
                  onDuplicar={handleDuplicar}
                  onExcluir={handleExcluir}
                  onCopiarWhatsApp={copiarParaWhatsApp}
                  onGerarContrato={handleOpenContratoWizard}
                  isGerandoContrato={gerarContrato.isPending}
                  permissions={cardPermissions}
                />
              );
            })
          )}
        </TabsContent>

        <TabsContent value="fechadas" className="mt-4 space-y-6">
          {fechadas.length === 0 ? (
            <Card className="border-dashed border-green-500/50">
              <CardContent className="py-12 text-center text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
                <p className="font-medium">
                  {dataFilter || consultorFilter !== 'all' 
                    ? 'Nenhuma proposta encontrada com os filtros aplicados' 
                    : 'Nenhuma proposta finalizada'}
                </p>
                <p className="text-sm">
                  {dataFilter || consultorFilter !== 'all' 
                    ? 'Tente ajustar os filtros de data ou consultor' 
                    : 'As propostas aceitas ou recusadas aparecerão aqui'}
                </p>
              </CardContent>
            </Card>
          ) : (
            finalizadasPorData.map((grupo) => (
              <div key={grupo.data} className="space-y-3">
                {/* Cabeçalho do grupo por data */}
                <div className="flex items-center gap-2 py-2 px-3 bg-muted/50 rounded-lg">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{grupo.dataFormatada}</span>
                  <Badge variant="secondary" className="ml-auto">
                    {grupo.cotacoes.length} {grupo.cotacoes.length === 1 ? 'cotação' : 'cotações'}
                  </Badge>
                </div>
                
                {/* Cards das cotações do dia */}
                <div className="space-y-3 pl-2 border-l-2 border-muted">
                  {grupo.cotacoes.map((cotacao) => {
                    const isOwner = cotacao.vendedor_id === permissions.userId;
                    const cardPermissions: CotacaoCardPermissions = {
                      canEdit: permissions.cotacao.canEdit && (!permissions.cotacao.canEditOwnOnly || isOwner),
                      canDelete: permissions.cotacao.canDelete,
                      canSend: permissions.cotacao.canSend && (!permissions.cotacao.canEditOwnOnly || isOwner),
                      canDuplicate: permissions.cotacao.canDuplicate,
                      canGenerateContract: permissions.cotacao.canGenerateContract && (!permissions.cotacao.canEditOwnOnly || isOwner),
                    };

                    return (
                      <CotacaoCard 
                        key={cotacao.id}
                        cotacao={cotacao}
                        tipo="fechada"
                        navigate={navigate}
                        formatRelativeTime={formatRelativeTime}
                        formatPhone={formatPhone}
                        formatCurrency={formatCurrency}
                        onVincular={(c) => {
                          setCotacaoParaVincular(c);
                          setShowVincularModal(true);
                        }}
                        onWhatsApp={enviarWhatsApp}
                        onEmail={handleOpenEmailModal}
                        onAceitar={(id) => {
                          updateCotacao.mutate({ id, status: 'aceita' });
                        }}
                        onPdf={handleBaixarPdf}
                        onDuplicar={handleDuplicar}
                        onExcluir={handleExcluir}
                        onCopiarWhatsApp={copiarParaWhatsApp}
                        onGerarContrato={handleOpenContratoWizard}
                        isGerandoContrato={gerarContrato.isPending}
                        permissions={cardPermissions}
                      />
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CotacaoFormDialog 
        open={showCotacaoForm} 
        onOpenChange={(open) => {
          setShowCotacaoForm(open);
          if (!open) {
            setLeadIdFromUrl(null);
            setCotacaoParaDuplicar(null);
          }
        }} 
        leadId={leadIdFromUrl || undefined}
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
      />
      <ContratoWizard 
        open={showContratoWizard} 
        onOpenChange={setShowContratoWizard} 
        cotacaoId={selectedCotacaoId}
        onContratoCreated={handleContratoCreated}
      />
      {selectedCotacaoEmail && (
        <EnviarEmailModal
          open={showEmailModal}
          onOpenChange={setShowEmailModal}
          cotacao={selectedCotacaoEmail}
          onSuccess={() => handleMarkAsEnviada(selectedCotacaoEmail.id, selectedCotacaoEmail.lead_id)}
        />
      )}
      
      {/* Modal Vincular Lead */}
      <VincularLeadModal
        open={showVincularModal}
        onOpenChange={setShowVincularModal}
        cotacaoId={cotacaoParaVincular?.id || ''}
        leadAtualId={cotacaoParaVincular?.lead_id}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
        }}
      />
      
      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={!!cotacaoParaExcluir} onOpenChange={(open) => !open && setCotacaoParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cotação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta cotação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmarExclusao}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
