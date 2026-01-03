import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Phone, Mail, Car, MessageCircle, ExternalLink } from 'lucide-react';
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
import { LeadTimeline } from '@/components/leads/LeadTimeline';
import { ETAPA_LABELS, ORIGEM_LABELS, type EtapaLead } from '@/types/database';
import { etapaColors, origemColors } from '@/lib/lead-transitions';

interface LeadDetailDrawerProps {
  leadId: string | null;
  open: boolean;
  onClose: () => void;
}

export function LeadDetailDrawer({ leadId, open, onClose }: LeadDetailDrawerProps) {
  const navigate = useNavigate();
  const { data: lead, isLoading } = useLead(leadId || undefined);

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

  return (
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

            {/* Contato */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Contato
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{lead.telefone}</span>
                  <a
                    href={`https://wa.me/55${lead.telefone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600 hover:text-green-700"
                    title="Abrir WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
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
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Nenhum veículo cadastrado</p>
              )}
            </div>

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
  );
}
