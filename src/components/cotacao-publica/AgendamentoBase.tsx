import { useState, useMemo } from 'react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MapPin, Clock, Calendar, Check, ChevronLeft, ChevronRight, Building2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useConfiguracaoBase, useHorariosDisponiveis, useCriarAgendamentoBase } from '@/hooks/useAgendamentoBase';
import { cn } from '@/lib/utils';
import { isDomingo, isSabado } from '@/data/autovistoriaConfig';

interface AgendamentoBaseProps {
  cotacaoId: string;
  clienteNome: string;
  clienteTelefone?: string;
  clienteEmail?: string;
  veiculoPlaca?: string;
  veiculoDescricao?: string;
  onAgendado: () => void;
  onVoltar: () => void;
}

export function AgendamentoBase({
  cotacaoId,
  clienteNome,
  clienteTelefone,
  clienteEmail,
  veiculoPlaca,
  veiculoDescricao,
  onAgendado,
  onVoltar,
}: AgendamentoBaseProps) {
  const [dataSelecionada, setDataSelecionada] = useState<Date | null>(null);
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const { data: configBase, isLoading: loadingConfig } = useConfiguracaoBase();
  const { data: horarios, isLoading: loadingHorarios } = useHorariosDisponiveis(
    dataSelecionada ? format(dataSelecionada, 'yyyy-MM-dd') : ''
  );
  const criarAgendamento = useCriarAgendamentoBase();

  // Gerar próximos 7 dias úteis a partir do offset (incluindo sábados)
  const diasDisponiveis = useMemo(() => {
    const dias: Date[] = [];
    let currentDate = addDays(new Date(), 1 + weekOffset * 7); // Começa amanhã
    
    while (dias.length < 7) {
      if (!isDomingo(currentDate)) { // Só bloqueia domingo
        dias.push(currentDate);
      }
      currentDate = addDays(currentDate, 1);
    }
    
    return dias;
  }, [weekOffset]);

  // Gerar slots de horário (considerando horário reduzido no sábado)
  const slotsHorario = useMemo(() => {
    if (!configBase?.base_horario_inicio || !configBase?.base_horario_fim) {
      return [];
    }

    const slots: string[] = [];
    const [horaInicio, minInicio] = configBase.base_horario_inicio.split(':').map(Number);
    const [horaFim] = configBase.base_horario_fim.split(':').map(Number);
    
    // Se for sábado, limitar até 13:00
    const horaFimEfetiva = dataSelecionada && isSabado(dataSelecionada) 
      ? Math.min(horaFim, 13) 
      : horaFim;
    
    let hora = horaInicio;
    let minuto = minInicio;

    while (hora < horaFimEfetiva || (hora === horaFimEfetiva && minuto === 0)) {
      slots.push(`${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`);
      minuto += 30;
      if (minuto >= 60) {
        minuto = 0;
        hora += 1;
      }
    }

    return slots;
  }, [configBase, dataSelecionada]);

  // Verificar disponibilidade de cada slot
  const getDisponibilidade = (horario: string) => {
    if (!horarios) return { disponivel: true, ocupados: 0 };
    const ocupados = horarios.filter(h => h.horario === horario).length;
    const capacidade = configBase?.base_capacidade_horario || 2;
    return { disponivel: ocupados < capacidade, ocupados };
  };

  const enderecoCompleto = configBase?.base_logradouro 
    ? `${configBase.base_logradouro}${configBase.base_numero ? `, ${configBase.base_numero}` : ''} - ${configBase.base_bairro || ''} - ${configBase.base_cidade || ''}/${configBase.base_uf || ''}`
    : 'Endereço não configurado';

  const handleConfirmar = async () => {
    if (!dataSelecionada || !horarioSelecionado) return;

    await criarAgendamento.mutateAsync({
      cotacaoId,
      dataAgendada: format(dataSelecionada, 'yyyy-MM-dd'),
      horario: horarioSelecionado,
      clienteNome,
      clienteTelefone,
      clienteEmail,
      veiculoPlaca,
      veiculoDescricao,
    });

    onAgendado();
  };

  if (loadingConfig) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com endereço */}
      <Card className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200 dark:border-orange-900">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-orange-500/10 p-2">
              <Building2 className="h-5 w-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm">Base PRATIC</h3>
              <div className="flex items-start gap-1.5 mt-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{enderecoCompleto}</span>
              </div>
              {configBase?.base_horario_inicio && configBase?.base_horario_fim && (
                <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{configBase.base_horario_inicio} às {configBase.base_horario_fim}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seleção de data */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Selecione uma data
          </h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))}
              disabled={weekOffset === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setWeekOffset(weekOffset + 1)}
              disabled={weekOffset >= 3}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-2">
          {diasDisponiveis.slice(0, 5).map((dia) => {
            const isSelected = dataSelecionada && format(dataSelecionada, 'yyyy-MM-dd') === format(dia, 'yyyy-MM-dd');
            return (
                <button
                key={dia.toISOString()}
                onClick={() => {
                  setDataSelecionada(dia);
                  setHorarioSelecionado(null);
                }}
                className={cn(
                  "flex flex-col items-center p-2 rounded-lg border transition-all text-center",
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {format(dia, 'EEE', { locale: ptBR })}
                </span>
                <span className="text-lg font-semibold text-foreground">
                  {format(dia, 'd')}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {format(dia, 'MMM', { locale: ptBR })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Seleção de horário */}
      {dataSelecionada && (
        <div className="space-y-3">
          <h3 className="font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Horários disponíveis para {format(dataSelecionada, "dd 'de' MMMM", { locale: ptBR })}
          </h3>

          {loadingHorarios ? (
            <div className="grid grid-cols-4 gap-2">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : slotsHorario.length === 0 ? (
            <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                Os horários de atendimento não estão configurados. 
                Entre em contato com a central para agendar sua vistoria.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {slotsHorario.map((horario) => {
                const { disponivel, ocupados } = getDisponibilidade(horario);
                const isSelected = horarioSelecionado === horario;
                const capacidade = configBase?.base_capacidade_horario || 2;
                
                return (
                  <button
                    key={horario}
                    onClick={() => disponivel && setHorarioSelecionado(horario)}
                    disabled={!disponivel}
                    className={cn(
                      "relative px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : disponivel
                          ? "border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-muted/50"
                          : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                    )}
                  >
                    {horario}
                    {disponivel && ocupados > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white">
                        {capacidade - ocupados}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Resumo e confirmação */}
      {dataSelecionada && horarioSelecionado && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Agendamento selecionado</p>
                <p className="text-lg font-semibold">
                  {format(dataSelecionada, "dd 'de' MMMM", { locale: ptBR })} às {horarioSelecionado}
                </p>
              </div>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                <Check className="h-3 w-3 mr-1" />
                Disponível
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Botões de ação */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onVoltar} className="flex-1">
          Voltar
        </Button>
        <Button
          onClick={handleConfirmar}
          disabled={!dataSelecionada || !horarioSelecionado || criarAgendamento.isPending}
          className="flex-1"
        >
          {criarAgendamento.isPending ? 'Agendando...' : 'Confirmar Agendamento'}
        </Button>
      </div>

      <p className="text-xs text-center text-muted-foreground">
        Ao confirmar, você receberá uma notificação com os detalhes do agendamento
      </p>
    </div>
  );
}
