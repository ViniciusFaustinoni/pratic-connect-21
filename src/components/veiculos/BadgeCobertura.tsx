import { Shield, ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BadgeCoberturaProps {
  coberturaTotal?: boolean | null;
  coberturaRouboFurto?: boolean | null;
  coberturaSuspensa?: boolean | null;
  coberturaSuspensaMotivo?: string | null;
  className?: string;
  showTooltip?: boolean;
}

export function BadgeCobertura({
  coberturaTotal,
  coberturaRouboFurto,
  coberturaSuspensa,
  coberturaSuspensaMotivo,
  className,
  showTooltip = true,
}: BadgeCoberturaProps) {
  const getCoberturaInfo = () => {
    if (coberturaSuspensa) {
      return {
        label: 'Suspensa',
        icon: ShieldAlert,
        className: 'bg-destructive/20 text-destructive border-destructive/30',
        tooltip: coberturaSuspensaMotivo || 'Cobertura suspensa por não ativação do rastreador em 48h',
      };
    }
    if (coberturaTotal) {
      return {
        label: 'Proteção 360º',
        icon: ShieldCheck,
        className: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        tooltip: 'Veículo com Proteção 360º ativa - Proteção 360º contra roubo, furto e colisão',
      };
    }
    if (coberturaRouboFurto) {
      return {
        label: 'Roubo/Furto',
        icon: Shield,
        className: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
        tooltip: 'Cobertura parcial ativa - Proteção contra roubo e furto. Aguardando instalação para Proteção 360º',
      };
    }
    return {
      label: 'Sem Cobertura',
      icon: ShieldOff,
      className: 'bg-slate-500/20 text-slate-500 dark:text-slate-400 border-slate-500/30',
      tooltip: 'Veículo ainda não possui cobertura ativa',
    };
  };

  const info = getCoberturaInfo();
  const Icon = info.icon;

  const badge = (
    <Badge variant="outline" className={cn(info.className, 'font-medium', className)}>
      <Icon className="h-3 w-3 mr-1" />
      {info.label}
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{info.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface BadgeCoberturaCompactProps {
  coberturaTotal?: boolean | null;
  coberturaRouboFurto?: boolean | null;
  coberturaSuspensa?: boolean | null;
  veiculoStatus?: string | null;
  className?: string;
}

export function BadgeCoberturaCompact({
  coberturaTotal,
  coberturaRouboFurto,
  coberturaSuspensa,
  veiculoStatus,
  className,
}: BadgeCoberturaCompactProps) {
  const isCancelado = veiculoStatus === 'cancelado' || veiculoStatus === 'inativo';

  if (!isCancelado && coberturaSuspensa) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('flex items-center justify-center w-6 h-6 rounded-full bg-destructive/20', className)}>
              <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Cobertura Suspensa - Rastreador não ativado</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (!isCancelado && coberturaTotal) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20', className)}>
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Proteção 360º Ativa</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (!isCancelado && coberturaRouboFurto) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('flex items-center justify-center w-6 h-6 rounded-full bg-yellow-500/20', className)}>
              <Shield className="h-3.5 w-3.5 text-yellow-500" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Roubo/Furto - Aguardando Instalação</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center justify-center w-6 h-6 rounded-full bg-slate-500/20', className)}>
            <ShieldOff className="h-3.5 w-3.5 text-slate-400" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Sem Cobertura</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
