import { X, Send, MessageSquare, Mail, FileText, Trash2, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BatchActionsBarProps {
  selectedCount: number;
  onClear: () => void;
  actions: BatchAction[];
  className?: string;
}

export interface BatchAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
  disabled?: boolean;
}

export function BatchActionsBar({ selectedCount, onClear, actions, className }: BatchActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className={cn(
      "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
      "bg-primary text-primary-foreground rounded-lg shadow-lg",
      "flex items-center gap-2 p-3 pr-4",
      "animate-in slide-in-from-bottom-4 duration-200",
      className
    )}>
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onClear}
        className="text-primary-foreground hover:bg-primary-foreground/20"
      >
        <X className="h-4 w-4" />
      </Button>
      
      <span className="font-medium px-2 border-r border-primary-foreground/30 mr-2">
        {selectedCount} selecionado(s)
      </span>
      
      <div className="flex items-center gap-1">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant || 'ghost'}
            size="sm"
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
              action.variant === 'destructive' 
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' 
                : 'text-primary-foreground hover:bg-primary-foreground/20'
            )}
          >
            {action.icon}
            <span className="ml-1">{action.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

// Ações predefinidas para cobranças
export const getCobrancasBatchActions = (
  onEnviarBoletos: () => void,
  onEnviarWhatsApp: () => void,
  onEnviarEmail: () => void,
  onReemitir: () => void
): BatchAction[] => [
  {
    label: 'Enviar Boletos',
    icon: <Send className="h-4 w-4" />,
    onClick: onEnviarBoletos,
  },
  {
    label: 'WhatsApp',
    icon: <MessageSquare className="h-4 w-4" />,
    onClick: onEnviarWhatsApp,
  },
  {
    label: 'E-mail',
    icon: <Mail className="h-4 w-4" />,
    onClick: onEnviarEmail,
  },
  {
    label: 'Reemitir',
    icon: <FileText className="h-4 w-4" />,
    onClick: onReemitir,
  },
];

// Ações predefinidas para contas a pagar
export const getContasPagarBatchActions = (
  onPagarSelecionadas: () => void,
  onCancelarSelecionadas: () => void
): BatchAction[] => [
  {
    label: 'Pagar Selecionadas',
    icon: <DollarSign className="h-4 w-4" />,
    onClick: onPagarSelecionadas,
  },
  {
    label: 'Cancelar',
    icon: <Trash2 className="h-4 w-4" />,
    onClick: onCancelarSelecionadas,
    variant: 'destructive',
  },
];
