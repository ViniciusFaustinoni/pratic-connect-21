import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Phone,
  MessageCircle,
  Calculator,
  User,
  AlertTriangle,
  MoreHorizontal,
  Eye,
  Trash2,
  Car,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ORIGEM_LABELS } from '@/types/database';
import { cn } from '@/lib/utils';
import { useState } from 'react';

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

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
  onDelete?: (id: string) => void;
  onQuote?: (lead: Lead) => void;
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

const ETAPA_BORDER_COLORS: Record<string, string> = {
  novo: 'border-l-blue-500',
  contato: 'border-l-yellow-500',
  qualificado: 'border-l-purple-500',
  cotacao_enviada: 'border-l-orange-500',
  negociacao: 'border-l-pink-500',
  ganho: 'border-l-green-500',
  perdido: 'border-l-red-500',
};

export function LeadCard({ lead, onClick, onDelete, onQuote }: LeadCardProps) {
  const [isHovered, setIsHovered] = useState(false);

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

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`https://wa.me/55${lead.telefone.replace(/\D/g, '')}`, '_blank');
  };

  const handleQuote = (e: React.MouseEvent) => {
    e.stopPropagation();
    onQuote?.(lead);
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'relative p-3 cursor-grab transition-all duration-200',
        'border-l-4 bg-card hover:bg-card-hover',
        'hover:shadow-lg hover:-translate-y-0.5',
        ETAPA_BORDER_COLORS[lead.etapa] || 'border-l-gray-500',
        isDragging && 'opacity-50 shadow-xl rotate-2 cursor-grabbing',
        isStale && 'ring-1 ring-orange-500/30'
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-full text-sm font-semibold flex-shrink-0',
              'bg-primary/10 text-primary'
            )}
          >
            {lead.nome.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{lead.nome}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(lead.created_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isStale && (
            <span title="Lead parado há mais de 3 dias">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:opacity-100 data-[state=open]:opacity-100"
                style={{ opacity: isHovered ? 1 : 0 }}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }}>
                <Eye className="h-4 w-4 mr-2" />
                Ver detalhes
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleQuote}>
                <Calculator className="h-4 w-4 mr-2" />
                Gerar cotação
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleWhatsApp}>
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </DropdownMenuItem>
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(lead.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Phone */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Phone className="h-3.5 w-3.5" />
        <span>{formatPhone(lead.telefone)}</span>
      </div>

      {/* Origin & Seller */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <Badge
          variant="outline"
          className={cn('text-xs font-normal', ORIGEM_COLORS[lead.origem])}
        >
          {ORIGEM_LABELS[lead.origem as keyof typeof ORIGEM_LABELS] || lead.origem}
        </Badge>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          <span className="truncate max-w-[80px]">
            {lead.vendedor?.nome || 'Não atribuído'}
          </span>
        </div>
      </div>

      {/* Quick Actions (shown on hover) */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-card via-card to-transparent',
          'flex items-center justify-center gap-2 transition-opacity duration-200',
          isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5 bg-card"
          onClick={handleWhatsApp}
        >
          <MessageCircle className="h-3.5 w-3.5 text-green-500" />
          WhatsApp
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5 bg-card"
          onClick={handleQuote}
        >
          <Calculator className="h-3.5 w-3.5 text-primary" />
          Cotar
        </Button>
      </div>
    </Card>
  );
}
