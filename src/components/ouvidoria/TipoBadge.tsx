import { Badge } from "@/components/ui/badge";
import type { TipoManifestacao } from "@/types/ouvidoria";
import { TIPO_MANIFESTACAO_LABELS } from "@/types/ouvidoria";
import { AlertCircle, Lightbulb, ThumbsUp, AlertTriangle, Shield, FileText } from "lucide-react";

interface TipoBadgeProps {
  tipo: TipoManifestacao;
  className?: string;
  showIcon?: boolean;
}

const TIPO_COLORS: Record<TipoManifestacao, string> = {
  reclamacao: "bg-orange-100 text-orange-700 hover:bg-orange-100",
  reclamacao_urgente: "bg-red-100 text-red-700 hover:bg-red-100",
  sugestao: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
  elogio: "bg-green-100 text-green-700 hover:bg-green-100",
  denuncia: "bg-purple-100 text-purple-700 hover:bg-purple-100",
  solicitacao: "bg-blue-100 text-blue-700 hover:bg-blue-100",
};

const TIPO_ICONS: Record<TipoManifestacao, React.ReactNode> = {
  reclamacao: <AlertCircle className="h-3 w-3" />,
  reclamacao_urgente: <AlertTriangle className="h-3 w-3" />,
  sugestao: <Lightbulb className="h-3 w-3" />,
  elogio: <ThumbsUp className="h-3 w-3" />,
  denuncia: <Shield className="h-3 w-3" />,
  solicitacao: <FileText className="h-3 w-3" />,
};

export function TipoBadge({ tipo, className, showIcon = true }: TipoBadgeProps) {
  return (
    <Badge className={`${TIPO_COLORS[tipo] || "bg-gray-100 text-gray-700"} ${className || ""} gap-1`} variant="secondary">
      {showIcon && TIPO_ICONS[tipo]}
      {TIPO_MANIFESTACAO_LABELS[tipo] || tipo}
    </Badge>
  );
}
