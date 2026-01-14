import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, RefreshCw, CheckCircle, XCircle, Car, User, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Vistoria, VistoriaStatus } from '@/hooks/useVistorias';

interface VistoriaListItemProps {
  vistoria: Vistoria;
  onClick: () => void;
}

const STATUS_CONFIG: Record<VistoriaStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  pendente: {
    label: 'Pendente',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    icon: Clock,
  },
  agendada: {
    label: 'Agendada',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    icon: Clock,
  },
  em_analise: {
    label: 'Em Andamento',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    icon: RefreshCw,
  },
  aprovada: {
    label: 'Concluída',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    icon: CheckCircle,
  },
  reprovada: {
    label: 'Reprovada',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    icon: XCircle,
  },
};

const BORDER_COLORS: Record<VistoriaStatus, string> = {
  pendente: 'border-l-amber-500',
  agendada: 'border-l-amber-500',
  em_analise: 'border-l-blue-500',
  aprovada: 'border-l-emerald-500',
  reprovada: 'border-l-red-500',
};

export function VistoriaListItem({ vistoria, onClick }: VistoriaListItemProps) {
  const status = vistoria.status as VistoriaStatus;
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  // Prioridade para placa: veículo vinculado > primeiro veículo do associado > "SEM PLACA"
  const placa = vistoria.veiculo?.placa 
    || vistoria.associado?.veiculos?.[0]?.placa 
    || 'SEM PLACA';

  // Prioridade para nome: associado do veículo > associado direto > fallback
  const nomeAssociado = vistoria.veiculo?.associado?.nome 
    || vistoria.associado?.nome 
    || 'Cliente não identificado';

  // Marca e modelo do veículo
  const marcaModelo = vistoria.veiculo?.marca && vistoria.veiculo?.modelo
    ? `${vistoria.veiculo.marca} ${vistoria.veiculo.modelo}`
    : vistoria.associado?.veiculos?.[0]?.marca && vistoria.associado?.veiculos?.[0]?.modelo
      ? `${vistoria.associado.veiculos[0].marca} ${vistoria.associado.veiculos[0].modelo}`
      : '';

  return (
    <div
      className={cn(
        "flex items-center justify-between p-4 bg-card rounded-lg border-l-4 shadow-sm hover:shadow-md transition-all cursor-pointer",
        BORDER_COLORS[status]
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-4 flex-1">
        {/* Placa */}
        <div className="flex items-center gap-2 min-w-[120px]">
          <Car className="h-5 w-5 text-muted-foreground" />
          <span className="font-mono font-semibold text-lg">
            {placa}
          </span>
        </div>

        {/* Cliente */}
        <div className="flex items-center gap-2 flex-1">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm truncate">
            {nomeAssociado}
          </span>
        </div>

        {/* Veículo */}
        <div className="hidden md:block text-sm text-muted-foreground min-w-[150px]">
          {marcaModelo}
        </div>

        {/* Data */}
        <div className="hidden sm:block text-sm text-muted-foreground min-w-[140px]">
          {format(new Date(vistoria.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </div>

        {/* Status */}
        <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full", config.bgColor)}>
          <StatusIcon className={cn("h-4 w-4", config.color)} />
          <span className={cn("text-sm font-medium", config.color)}>
            {config.label}
          </span>
        </div>
      </div>

      {/* Ação */}
      <Button variant="ghost" size="sm" className="ml-4">
        <Eye className="h-4 w-4" />
      </Button>
    </div>
  );
}
