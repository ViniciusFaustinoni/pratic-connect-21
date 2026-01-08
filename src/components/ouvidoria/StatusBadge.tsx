import { Badge } from "@/components/ui/badge";
import type { StatusManifestacao } from "@/types/ouvidoria";
import { STATUS_LABELS } from "@/types/ouvidoria";

interface StatusBadgeProps {
  status: StatusManifestacao;
  className?: string;
}

const STATUS_COLORS: Record<StatusManifestacao, string> = {
  aberto: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  em_analise: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  aguardando_resposta: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  respondido: "bg-green-100 text-green-800 hover:bg-green-100",
  encerrado: "bg-gray-100 text-gray-800 hover:bg-gray-100",
  reaberto: "bg-purple-100 text-purple-800 hover:bg-purple-100",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge className={`${STATUS_COLORS[status]} ${className || ""}`} variant="secondary">
      {STATUS_LABELS[status]}
    </Badge>
  );
}
