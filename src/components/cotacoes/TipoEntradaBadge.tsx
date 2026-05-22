import { Badge } from '@/components/ui/badge';
import { ArrowRight, Car, Repeat, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TipoEntradaBadgeProps {
  tipo?: string | null;
  className?: string;
  size?: 'sm' | 'md';
}

const CONFIG: Record<
  string,
  { label: string; className: string; Icon: typeof Car }
> = {
  troca_titularidade: {
    label: 'Troca de titularidade',
    className: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
    Icon: ArrowRight,
  },
  inclusao_veiculo: {
    label: 'Inclusão de veículo',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    Icon: Car,
  },
  inclusao: {
    label: 'Inclusão de veículo',
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    Icon: Car,
  },
  substituicao_placa: {
    label: 'Substituição de veículo',
    className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    Icon: Repeat,
  },
  substituicao: {
    label: 'Substituição de veículo',
    className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    Icon: Repeat,
  },
  migracao: {
    label: 'Migração',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    Icon: ArrowRightLeft,
  },
};

export function TipoEntradaBadge({ tipo, className, size = 'sm' }: TipoEntradaBadgeProps) {
  if (!tipo) return null;
  const cfg = CONFIG[tipo];
  if (!cfg) return null;
  const Icon = cfg.Icon;
  const sizeCls = size === 'md'
    ? 'h-6 text-xs px-2.5'
    : 'h-5 text-[10px] px-2';
  return (
    <span
      className={cn(
        cfg.className,
        sizeCls,
        'inline-flex items-center font-semibold tracking-wide rounded-md whitespace-nowrap',
        className,
      )}
    >
      <Icon className="h-2.5 w-2.5 mr-1 shrink-0" />
      {cfg.label}
    </span>
  );
}
