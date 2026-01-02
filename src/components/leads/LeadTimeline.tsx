import { Loader2, Clock, ArrowRight, User, FileText, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLeadHistorico } from '@/hooks/useLeadHistorico';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ETAPA_LABELS, type EtapaLead } from '@/types/database';
import { etapaColors } from '@/lib/lead-transitions';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface LeadTimelineProps {
  leadId: string;
}

const acaoIcons: Record<string, React.ReactNode> = {
  mudou_etapa: <ArrowRight className="h-4 w-4" />,
  enviou_cotacao: <FileText className="h-4 w-4" />,
  enviou_contrato: <FileText className="h-4 w-4" />,
  criou_lead: <User className="h-4 w-4" />,
  default: <Clock className="h-4 w-4" />,
};

const acaoLabels: Record<string, string> = {
  mudou_etapa: 'Mudou de etapa',
  enviou_cotacao: 'Cotação enviada',
  enviou_contrato: 'Contrato enviado',
  criou_lead: 'Lead criado',
};

export function LeadTimeline({ leadId }: LeadTimelineProps) {
  const { data: historico, isLoading } = useLeadHistorico(leadId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!historico || historico.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mb-2" />
            <p className="text-sm">Nenhum histórico registrado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Linha vertical */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-6">
            {historico.map((item, index) => (
              <div key={item.id} className="relative flex gap-4 pl-10">
                {/* Círculo */}
                <div
                  className={cn(
                    'absolute left-0 flex h-8 w-8 items-center justify-center rounded-full bg-background border-2',
                    item.acao === 'mudou_etapa' && item.etapa_nova === 'perdido'
                      ? 'border-destructive text-destructive'
                      : item.acao === 'mudou_etapa' && item.etapa_nova === 'ganho'
                      ? 'border-green-500 text-green-500'
                      : 'border-primary text-primary'
                  )}
                >
                  {acaoIcons[item.acao] || acaoIcons.default}
                </div>

                {/* Conteúdo */}
                <div className="flex-1 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">
                      {acaoLabels[item.acao] || item.acao}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(item.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>

                  {/* Badges de etapa */}
                  {item.etapa_anterior && item.etapa_nova && (
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          etapaColors[item.etapa_anterior as EtapaLead]
                        )}
                      >
                        {ETAPA_LABELS[item.etapa_anterior as EtapaLead] || item.etapa_anterior}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          etapaColors[item.etapa_nova as EtapaLead]
                        )}
                      >
                        {ETAPA_LABELS[item.etapa_nova as EtapaLead] || item.etapa_nova}
                      </Badge>
                    </div>
                  )}

                  {/* Descrição */}
                  {item.descricao && (
                    <p className="text-sm text-muted-foreground">{item.descricao}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
