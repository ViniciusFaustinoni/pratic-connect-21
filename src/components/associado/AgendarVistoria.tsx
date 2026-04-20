import { useState } from 'react';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock, ArrowLeft, Loader2, Lock, Sun, Sunset } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { isDomingo, isSabado } from '@/data/autovistoriaConfig';
import { useCriarVistoriaAgendada } from '@/hooks/useContratoLink';
import { useDatasBloqueadasSet } from '@/hooks/useDatasBloqueadas';
import { useVagasPeriodo, temVagasDisponiveis } from '@/hooks/useVagasPeriodo';
import { PERIODO_LABEL, PERIODO_FAIXA } from '@/lib/periodo-utils';
import { cn } from '@/lib/utils';

type PeriodoSel = 'manha' | 'tarde';

interface AgendarVistoriaProps {
  contratoId: string;
  associadoId: string;
  veiculoId?: string;
  readOnly?: boolean;
  onAgendar: (data: string, periodo: PeriodoSel, vistoriaId: string) => void;
  onVoltar: () => void;
}

export function AgendarVistoria({ contratoId, associadoId, veiculoId, readOnly, onAgendar, onVoltar }: AgendarVistoriaProps) {
  const [dataSelecionada, setDataSelecionada] = useState<Date | undefined>();
  const [periodoSelecionado, setPeriodoSelecionado] = useState<PeriodoSel | null>(null);
  const criarVistoria = useCriarVistoriaAgendada();
  const { set: datasBloqueadasSet } = useDatasBloqueadasSet();
  const { data: vagas } = useVagasPeriodo(dataSelecionada ? format(dataSelecionada, 'yyyy-MM-dd') : null);

  const isDateDisabled = (date: Date) => {
    const today = startOfDay(new Date());
    const minDate = addDays(today, 1);
    if (isBefore(date, minDate) || isDomingo(date)) return true;
    return datasBloqueadasSet.has(format(date, 'yyyy-MM-dd'));
  };

  // Períodos disponíveis (sábado: só manhã)
  const periodos: PeriodoSel[] = dataSelecionada && isSabado(dataSelecionada) ? ['manha'] : ['manha', 'tarde'];

  const handleConfirmar = async () => {
    if (!dataSelecionada || !periodoSelecionado) return;
    const dataFormatada = format(dataSelecionada, 'yyyy-MM-dd');
    const result = await criarVistoria.mutateAsync({
      contratoId,
      associadoId,
      veiculoId,
      dataAgendada: dataFormatada,
      periodo: periodoSelecionado,
    });
    onAgendar(dataFormatada, periodoSelecionado, result.id);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onVoltar}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Agendar Vistoria
            </CardTitle>
            <CardDescription>
              Selecione uma data e horário disponíveis
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Alerta de Modo Somente Leitura */}
        {readOnly && (
          <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900">
            <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-700 dark:text-blue-300">
              O agendamento não pode ser alterado neste momento.
            </AlertDescription>
          </Alert>
        )}

        {/* Calendário */}
        <div className="flex justify-center">
          <Calendar
            mode="single"
            selected={dataSelecionada}
            onSelect={readOnly ? undefined : setDataSelecionada}
            disabled={readOnly ? () => true : isDateDisabled}
            locale={ptBR}
            className={`rounded-md border ${readOnly ? 'opacity-60 pointer-events-none' : ''}`}
          />
        </div>

        {/* Períodos */}
        {dataSelecionada && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Selecione um período para {format(dataSelecionada, "dd 'de' MMMM", { locale: ptBR })}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {periodos.map((p) => {
                const Icone = p === 'manha' ? Sun : Sunset;
                const temVagas = temVagasDisponiveis(vagas, p);
                const restantes = vagas ? vagas[p] : null;
                const isSelected = periodoSelecionado === p;
                const desabilitado = readOnly || !temVagas;
                return (
                  <button
                    key={p}
                    onClick={() => !desabilitado && setPeriodoSelecionado(p)}
                    disabled={desabilitado}
                    className={cn(
                      "flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all text-left",
                      isSelected
                        ? "bg-primary/5 border-primary ring-2 ring-primary/20"
                        : desabilitado
                          ? "bg-muted text-muted-foreground cursor-not-allowed opacity-60 border-border"
                          : "border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn("rounded-md p-2", isSelected ? "bg-primary text-primary-foreground" : "bg-muted")}>
                        <Icone className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{PERIODO_LABEL[p]}</p>
                        <p className="text-xs text-muted-foreground">{PERIODO_FAIXA[p]}</p>
                      </div>
                    </div>
                    {restantes !== null && (
                      <Badge variant="outline" className={temVagas ? "bg-success/10 text-success border-success/30" : "text-destructive border-destructive/40"}>
                        {temVagas ? `${restantes} ${restantes === 1 ? 'vaga' : 'vagas'}` : 'Lotado'}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Resumo e Confirmação */}
        {dataSelecionada && periodoSelecionado && (
          <div className="space-y-4 pt-4 border-t">
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Vistoria agendada para:</p>
              <p className="font-semibold">
                {format(dataSelecionada, "EEEE, dd 'de' MMMM", { locale: ptBR })} — {PERIODO_LABEL[periodoSelecionado]}
              </p>
              <p className="text-xs text-muted-foreground">{PERIODO_FAIXA[periodoSelecionado]}</p>
            </div>
            
            {!readOnly && (
              <>
                <p className="text-sm text-muted-foreground text-center">
                  Para confirmar o agendamento, você precisará realizar o pagamento da taxa de filiação.
                </p>
                
                <Button 
                  onClick={handleConfirmar}
                  disabled={criarVistoria.isPending}
                  className="w-full"
                  size="lg"
                >
                  {criarVistoria.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Confirmar e Pagar Filiação
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
