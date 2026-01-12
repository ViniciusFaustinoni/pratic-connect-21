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
  FileText,
  Send,
  CheckCircle,
  XCircle,
  Link2,
  FileSignature,
  Target,
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

interface PlanoInteresse {
  id: string;
  nome: string;
}

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
  // Campos de proposta
  plano_escolhido_id?: string | null;
  plano_escolhido_nome?: string | null;
  plano_escolhido_valor?: number | null;
  proposta_enviada_em?: string | null;
  proposta_assinada_em?: string | null;
}

interface LeadCardEnhancedProps {
  lead: Lead;
  onClick: () => void;
  onDelete?: (id: string) => void;
  onQuote?: (lead: Lead) => void;
  onSendProposal?: (lead: Lead) => void;
  onMarkLost?: (lead: Lead) => void;
  planosInteresse?: PlanoInteresse[];
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

export function LeadCardEnhanced({ 
  lead, 
  onClick, 
  onDelete, 
  onQuote,
  onSendProposal,
  onMarkLost,
  planosInteresse = [],
}: LeadCardEnhancedProps) {
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Check if lead is stale (more than 3 days without update)
  const daysWithoutUpdate = differenceInDays(new Date(), new Date(lead.updated_at));
  const isStale = daysWithoutUpdate > 3 && lead.etapa !== 'ganho' && lead.etapa !== 'perdido';

  // Status visual states
  const isPropostaPendente = lead.etapa === 'contrato_enviado';
  const isPropostaAssinada = lead.etapa === 'contrato_assinado';
  const isCotacaoEnviada = lead.etapa === 'cotacao_enviada';
  const isNovo = lead.etapa === 'novo';
  const hasPlanoEscolhido = !!lead.plano_escolhido_nome;

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
        isStale && !isPropostaPendente && !isPropostaAssinada && 'ring-1 ring-orange-500/40 bg-orange-500/5',
        // Visual states based on etapa
        isPropostaPendente && 'card-proposta-pendente',
        isPropostaAssinada && 'card-proposta-assinada',
        isCotacaoEnviada && 'card-cotacao-enviada',
      )}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Status Badge for special states */}
      {isPropostaAssinada && (
        <div className="absolute -top-2 -right-2 z-10">
          <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0.5 shadow-md">
            <CheckCircle className="h-3 w-3 mr-0.5" />
            Assinado
          </Badge>
        </div>
      )}
      
      {isPropostaPendente && (
        <div className="absolute -top-2 -right-2 z-10">
          <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 shadow-md animate-pulse">
            <FileSignature className="h-3 w-3 mr-0.5" />
            Aguardando
          </Badge>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-full text-sm font-semibold flex-shrink-0',
              'transition-transform duration-200',
              isPropostaAssinada ? 'bg-green-500/15 text-green-600 dark:text-green-400' :
              isPropostaPendente ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
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
          {isStale && !isPropostaPendente && !isPropostaAssinada && (
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
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClick(); }}>
                <Eye className="h-4 w-4 mr-2" />
                Ver detalhes
              </DropdownMenuItem>
              
              {/* Actions based on etapa */}
              {(isNovo || lead.etapa === 'contato' || lead.etapa === 'qualificado') && (
                <DropdownMenuItem onClick={handleQuote}>
                  <Calculator className="h-4 w-4 mr-2" />
                  Enviar cotação
                </DropdownMenuItem>
              )}
              
              {isCotacaoEnviada && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSendProposal?.(lead); }}>
                  <FileSignature className="h-4 w-4 mr-2" />
                  Enviar proposta
                </DropdownMenuItem>
              )}
              
              <DropdownMenuItem onClick={handleWhatsApp}>
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp
              </DropdownMenuItem>
              
              {lead.etapa !== 'ganho' && lead.etapa !== 'perdido' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-red-500 focus:text-red-500"
                    onClick={(e) => { e.stopPropagation(); onMarkLost?.(lead); }}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Marcar perdido
                  </DropdownMenuItem>
                </>
              )}
              
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

      {/* Planos de Interesse - Show on NOVO stage */}
      {isNovo && planosInteresse.length > 0 && (
        <div className="mb-2.5 p-2 rounded-md bg-blue-500/5 border border-blue-500/10">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Target className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Interesse em:</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {planosInteresse.slice(0, 3).map((plano) => (
              <Badge 
                key={plano.id}
                variant="outline" 
                className="text-[10px] px-1.5 py-0 bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400"
              >
                {plano.nome}
              </Badge>
            ))}
            {planosInteresse.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                +{planosInteresse.length - 3}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Plano Escolhido - Show on COTAÇÃO_ENVIADA and later */}
      {hasPlanoEscolhido && (isCotacaoEnviada || isPropostaPendente || isPropostaAssinada || lead.etapa === 'negociacao') && (
        <div className={cn(
          "mb-2.5 p-2 rounded-md border",
          isPropostaAssinada ? "bg-green-500/5 border-green-500/20" :
          isPropostaPendente ? "bg-amber-500/5 border-amber-500/20" :
          "bg-violet-500/5 border-violet-500/10"
        )}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <FileText className={cn(
                "h-3.5 w-3.5 flex-shrink-0",
                isPropostaAssinada ? "text-green-500" :
                isPropostaPendente ? "text-amber-500" :
                "text-violet-500"
              )} />
              <span className={cn(
                "text-xs font-medium truncate",
                isPropostaAssinada ? "text-green-600 dark:text-green-400" :
                isPropostaPendente ? "text-amber-600 dark:text-amber-400" :
                "text-violet-600 dark:text-violet-400"
              )}>
                {lead.plano_escolhido_nome}
              </span>
            </div>
            {lead.plano_escolhido_valor && (
              <span className={cn(
                "text-xs font-bold whitespace-nowrap",
                isPropostaAssinada ? "text-green-600 dark:text-green-400" :
                isPropostaPendente ? "text-amber-600 dark:text-amber-400" :
                "text-violet-600 dark:text-violet-400"
              )}>
                {formatCurrency(lead.plano_escolhido_valor)}/mês
              </span>
            )}
          </div>
        </div>
      )}

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
        
        {!isCotacaoEnviada && !isPropostaPendente && !isPropostaAssinada && lead.etapa !== 'ganho' && lead.etapa !== 'perdido' && (
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs gap-1.5 shadow-md bg-card border border-border"
            onClick={handleQuote}
          >
            <Calculator className="h-3.5 w-3.5 text-primary" />
            Cotar
          </Button>
        )}
        
        {isCotacaoEnviada && (
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs gap-1.5 shadow-md bg-violet-500/10 border border-violet-500/20 text-violet-600"
            onClick={(e) => { e.stopPropagation(); onSendProposal?.(lead); }}
          >
            <FileSignature className="h-3.5 w-3.5" />
            Proposta
          </Button>
        )}
      </div>
    </Card>
  );
}
