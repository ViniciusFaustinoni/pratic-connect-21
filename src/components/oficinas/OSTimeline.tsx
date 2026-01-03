import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, ArrowRight } from 'lucide-react';
import { STATUS_ORDEM_SERVICO_LABELS, type OrdemServicoHistorico } from '@/types/database';

interface Props {
  historico: OrdemServicoHistorico[];
}

export function OSTimeline({ historico }: Props) {
  if (historico.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Nenhum histórico registrado
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {historico.map((item, index) => (
        <div key={item.id} className="relative flex gap-4">
          {/* Line */}
          {index !== historico.length - 1 && (
            <div className="absolute left-[11px] top-8 h-full w-0.5 bg-border" />
          )}

          {/* Dot */}
          <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Clock className="h-3 w-3 text-primary" />
          </div>

          {/* Content */}
          <div className="flex-1 space-y-1 pb-4">
            <div className="flex items-center gap-2 text-sm">
              {item.status_anterior && (
                <>
                  <span className="text-muted-foreground">
                    {STATUS_ORDEM_SERVICO_LABELS[item.status_anterior as keyof typeof STATUS_ORDEM_SERVICO_LABELS] || item.status_anterior}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                </>
              )}
              <span className="font-medium">
                {STATUS_ORDEM_SERVICO_LABELS[item.status_novo as keyof typeof STATUS_ORDEM_SERVICO_LABELS] || item.status_novo}
              </span>
            </div>

            {item.observacao && (
              <p className="text-sm text-muted-foreground">{item.observacao}</p>
            )}

            <p className="text-xs text-muted-foreground">
              {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              {item.usuario?.nome && ` • ${item.usuario.nome}`}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
