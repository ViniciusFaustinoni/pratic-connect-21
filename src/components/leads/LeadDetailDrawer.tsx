import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Phone, 
  Mail, 
  Car, 
  MessageCircle, 
  ExternalLink, 
  Calculator, 
  XCircle,
  FileText,
  CalendarClock 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useLead } from '@/hooks/useLeads';
import { useCotacoesByLead } from '@/hooks/useCotacoesByLead';
import { useContratoByLead } from '@/hooks/useContratos';
import { LeadTimeline } from '@/components/leads/LeadTimeline';
import { LeadLossDialog } from '@/components/leads/LeadLossDialog';
import { AgendarFollowupDialog } from '@/components/leads/AgendarFollowupDialog';
import { VeiculoPerfilAlert } from '@/components/leads/VeiculoPerfilAlert';
import { ETAPA_LABELS, ORIGEM_LABELS, type EtapaLead } from '@/types/database';
import { etapaColors, origemColors } from '@/lib/lead-transitions';

interface LeadDetailDrawerProps {
  leadId: string | null;
  open: boolean;
  onClose: () => void;
}

const STATUS_COTACAO_COLORS: Record<string, string> = {
  rascunho: 'bg-gray-100 text-gray-800',
  enviada: 'bg-blue-100 text-blue-800',
  aceita: 'bg-green-100 text-green-800',
  recusada: 'bg-red-100 text-red-800',
  expirada: 'bg-yellow-100 text-yellow-800',
};

const STATUS_CONTRATO_COLORS: Record<string, string> = {
  pendente: 'bg-gray-100 text-gray-800',
  enviado: 'bg-blue-100 text-blue-800',
  assinado: 'bg-green-100 text-green-800',
  ativo: 'bg-emerald-100 text-emerald-800',
  suspenso: 'bg-yellow-100 text-yellow-800',
  cancelado: 'bg-red-100 text-red-800',
};

