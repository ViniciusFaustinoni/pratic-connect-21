import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Phone, Car, MessageCircle, Calculator, MoreHorizontal, Eye, Edit, FileText, FileSignature, UserPlus, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Tables } from '@/integrations/supabase/types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ORIGEM_LABELS } from '@/types/database';
import { cn } from '@/lib/utils';

type Lead = Tables<'leads'>;

interface LeadKanbanCardProps {
  lead: Lead;
  onClick: () => void;
  onQuote?: (leadId: string) => void;
  onWhatsAppClick?: (leadId: string, currentEtapa: string) => void;
  onAction?: (action: string, lead: Lead) => void;
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

// Indicador visual de status do contrato
function getIndicadorContrato(lead: Lead) {
  const status = (lead as any).contrato_status;
  
  if (status === 'assinado') {
    return {
      borderClass: 'border-l-4 border-l-green-500',
      cardClass: 'card-proposta-assinada',
      badge: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      icone: '✅',
      texto: 'Assinado'
    };
  }
  if (status === 'enviado' || status === 'visualizado') {
    return {
      borderClass: 'border-l-4 border-l-yellow-500',
      cardClass: 'card-proposta-pendente',
      badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      icone: '⏳',
      texto: status === 'visualizado' ? 'Visualizado' : 'Aguardando'
    };
  }
  if (status === 'recusado') {
    return {
      borderClass: 'border-l-4 border-l-red-500',
      cardClass: '',
      badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      icone: '❌',
      texto: 'Recusado'
    };
  }
  return null;
}

export function LeadKanbanCard({ lead, onClick, onQuote, onWhatsAppClick, onAction }: LeadKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    visibility: isDragging ? 'hidden' as const : 'visible' as const,
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
  const indicador = getIndicadorContrato(lead);

  // Planos de interesse (novo campo)
  const planosInteresse = (lead as any).planos_interesse as string[] | null;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-grab active:cursor-grabbing transition-all hover:shadow-md group relative",
        indicador?.cardClass,
        indicador?.borderClass || (isStale ? 'border-l-4 border-l-destructive' : 'border-l-2 border-l-transparent hover:border-l-primary')
      )}
      onClick={onClick}
    >
      <CardContent className="p-2.5">
        {/* Header: Avatar + Nome + Indicador + Menu */}
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
          
          {/* Badge de status do contrato */}
          {indicador && (
            <Badge className={cn("text-[9px] px-1 py-0 h-4 flex-shrink-0", indicador.badge)}>
              {indicador.icone} {indicador.texto}
            </Badge>
          )}
          
          {isOverdue && !indicador && (
            <div 
              className="h-2 w-2 rounded-full bg-red-500 animate-pulse flex-shrink-0 mt-1" 
              title="Ação atrasada"
            />
          )}

          {/* Menu de ações */}
          {onAction && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction('ver', lead); }}>
                  <Eye className="h-4 w-4 mr-2" />
                  Ver detalhes
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction('editar', lead); }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar lead
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction('contato', lead); }}>
                  <Phone className="h-4 w-4 mr-2" />
                  Registrar contato
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction('cotacao', lead); }}>
                  <FileText className="h-4 w-4 mr-2" />
                  Enviar cotação
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction('contrato', lead); }}>
                  <FileSignature className="h-4 w-4 mr-2" />
                  Enviar contrato
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onAction('transferir', lead); }}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Transferir lead
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); onAction('perdido', lead); }}
                  className="text-destructive focus:text-destructive"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Marcar como perdido
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Planos de interesse (apenas na etapa novo) */}
        {lead.etapa === 'novo' && planosInteresse && planosInteresse.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {planosInteresse.map((plano) => (
              <Badge key={plano} variant="outline" className="text-[9px] px-1 py-0 h-4 capitalize">
                {plano}
              </Badge>
            ))}
          </div>
        )}

        {/* Plano escolhido (após cotação) */}
        {lead.plano_escolhido_nome && (
          <div className="flex items-center justify-between gap-1 mb-1.5 text-[11px]">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {lead.plano_escolhido_nome}
            </Badge>
            {lead.plano_escolhido_valor && (
              <span className="font-medium text-green-600">
                R$ {lead.plano_escolhido_valor.toFixed(2)}/mês
              </span>
            )}
          </div>
        )}

        {/* Info: Telefone + Valor FIPE */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <div className="flex items-center gap-1.5">
            <Phone className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{lead.telefone}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onWhatsAppClick?.(lead.id, lead.etapa);
                window.open(`https://wa.me/55${lead.telefone.replace(/\D/g, '')}`, '_blank');
              }}
              className="text-green-600 hover:text-green-700 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Abrir WhatsApp"
            >
              <MessageCircle className="h-3 w-3" />
            </button>
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

        {/* Hover Actions */}
        {onQuote && (
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center p-2 bg-gradient-to-t from-background/95 via-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-b-lg">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs gap-1.5 shadow-sm"
              onClick={(e) => {
                e.stopPropagation();
                onQuote(lead.id);
              }}
            >
              <Calculator className="h-3.5 w-3.5" />
              Cotar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}