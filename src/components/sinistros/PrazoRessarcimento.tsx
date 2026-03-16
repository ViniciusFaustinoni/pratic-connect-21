import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Clock, Pause, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

/** Conta dias úteis (seg-sex) entre duas datas */
function calcularDiasUteis(inicio: Date, fim: Date): number {
  let count = 0;
  const current = new Date(inicio);
  current.setHours(0, 0, 0, 0);
  const end = new Date(fim);
  end.setHours(0, 0, 0, 0);
  while (current < end) {
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

interface PrazoRessarcimentoProps {
  sinistroId: string;
  dataInicio: string;
  prazoSuspenso?: boolean;
  prazoSuspensoEm?: string | null;
  motivoSuspensao?: string | null;
  prazoTotal?: number;
}

export function PrazoRessarcimento({ sinistroId, dataInicio, prazoSuspenso, prazoSuspensoEm, motivoSuspensao }: PrazoRessarcimentoProps) {
  const { data: suspensoes = [] } = useQuery({
    queryKey: ['suspensoes-prazo', sinistroId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistro_suspensoes_prazo')
        .select('*')
        .eq('sinistro_id', sinistroId)
        .order('inicio', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!sinistroId,
  });

  const inicio = new Date(dataInicio);
  const hoje = new Date();

  // Calcular dias úteis totais desde início até hoje
  const diasUteisTotais = calcularDiasUteis(inicio, hoje);

  // Calcular dias úteis suspensos
  let diasUteisSuspensos = 0;
  for (const s of suspensoes) {
    const sInicio = new Date(s.inicio);
    const sFim = s.fim ? new Date(s.fim) : hoje;
    diasUteisSuspensos += calcularDiasUteis(sInicio, sFim);
  }

  const diasUteisConsumidos = Math.max(0, diasUteisTotais - diasUteisSuspensos);
  const percentual = Math.min(100, Math.round((diasUteisConsumidos / PRAZO_TOTAL) * 100));

  const isVencido = diasUteisConsumidos >= PRAZO_TOTAL;
  const isProximo = diasUteisConsumidos > 55;

  return (
    <Card className={isVencido ? 'border-destructive/50' : isProximo ? 'border-amber-400/50' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-5 w-5" />
          Prazo de Ressarcimento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span>{diasUteisConsumidos} de {PRAZO_TOTAL} dias úteis</span>
          {prazoSuspenso ? (
            <Badge className="bg-amber-100 text-amber-800">
              <Pause className="h-3 w-3 mr-1" /> Suspenso
            </Badge>
          ) : isVencido ? (
            <Badge variant="destructive">
              <AlertTriangle className="h-3 w-3 mr-1" /> VENCIDO
            </Badge>
          ) : isProximo ? (
            <Badge className="bg-amber-100 text-amber-800">
              <AlertTriangle className="h-3 w-3 mr-1" /> Próximo do vencimento
            </Badge>
          ) : (
            <Badge className="bg-green-100 text-green-800">Em contagem</Badge>
          )}
        </div>

        <Progress
          value={percentual}
          className="h-2"
          indicatorClassName={isVencido ? 'bg-destructive' : isProximo ? 'bg-amber-500' : 'bg-primary'}
        />

        {prazoSuspenso && prazoSuspensoEm && (
          <p className="text-xs text-muted-foreground">
            Suspenso desde {format(new Date(prazoSuspensoEm), 'dd/MM/yyyy')}
            {motivoSuspensao && ` (${motivoSuspensao})`}
          </p>
        )}

        {suspensoes.length > 0 && (
          <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t">
            <span className="font-medium">Suspensões registradas:</span>
            {suspensoes.map((s: any) => (
              <div key={s.id} className="flex justify-between">
                <span>{s.motivo}</span>
                <span>
                  {format(new Date(s.inicio), 'dd/MM')}
                  {s.fim ? ` — ${format(new Date(s.fim), 'dd/MM')}` : ' — em aberto'}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
