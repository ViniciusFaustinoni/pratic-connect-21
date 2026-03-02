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
  className?: string;
  showTooltip?: boolean;
}

export function BadgeCobertura({
  coberturaTotal,
  coberturaRouboFurto,
  className,
  showTooltip = true,
}: BadgeCoberturaProps) {
  // Determinar o tipo de cobertura
  const getCoberturaInfo = () => {
    if (coberturaTotal) {
      return {
        label: 'Proteção 360º',
        icon: ShieldCheck,
        className: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        tooltip: 'Veículo com Proteção 360º ativa - Proteção completa contra roubo, furto e colisão',
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
    <Badge 
      variant="outline" 
      className={cn(info.className, 'font-medium', className)}
    >
      <Icon className="h-3 w-3 mr-1" />
      {info.label}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{info.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Badge compacto para uso em listas/cards
interface BadgeCoberturaCompactProps {
  coberturaTotal?: boolean | null;
  coberturaRouboFurto?: boolean | null;
  veiculoStatus?: string | null;
  className?: string;
}

export function BadgeCoberturaCompact({
  coberturaTotal,
  coberturaRouboFurto,
  veiculoStatus,
  className,
}: BadgeCoberturaCompactProps) {
  // Se veículo cancelado/inativo, sempre mostrar sem cobertura
  const isCancelado = veiculoStatus === 'cancelado' || veiculoStatus === 'inativo';

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
