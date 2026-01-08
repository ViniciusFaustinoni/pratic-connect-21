import { Badge } from "@/components/ui/badge";
import type { TipoManifestacao } from "@/types/ouvidoria";
import { TIPO_MANIFESTACAO_LABELS } from "@/types/ouvidoria";
import { AlertCircle, HelpCircle, MessageSquare, ThumbsUp, AlertTriangle } from "lucide-react";

interface TipoBadgeProps {
  tipo: TipoManifestacao;
  className?: string;
  showIcon?: boolean;
}

const TIPO_COLORS: Record<TipoManifestacao, string> = {
  reclamacao: "bg-red-100 text-red-700 hover:bg-red-100",
  sugestao: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  elogio: "bg-green-100 text-green-700 hover:bg-green-100",
  denuncia: "bg-purple-100 text-purple-700 hover:bg-purple-100",
  duvida: "bg-amber-100 text-amber-700 hover:bg-amber-100",
};

const TIPO_ICONS: Record<TipoManifestacao, React.ReactNode> = {
  reclamacao: <AlertCircle className="h-3 w-3" />,
  sugestao: <MessageSquare className="h-3 w-3" />,
  elogio: <ThumbsUp className="h-3 w-3" />,
  denuncia: <AlertTriangle className="h-3 w-3" />,
  duvida: <HelpCircle className="h-3 w-3" />,
};

export function TipoBadge({ tipo, className, showIcon = true }: TipoBadgeProps) {
  return (
    <Badge className={`${TIPO_COLORS[tipo]} ${className || ""} gap-1`} variant="secondary">
      {showIcon && TIPO_ICONS[tipo]}
      {TIPO_MANIFESTACAO_LABELS[tipo]}
    </Badge>
  );
}
