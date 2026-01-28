import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Gauge } from 'lucide-react';

interface VistoriaObservacoesCardProps {
  observacoes?: string | null;
  kmAtual?: number | null;
}

export function VistoriaObservacoesCard({ observacoes, kmAtual }: VistoriaObservacoesCardProps) {
  if (!observacoes && !kmAtual) return null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-foreground text-base">
          <MessageSquare className="h-5 w-5 text-amber-500" />
          Observações do Vistoriador
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {kmAtual && (
          <div className="flex items-center gap-2 text-sm">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Hodômetro:</span>
            <span className="font-semibold">{kmAtual.toLocaleString('pt-BR')} km</span>
          </div>
        )}
        {observacoes && (
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {observacoes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
