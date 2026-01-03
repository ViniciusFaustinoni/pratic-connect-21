import { useState } from 'react';
import { format, addWeeks, subWeeks, startOfWeek, addDays, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Route, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useRotasSemana, STATUS_ROTA_COLORS, type StatusRota } from '@/hooks/useRotas';

interface RotaCalendarioProps {
  onRotaClick: (rotaId: string) => void;
  onDayClick?: (data: Date) => void;
}

export function RotaCalendario({ onRotaClick, onDayClick }: RotaCalendarioProps) {
  const [dataAtual, setDataAtual] = useState(new Date());
  const inicioSemana = startOfWeek(dataAtual, { weekStartsOn: 1 });
  
  const { data: rotasPorDia, isLoading } = useRotasSemana(dataAtual);

  const diasSemana = Array.from({ length: 7 }, (_, i) => addDays(inicioSemana, i));

  const semanaAnterior = () => setDataAtual(subWeeks(dataAtual, 1));
  const proximaSemana = () => setDataAtual(addWeeks(dataAtual, 1));
  const irParaHoje = () => setDataAtual(new Date());

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">Calendário de Rotas</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={irParaHoje}>
              Hoje
            </Button>
            <Button variant="outline" size="icon" onClick={semanaAnterior}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[200px] text-center text-sm font-medium">
              {format(diasSemana[0], "dd 'de' MMM", { locale: ptBR })} - {format(diasSemana[6], "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
            </span>
            <Button variant="outline" size="icon" onClick={proximaSemana}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {diasSemana.map((dia) => {
              const diaKey = format(dia, 'yyyy-MM-dd');
              const rotasDoDia = rotasPorDia?.[diaKey] || [];
              const ehHoje = isToday(dia);
              const ehFimDeSemana = dia.getDay() === 0 || dia.getDay() === 6;

              return (
                <div
                  key={diaKey}
                  className={cn(
                    'min-h-[180px] rounded-lg border p-2 transition-colors',
                    ehHoje && 'border-primary bg-primary/5',
                    ehFimDeSemana && 'bg-muted/30',
                    'hover:bg-muted/50 cursor-pointer'
                  )}
                  onClick={() => onDayClick?.(dia)}
                >
                  <div className="mb-2 text-center">
                    <p className={cn(
                      'text-xs font-medium uppercase',
                      ehHoje ? 'text-primary' : 'text-muted-foreground'
                    )}>
                      {format(dia, 'EEE', { locale: ptBR })}
                    </p>
                    <p className={cn(
                      'text-lg font-semibold',
                      ehHoje && 'text-primary'
                    )}>
                      {format(dia, 'd')}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    {rotasDoDia.slice(0, 3).map((rota) => {
                      const progresso = rota.total_servicos > 0 
                        ? Math.round((rota.total_concluidos / rota.total_servicos) * 100)
                        : 0;

                      return (
                        <div
                          key={rota.id}
                          className="cursor-pointer rounded border bg-card p-1.5 transition-shadow hover:shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRotaClick(rota.id);
                          }}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <p className="truncate text-xs font-medium">
                              {rota.instalador?.nome || 'Sem instalador'}
                            </p>
                            <Badge 
                              variant="outline" 
                              className={cn('h-4 px-1 text-[10px]', STATUS_ROTA_COLORS[rota.status as StatusRota])}
                            >
                              {rota.total_servicos}
                            </Badge>
                          </div>
                          <div className="mt-1 flex items-center gap-1">
                            <Progress value={progresso} className="h-1 flex-1" />
                            <span className="text-[10px] text-muted-foreground">{progresso}%</span>
                          </div>
                        </div>
                      );
                    })}

                    {rotasDoDia.length > 3 && (
                      <p className="text-center text-xs text-muted-foreground">
                        +{rotasDoDia.length - 3} rotas
                      </p>
                    )}

                    {rotasDoDia.length === 0 && !ehFimDeSemana && (
                      <div className="flex h-16 items-center justify-center">
                        <Route className="h-5 w-5 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
