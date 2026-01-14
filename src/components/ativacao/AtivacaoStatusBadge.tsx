import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, AlertCircle, Camera, CalendarClock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface AtivacaoStatusBadgeProps {
  vistoriaRealizada: boolean;
  assinaturaRealizada: boolean;
  dataVistoria?: string | null;
  dataAssinatura?: string | null;
  variant?: 'full' | 'compact';
  modalidadeVistoria?: 'autovistoria' | 'presencial' | null;
  vistoriaStatus?: string | null;
  onEnviarLembrete?: () => void;
  onVerProposta?: () => void;
}

type StatusType = 'concluida' | 'pendente_assinatura' | 'pendente_vistoria' | 'autovistoria_analise';

const STATUS_CONFIG: Record<StatusType, {
  label: string;
  labelCompact: string;
  sublabel: string;
  icon: React.ReactNode;
  bgClass: string;
  borderClass: string;
  textClass: string;
}> = {
  concluida: {
    label: 'Vistoria e Assinatura Realizada',
    labelCompact: 'Ativação Concluída',
    sublabel: 'ATIVAÇÃO CONCLUÍDA',
    icon: <><CheckCircle2 className="h-4 w-4" /><CheckCircle2 className="h-4 w-4" /></>,
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-500',
    textClass: 'text-emerald-800',
  },
  autovistoria_analise: {
    label: 'Autovistoria em Análise',
    labelCompact: 'Autovistoria OK',
    sublabel: 'PODE ATIVAR',
    icon: <><Camera className="h-4 w-4" /><CheckCircle2 className="h-4 w-4" /></>,
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-500',
    textClass: 'text-blue-800',
  },
  pendente_assinatura: {
    label: 'Vistoria Realizada',
    labelCompact: 'Pend. Assinatura',
    sublabel: 'PENDENTE ASSINATURA',
    icon: <><CheckCircle2 className="h-4 w-4" /><Clock className="h-4 w-4" /></>,
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-500',
    textClass: 'text-amber-800',
  },
  pendente_vistoria: {
    label: 'Aguardando Vistoria',
    labelCompact: 'Pend. Vistoria',
    sublabel: 'PENDENTE',
    icon: <CalendarClock className="h-4 w-4" />,
    bgClass: 'bg-gray-100',
    borderClass: 'border-gray-400',
    textClass: 'text-gray-600',
  },
};

function getStatus(
  vistoriaRealizada: boolean, 
  assinaturaRealizada: boolean,
  modalidade?: 'autovistoria' | 'presencial' | null,
  vistoriaStatus?: string | null
): StatusType {
  if (vistoriaRealizada && assinaturaRealizada) {
    // Se é autovistoria em análise (não aprovada ainda), mostrar status especial
    if (modalidade === 'autovistoria' && vistoriaStatus === 'em_analise') {
      return 'autovistoria_analise';
    }
    return 'concluida';
  }
  if (vistoriaRealizada && !assinaturaRealizada) return 'pendente_assinatura';
  return 'pendente_vistoria';
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Aguardando';
  try {
    return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return 'Data inválida';
  }
}

