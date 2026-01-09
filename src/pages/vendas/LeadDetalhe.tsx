import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Phone, Mail, Car, Edit, MessageSquare, Loader2, 
  FileText, ArrowRightLeft, Trash2, User, Clock, Calendar, 
  Tag, DollarSign, MoreVertical, MapPin, StickyNote 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLead } from '@/hooks/useLeads';
import { useCotacoesByLead } from '@/hooks/useCotacoesByLead';
import { ETAPA_LABELS, ORIGEM_LABELS, ETAPA_COLORS, type EtapaLead } from '@/types/vendas';
import { useChangeLeadEtapa } from '@/hooks/useLeadHistorico';
import { useLeadActions } from '@/hooks/useLeadActions';
import { CotacaoFormDialog } from '@/components/cotacoes/CotacaoFormDialog';
import { LeadTimeline } from '@/components/leads/LeadTimeline';
import { LeadFunnelProgress } from '@/components/leads/LeadFunnelProgress';
import { LeadQuickStats } from '@/components/leads/LeadQuickStats';
import { MoverEtapaModal } from '@/components/vendas/MoverEtapaModal';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_COTACAO_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  aceita: 'Aceita',
  recusada: 'Recusada',
  expirada: 'Expirada',
};

const STATUS_COTACAO_COLORS: Record<string, string> = {
  rascunho: 'bg-muted text-muted-foreground',
  enviada: 'bg-blue-500/10 text-blue-600 border-blue-200',
  aceita: 'bg-green-500/10 text-green-600 border-green-200',
  recusada: 'bg-red-500/10 text-red-600 border-red-200',
  expirada: 'bg-amber-500/10 text-amber-600 border-amber-200',
};

const ORIGEM_ICONS: Record<string, string> = {
  whatsapp: '💬',
  telefone: '📞',
  site: '🌐',
  indicacao: '🤝',
  redes_sociais: '📱',
  presencial: '🏢',
  outro: '📌',
};

