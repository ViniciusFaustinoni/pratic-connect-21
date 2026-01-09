import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Phone, MapPin, User, AlertTriangle, GripVertical } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ORIGEM_LABELS } from '@/types/database';
import { cn } from '@/lib/utils';

interface Lead {
  id: string;
  nome: string;
  telefone: string;
  origem: string;
  etapa: string;
  created_at: string;
  updated_at: string;
  vendedor?: {
    nome: string;
  } | null;
}

interface LeadCardSimpleProps {
  lead: Lead;
  onClick: () => void;
}

const ORIGEM_COLORS: Record<string, string> = {
  site: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  telefone: 'bg-green-500/10 text-green-400 border-green-500/20',
  whatsapp: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  indicacao: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  instagram: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  facebook: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  evento: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  parceiro: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  outro: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

export function LeadCardSimple({ lead, onClick }: LeadCardSimpleProps) {
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
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  // Check if lead is stale (more than 3 days without update)
  const daysWithoutUpdate = differenceInDays(new Date(), new Date(lead.updated_at));
  const isStale = daysWithoutUpdate > 3 && lead.etapa !== 'ganho' && lead.etapa !== 'perdido';

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'p-3 cursor-pointer transition-all duration-200 border',
        'hover:border-primary hover:shadow-md hover:-translate-y-0.5',
        isDragging && 'opacity-50 shadow-lg rotate-2',
        isStale && 'border-l-2 border-l-orange-500'
      )}
      onClick={onClick}
    >
      {/* Header com nome e alerta */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-muted"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary/10 text-xs font-semibold text-primary flex-shrink-0">
            {lead.nome.charAt(0).toUpperCase()}
          </div>
          <span className="font-medium text-sm truncate">{lead.nome}</span>
        </div>
        {isStale && (
          <span title="Lead parado há mais de 3 dias">
            <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
          </span>
        )}
      </div>

      {/* Telefone */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Phone className="h-3 w-3" />
        <a
          href={`https://wa.me/55${lead.telefone.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="hover:text-primary hover:underline"
        >
          {formatPhone(lead.telefone)}
        </a>
      </div>

      {/* Origem */}
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="h-3 w-3 text-muted-foreground" />
        <Badge variant="outline" className={cn('text-xs font-normal', ORIGEM_COLORS[lead.origem])}>
          {ORIGEM_LABELS[lead.origem as keyof typeof ORIGEM_LABELS] || lead.origem}
        </Badge>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
        <div className="flex items-center gap-1">
          <User className="h-3 w-3" />
          <span>{lead.vendedor?.nome || 'Não atribuído'}</span>
        </div>
        <span>
          {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
        </span>
      </div>
    </Card>
  );
}
