import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, FileText, Calculator, Send, Check, X, Loader2, MessageCircle, ChevronDown, FileDown, Mail, FileSignature, Eye, Link2, AlertCircle, Copy, Trash2, MoreHorizontal, Car, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

type StatusCotacaoExtended = StatusCotacao | 'visualizada';

const statusConfig: Record<StatusCotacaoExtended, { label: string; color: string; icon: typeof FileText }> = {
  rascunho: { label: 'Rascunho', color: 'bg-muted text-muted-foreground', icon: FileText },
  enviada: { label: 'Enviada', color: 'bg-primary text-primary-foreground', icon: Send },
  visualizada: { label: 'Visualizada', color: 'bg-blue-500 text-white', icon: Eye },
  aceita: { label: 'Aceita', color: 'bg-green-500 text-white', icon: Check },
  recusada: { label: 'Recusada', color: 'bg-destructive text-destructive-foreground', icon: X },
  expirada: { label: 'Expirada', color: 'bg-muted text-muted-foreground', icon: FileText },
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
      // Limpar parâmetro após processar
      searchParams.delete('lead');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const filteredCotacoes = (cotacoes || []).filter((cotacao) => {
    const matchesSearch =
      cotacao.numero.toLowerCase().includes(search.toLowerCase()) ||
      (cotacao.leads?.nome?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (cotacao.veiculo_placa?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === 'all' || cotacao.status === statusFilter;
    
    // Filtro por mês
    let matchesMes = true;
    if (mesFilter !== 'all') {
      const cotacaoDate = new Date(cotacao.created_at);
      const [year, month] = mesFilter.split('-').map(Number);
      matchesMes = cotacaoDate.getFullYear() === year && cotacaoDate.getMonth() === month - 1;
    }
    
    return matchesSearch && matchesStatus && matchesMes;
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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleMarkAsEnviada = async (id: string, leadId?: string | null) => {
    try {
      await updateCotacao.mutateAsync({ id, status: 'enviada' });
      
      // Atualizar etapa do lead para 'cotacao_enviada'
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
    
    // Marca como enviada e atualiza etapa do lead após abrir WhatsApp
    handleMarkAsEnviada(cotacao.id, cotacao.lead_id);
  };

  // Stats
  const stats = {
    total: cotacoes?.length || 0,
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

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Calculator className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Send className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.enviadas}</p>
                <p className="text-xs text-muted-foreground">Enviadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-500/10 p-2">
                <Check className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.aceitas}</p>
                <p className="text-xs text-muted-foreground">Aceitas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent/10 p-2">
                <FileText className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.taxa}%</p>
                <p className="text-xs text-muted-foreground">Taxa Conversão</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, cliente ou placa..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(statusConfig).map(([key, value]) => (
              <SelectItem key={key} value={key}>
                {value.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mesFilter} onValueChange={setMesFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {mesesDisponiveis.map((mes) => (
              <SelectItem key={mes} value={mes}>
                {formatMesLabel(mes)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Valor FIPE</TableHead>
                <TableHead>Mensal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCotacoes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhuma cotação encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredCotacoes.map((cotacao) => {
                  const status = statusConfig[cotacao.status as StatusCotacaoExtended] || statusConfig.rascunho;
                  const veiculo = cotacao.veiculo_marca && cotacao.veiculo_modelo 
                    ? `${cotacao.veiculo_marca} ${cotacao.veiculo_modelo}`.substring(0, 25) + ((`${cotacao.veiculo_marca} ${cotacao.veiculo_modelo}`).length > 25 ? '...' : '')
                    : '-';
                  
                  return (
                    <TableRow 
                      key={cotacao.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/vendas/cotacoes/${cotacao.id}`)}
                    >
                      <TableCell className="font-mono text-sm font-medium">{cotacao.numero}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(cotacao.created_at)}
                      </TableCell>
                      <TableCell>
                        {cotacao.leads?.nome ? (
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                              {cotacao.leads.nome.charAt(0)}
                            </div>
                            <span className="truncate max-w-[120px]">{cotacao.leads.nome}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Car className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{veiculo}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {cotacao.veiculo_placa ? (
                          <Badge variant="outline" className="font-mono text-xs">
                            {cotacao.veiculo_placa}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatCurrency(cotacao.valor_fipe)}
                      </TableCell>
                      <TableCell className="font-medium text-green-600 dark:text-green-400">
                        {formatCurrency(cotacao.valor_total_mensal)}
                      </TableCell>
                      <TableCell>
                        <Badge className={status.color}>
                          <status.icon className="mr-1 h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 items-center" onClick={(e) => e.stopPropagation()}>
                          {cotacao.status === 'rascunho' && (
                            <>
                              {/* Se TEM lead vinculado: mostra botão Enviar */}
                              {cotacao.lead_id ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="outline" className="gap-1">
                                      <Send className="h-3 w-3" />
                                      Enviar
                                      <ChevronDown className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => enviarWhatsApp(cotacao)}>
                                      <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
                                      WhatsApp
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleOpenEmailModal(cotacao)}>
                                      <Mail className="h-4 w-4 mr-2 text-blue-600" />
                                      Email
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleBaixarPdf(cotacao)}>
                                      <FileDown className="h-4 w-4 mr-2" />
                                      Baixar PDF
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : (
                                /* Se NÃO tem lead: mostra botão Vincular */
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setCotacaoParaVincular(cotacao);
                                    setShowVincularModal(true);
                                  }}
                                >
                                  <Link2 className="h-3 w-3 mr-1" />
                                  Vincular
                                </Button>
                              )}
                            </>
                          )}
                          {cotacao.status === 'enviada' && (
                            <Button 
                              size="sm"
                              onClick={() => handleOpenContratoWizard(cotacao.id)}
                            >
                              Aceitar
                            </Button>
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
                              {gerarContrato.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <FileSignature className="h-4 w-4 mr-2" />
                              )}
                              {gerarContrato.isPending ? 'Gerando...' : 'Contrato'}
                            </Button>
                          )}
                          
                          {/* Menu de ações extras */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/vendas/cotacoes/${cotacao.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                Ver Detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleBaixarPdf(cotacao)}>
                                <FileDown className="h-4 w-4 mr-2" />
                                Baixar PDF
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
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
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
