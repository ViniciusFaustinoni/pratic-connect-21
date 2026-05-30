import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSGASuccessRateByAction } from '@/hooks/useSGAHealthCheck';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  onSelectAction: (action: string) => void;
}

export function SGAVisaoGeralPorAction({ onSelectAction }: Props) {
  const [janela, setJanela] = useState<24 | 168>(24);
  const { data: rows = [], isLoading } = useSGASuccessRateByAction(janela);

  const fmtTaxa = (t: number | null) =>
    t === null ? '—' : `${Math.round(t * 100)}%`;

  const corBorda = (t: number | null) => {
    if (t === null) return 'border-l-muted-foreground';
    if (t < 0.85) return 'border-l-destructive';
    if (t < 0.95) return 'border-l-yellow-500';
    return 'border-l-green-500';
  };

  const icone = (t: number | null) => {
    if (t === null) return <Clock className="h-5 w-5 text-muted-foreground" />;
    if (t < 0.85) return <AlertTriangle className="h-5 w-5 text-destructive" />;
    if (t < 0.95) return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  };

  const fmtRel = (d: string | null) => {
    if (!d) return null;
    try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: ptBR }); } catch { return null; }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Taxa de sucesso por tipo de operação. Registros marcados como <code>skipped</code> são ignorados.
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={janela === 24 ? 'default' : 'outline'}
            onClick={() => setJanela(24)}
          >24h</Button>
          <Button
            size="sm"
            variant={janela === 168 ? 'default' : 'outline'}
            onClick={() => setJanela(168)}
          >7 dias</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma operação SGA registrada na janela selecionada.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((r) => (
            <Card
              key={r.action}
              className={cn('border-l-4 cursor-pointer hover:bg-muted/30 transition-colors', corBorda(r.taxa_sucesso))}
              onClick={() => onSelectAction(r.action)}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {icone(r.taxa_sucesso)}
                    <p className="text-sm font-semibold truncate" title={r.action}>{r.action}</p>
                  </div>
                  <Badge variant="outline" className="text-xs whitespace-nowrap">
                    {fmtTaxa(r.taxa_sucesso)}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{Number(r.total).toLocaleString('pt-BR')} ops</span>
                  {Number(r.falha) > 0 && (
                    <span className="text-destructive">{Number(r.falha)} falha{Number(r.falha) > 1 ? 's' : ''}</span>
                  )}
                  {r.duracao_media_ms !== null && (
                    <span>{Math.round(Number(r.duracao_media_ms))}ms méd.</span>
                  )}
                </div>
                {r.ultimo_erro && (
                  <p className="text-xs text-muted-foreground line-clamp-2" title={r.ultimo_erro}>
                    <span className="font-medium">Último erro</span>
                    {fmtRel(r.ultimo_erro_em) ? ` (${fmtRel(r.ultimo_erro_em)})` : ''}: {r.ultimo_erro}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
