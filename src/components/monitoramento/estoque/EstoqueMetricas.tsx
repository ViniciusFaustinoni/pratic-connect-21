import { useRastreadoresMetricas } from "@/hooks/useRastreadores";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Package, CheckCircle, Wrench, XCircle, AlertTriangle } from "lucide-react";

// Limite mínimo de estoque para alertas
const ESTOQUE_MINIMO = 10;

export function EstoqueMetricas() {
  const { data: metricas, isLoading } = useRastreadoresMetricas();

  const estoqueAtual = metricas?.estoque ?? 0;
  const estoqueBaixo = estoqueAtual < ESTOQUE_MINIMO;

  const cards = [
    {
      key: "estoque" as const,
      titulo: "Em Estoque",
      subtitulo: "Disponíveis para instalação",
      icone: Package,
      cor: estoqueBaixo ? "text-orange-600" : "text-blue-600",
      bg: estoqueBaixo ? "bg-orange-100" : "bg-blue-100",
      alerta: estoqueBaixo,
    },
    {
      key: "instalados" as const,
      titulo: "Instalados",
      subtitulo: "Em operação",
      icone: CheckCircle,
      cor: "text-green-600",
      bg: "bg-green-100",
      alerta: false,
    },
    {
      key: "manutencao" as const,
      titulo: "Em Manutenção",
      subtitulo: "Aguardando reparo",
      icone: Wrench,
      cor: "text-yellow-600",
      bg: "bg-yellow-100",
      alerta: false,
    },
    {
      key: "baixados" as const,
      titulo: "Baixados",
      subtitulo: "Descartados",
      icone: XCircle,
      cor: "text-red-600",
      bg: "bg-red-100",
      alerta: false,
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => {
        const Icone = card.icone;
        const valor = metricas?.[card.key] ?? 0;

        return (
          <Card 
            key={card.key} 
            className={`hover:shadow-md transition-shadow ${
              card.alerta ? 'border-orange-500 border-2' : ''
            }`}
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${card.bg}`}>
                  <Icone className={`h-6 w-6 ${card.cor}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold">{valor}</p>
                    {card.alerta && (
                      <Badge variant="destructive" className="bg-orange-500 text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Baixo
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium">{card.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {card.alerta 
                      ? `Mínimo recomendado: ${ESTOQUE_MINIMO}` 
                      : card.subtitulo
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