export function LeadDetailDrawer({ leadId, open, onClose }: LeadDetailDrawerProps) {
  const navigate = useNavigate();
  const [showLossDialog, setShowLossDialog] = useState(false);
  const [showFollowupDialog, setShowFollowupDialog] = useState(false);
  
  const { data: lead, isLoading } = useLead(leadId || undefined);
  const { data: cotacoes } = useCotacoesByLead(leadId || undefined);
  const { data: contrato } = useContratoByLead(leadId || undefined);

  const formatCurrency = (value: number | null) => {
    if (!value) return '—';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleViewDetails = () => {
    if (leadId) {
      onClose();
      navigate(`/vendas/leads/${leadId}`);
    }
  };

  const handleNovaCotacao = () => {
    if (leadId && lead) {
      onClose();
      navigate('/vendas/cotacao', { 
        state: { 
          leadId: lead.id,
          placa: lead.veiculo_placa,
          marca: lead.veiculo_marca,
          modelo: lead.veiculo_modelo,
          ano: lead.veiculo_ano?.toString(),
          valorFipe: lead.veiculo_fipe,
          nome: lead.nome,
        } 
      });
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-3">
              {lead && (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                    {lead.nome.charAt(0)}
                  </div>
                  <span>{lead.nome}</span>
                </>
              )}
            </SheetTitle>
          </SheetHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Carregando...</p>
            </div>
          ) : lead ? (
            <div className="space-y-6 mt-6">
              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={etapaColors[lead.etapa as EtapaLead]}>
                  {ETAPA_LABELS[lead.etapa as EtapaLead]}
                </Badge>
                <Badge className={origemColors[lead.origem] || 'bg-gray-100 text-gray-800'}>
                  {ORIGEM_LABELS[lead.origem]}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(lead.created_at), { 
                    addSuffix: true, 
                    locale: ptBR 
                  })}
                </span>
              </div>

              <Separator />

              {/* Ações Rápidas */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Ações Rápidas
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="gap-2 justify-start" asChild>
                    <a
                      href={`https://wa.me/55${lead.telefone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="h-4 w-4 text-green-600" />
                      WhatsApp
                    </a>
                  </Button>
                  <Button variant="outline" className="gap-2 justify-start" asChild>
                    <a href={`tel:${lead.telefone}`}>
                      <Phone className="h-4 w-4" />
                      Ligar
                    </a>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="gap-2 justify-start"
                    onClick={handleNovaCotacao}
                  >
                    <Calculator className="h-4 w-4" />
                    Nova Cotação
                  </Button>
                  <Button 
                    variant="outline" 
                    className="gap-2 justify-start"
                    onClick={() => setShowFollowupDialog(true)}
                  >
                    <CalendarClock className="h-4 w-4 text-orange-600" />
                    {lead.data_proxima_acao ? 'Reagendar' : 'Agendar'}
                  </Button>
                  {lead.etapa !== 'perdido' && lead.etapa !== 'ganho' && (
                    <Button 
                      variant="outline" 
                      className="gap-2 justify-start text-destructive hover:text-destructive col-span-2"
                      onClick={() => setShowLossDialog(true)}
                    >
                      <XCircle className="h-4 w-4" />
                      Marcar Perdido
                    </Button>
                  )}
                </div>

                {/* Próxima ação agendada */}
                {lead.data_proxima_acao && (
                  <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800">
                    <p className="text-xs text-orange-600 dark:text-orange-400 font-medium uppercase tracking-wide mb-1">
                      Próximo Contato
                    </p>
                    <p className="text-sm font-medium">
                      {format(new Date(lead.data_proxima_acao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Contato */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Contato
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{lead.telefone}</span>
                  </div>
                  {lead.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{lead.email}</span>
                    </div>
                  )}
                  {lead.cpf && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">CPF:</span>
                      <span>{lead.cpf}</span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Veículo */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Veículo
                </h3>
                {lead.veiculo_marca ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {lead.veiculo_marca} {lead.veiculo_modelo} {lead.veiculo_ano}
                      </span>
                    </div>
                    {lead.veiculo_placa && (
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">Placa:</span>
                        <span className="font-mono">{lead.veiculo_placa}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">FIPE:</span>
                      <span className="font-medium">{formatCurrency(lead.veiculo_fipe)}</span>
                    </div>
                    {/* Alerta de veículo fora do perfil */}
                    <VeiculoPerfilAlert 
                      anoVeiculo={lead.veiculo_ano} 
                      valorFipe={lead.veiculo_fipe}
                      className="mt-2 space-y-2"
                    />
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Nenhum veículo cadastrado</p>
                )}
              </div>

              <Separator />

              {/* Cotações */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Cotações ({cotacoes?.length || 0})
                </h3>
                {cotacoes && cotacoes.length > 0 ? (
                  <div className="space-y-2">
                    {cotacoes.map((cotacao) => (
                      <div 
                        key={cotacao.id} 
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-sm">{cotacao.numero}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(cotacao.valor_total_mensal)}/mês
                          </p>
                        </div>
                        <Badge className={STATUS_COTACAO_COLORS[cotacao.status] || 'bg-gray-100'}>
                          {cotacao.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Nenhuma cotação</p>
                )}
              </div>

              {/* Contrato */}
              {contrato && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                      Contrato
                    </h3>
                    <div className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{contrato.numero}</span>
                        <Badge className={STATUS_CONTRATO_COLORS[contrato.status] || 'bg-gray-100'}>
                          {contrato.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(contrato.valor_mensal)}/mês
                      </p>
                      {contrato.autentique_url && (
                        <a 
                          href={contrato.autentique_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary text-sm hover:underline flex items-center gap-1 mt-2"
                        >
                          <FileText className="h-3 w-3" />
                          Ver no Autentique
                        </a>
                      )}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Timeline resumida */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Histórico Recente
                </h3>
                <LeadTimeline leadId={leadId!} limit={5} />
              </div>

              <Separator />

              {/* Ações */}
              <div className="flex gap-2">
                <Button onClick={handleViewDetails} className="flex-1 gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Ver Detalhes Completos
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Lead não encontrado</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {lead && showLossDialog && (
        <LeadLossDialog
          open={showLossDialog}
          onOpenChange={setShowLossDialog}
          leadId={lead.id}
          leadNome={lead.nome}
          etapaAtual={lead.etapa as EtapaLead}
          onSuccess={() => {
            setShowLossDialog(false);
            onClose();
          }}
        />
      )}

      {lead && showFollowupDialog && (
        <AgendarFollowupDialog
          open={showFollowupDialog}
          onOpenChange={setShowFollowupDialog}
          leadId={lead.id}
          leadNome={lead.nome}
          dataAtual={lead.data_proxima_acao}
        />
      )}
    </>
  );
}
