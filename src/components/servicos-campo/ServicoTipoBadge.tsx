import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Wrench, ClipboardCheck, PackageX, RefreshCw, FileSearch,
  Settings, AlertOctagon, Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { TIPO_SERVICO_LABELS, type Servico, type TipoServico } from '@/hooks/useServicos';
import { MOTIVO_RETIRADA_LABELS, type MotivoRetirada } from '@/types/retirada';

const TIPO_ICON: Record<TipoServico, React.ComponentType<{ className?: string }>> = {
  instalacao: Wrench,
  revistoria: RefreshCw,
  vistoria_entrada: ClipboardCheck,
  vistoria_saida: ClipboardCheck,
  vistoria_sinistro: AlertOctagon,
  vistoria_periodica: FileSearch,
  vistoria_manutencao: Settings,
  vistoria_retirada: PackageX,
};

const TIPO_COLOR: Record<TipoServico, string> = {
  instalacao: 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200',
  revistoria: 'bg-teal-100 text-teal-800 hover:bg-teal-200 dark:bg-teal-900/40 dark:text-teal-200',
  vistoria_entrada: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200',
  vistoria_saida: 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200',
  vistoria_sinistro: 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-200',
  vistoria_periodica: 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-200',
  vistoria_manutencao: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200',
  vistoria_retirada: 'bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-200',
};

interface ServicoTipoBadgeProps {
  servico: Servico;
  className?: string;
}

export function ServicoTipoBadge({ servico, className }: ServicoTipoBadgeProps) {
  const Icon = TIPO_ICON[servico.tipo];
  const colorClass = TIPO_COLOR[servico.tipo];
  const label = TIPO_SERVICO_LABELS[servico.tipo];

  const motivoRetirada = (servico as any).motivo_retirada as MotivoRetirada | undefined;
  const origem = (servico as any).solicitado_por_modulo || servico.origem;
  const motivoSinistro = (servico as any).motivo_manutencao || (servico as any).motivo_detalhe;
  const permiteEncaixe = servico.permite_encaixe;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            className={cn(
              'inline-flex items-center gap-1 cursor-help font-medium border-transparent',
              colorClass,
              className
            )}
          >
            <Icon className="h-3 w-3" />
            <span className="text-xs">{label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs p-3 space-y-1.5">
          <div className="font-semibold text-sm border-b border-border pb-1 mb-1">
            {label}
          </div>

          {servico.protocolo && (
            <div className="flex justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Protocolo:</span>
              <span className="font-mono">{servico.protocolo}</span>
            </div>
          )}

          {origem && (
            <div className="flex justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Origem:</span>
              <span className="capitalize">{origem}</span>
            </div>
          )}

          {motivoRetirada && (
            <div className="flex justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Motivo:</span>
              <span>{MOTIVO_RETIRADA_LABELS[motivoRetirada]}</span>
            </div>
          )}

          {motivoSinistro && servico.tipo === 'vistoria_sinistro' && (
            <div className="flex justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Detalhe:</span>
              <span className="text-right">{motivoSinistro}</span>
            </div>
          )}

          {servico.data_agendada && (
            <div className="flex justify-between gap-3 text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Data:
              </span>
              <span>
                {format(new Date(servico.data_agendada), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            </div>
          )}

          {permiteEncaixe && (
            <div className="text-xs text-emerald-600 dark:text-emerald-400 pt-1 border-t border-border">
              ✓ Cliente aceita encaixe
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
