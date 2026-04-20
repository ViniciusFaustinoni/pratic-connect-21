import { useState, useMemo } from 'react';
import { format, addDays, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MapPin, Clock, Calendar, Check, ChevronLeft, ChevronRight, Building2, AlertTriangle, Sun, Sunset } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useConfiguracaoBase, useHorariosDisponiveis, useCriarAgendamentoBase } from '@/hooks/useAgendamentoBase';
import { useOficina } from '@/hooks/useOficinas';
import { cn } from '@/lib/utils';
import { isDomingo, isSabado } from '@/data/autovistoriaConfig';
import { useDatasBloqueadasSet } from '@/hooks/useDatasBloqueadas';
import { normalizePeriodo, PERIODO_LABEL, PERIODO_FAIXA, type PeriodoCanonico } from '@/lib/periodo-utils';

interface AgendamentoBaseProps {
  cotacaoId: string;
  oficinaId: string;
  clienteNome: string;
  clienteTelefone?: string;
  clienteEmail?: string;
  veiculoPlaca?: string;
  veiculoDescricao?: string;
  onAgendado: () => void;
  onVoltar: () => void;
}

type PeriodoBase = 'manha' | 'tarde';

export function AgendamentoBase({
  cotacaoId,
  oficinaId,
  clienteNome,
  clienteTelefone,
  clienteEmail,
  veiculoPlaca,
  veiculoDescricao,
  onAgendado,
  onVoltar,
}: AgendamentoBaseProps) {
  const [dataSelecionada, setDataSelecionada] = useState<Date | null>(null);
  const [periodoSelecionado, setPeriodoSelecionado] = useState<PeriodoBase | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const { data: configBase, isLoading: loadingConfig } = useConfiguracaoBase();
  const { data: oficina, isLoading: loadingOficina } = useOficina(oficinaId);
  const { data: agendamentos } = useHorariosDisponiveis(
    dataSelecionada ? format(dataSelecionada, 'yyyy-MM-dd') : '',
    oficinaId
  );
  const criarAgendamento = useCriarAgendamentoBase();
  const { set: datasBloqueadasSet } = useDatasBloqueadasSet();

  // Capacidade total por período = capacidade_horario × nº slots de 30min naquele período
  const capacidadePorPeriodo = useMemo(() => {
    const capHora = configBase?.base_capacidade_horario || 2;
    // 4 slots por hora-período aproximado (08-12 = 8 slots de 30min, 13-18 = 10 slots)
    // Para evitar over-booking, mantemos uma capacidade conservadora baseada em horas:
    // Manhã: 4h * cap = 4*cap;  Tarde: 5h * cap = 5*cap
    return {
      manha: 4 * capHora,
      tarde: 5 * capHora,
    };
  }, [configBase]);

  // Próximos 7 dias úteis (pula domingos e datas bloqueadas)
  const diasDisponiveis = useMemo(() => {
    const dias: Date[] = [];
    let currentDate = addDays(new Date(), weekOffset * 7);
    let guard = 0;
    while (dias.length < 7 && guard < 60) {
      if (!isDomingo(currentDate) && !datasBloqueadasSet.has(format(currentDate, 'yyyy-MM-dd'))) {
        dias.push(currentDate);
      }
      currentDate = addDays(currentDate, 1);
      guard++;
    }
    return dias;
  }, [weekOffset, datasBloqueadasSet]);

  // Períodos disponíveis para o dia selecionado
  const periodosDisponiveis = useMemo<PeriodoBase[]>(() => {
    if (!dataSelecionada) return [];
    // Sábado: só manhã
    if (isSabado(dataSelecionada)) return ['manha'];
    return ['manha', 'tarde'];
  }, [dataSelecionada]);

  // Contagem de ocupação por período (considera valores canônicos e legado HH:MM)
  const ocupacao = useMemo<Record<PeriodoBase, number>>(() => {
    const acc: Record<PeriodoBase, number> = { manha: 0, tarde: 0 };
    (agendamentos || []).forEach((a: any) => {
      const p = normalizePeriodo(a.horario) as PeriodoCanonico;
      if (p === 'manha') acc.manha++;
      else if (p === 'tarde') acc.tarde++;
    });
    return acc;
  }, [agendamentos]);

  // Se for hoje, esconder períodos cujo horário inicial já passou
  const periodoExpirado = (p: PeriodoBase): boolean => {
    if (!dataSelecionada || !isToday(dataSelecionada)) return false;
    const agora = new Date();
    const minAtual = agora.getHours() * 60 + agora.getMinutes();
    // Janela de aceite até 30 min antes do início
    const inicio = p === 'manha' ? 8 * 60 : 13 * 60;
    const fim = p === 'manha' ? 12 * 60 : 18 * 60;
    // expira quando passamos do FIM do período
    return minAtual + 30 >= fim || minAtual >= inicio + (fim - inicio);
  };

  const nomeBase = oficina?.nome_fantasia || oficina?.razao_social || 'Base PRATIC';
  const enderecoCompleto = oficina?.logradouro
    ? `${oficina.logradouro}${oficina.numero ? `, ${oficina.numero}` : ''} - ${oficina.bairro || ''} - ${oficina.cidade || ''}/${oficina.estado || ''}`
    : configBase?.base_logradouro
      ? `${configBase.base_logradouro}${configBase.base_numero ? `, ${configBase.base_numero}` : ''} - ${configBase.base_bairro || ''} - ${configBase.base_cidade || ''}/${configBase.base_uf || ''}`
      : 'Endereço não configurado';

  const handleConfirmar = async () => {
    if (!dataSelecionada || !periodoSelecionado) return;

    await criarAgendamento.mutateAsync({
      cotacaoId,
      dataAgendada: format(dataSelecionada, 'yyyy-MM-dd'),
      horario: periodoSelecionado, // grava 'manha' | 'tarde'
      clienteNome,
      clienteTelefone,
      clienteEmail,
      veiculoPlaca,
      veiculoDescricao,
      oficinaId,
    });

    onAgendado();
  };

  if (loadingConfig || loadingOficina) {
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
              <h3 className="font-semibold text-sm">{nomeBase}</h3>
              <div className="flex items-start gap-1.5 mt-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{enderecoCompleto}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>Manhã 08:00–12:00 · Tarde 13:00–18:00</span>
              </div>
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
            const isDiaHoje = isToday(dia);
            // Hoje fica disponível enquanto algum período ainda for válido (até 17:30)
            let hojeExpirado = false;
            if (isDiaHoje) {
              const agora = new Date();
              const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
              const fimOperacao = isSabado(dia) ? 12 * 60 : 18 * 60;
              hojeExpirado = (minutosAgora + 30) >= fimOperacao;
            }
            return (
              <button
                key={dia.toISOString()}
                onClick={() => {
                  if (hojeExpirado) return;
                  setDataSelecionada(dia);
                  setPeriodoSelecionado(null);
                }}
                disabled={hojeExpirado}
                className={cn(
                  "flex flex-col items-center p-2 rounded-lg border transition-all text-center",
                  hojeExpirado
                    ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
                    : isSelected
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
                {hojeExpirado && (
                  <span className="text-[9px] text-destructive font-medium">Encerrado</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Seleção de período */}
      {dataSelecionada && (
        <div className="space-y-3">
          <h3 className="font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Períodos disponíveis para {format(dataSelecionada, "dd 'de' MMMM", { locale: ptBR })}
          </h3>

          {periodosDisponiveis.length === 0 ? (
            <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                Nenhum período disponível para esta data. Entre em contato com a central.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {periodosDisponiveis.map((p) => {
                const cap = capacidadePorPeriodo[p];
                const ocup = ocupacao[p];
                const restantes = Math.max(0, cap - ocup);
                const esgotado = restantes <= 0;
                const expirado = periodoExpirado(p);
                const desabilitado = esgotado || expirado;
                const isSelected = periodoSelecionado === p;
                const Icone = p === 'manha' ? Sun : Sunset;

                return (
                  <button
                    key={p}
                    onClick={() => !desabilitado && setPeriodoSelecionado(p)}
                    disabled={desabilitado}
                    className={cn(
                      "relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all text-left",
                      isSelected
                        ? "bg-primary/5 border-primary ring-2 ring-primary/20"
                        : desabilitado
                          ? "bg-muted text-muted-foreground cursor-not-allowed opacity-60 border-border"
                          : "border-border bg-card text-card-foreground hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "rounded-md p-2",
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        <Icone className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{PERIODO_LABEL[p]}</p>
                        <p className="text-xs text-muted-foreground">{PERIODO_FAIXA[p]}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {expirado ? (
                        <Badge variant="outline" className="text-destructive border-destructive/40">
                          Encerrado
                        </Badge>
                      ) : esgotado ? (
                        <Badge variant="outline" className="text-destructive border-destructive/40">
                          Lotado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                          {restantes} {restantes === 1 ? 'vaga restante' : 'vagas restantes'}
                        </Badge>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Resumo e confirmação */}
      {dataSelecionada && periodoSelecionado && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Agendamento selecionado</p>
                <p className="text-lg font-semibold">
                  {format(dataSelecionada, "dd 'de' MMMM", { locale: ptBR })} — {PERIODO_LABEL[periodoSelecionado]}
                </p>
                <p className="text-xs text-muted-foreground">{PERIODO_FAIXA[periodoSelecionado]}</p>
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
        <Button variant="outline" onClick={onVoltar} className="flex-1 border-border text-foreground hover:bg-muted">
          Voltar
        </Button>
        <Button
          onClick={handleConfirmar}
          disabled={!dataSelecionada || !periodoSelecionado || criarAgendamento.isPending}
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
