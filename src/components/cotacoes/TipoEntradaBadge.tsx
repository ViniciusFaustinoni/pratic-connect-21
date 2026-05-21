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
    className: 'bg-purple-600 hover:bg-purple-600 text-white',
    Icon: ArrowRight,
  },
  inclusao_veiculo: {
    label: 'Inclusão de veículo',
    className: 'bg-emerald-600 hover:bg-emerald-600 text-white',
    Icon: Car,
  },
  inclusao: {
    label: 'Inclusão de veículo',
    className: 'bg-emerald-600 hover:bg-emerald-600 text-white',
    Icon: Car,
  },
  substituicao_placa: {
    label: 'Substituição de veículo',
    className: 'bg-sky-600 hover:bg-sky-600 text-white',
    Icon: Repeat,
  },
  substituicao: {
    label: 'Substituição de veículo',
    className: 'bg-sky-600 hover:bg-sky-600 text-white',
    Icon: Repeat,
  },
  migracao: {
    label: 'Migração',
    className: 'bg-amber-600 hover:bg-amber-600 text-white',
    Icon: ArrowRightLeft,
  },
};

export function TipoEntradaBadge({ tipo, className, size = 'sm' }: TipoEntradaBadgeProps) {
  if (!tipo) return null;
  const cfg = CONFIG[tipo];
  if (!cfg) return null;
  const Icon = cfg.Icon;
  const sizeCls = size === 'md'
    ? 'text-xs px-2.5 py-0.5'
    : 'text-[10px] px-2 py-0.5';
  return (
    <Badge className={cn(cfg.className, sizeCls, 'font-bold tracking-wide w-fit border-0 rounded-full', className)}>
      <Icon className="h-2.5 w-2.5 mr-1" />
      {cfg.label}
    </Badge>
  );
}
