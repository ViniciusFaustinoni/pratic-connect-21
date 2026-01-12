import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, FileText, Send, Check, X, Loader2, MessageCircle, FileDown, Mail, FileSignature, Eye, Link2, Copy, Trash2, MoreHorizontal, Car, Calendar, User, Phone, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
import type { StatusCotacao } from '@/types/database';
import { useCotacoes, useUpdateCotacao, useDuplicarCotacao, useExcluirCotacao, type CotacaoWithRelations } from '@/hooks/useCotacoes';
import { useGerarContrato } from '@/hooks/useContratos';
import { useAuth } from '@/contexts/AuthContext';
import { CotacaoFormDialog } from '@/components/cotacoes/CotacaoFormDialog';
import { ContratoWizard } from '@/components/contratos/ContratoWizard';
import { EnviarEmailModal } from '@/components/cotacoes/EnviarEmailModal';
import { VincularLeadModal } from '@/components/cotacoes/VincularLeadModal';
import { gerarPdfCotacao } from '@/lib/gerarPdfCotacao';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

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

  const { data: cotacoes, isLoading } = useCotacoes();
  const updateCotacao = useUpdateCotacao();
  const gerarContrato = useGerarContrato();
  const duplicarCotacao = useDuplicarCotacao();
  const excluirCotacao = useExcluirCotacao();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

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
    duplicarCotacao.mutate(cotacao.id);
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

  const handleBaixarPdf = (cotacao: CotacaoWithRelations) => {
    try {
      gerarPdfCotacao(cotacao);
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      toast.error('Erro ao gerar PDF');
    }
  };

  const handleOpenContratoWizard = (cotacaoId: string) => {
    setSelectedCotacaoId(cotacaoId);
    setShowContratoWizard(true);
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

    const mensagem = encodeURIComponent(
      `Olá ${cotacao.leads?.nome || 'Cliente'}! 🚗\n\n` +
      `Segue sua cotação de proteção veicular:\n\n` +
      `📋 *Cotação Nº:* ${cotacao.numero}\n` +
      `📦 *Plano:* ${cotacao.planos?.nome || 'Proteção Veicular'}\n` +
      `💰 *Valor FIPE:* R$ ${cotacao.valor_fipe?.toLocaleString('pt-BR')}\n\n` +
      `*Valores Mensais:*\n` +
      `• Cota: R$ ${cotacao.valor_cota?.toFixed(2)}\n` +
      `• Taxa Adm: R$ ${cotacao.taxa_administrativa?.toFixed(2)}\n` +
      `• Rastreamento: R$ ${cotacao.valor_rastreamento?.toFixed(2)}\n` +
      `• Assistência: R$ ${(cotacao.valor_assistencia || 0)?.toFixed(2)}\n\n` +
      `💵 *TOTAL MENSAL: R$ ${cotacao.valor_total_mensal?.toFixed(2)}*\n\n` +
      `📝 Taxa de Adesão: R$ ${cotacao.valor_adesao?.toFixed(2)}\n\n` +
      `⏰ Cotação válida por ${cotacao.validade_dias || 7} dias.\n\n` +
      `Posso te ajudar com mais alguma informação?`
    );

    window.open(`https://wa.me/55${telefone}?text=${mensagem}`, '_blank');
    handleMarkAsEnviada(cotacao.id, cotacao.lead_id);
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setMesFilter('all');
  };

  const hasActiveFilters = search || statusFilter !== 'all' || mesFilter !== 'all';

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
          <h1 className="text-2xl font-bold">Cotações</h1>
          <p className="text-muted-foreground">
            Gerencie cotações e acompanhe propostas enviadas
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowCotacaoForm(true)}>
          <Plus className="h-4 w-4" />
          Nova Cotação
        </Button>
      </div>

      {/* Stats - Layout compacto */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="bg-card">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.rascunhos}</p>
            <p className="text-xs text-muted-foreground">Rascunhos</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/10 border-blue-500/30">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.enviadas}</p>
            <p className="text-xs text-muted-foreground">Enviadas</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.aceitas}</p>
            <p className="text-xs text-muted-foreground">Aceitas</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{stats.taxa}%</p>
            <p className="text-xs text-muted-foreground">Conversão</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar lead ou veículo..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(statusConfig).map(([key, value]) => (
              <SelectItem key={key} value={key}>{value.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mesFilter} onValueChange={setMesFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {mesesDisponiveis.map((mes) => (
              <SelectItem key={mes} value={mes}>{formatMesLabel(mes)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Limpar
          </Button>
        )}
      </div>

      {/* Lista de Cotações em Cards */}
      <div className="space-y-3">
        {sortedCotacoes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma cotação encontrada</p>
            </CardContent>
          </Card>
        ) : (
          sortedCotacoes.map((cotacao) => {
            const status = statusConfig[cotacao.status as StatusCotacaoExtended] || statusConfig.rascunho;
            const hasLead = !!cotacao.lead_id;
            const isWithoutLead = !hasLead && cotacao.status === 'rascunho';
            
            return (
              <Card 
                key={cotacao.id}
                className={cn(
                  "overflow-hidden border-l-4 transition-all hover:shadow-md hover:border-l-primary cursor-pointer",
                  isWithoutLead ? 'border-l-orange-500 bg-orange-500/5' : status.borderColor
                )}
                onClick={() => navigate(`/vendas/cotacoes/${cotacao.id}`)}
              >
                {/* Header do Card: Status + Tempo */}
                <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
                  <Badge className={cn(status.bgColor, status.color, "font-medium border-0")}>
                    <status.icon className="h-3 w-3 mr-1" />
                    {isWithoutLead ? 'SEM LEAD VINCULADO' : status.label.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(cotacao.created_at)}
                  </span>
                </div>
                
                <CardContent className="p-4">
                  {/* Conteúdo Principal: Lead + Veículo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    {/* Coluna Lead */}
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium",
                        hasLead ? "bg-primary/10 text-primary" : "bg-orange-500/10 text-orange-500"
                      )}>
                        {hasLead ? cotacao.leads?.nome?.charAt(0).toUpperCase() : <User className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "font-semibold text-lg truncate",
                          !hasLead && "text-orange-600 dark:text-orange-400"
                        )}>
                          {cotacao.leads?.nome || 'Sem lead vinculado'}
                        </p>
                        {hasLead && cotacao.leads?.telefone ? (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {formatPhone(cotacao.leads.telefone)}
                          </p>
                        ) : !hasLead && (
                          <Button
                            size="sm"
                            variant="link"
                            className="p-0 h-auto text-orange-600 dark:text-orange-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCotacaoParaVincular(cotacao);
                              setShowVincularModal(true);
                            }}
                          >
                            <Link2 className="h-3 w-3 mr-1" />
                            Vincular Lead
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Coluna Veículo */}
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Car className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {cotacao.veiculo_marca} {cotacao.veiculo_modelo} {cotacao.veiculo_ano}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {cotacao.veiculo_placa ? (
                            <Badge variant="outline" className="font-mono text-xs">
                              {cotacao.veiculo_placa}
                            </Badge>
                          ) : (
                            'Placa não informada'
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Valores */}
                  <div className="flex flex-wrap gap-4 sm:gap-8 text-sm mb-4">
                    <div>
                      <span className="text-muted-foreground">FIPE: </span>
                      <span className="font-medium">{formatCurrency(cotacao.valor_fipe)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Mensal: </span>
                      <span className="font-semibold text-primary text-base">
                        {formatCurrency(cotacao.valor_total_mensal)}
                      </span>
                    </div>
                  </div>
                  
                  <Separator className="my-3" />
                  
                  {/* Ações */}
                  <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => navigate(`/vendas/cotacoes/${cotacao.id}`)}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      Ver Detalhes
                    </Button>
                    
                    {/* Ações por Status */}
                    {cotacao.status === 'rascunho' && hasLead && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => enviarWhatsApp(cotacao)}>
                          <MessageCircle className="h-4 w-4 mr-1 text-green-600" />
                          WhatsApp
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleOpenEmailModal(cotacao)}>
                          <Mail className="h-4 w-4 mr-1 text-blue-600" />
                          Email
                        </Button>
                      </>
                    )}
                    
                    {cotacao.status === 'rascunho' && !hasLead && (
                      <Button
                        size="sm"
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                        onClick={() => {
                          setCotacaoParaVincular(cotacao);
                          setShowVincularModal(true);
                        }}
                      >
                        <Link2 className="h-4 w-4 mr-1" />
                        Vincular para Enviar
                      </Button>
                    )}
                    
                    {cotacao.status === 'enviada' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => enviarWhatsApp(cotacao)}>
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Reenviar
                        </Button>
                        <Button size="sm" onClick={() => handleOpenContratoWizard(cotacao.id)}>
                          <Check className="h-4 w-4 mr-1" />
                          Aceitar
                        </Button>
                      </>
                    )}
                    
                    {cotacao.status === 'aceita' && (
                      <Button 
                        size="sm"
                        onClick={() => gerarContrato.mutate({ 
                          cotacaoId: cotacao.id, 
                          vendedorId: profile?.id 
                        })}
                        disabled={gerarContrato.isPending}
                      >
                        <FileSignature className="h-4 w-4 mr-1" />
                        {gerarContrato.isPending ? 'Gerando...' : 'Gerar Contrato'}
                      </Button>
                    )}
                    
                    {/* Menu de ações extras */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="px-2">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleBaixarPdf(cotacao)}>
                          <FileDown className="h-4 w-4 mr-2" />
                          Baixar PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicar(cotacao)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleExcluir(cotacao.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Dialogs */}
      <CotacaoFormDialog 
        open={showCotacaoForm} 
        onOpenChange={(open) => {
          setShowCotacaoForm(open);
          if (!open) setLeadIdFromUrl(null);
        }} 
        leadId={leadIdFromUrl || undefined}
      />
      <ContratoWizard 
        open={showContratoWizard} 
        onOpenChange={setShowContratoWizard} 
        cotacaoId={selectedCotacaoId}
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
