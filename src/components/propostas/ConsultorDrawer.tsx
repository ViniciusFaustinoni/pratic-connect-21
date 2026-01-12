import { Star, Award, AlertTriangle, User, Clock, Send, CheckCircle, Car, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserAvatar } from '@/components/UserAvatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useConsultorPropostas, type ConsultorMetricas, type PeriodoFiltro } from '@/hooks/usePropostasMetricas';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConsultorDrawerProps {
  consultor: ConsultorMetricas | null;
  periodo: PeriodoFiltro;
  open: boolean;
  onClose: () => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function getRankingBadge(ranking: number) {
  if (ranking === 1) return { emoji: '🥇', label: 'Ranking #1 do mês', className: 'bg-yellow-100 text-yellow-800' };
  if (ranking === 2) return { emoji: '🥈', label: 'Ranking #2 do mês', className: 'bg-gray-200 text-gray-800' };
  if (ranking === 3) return { emoji: '🥉', label: 'Ranking #3 do mês', className: 'bg-orange-100 text-orange-800' };
  return { emoji: `#${ranking}`, label: `Ranking #${ranking} do mês`, className: 'bg-muted text-muted-foreground' };
}

function getPerformanceBadge(taxaConversao: number) {
  if (taxaConversao >= 30) {
    return { label: 'Top Performer', icon: Star, className: 'bg-yellow-100 text-yellow-800' };
  }
  if (taxaConversao >= 10) {
    return { label: 'Regular', icon: Award, className: 'bg-green-100 text-green-800' };
  }
  return { label: 'Atenção', icon: AlertTriangle, className: 'bg-red-100 text-red-800' };
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'cotacao_enviada': return { icon: Clock, color: 'text-yellow-600', label: 'Em cotação' };
    case 'negociacao': return { icon: Send, color: 'text-blue-600', label: 'Negociação' };
    case 'contrato_enviado': return { icon: Send, color: 'text-orange-600', label: 'Contrato enviado' };
    case 'enviado': return { icon: Send, color: 'text-orange-600', label: 'Enviado' };
    case 'assinado':
    case 'ativo': return { icon: CheckCircle, color: 'text-green-600', label: 'Fechada' };
    default: return { icon: Clock, color: 'text-muted-foreground', label: status };
  }
}

export function ConsultorDrawer({ consultor, periodo, open, onClose }: ConsultorDrawerProps) {
  const { data, isLoading } = useConsultorPropostas(consultor?.id || null, periodo);

  if (!consultor) return null;

  const rankingBadge = getRankingBadge(consultor.ranking);
  const performanceBadge = getPerformanceBadge(consultor.taxaConversao);
  const Icon = performanceBadge.icon;

  // Combinar todas as propostas recentes (max 5)
  const recentItems = [
    ...(data?.propostasFechadas?.slice(0, 2).map(c => ({ 
      type: 'contrato' as const, 
      data: c, 
      status: c.status 
    })) || []),
    ...(data?.propostasEnviadas?.slice(0, 2).map(c => ({ 
      type: 'contrato' as const, 
      data: c, 
      status: 'enviado' 
    })) || []),
    ...(data?.emCotacao?.slice(0, 2).map(l => ({ 
      type: 'lead' as const, 
      data: l, 
      status: 'cotacao_enviada' 
    })) || []),
  ].slice(0, 5);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="sm:max-w-lg w-full p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-start gap-4">
            <UserAvatar 
              src={consultor.avatar_url} 
              name={consultor.nome} 
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg font-bold leading-tight mb-2">
                {consultor.nome}
              </SheetTitle>
              <div className="flex flex-wrap gap-2">
                <Badge className={cn("gap-1", rankingBadge.className)}>
                  {rankingBadge.emoji} {rankingBadge.label}
                </Badge>
                <Badge className={cn("gap-1", performanceBadge.className)}>
                  <Icon className="h-3 w-3" />
                  {performanceBadge.label}
                </Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="p-6 space-y-6">
            {/* Métricas do Período */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                📊 MÉTRICAS DO {periodo === 'semana' ? 'PERÍODO' : 'MÊS'}
              </h3>
              
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <MetricRow 
                    icon={User} 
                    label="Leads Ativos" 
                    value={consultor.leadsAtivos}
                  />
                  <MetricRow 
                    icon={Clock} 
                    label="Em Cotação" 
                    value={data?.emCotacao.length || 0}
                    color="text-yellow-600"
                  />
                  <MetricRow 
                    icon={Send} 
                    label="Propostas Enviadas" 
                    value={data?.propostasEnviadas.length || 0}
                    color="text-blue-600"
                  />
                  <MetricRow 
                    icon={CheckCircle} 
                    label="Fechadas" 
                    value={data?.fechadasNoPeriodo.length || 0}
                    color="text-green-600"
                  />
                  <Separator />
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm font-medium">💰 Valor Fechado</span>
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(data?.totalValorPeriodo || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-sm font-medium">📈 Taxa de Conversão</span>
                    <span className={cn(
                      "text-lg font-bold",
                      consultor.taxaConversao >= 30 ? "text-green-600" :
                      consultor.taxaConversao >= 10 ? "text-yellow-600" : "text-red-500"
                    )}>
                      {consultor.taxaConversao.toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Propostas Recentes */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                📋 PROPOSTAS RECENTES
              </h3>
              
              {isLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : recentItems.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  Nenhuma proposta encontrada
                </div>
              ) : (
                <div className="space-y-3">
                  {recentItems.map((item, index) => {
                    const statusInfo = getStatusIcon(item.status);
                    const StatusIcon = statusInfo.icon;
                    
                    if (item.type === 'contrato') {
                      const contrato = item.data as any;
                      return (
                        <div key={`c-${index}`} className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                          <div className="flex items-start justify-between mb-1">
                            <p className="font-medium text-sm">
                              {contrato.leads?.nome || 'Cliente'}
                            </p>
                            <StatusIcon className={cn("h-4 w-4", statusInfo.color)} />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Car className="h-3 w-3" />
                            <span>{contrato.leads?.veiculo_marca} {contrato.leads?.veiculo_modelo}</span>
                          </div>
                          <div className="flex items-center justify-between mt-2 text-xs">
                            <span className={statusInfo.color}>
                              {statusInfo.label}
                              {contrato.valor_mensal && ` - ${formatCurrency(contrato.valor_mensal)}/mês`}
                            </span>
                            <span className="text-muted-foreground">
                              {format(new Date(contrato.created_at), 'dd/MM', { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                      );
                    } else {
                      const lead = item.data as any;
                      return (
                        <div key={`l-${index}`} className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                          <div className="flex items-start justify-between mb-1">
                            <p className="font-medium text-sm">
                              {lead.nome || 'Lead'}
                            </p>
                            <StatusIcon className={cn("h-4 w-4", statusInfo.color)} />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Car className="h-3 w-3" />
                            <span>{lead.veiculo_marca} {lead.veiculo_modelo} {lead.veiculo_ano}</span>
                          </div>
                          <div className="flex items-center justify-between mt-2 text-xs">
                            <span className={statusInfo.color}>{statusInfo.label}</span>
                            <span className="text-muted-foreground">
                              {format(new Date(lead.created_at), 'dd/MM', { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function MetricRow({ 
  icon: Icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2 text-sm">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span>{label}</span>
      </div>
      <span className={cn("font-semibold", color || (value > 0 ? "text-foreground" : "text-muted-foreground"))}>
        {value}
      </span>
    </div>
  );
}
