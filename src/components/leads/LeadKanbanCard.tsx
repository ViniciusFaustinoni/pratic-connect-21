import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Phone, Car, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Tables } from '@/integrations/supabase/types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ORIGEM_LABELS } from '@/types/database';

type Lead = Tables<'leads'>;

interface LeadKanbanCardProps {
  lead: Lead;
  onClick: () => void;
}

// Cores de fundo do avatar baseadas na origem
const origemAvatarColors: Record<string, string> = {
  site: 'bg-blue-100 text-blue-700',
  indicacao: 'bg-green-100 text-green-700',
  telefone: 'bg-purple-100 text-purple-700',
  whatsapp: 'bg-emerald-100 text-emerald-700',
  facebook: 'bg-indigo-100 text-indigo-700',
  instagram: 'bg-pink-100 text-pink-700',
  google_ads: 'bg-red-100 text-red-700',
  feira: 'bg-amber-100 text-amber-700',
  parceiro: 'bg-cyan-100 text-cyan-700',
  outros: 'bg-gray-100 text-gray-700',
};

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

  // Verificar se a data_proxima_acao está atrasada
  const isOverdue = lead.data_proxima_acao 
    && new Date(lead.data_proxima_acao) < new Date()
    && lead.etapa !== 'ganho' 
    && lead.etapa !== 'perdido';

  const avatarColor = origemAvatarColors[lead.origem] || origemAvatarColors.outros;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing transition-all hover:shadow-md group border-l-2 ${
        isStale ? 'border-l-destructive' : 'border-l-transparent hover:border-l-primary'
      }`}
      onClick={onClick}
    >
      <CardContent className="p-2.5">
        {/* Header: Avatar + Nome + Indicador */}
        <div className="flex items-start gap-2 mb-1.5">
          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold flex-shrink-0 ${avatarColor}`}>
            {lead.nome.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm leading-tight truncate" title={lead.nome}>
              {lead.nome}
            </p>
            {lead.veiculo_marca && (
              <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                <Car className="h-3 w-3 flex-shrink-0" />
                {lead.veiculo_marca} {lead.veiculo_modelo} {lead.veiculo_ano || ''}
              </p>
            )}
          </div>
          {isOverdue && (
            <div 
              className="h-2 w-2 rounded-full bg-red-500 animate-pulse flex-shrink-0 mt-1" 
              title="Ação atrasada"
            />
          )}
        </div>

        {/* Info: Telefone + Valor FIPE */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <div className="flex items-center gap-1.5">
            <Phone className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{lead.telefone}</span>
            <a
              href={`https://wa.me/55${lead.telefone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-green-600 hover:text-green-700 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Abrir WhatsApp"
            >
              <MessageCircle className="h-3 w-3" />
            </a>
          </div>
          {lead.veiculo_fipe && (
            <span className="font-medium text-foreground text-[11px]">
              {formatCurrency(lead.veiculo_fipe)}
            </span>
          )}
        </div>

        {/* Footer: Origem + Tempo */}
        <div className="flex items-center justify-between pt-1.5 border-t border-border/50">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
            {ORIGEM_LABELS[lead.origem]}
          </Badge>
          <span className={`text-[10px] ${isStale ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
            {daysInStage}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}