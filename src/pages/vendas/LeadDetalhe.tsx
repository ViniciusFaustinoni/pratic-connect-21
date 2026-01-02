import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, Car, Edit, MessageSquare, Loader2, FileText, ArrowRight, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLead } from '@/hooks/useLeads';
import { useCotacoesByLead } from '@/hooks/useCotacoesByLead';
import { ETAPA_LABELS, ORIGEM_LABELS, type EtapaLead } from '@/types/database';
import { etapaColors, ETAPAS_FUNIL, getNextStages } from '@/lib/lead-transitions';
import { useChangeLeadEtapa } from '@/hooks/useLeadHistorico';
import { CotacaoFormDialog } from '@/components/cotacoes/CotacaoFormDialog';
import { LeadEditDialog } from '@/components/leads/LeadEditDialog';
import { LeadLossDialog } from '@/components/leads/LeadLossDialog';
import { LeadTimeline } from '@/components/leads/LeadTimeline';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_COTACAO_LABELS: Record<string, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  aceita: 'Aceita',
  recusada: 'Recusada',
  expirada: 'Expirada',
};

export default function LeadDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: lead, isLoading } = useLead(id);
  const { data: cotacoes, isLoading: isLoadingCotacoes } = useCotacoesByLead(id);
  const changeEtapa = useChangeLeadEtapa();
  
  const [showCotacaoForm, setShowCotacaoForm] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showLossDialog, setShowLossDialog] = useState(false);

  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateStr: string) => 
    format(new Date(dateStr), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  const formatDateTime = (dateStr: string) => 
    format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const handleAdvanceStage = async (newEtapa: EtapaLead) => {
    if (!lead) return;
    
    // Se for perdido, abrir modal
    if (newEtapa === 'perdido') {
      setShowLossDialog(true);
      return;
    }
    
    try {
      await changeEtapa.mutateAsync({
        leadId: lead.id,
        etapaAnterior: lead.etapa as EtapaLead,
        etapaNova: newEtapa,
      });
      toast.success(`Lead movido para ${ETAPA_LABELS[newEtapa]}`);
    } catch (error) {
      toast.error('Erro ao atualizar lead');
    }
  };

  const handleWhatsApp = () => {
    if (!lead) return;
    const phone = lead.telefone.replace(/\D/g, '');
    const message = encodeURIComponent(`Olá ${lead.nome}, tudo bem?`);
    window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
  };

  // Próximas etapas permitidas
  const nextStages = lead ? getNextStages(lead.etapa as EtapaLead) : [];

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
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/vendas/leads')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{lead.nome}</h1>
          <p className="text-muted-foreground">Lead criado em {formatDate(lead.created_at)}</p>
        </div>
        <Badge className={etapaColors[lead.etapa as EtapaLead]}>{ETAPA_LABELS[lead.etapa as EtapaLead]}</Badge>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setShowEditDialog(true)}>
          <Edit className="mr-2 h-4 w-4" />
          Editar
        </Button>
        <Button variant="outline" onClick={handleWhatsApp}>
          <MessageSquare className="mr-2 h-4 w-4" />
          WhatsApp
        </Button>
        {nextStages.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <ArrowRight className="mr-2 h-4 w-4" />
                Avançar Etapa
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {nextStages.filter(e => e !== 'perdido').map((etapa) => (
                <DropdownMenuItem key={etapa} onClick={() => handleAdvanceStage(etapa)}>
                  {ETAPA_LABELS[etapa]}
                </DropdownMenuItem>
              ))}
              {nextStages.includes('perdido') && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setShowLossDialog(true)}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Marcar como Perdido
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button onClick={() => setShowCotacaoForm(true)}>
          <FileText className="mr-2 h-4 w-4" />
          Criar Cotação
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Dados de Contato */}
        <Card>
          <CardHeader><CardTitle>Dados de Contato</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {lead.telefone}
            </div>
            {lead.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {lead.email}
              </div>
            )}
            <div><span className="text-muted-foreground">CPF:</span> {lead.cpf || '-'}</div>
            <div><span className="text-muted-foreground">Origem:</span> <Badge variant="outline">{ORIGEM_LABELS[lead.origem]}</Badge></div>
          </CardContent>
        </Card>

        {/* Dados do Veículo */}
        <Card>
          <CardHeader><CardTitle>Dados do Veículo</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {lead.veiculo_marca ? (
              <>
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  {lead.veiculo_marca} {lead.veiculo_modelo}
                </div>
                <div><span className="text-muted-foreground">Ano:</span> {lead.veiculo_ano || '-'}</div>
                <div><span className="text-muted-foreground">Placa:</span> {lead.veiculo_placa || '-'}</div>
                <div><span className="text-muted-foreground">Valor FIPE:</span> {formatCurrency(lead.veiculo_fipe)}</div>
              </>
            ) : (
              <p className="text-muted-foreground">Nenhum veículo informado</p>
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
      <LeadEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        lead={lead}
      />
      <LeadLossDialog
        open={showLossDialog}
        onOpenChange={setShowLossDialog}
        leadId={lead.id}
        leadNome={lead.nome}
        etapaAtual={lead.etapa as EtapaLead}
      />
    </div>
  );
}