export function AtivacaoStatusBadge({
  vistoriaRealizada,
  assinaturaRealizada,
  dataVistoria,
  dataAssinatura,
  variant = 'compact',
  modalidadeVistoria,
  vistoriaStatus,
  onEnviarLembrete,
  onVerProposta,
}: AtivacaoStatusBadgeProps) {
  const status = getStatus(vistoriaRealizada, assinaturaRealizada, modalidadeVistoria, vistoriaStatus);
  const config = STATUS_CONFIG[status];

  const handleEnviarLembrete = () => {
    if (onEnviarLembrete) {
      onEnviarLembrete();
    } else {
      toast.success('Lembrete enviado com sucesso!');
    }
  };

  const TooltipContentComponent = (
    <div className="space-y-1 text-sm">
      <div className="flex items-center gap-2">
        {vistoriaRealizada ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span>
          Vistoria: {vistoriaRealizada ? formatDate(dataVistoria) : 'Aguardando'}
          {modalidadeVistoria && (
            <span className="ml-1 text-xs text-muted-foreground">
              ({modalidadeVistoria === 'autovistoria' ? 'Auto' : 'Presencial'})
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {assinaturaRealizada ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span>Assinatura: {assinaturaRealizada ? formatDate(dataAssinatura) : 'Aguardando'}</span>
      </div>
      {modalidadeVistoria === 'autovistoria' && vistoriaStatus === 'em_analise' && (
        <p className="text-xs text-blue-600 mt-1">
          ✓ Autovistoria realizada - pode ativar para roubo/furto
        </p>
      )}
    </div>
  );

  // Versão Full - para exibição destacada
  if (variant === 'full') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "rounded-lg border-2 p-3 shadow-sm cursor-default",
                config.bgClass,
                config.borderClass
              )}
            >
              <div className="flex items-center gap-2">
                <div className={cn("flex items-center gap-1", config.textClass)}>
                  {config.icon}
                </div>
                <span className={cn("text-sm", config.textClass)}>
                  {config.label}
                </span>
              </div>
              <p className={cn("text-xs font-bold mt-1", config.textClass)}>
                {config.sublabel}
              </p>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {TooltipContentComponent}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Versão Compact - para inline/listagens
  const BadgeContent = (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border-2 px-2.5 py-1 text-xs font-medium shadow-sm",
        config.bgClass,
        config.borderClass,
        config.textClass,
        status === 'pendente_assinatura' && "cursor-pointer hover:opacity-80"
      )}
    >
      <div className="flex items-center gap-0.5">
        {config.icon}
      </div>
      <span>{config.labelCompact}</span>
    </div>
  );

  // Se for pendente_assinatura, adicionar dropdown com ações
  if (status === 'pendente_assinatura') {
    return (
      <TooltipProvider>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                {BadgeContent}
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {TooltipContentComponent}
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleEnviarLembrete}>
              <AlertCircle className="h-4 w-4 mr-2" />
              Enviar Lembrete
            </DropdownMenuItem>
            {onVerProposta && (
              <DropdownMenuItem onClick={onVerProposta}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Ver Proposta
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>
    );
  }

  // Para outros status, apenas tooltip
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {BadgeContent}
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {TooltipContentComponent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Mini-cards para exibição detalhada no card
interface StatusMiniCardProps {
  tipo: 'vistoria' | 'assinatura';
  realizado: boolean;
  data?: string | null;
  modalidade?: 'autovistoria' | 'presencial' | null;
  vistoriaStatus?: string | null;
}

export function StatusMiniCard({ tipo, realizado, data, modalidade, vistoriaStatus }: StatusMiniCardProps) {
  const isAutovistoriaEmAnalise = tipo === 'vistoria' && modalidade === 'autovistoria' && vistoriaStatus === 'em_analise';
  
  const getLabel = () => {
    if (tipo === 'assinatura') return 'Assinatura';
    if (modalidade === 'autovistoria') return 'Autovistoria';
    if (modalidade === 'presencial') return 'Vistoria Agend.';
    return 'Vistoria';
  };
  
  const getBgColor = () => {
    if (!realizado) return "bg-gray-50 border-gray-200";
    if (isAutovistoriaEmAnalise) return "bg-blue-50 border-blue-200";
    return "bg-emerald-50 border-emerald-200";
  };
  
  const getIconColor = () => {
    if (!realizado) return "text-gray-400";
    if (isAutovistoriaEmAnalise) return "text-blue-500";
    return "text-emerald-500";
  };
  
  const getTextColor = () => {
    if (!realizado) return "text-gray-600";
    if (isAutovistoriaEmAnalise) return "text-blue-700";
    return "text-emerald-700";
  };
  
  const getSubtextColor = () => {
    if (!realizado) return "text-gray-500";
    if (isAutovistoriaEmAnalise) return "text-blue-600";
    return "text-emerald-600";
  };
  
  const getStatusText = () => {
    if (!realizado) return "Pendente";
    if (isAutovistoriaEmAnalise) return "Em Análise";
    if (data) return format(new Date(data), "dd/MM/yyyy", { locale: ptBR });
    return "Realizado";
  };
  
  return (
    <div
      className={cn(
        "flex-1 rounded-lg border p-3 text-center",
        getBgColor()
      )}
    >
      <div className="flex items-center justify-center gap-1.5 mb-1">
        {realizado ? (
          isAutovistoriaEmAnalise ? (
            <Camera className={cn("h-4 w-4", getIconColor())} />
          ) : (
            <CheckCircle2 className={cn("h-4 w-4", getIconColor())} />
          )
        ) : (
          <Clock className="h-4 w-4 text-gray-400" />
        )}
        <span className={cn("text-sm font-medium", getTextColor())}>
          {getLabel()}
        </span>
      </div>
      <p className={cn("text-xs", getSubtextColor())}>
        {getStatusText()}
      </p>
    </div>
  );
}
