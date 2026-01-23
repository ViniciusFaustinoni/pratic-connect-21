import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Building2, Clock, User, Car, Phone, MoreVertical, Check, X, UserCheck, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAgendamentosBaseDia, useAtualizarAgendamentoBase } from '@/hooks/useAgendamentoBase';
import { useAuth } from '@/contexts/AuthContext';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  agendado: { label: 'Aguardando', variant: 'secondary', icon: Clock },
  confirmado: { label: 'Confirmado', variant: 'default', icon: Check },
  em_atendimento: { label: 'Em Atendimento', variant: 'default', icon: UserCheck },
  realizado: { label: 'Realizado', variant: 'outline', icon: Check },
  cancelado: { label: 'Cancelado', variant: 'destructive', icon: X },
  nao_compareceu: { label: 'Não Compareceu', variant: 'destructive', icon: AlertCircle },
};

interface AgendamentosBaseProps {
  data?: string;
}

export function AgendamentosBase({ data }: AgendamentosBaseProps) {
  const { profile } = useAuth();
  const { data: agendamentos, isLoading } = useAgendamentosBaseDia(data);
  const atualizarAgendamento = useAtualizarAgendamentoBase();

  const hoje = data || new Date().toISOString().split('T')[0];
  const dataFormatada = format(new Date(hoje + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR });

  const handleAtualizarStatus = (id: string, status: string) => {
    atualizarAgendamento.mutate({
      id,
      status,
      atendidoPor: status === 'em_atendimento' ? profile?.id : undefined,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const agendamentosPendentes = agendamentos?.filter(a => 
    ['agendado', 'confirmado', 'em_atendimento'].includes(a.status)
  ) || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5 text-orange-600" />
            Agendamentos na Base
            <Badge variant="secondary" className="ml-2">
              {dataFormatada}
            </Badge>
          </CardTitle>
          <Badge variant="outline">
            {agendamentosPendentes.length} pendente{agendamentosPendentes.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {(!agendamentos || agendamentos.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Building2 className="h-10 w-10 mb-2 opacity-30" />
            <p className="text-sm">Nenhum agendamento na base para hoje</p>
          </div>
        ) : (
          <ScrollArea className="h-[320px] pr-4">
            <div className="space-y-3">
              {agendamentos.map((agendamento) => {
                const statusInfo = STATUS_CONFIG[agendamento.status] || STATUS_CONFIG.agendado;
                const StatusIcon = statusInfo.icon;
                const atendidoPor = (agendamento as any).atendido_por_profile?.nome;

                return (
                  <div
                    key={agendamento.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                  >
                    {/* Horário */}
                    <div className="flex flex-col items-center justify-center w-14 flex-shrink-0">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground mb-0.5" />
                      <span className="text-lg font-bold">{agendamento.horario.slice(0, 5)}</span>
                    </div>

                    {/* Divisor */}
                    <div className="w-px h-12 bg-border" />

                    {/* Informações */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium truncate">{agendamento.cliente_nome}</span>
                      </div>
                      {agendamento.veiculo_placa && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <Car className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm text-muted-foreground truncate">
                            {agendamento.veiculo_placa}
                            {agendamento.veiculo_descricao && ` - ${agendamento.veiculo_descricao}`}
                          </span>
                        </div>
                      )}
                      {agendamento.cliente_telefone && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs text-muted-foreground">{agendamento.cliente_telefone}</span>
                        </div>
                      )}
                      {atendidoPor && (
                        <div className="flex items-center gap-1 mt-1">
                          <UserCheck className="h-3 w-3 text-primary" />
                          <span className="text-xs text-primary">{atendidoPor}</span>
                        </div>
                      )}
                    </div>

                    {/* Status e ações */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={statusInfo.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusInfo.label}
                      </Badge>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => handleAtualizarStatus(agendamento.id, 'confirmado')}
                            disabled={agendamento.status !== 'agendado'}
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Confirmar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleAtualizarStatus(agendamento.id, 'em_atendimento')}
                            disabled={!['agendado', 'confirmado'].includes(agendamento.status)}
                          >
                            <UserCheck className="h-4 w-4 mr-2" />
                            Iniciar Atendimento
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleAtualizarStatus(agendamento.id, 'realizado')}
                            disabled={agendamento.status !== 'em_atendimento'}
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Marcar como Realizado
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleAtualizarStatus(agendamento.id, 'nao_compareceu')}
                            disabled={!['agendado', 'confirmado'].includes(agendamento.status)}
                            className="text-destructive"
                          >
                            <AlertCircle className="h-4 w-4 mr-2" />
                            Não Compareceu
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleAtualizarStatus(agendamento.id, 'cancelado')}
                            disabled={['realizado', 'cancelado'].includes(agendamento.status)}
                            className="text-destructive"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
