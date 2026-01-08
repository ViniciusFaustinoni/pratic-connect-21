import { Badge } from "@/components/ui/badge";
import type { PrioridadeManifestacao } from "@/types/ouvidoria";
import { PRIORIDADE_LABELS } from "@/types/ouvidoria";
import { AlertTriangle, ArrowDown, ArrowUp, Flame } from "lucide-react";

interface PrioridadeBadgeProps {
  prioridade: PrioridadeManifestacao;
  className?: string;
  showIcon?: boolean;
}

const PRIORIDADE_COLORS: Record<PrioridadeManifestacao, string> = {
  baixa: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  normal: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  alta: "bg-orange-100 text-orange-700 hover:bg-orange-100",
  urgente: "bg-red-100 text-red-700 hover:bg-red-100",
};

const PRIORIDADE_ICONS: Record<PrioridadeManifestacao, React.ReactNode> = {
  baixa: <ArrowDown className="h-3 w-3" />,
  normal: null,
  alta: <ArrowUp className="h-3 w-3" />,
  urgente: <Flame className="h-3 w-3" />,
};

export function PrioridadeBadge({ prioridade, className, showIcon = true }: PrioridadeBadgeProps) {
  return (
    <Badge className={`${PRIORIDADE_COLORS[prioridade]} ${className || ""} gap-1`} variant="secondary">
      {showIcon && PRIORIDADE_ICONS[prioridade]}
      {PRIORIDADE_LABELS[prioridade]}
    </Badge>
  );
}
