import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, Eye, ShieldAlert, ShieldCheck } from "lucide-react";

type StatusMonitoramento = "normal" | "sob_observacao" | "suspenso" | null | undefined;

interface VendedorRiskBadgeProps {
  status: StatusMonitoramento;
  scoreRisco?: number | null;
  compact?: boolean;
  showScore?: boolean;
}

export function VendedorRiskBadge({
  status,
  scoreRisco,
  compact = false,
  showScore = false,
}: VendedorRiskBadgeProps) {
  const config = getStatusConfig(status, scoreRisco);

  if (!status || status === "normal") {
    if (!showScore || !scoreRisco) return null;
  }

  const badge = (
    <Badge
      variant="outline"
      className={`${config.className} ${compact ? "px-1.5 py-0.5" : "px-2 py-1"} gap-1`}
    >
      {config.icon}
      {!compact && <span>{config.label}</span>}
      {showScore && scoreRisco !== null && scoreRisco !== undefined && (
        <span className="font-bold">({scoreRisco})</span>
      )}
    </Badge>
  );

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">{config.label}</p>
            {scoreRisco !== null && scoreRisco !== undefined && (
              <p className="text-xs text-muted-foreground">Score de risco: {scoreRisco}</p>
            )}
            <p className="text-xs">{config.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

function getStatusConfig(status: StatusMonitoramento, scoreRisco?: number | null) {
  switch (status) {
    case "suspenso":
      return {
        label: "Suspenso",
        icon: <ShieldAlert className="h-3.5 w-3.5" />,
        className: "border-destructive text-destructive bg-destructive/10",
        description: "Vendedor suspenso por atividade suspeita confirmada",
      };
    case "sob_observacao":
      return {
        label: "Em Observação",
        icon: <Eye className="h-3.5 w-3.5" />,
        className: "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-900/20",
        description: "Vendedor em monitoramento por padrões suspeitos",
      };
    case "normal":
    default:
      if (scoreRisco && scoreRisco > 0) {
        return {
          label: "Monitorado",
          icon: <AlertTriangle className="h-3.5 w-3.5" />,
          className: "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20",
          description: "Vendedor com alguns alertas registrados",
        };
      }
      return {
        label: "Normal",
        icon: <ShieldCheck className="h-3.5 w-3.5" />,
        className: "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
        description: "Nenhum padrão suspeito identificado",
      };
  }
}

// Componente para exibir score de risco com cores
export function RiskScoreIndicator({ score }: { score: number }) {
  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-destructive bg-destructive/10";
    if (score >= 50) return "text-amber-600 bg-amber-50 dark:bg-amber-900/20";
    if (score >= 30) return "text-orange-600 bg-orange-50 dark:bg-orange-900/20";
    return "text-blue-600 bg-blue-50 dark:bg-blue-900/20";
  };

  return (
    <div
      className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm ${getScoreColor(
        score
      )}`}
    >
      {score}
    </div>
  );
}
