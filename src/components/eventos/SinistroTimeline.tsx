import { Clock, ArrowRight, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface HistoricoItem {
  id: string;
  status_anterior: string | null;
  status_novo: string;
  usuario: { nome: string } | null;
  observacao: string | null;
  created_at: string;
}

interface SinistroTimelineProps {
  historico: HistoricoItem[];
}

import { STATUS_SINISTRO_LABELS, STATUS_SINISTRO_COLORS } from '@/types/sinistros';

const statusConfig: Record<string, { label: string; class: string }> = Object.fromEntries(
  Object.entries(STATUS_SINISTRO_LABELS).map(([key, label]) => [
    key,
    { label, class: STATUS_SINISTRO_COLORS[key as keyof typeof STATUS_SINISTRO_COLORS] || 'bg-gray-100 text-gray-800' }
  ])
);

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }) + ' ' + date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function SinistroTimeline({ historico }: SinistroTimelineProps) {
  if (historico.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Atualizações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mb-2" />
            <p className="text-sm">Nenhum histórico registrado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Histórico de Atualizações</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {historico.map((item, index) => {
            const isFirst = index === 0;
            const statusAnterior = item.status_anterior
              ? statusConfig[item.status_anterior]
              : null;
            const statusNovo = statusConfig[item.status_novo] || {
              label: item.status_novo,
              class: 'bg-gray-100 text-gray-800',
            };

            return (
              <div key={item.id} className="relative flex gap-4 pb-6 last:pb-0">
                {/* Círculo */}
                <div
                  className={cn(
                    'w-3 h-3 rounded-full shrink-0 mt-1.5 z-10',
                    isFirst ? 'bg-blue-500' : 'bg-gray-300'
                  )}
                />

                {/* Linha vertical */}
                {index < historico.length - 1 && (
                  <div className="absolute left-[5px] top-5 bottom-0 w-0.5 bg-gray-200" />
                )}

                {/* Conteúdo */}
                <div className="flex-1 space-y-1">
                  {/* Data */}
                  <p className="text-sm text-muted-foreground">
                    {formatDate(item.created_at)}
                  </p>

                  {/* Transição de status */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {statusAnterior ? (
                      <>
                        <Badge className={statusAnterior.class} variant="secondary">
                          {statusAnterior.label}
                        </Badge>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </>
                    ) : (
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    )}
                    <Badge className={statusNovo.class} variant="secondary">
                      {statusNovo.label}
                    </Badge>
                  </div>

                  {/* Usuário */}
                  <p className="text-sm font-medium flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Por: {item.usuario?.nome || 'Sistema'}
                  </p>

                  {/* Observação */}
                  {item.observacao && (
                    <p className="text-sm text-muted-foreground italic">
                      "{item.observacao}"
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
