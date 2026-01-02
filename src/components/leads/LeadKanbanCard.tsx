import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Phone, Car, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Tables } from '@/integrations/supabase/types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Lead = Tables<'leads'>;

interface LeadKanbanCardProps {
  lead: Lead;
  onClick: () => void;
}

export function LeadKanbanCard({ lead, onClick }: LeadKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return null;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const daysInStage = formatDistanceToNow(new Date(lead.updated_at), {
    locale: ptBR,
    addSuffix: false,
  });

  // Calcular se está parado há muito tempo (mais de 7 dias)
  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  const isStale = daysSinceUpdate > 7 && lead.etapa !== 'ganho' && lead.etapa !== 'perdido';

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md ${
        isStale ? 'border-destructive/50' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
            {lead.nome.charAt(0)}
          </div>
          <span className="font-medium text-sm truncate flex-1">{lead.nome}</span>
        </div>

        <div className="space-y-1.5 text-xs text-muted-foreground">
          {lead.veiculo_marca && (
            <div className="flex items-center gap-1.5">
              <Car className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">
                {lead.veiculo_marca} {lead.veiculo_modelo}
                {lead.veiculo_fipe && (
                  <span className="ml-1 text-foreground font-medium">
                    {formatCurrency(lead.veiculo_fipe)}
                  </span>
                )}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <Phone className="h-3 w-3 flex-shrink-0" />
            <span>{lead.telefone}</span>
          </div>

          <div className={`flex items-center gap-1.5 ${isStale ? 'text-destructive' : ''}`}>
            <Clock className="h-3 w-3 flex-shrink-0" />
            <span>{daysInStage} nesta etapa</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
