import { useState } from 'react';
import { format, addDays, isWeekend, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Clock, ArrowLeft, Loader2, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { HORARIOS_DISPONIVEIS } from '@/data/autovistoriaConfig';
import { useCriarVistoriaAgendada } from '@/hooks/useContratoLink';

interface AgendarVistoriaProps {
  contratoId: string;
  associadoId: string;
  veiculoId?: string;
  readOnly?: boolean;
  onAgendar: (data: string, horario: string, vistoriaId: string) => void;
  onVoltar: () => void;
}

export function AgendarVistoria({ contratoId, associadoId, veiculoId, readOnly, onAgendar, onVoltar }: AgendarVistoriaProps) {
  const [dataSelecionada, setDataSelecionada] = useState<Date | undefined>();
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null);
  const criarVistoria = useCriarVistoriaAgendada();

  // Desabilitar datas passadas e fins de semana
  const isDateDisabled = (date: Date) => {
    const today = startOfDay(new Date());
    const minDate = addDays(today, 1); // Mínimo: amanhã
    return isBefore(date, minDate) || isWeekend(date);
  };

  const handleConfirmar = async () => {
    if (!dataSelecionada || !horarioSelecionado) return;
    
    const dataFormatada = format(dataSelecionada, 'yyyy-MM-dd');
    
    const result = await criarVistoria.mutateAsync({
      contratoId,
      associadoId,
      veiculoId,
      dataAgendada: dataFormatada,
      horarioAgendado: horarioSelecionado,
    });
    
    onAgendar(dataFormatada, horarioSelecionado, result.id);
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

        {/* Horários */}
        {dataSelecionada && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Selecione um horário para {format(dataSelecionada, "dd 'de' MMMM", { locale: ptBR })}
            </h4>
            <div className="grid grid-cols-4 gap-2">
              {HORARIOS_DISPONIVEIS.map((horario) => (
                <Button
                  key={horario}
                  variant={horarioSelecionado === horario ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => !readOnly && setHorarioSelecionado(horario)}
                  className="w-full"
                  disabled={readOnly}
                >
                  {horario}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Resumo e Confirmação */}
        {dataSelecionada && horarioSelecionado && (
          <div className="space-y-4 pt-4 border-t">
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Vistoria agendada para:</p>
              <p className="font-semibold">
                {format(dataSelecionada, "EEEE, dd 'de' MMMM", { locale: ptBR })} às {horarioSelecionado}
              </p>
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
