import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, User, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import { PrioridadeBadge } from "./PrioridadeBadge";
import { TipoBadge } from "./TipoBadge";
import type { ManifestacaoWithRelations } from "@/types/ouvidoria";
import { useNavigate } from "react-router-dom";

interface ManifestacaoCardProps {
  manifestacao: ManifestacaoWithRelations;
}

export function ManifestacaoCard({ manifestacao }: ManifestacaoCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/ouvidoria/manifestacoes/${manifestacao.id}`);
  };

  // Calcular se está em risco de SLA
  const horasDesdeAbertura =
    (new Date().getTime() - new Date(manifestacao.created_at).getTime()) / (1000 * 60 * 60);
  const slaEmRisco = horasDesdeAbertura >= 20 && !manifestacao.data_primeira_resposta;

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        slaEmRisco ? "border-red-300 bg-red-50/50" : ""
      }`}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Header com protocolo e badges */}
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="font-mono text-sm font-semibold text-primary">
                {manifestacao.protocolo}
              </span>
              <TipoBadge tipo={manifestacao.tipo} />
              <StatusBadge status={manifestacao.status} />
              <PrioridadeBadge prioridade={manifestacao.prioridade} />
              {slaEmRisco && (
                <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded font-medium">
                  SLA em risco!
                </span>
              )}
            </div>

            {/* Assunto */}
            <h3 className="font-medium text-foreground truncate mb-2">{manifestacao.assunto}</h3>

            {/* Meta info */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                <span className="truncate max-w-[150px]">
                  {manifestacao.anonimo ? "Anônimo" : manifestacao.associado?.nome || "Não identificado"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {format(new Date(manifestacao.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </span>
              </div>
              {manifestacao.responsavel && (
                <div className="flex items-center gap-1">
                  <span className="text-xs">Responsável:</span>
                  <span className="font-medium">{manifestacao.responsavel.nome}</span>
                </div>
              )}
            </div>
          </div>

          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
