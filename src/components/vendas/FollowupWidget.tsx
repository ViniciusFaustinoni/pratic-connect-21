import { Link } from 'react-router-dom';
import { CalendarClock, AlertTriangle, Phone, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFollowupsHoje, useFollowupsAtrasados, useFollowupStats } from '@/hooks/useFollowups';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FollowupWidgetProps {
  vendedorId?: string;
  maxItems?: number;
}

export function FollowupWidget({ vendedorId, maxItems = 5 }: FollowupWidgetProps) {
  const { data: stats, isLoading: isLoadingStats } = useFollowupStats(vendedorId);
  const { data: followupsHoje, isLoading: isLoadingHoje } = useFollowupsHoje(vendedorId);
  const { data: followupsAtrasados } = useFollowupsAtrasados(vendedorId);

  const isLoading = isLoadingStats || isLoadingHoje;

  // Combinar atrasados + hoje, priorizando atrasados
  const todosFollowups = [
    ...(followupsAtrasados || []).map(f => ({ ...f, isAtrasado: true })),
    ...(followupsHoje || []).map(f => ({ ...f, isAtrasado: false })),
  ].slice(0, maxItems);

  const totalPendentes = (stats?.hoje || 0) + (stats?.atrasados || 0);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="h-5 w-5 text-primary" />
            Tarefas do Dia
          </CardTitle>
          {totalPendentes > 0 && (
            <Badge variant={stats?.atrasados ? 'destructive' : 'secondary'}>
              {totalPendentes} pendente{totalPendentes !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : todosFollowups.length > 0 ? (
          <div className="space-y-2">
            {todosFollowups.map((lead) => (
              <Link
                key={lead.id}
                to={`/vendas/leads/${lead.id}`}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {lead.isAtrasado ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10 text-destructive shrink-0">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                      <Phone className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium truncate group-hover:text-primary transition-colors">
                      {lead.nome}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lead.veiculo_marca && lead.veiculo_modelo 
                        ? `${lead.veiculo_marca} ${lead.veiculo_modelo}`
                        : lead.telefone
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs ${lead.isAtrasado ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                    {format(new Date(lead.data_proxima_acao), 'HH:mm', { locale: ptBR })}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}

            {totalPendentes > maxItems && (
              <Link to="/vendas/leads?followup=pendente">
                <Button variant="ghost" size="sm" className="w-full mt-2">
                  Ver todos ({totalPendentes})
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <CalendarClock className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">
              Nenhum follow-up agendado para hoje
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Agende contatos com seus leads para não perder oportunidades
            </p>
          </div>
        )}

        {/* Resumo de estatísticas */}
        {!isLoading && (stats?.atrasados || 0) > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Atrasados</span>
              <Badge variant="destructive" className="font-mono">
                {stats?.atrasados}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
