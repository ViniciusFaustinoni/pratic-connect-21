import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, Car, Edit, MessageSquare, Loader2, FileText, ArrowRightLeft, Trash2, User, Clock, Calendar, Tag, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useLead } from '@/hooks/useLeads';
import { useCotacoesByLead } from '@/hooks/useCotacoesByLead';
import { ETAPA_LABELS, ORIGEM_LABELS, ETAPA_COLORS, ORIGEM_COLORS, type EtapaLead } from '@/types/vendas';
import { useChangeLeadEtapa } from '@/hooks/useLeadHistorico';
import { useLeadActions } from '@/hooks/useLeadActions';
import { CotacaoFormDialog } from '@/components/cotacoes/CotacaoFormDialog';
import { LeadTimeline } from '@/components/leads/LeadTimeline';
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

const formatCPF = (cpf: string | null) => {
  if (!cpf) return '—';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length === 11) {
    return `***.${digits.slice(3, 6)}.***-${digits.slice(9)}`;
  }
  return '—';
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

  // Calcular dias na etapa
  const diasNaEtapa = lead ? differenceInDays(new Date(), new Date(lead.updated_at)) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lead) {
    return <div className="text-center py-8">Lead não encontrado</div>;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/vendas/leads">Leads</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{lead.nome}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Botão Voltar */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/vendas/leads')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>

      {/* Header Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            {/* Avatar + Info */}
            <div className="flex items-center gap-4 flex-1">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-2xl font-semibold text-primary">
                  {lead.nome.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{lead.nome}</h1>
                  <Badge className={ETAPA_COLORS[lead.etapa as EtapaLead]}>
                    {ETAPA_LABELS[lead.etapa as EtapaLead]}
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  Lead criado em {formatDate(lead.created_at)}
                </p>
                {diasNaEtapa > 0 && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {diasNaEtapa} {diasNaEtapa === 1 ? 'dia' : 'dias'} na etapa atual
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate(`/vendas/leads/${id}/editar`)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowMoverModal(true)}>
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Mover Etapa
              </Button>
              <Button variant="outline" size="sm" onClick={handleWhatsApp}>
                <MessageSquare className="mr-2 h-4 w-4" />
                WhatsApp
              </Button>
              <Button size="sm" onClick={() => setShowCotacaoForm(true)}>
                <FileText className="mr-2 h-4 w-4" />
                Criar Cotação
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid de Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Dados Pessoais */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Dados Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{formatPhone(lead.telefone)}</span>
            </div>
            <Separator />
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{lead.email || '—'}</span>
            </div>
            <Separator />
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">CPF:</span>
              <span>{formatCPF(lead.cpf)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Dados do Veículo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-4 w-4" />
              Dados do Veículo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lead.veiculo_marca ? (
              <>
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.veiculo_marca} {lead.veiculo_modelo}</span>
                </div>
                <Separator />
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Ano: {lead.veiculo_ano || '—'}</span>
                </div>
                <Separator />
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span>Placa: {lead.veiculo_placa || '—'}</span>
                </div>
                <Separator />
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>FIPE: {formatCurrency(lead.veiculo_fipe)}</span>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">Nenhum veículo informado</p>
            )}
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Origem</span>
              <Badge variant="outline" className={ORIGEM_COLORS[lead.origem]}>
                {ORIGEM_LABELS[lead.origem]}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Etapa</span>
              <Badge className={ETAPA_COLORS[lead.etapa as EtapaLead]}>
                {ETAPA_LABELS[lead.etapa as EtapaLead]}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Dias na etapa</span>
              <span className={diasNaEtapa > 5 ? 'text-orange-600' : diasNaEtapa > 10 ? 'text-destructive' : ''}>
                {diasNaEtapa} {diasNaEtapa === 1 ? 'dia' : 'dias'}
              </span>
            </div>
            {lead.motivo_perda && (
              <>
                <Separator />
                <div>
                  <span className="text-muted-foreground">Motivo da perda</span>
                  <p className="text-sm mt-1">{lead.motivo_perda}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Vendedor Responsável */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Vendedor Responsável
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lead.vendedor_id ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Vendedor atribuído (ID: {lead.vendedor_id.slice(0, 8)}...)</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Nenhum vendedor atribuído</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cotações */}
      <Card>
        <CardHeader>
          <CardTitle>Cotações</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingCotacoes ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : cotacoes && cotacoes.length > 0 ? (
            <div className="space-y-3">
              {cotacoes.map((cotacao) => (
                <div
                  key={cotacao.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer"
                  onClick={() => navigate(`/vendas/cotacoes`)}
                >
                  <div>
                    <p className="font-medium">{cotacao.numero}</p>
                    <p className="text-sm text-muted-foreground">
                      {cotacao.planos?.nome} • {formatDateTime(cotacao.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(cotacao.valor_total_mensal)}/mês</p>
                    <Badge variant="outline">{STATUS_COTACAO_LABELS[cotacao.status]}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              Nenhuma cotação criada para este lead
            </p>
          )}
        </CardContent>
      </Card>

      {/* Observações */}
      {lead.observacoes && (
        <Card>
          <CardHeader><CardTitle>Observações</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{lead.observacoes}</p>
          </CardContent>
        </Card>
      )}

      {/* Timeline/Histórico */}
      <LeadTimeline leadId={lead.id} />

      {/* Motivo da Perda */}
      {lead.etapa === 'perdido' && lead.motivo_perda && (
        <Card className="border-destructive/50">
          <CardHeader><CardTitle className="text-destructive">Motivo da Perda</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{lead.motivo_perda}</p>
          </CardContent>
        </Card>
      )}

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
