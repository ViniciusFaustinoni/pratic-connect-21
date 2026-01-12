import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
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
  onEnviarLembrete?: () => void;
  onVerProposta?: () => void;
}

type StatusType = 'concluida' | 'pendente_assinatura' | 'pendente_vistoria';

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
    icon: <Clock className="h-4 w-4" />,
    bgClass: 'bg-gray-100',
    borderClass: 'border-gray-400',
    textClass: 'text-gray-600',
  },
};

function getStatus(vistoriaRealizada: boolean, assinaturaRealizada: boolean): StatusType {
  if (vistoriaRealizada && assinaturaRealizada) return 'concluida';
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
  onEnviarLembrete,
  onVerProposta,
}: AtivacaoStatusBadgeProps) {
  const status = getStatus(vistoriaRealizada, assinaturaRealizada);
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
        <span>Vistoria: {vistoriaRealizada ? formatDate(dataVistoria) : 'Aguardando'}</span>
      </div>
      <div className="flex items-center gap-2">
        {assinaturaRealizada ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        ) : (
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span>Assinatura: {assinaturaRealizada ? formatDate(dataAssinatura) : 'Aguardando'}</span>
      </div>
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
}

export function StatusMiniCard({ tipo, realizado, data }: StatusMiniCardProps) {
  const label = tipo === 'vistoria' ? 'Vistoria' : 'Assinatura';
  
  return (
    <div
      className={cn(
        "flex-1 rounded-lg border p-3 text-center",
        realizado
          ? "bg-emerald-50 border-emerald-200"
          : "bg-gray-50 border-gray-200"
      )}
    >
      <div className="flex items-center justify-center gap-1.5 mb-1">
        {realizado ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <Clock className="h-4 w-4 text-gray-400" />
        )}
        <span
          className={cn(
            "text-sm font-medium",
            realizado ? "text-emerald-700" : "text-gray-600"
          )}
        >
          {label}
        </span>
      </div>
      <p
        className={cn(
          "text-xs",
          realizado ? "text-emerald-600" : "text-gray-500"
        )}
      >
        {realizado && data
          ? format(new Date(data), "dd/MM/yyyy", { locale: ptBR })
          : "Pendente"}
      </p>
    </div>
  );
}