// Utilities
const formatCurrency = (value: number | null) => {
  if (!value) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatPhone = (phone: string | null) => {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return phone;
};

const formatDate = (dateStr: string) => 
  format(new Date(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

const formatDateTime = (dateStr: string) => 
  format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

export default function LeadDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: lead, isLoading } = useLead(id);
  const { data: cotacoes, isLoading: isLoadingCotacoes } = useCotacoesByLead(id);
  const changeEtapa = useChangeLeadEtapa();
  const { excluirLead, isDeleting } = useLeadActions();
  
  const [showCotacaoForm, setShowCotacaoForm] = useState(false);
  const [showMoverModal, setShowMoverModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleMoverEtapa = async (novaEtapa: EtapaLead, observacao: string, motivoPerda?: string) => {
    if (!lead) return;
    
    try {
      await changeEtapa.mutateAsync({
        leadId: lead.id,
        etapaAnterior: lead.etapa as EtapaLead,
        etapaNova: novaEtapa,
        motivoPerda,
        observacaoPerda: observacao,
      });
      toast.success(`Lead movido para ${ETAPA_LABELS[novaEtapa]}`);
      setShowMoverModal(false);
    } catch (error) {
      toast.error('Erro ao mover lead');
    }
  };

  const handleExcluir = async () => {
    if (!id) return;
    try {
      await excluirLead(id);
      toast.success('Lead excluído com sucesso');
      navigate('/vendas/leads');
    } catch (error) {
      toast.error('Erro ao excluir lead');
    }
  };

  const handleWhatsApp = () => {
    if (!lead) return;
    const phone = lead.telefone.replace(/\D/g, '');
    const message = encodeURIComponent(`Olá ${lead.nome}, tudo bem?`);
    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
  };

  // Calcular dias no funil
  const diasNoFunil = lead ? differenceInDays(new Date(), new Date(lead.created_at)) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-muted-foreground">Lead não encontrado</p>
        <Button variant="outline" onClick={() => navigate('/vendas/leads')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para Leads
        </Button>
      </div>
    );
  }

  const hasVeiculo = lead.veiculo_marca || lead.veiculo_modelo || lead.veiculo_ano || lead.veiculo_placa;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Navegação */}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => navigate('/vendas/leads')}
        className="gap-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para Leads
      </Button>

      {/* HEADER HERO */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent overflow-hidden">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            {/* Avatar */}
            <Avatar className="h-20 w-20 border-4 border-primary/20 shadow-lg shrink-0">
              <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                {lead.nome.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-4 min-w-0">
              {/* Nome + Menu */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">
                    {lead.nome}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Lead criado em {formatDate(lead.created_at)}
                  </p>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => navigate(`/vendas/leads/${id}/editar`)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Editar Lead
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShowMoverModal(true)}>
                      <ArrowRightLeft className="mr-2 h-4 w-4" />
                      Mover Etapa
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir Lead
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Contato inline */}
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <a
                  href={`tel:${lead.telefone}`}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  {formatPhone(lead.telefone)}
                </a>
                {lead.email && (
                  <a
                    href={`mailto:${lead.email}`}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Mail className="h-4 w-4" />
                    {lead.email}
                  </a>
                )}
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <Badge className={`${ETAPA_COLORS[lead.etapa as EtapaLead]} border`}>
                  {ETAPA_LABELS[lead.etapa as EtapaLead]}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  {ORIGEM_ICONS[lead.origem] || '📌'} {ORIGEM_LABELS[lead.origem]}
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {diasNoFunil} {diasNoFunil === 1 ? 'dia' : 'dias'} no funil
                </Badge>
              </div>
            </div>
          </div>

          {/* Ações Principais */}
          <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t">
            <Button 
              onClick={handleWhatsApp}
              className="bg-green-600 hover:bg-green-700 text-white shadow-md"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              WhatsApp
            </Button>
            <Button onClick={() => setShowCotacaoForm(true)} className="shadow-md">
              <FileText className="mr-2 h-4 w-4" />
              Nova Cotação
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* LAYOUT 2 COLUNAS */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* COLUNA PRINCIPAL (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Veículo */}
          {hasVeiculo && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Car className="h-5 w-5 text-primary" />
                  Veículo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {lead.veiculo_marca && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Marca</p>
                      <p className="font-medium mt-1">{lead.veiculo_marca}</p>
                    </div>
                  )}
                  {lead.veiculo_modelo && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Modelo</p>
                      <p className="font-medium mt-1">{lead.veiculo_modelo}</p>
                    </div>
                  )}
                  {lead.veiculo_ano && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Ano</p>
                      <p className="font-medium mt-1">{lead.veiculo_ano}</p>
                    </div>
                  )}
                  {lead.veiculo_placa && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Placa</p>
                      <p className="font-medium mt-1 font-mono">{lead.veiculo_placa}</p>
                    </div>
                  )}
                </div>
                {lead.veiculo_fipe && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Valor FIPE</p>
                    <p className="font-semibold text-lg text-primary mt-1">
                      {formatCurrency(lead.veiculo_fipe)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Cotações */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  Cotações
                  {cotacoes && cotacoes.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {cotacoes.length}
                    </Badge>
                  )}
                </CardTitle>
                <Button size="sm" onClick={() => setShowCotacaoForm(true)}>
                  + Nova
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingCotacoes ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : cotacoes && cotacoes.length > 0 ? (
                <div className="space-y-3">
                  {cotacoes.map((cotacao) => (
                    <div
                      key={cotacao.id}
                      className="group flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 hover:border-primary/30 cursor-pointer transition-all"
                      onClick={() => navigate(`/vendas/cotacoes`)}
                    >
                      <div className="space-y-1">
                        <p className="font-semibold group-hover:text-primary transition-colors">
                          {cotacao.numero}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {cotacao.planos?.nome} • {formatDateTime(cotacao.created_at)}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="font-semibold text-primary">
                          {formatCurrency(cotacao.valor_total_mensal)}/mês
                        </p>
                        <Badge 
                          variant="outline" 
                          className={`${STATUS_COTACAO_COLORS[cotacao.status]} border`}
                        >
                          {STATUS_COTACAO_LABELS[cotacao.status]}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhuma cotação criada</p>
                  <Button 
                    variant="link" 
                    className="mt-2"
                    onClick={() => setShowCotacaoForm(true)}
                  >
                    Criar primeira cotação
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline/Histórico */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Histórico</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadTimeline leadId={lead.id} />
            </CardContent>
          </Card>

          {/* Motivo da Perda */}
          {lead.etapa === 'perdido' && lead.motivo_perda && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-destructive flex items-center gap-2 text-base">
                  <Tag className="h-4 w-4" />
                  Motivo da Perda
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{lead.motivo_perda}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* SIDEBAR (1/3) */}
        <div className="space-y-6">
          {/* Progresso no Funil */}
          <LeadFunnelProgress etapaAtual={lead.etapa} />

          {/* Vendedor */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Vendedor Responsável
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lead.vendedor_id ? (
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      V
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">Vendedor</p>
                    <p className="text-sm text-muted-foreground truncate">
                      ID: {lead.vendedor_id.slice(0, 8)}...
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum vendedor atribuído
                </p>
              )}
            </CardContent>
          </Card>

          {/* Observações */}
          {lead.observacoes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-primary" />
                  Observações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {lead.observacoes}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Estatísticas */}
          <LeadQuickStats
            totalCotacoes={cotacoes?.length || 0}
            diasNoFunil={diasNoFunil}
            ultimaAtividade={lead.updated_at}
          />
        </div>
      </div>

      {/* Dialogs */}
      <CotacaoFormDialog 
        open={showCotacaoForm} 
        onOpenChange={setShowCotacaoForm} 
        leadId={lead.id} 
      />
      
      <MoverEtapaModal
        open={showMoverModal}
        onOpenChange={setShowMoverModal}
        leadNome={lead.nome}
        etapaAtual={lead.etapa as EtapaLead}
        onMover={handleMoverEtapa}
        isMoving={changeEtapa.isPending}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o lead <strong>{lead.nome}</strong>?
              <br /><br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExcluir}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
