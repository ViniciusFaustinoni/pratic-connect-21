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
  site: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  telefone: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  whatsapp: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  indicacao: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  instagram: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20',
  facebook: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  evento: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  parceiro: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  outro: 'bg-muted text-muted-foreground border-border',
};

const AVATAR_COLORS: Record<string, string> = {
  site: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  telefone: 'bg-green-500/15 text-green-600 dark:text-green-400',
  whatsapp: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  indicacao: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  instagram: 'bg-pink-500/15 text-pink-600 dark:text-pink-400',
  facebook: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  evento: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  parceiro: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  outro: 'bg-muted text-muted-foreground',
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
        'relative p-3 cursor-grab',
        'bg-card border-border/50 rounded-lg',
        'transition-all duration-200 ease-out',
        'hover:shadow-md hover:-translate-y-0.5 hover:border-border',
        isDragging && 'opacity-50 shadow-xl rotate-2 cursor-grabbing scale-105',
        isStale && 'ring-1 ring-orange-500/40 bg-orange-500/5'
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-full text-sm font-semibold flex-shrink-0',
              'transition-transform duration-200',
              AVATAR_COLORS[lead.origem] || AVATAR_COLORS.outro,
              isHovered && 'scale-105'
            )}
          >
            {lead.nome.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate leading-tight">{lead.nome}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDistanceToNow(new Date(lead.created_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isStale && (
            <span title="Lead parado há mais de 3 dias" className="animate-pulse">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-7 w-7 transition-opacity duration-200',
                  isHovered ? 'opacity-100' : 'opacity-0'
                )}
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
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2.5">
        <Phone className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="truncate">{formatPhone(lead.telefone)}</span>
      </div>

      {/* Origin & Seller */}
      <div className="flex items-center justify-between pt-2.5 border-t border-border/50">
        <Badge
          variant="outline"
          className={cn('text-xs font-medium px-2 py-0.5', ORIGEM_COLORS[lead.origem] || ORIGEM_COLORS.outro)}
        >
          {ORIGEM_LABELS[lead.origem as keyof typeof ORIGEM_LABELS] || lead.origem}
        </Badge>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          <span className="truncate max-w-[70px]">
            {lead.vendedor?.nome || 'Não atribuído'}
          </span>
        </div>
      </div>

      {/* Quick Actions (shown on hover) */}
      <div
        className={cn(
          'absolute -bottom-1 left-2 right-2',
          'flex items-center justify-center gap-1.5',
          'transition-all duration-200 ease-out',
          isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        )}
      >
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs gap-1.5 shadow-md bg-card border border-border"
          onClick={handleWhatsApp}
        >
          <MessageCircle className="h-3.5 w-3.5 text-green-500" />
          WhatsApp
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs gap-1.5 shadow-md bg-card border border-border"
          onClick={handleQuote}
        >
          <Calculator className="h-3.5 w-3.5 text-primary" />
          Cotar
        </Button>
      </div>
    </Card>
  );
}
