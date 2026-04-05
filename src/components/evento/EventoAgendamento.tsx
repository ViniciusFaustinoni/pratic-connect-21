import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Loader2, CalendarDays, MapPin, CheckCircle, Sun, Sunset, Info } from 'lucide-react';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  isDomingo,
  isSabado,
  getPeriodosParaDia,
  LIMITE_VAGAS_POR_PERIODO,
  type Periodo,
  type PeriodoConfig,
} from '@/data/autovistoriaConfig';
import { useVagasPeriodoEvento } from '@/hooks/useVagasPeriodoEvento';

interface Props {
  token: string;
  onAgendado: () => void;
}

export default function EventoAgendamento({ token, onAgendado }: Props) {
  const [dataSelecionada, setDataSelecionada] = useState<Date | undefined>();
  const [periodoSelecionado, setPeriodoSelecionado] = useState<Periodo | null>(null);
  const [permiteEncaixe, setPermiteEncaixe] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [agendado, setAgendado] = useState(false);
  const [dadosAgendamento, setDadosAgendamento] = useState<any>(null);

  const [endereco, setEndereco] = useState({
    rua: '',
    numero: '',
    bairro: '',
    cidade: '',
    complemento: '',
  });

  // Próximos 5 dias úteis (excl. domingos)
  const datasDisponiveis = useMemo(() => {
    const resultado: Date[] = [];
    const hoje = startOfDay(new Date());
    let dia = addDays(hoje, 1);
    while (resultado.length < 5) {
      if (!isDomingo(dia)) resultado.push(new Date(dia));
      dia = addDays(dia, 1);
    }
    return resultado;
  }, []);

  // Vagas para data selecionada
  const dataFormatada = dataSelecionada ? format(dataSelecionada, 'yyyy-MM-dd') : null;
  const { data: vagasData, isLoading: isLoadingVagas, error: vagasError } = useVagasPeriodoEvento(dataFormatada, true);

  // Períodos disponíveis para a data
  const periodosDisponiveis = dataSelecionada ? getPeriodosParaDia(dataSelecionada) : [];

  const handleSelectDate = (date: Date) => {
    setDataSelecionada(date);
    setPeriodoSelecionado(null);
  };

  const getVagasParaPeriodo = (periodo: Periodo): number => {
    if (!vagasData) return LIMITE_VAGAS_POR_PERIODO;
    return vagasData[periodo];
  };

  const isPeriodoDisponivel = (periodo: Periodo): boolean => {
    if (permiteEncaixe) return true;
    return getVagasParaPeriodo(periodo) > 0;
  };

  const handleConfirmar = async () => {
    if (!dataSelecionada || !periodoSelecionado) return;
    if (!endereco.rua || !endereco.bairro || !endereco.cidade) {
      toast.error('Preencha os campos de endereço obrigatórios');
      return;
    }

    setSalvando(true);
    try {
      const { data, error } = await publicSupabase.functions.invoke('agendar-vistoria-evento', {
        body: {
          token,
          data_agendada: format(dataSelecionada, 'yyyy-MM-dd'),
          periodo: periodoSelecionado,
          endereco,
          permite_encaixe: permiteEncaixe,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao agendar');

      setDadosAgendamento(data.vistoria);
      setAgendado(true);
      onAgendado();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao confirmar agendamento');
    } finally {
      setSalvando(false);
    }
  };

  if (agendado && dadosAgendamento) {
    const periodoLabel = dadosAgendamento.horario_agendado === 'manha' ? 'Manhã (08:00–12:00)' :
      dadosAgendamento.horario_agendado === 'tarde' ? 'Tarde (14:00–18:00)' :
      dadosAgendamento.horario_agendado;

    return (
      <div className="space-y-4 text-center">
        <CheckCircle className="h-14 w-14 mx-auto text-green-500" />
        <h2 className="text-lg font-bold">Vistoria Agendada!</h2>
        <p className="text-sm text-muted-foreground">
          Sua vistoria foi agendada com sucesso. O regulador irá até o endereço informado.
        </p>
        <Card>
          <CardContent className="pt-4 text-left space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data</span>
              <span className="font-medium">
                {format(new Date(dadosAgendamento.data_agendada + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Período</span>
              <span className="font-medium">{periodoLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Endereço</span>
              <span className="font-medium text-right">
                {dadosAgendamento.endereco_rua}, {dadosAgendamento.endereco_numero} — {dadosAgendamento.endereco_bairro}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canConfirm = dataSelecionada && periodoSelecionado && endereco.rua && endereco.bairro && endereco.cidade;

  return (
    <div className="space-y-5">
      <div className="text-center space-y-1">
        <CalendarDays className="h-10 w-10 mx-auto text-primary" />
        <h2 className="text-lg font-bold">Agende sua Vistoria de Evento</h2>
        <p className="text-sm text-muted-foreground">
          Para dar continuidade ao processo, é necessário agendar uma vistoria presencial.
          O regulador da Pratic Car irá avaliar os danos no seu veículo.
        </p>
      </div>

      {/* Datas */}
      <div>
        <Label className="text-sm font-medium mb-2 block">Selecione a data</Label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {datasDisponiveis.map((d) => {
            const isSelected = dataSelecionada?.toDateString() === d.toDateString();
            return (
              <Button
                key={d.toISOString()}
                variant={isSelected ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSelectDate(d)}
                className="flex flex-col h-auto py-2"
              >
                <span className="text-xs capitalize">
                  {format(d, 'EEE', { locale: ptBR })}
                </span>
                <span className="text-sm font-semibold">
                  {format(d, 'dd/MM')}
                </span>
                {isSabado(d) && (
                  <span className="text-[10px] text-muted-foreground">Só manhã</span>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Períodos */}
      {dataSelecionada && (
        <div className="space-y-3">
          <Label className="text-sm font-medium block">Selecione o período</Label>
          {isLoadingVagas ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {periodosDisponiveis.map((p) => {
                const vagas = getVagasParaPeriodo(p.id);
                const disponivel = isPeriodoDisponivel(p.id);
                const isSelected = periodoSelecionado === p.id;
                const Icon = p.id === 'manha' ? Sun : Sunset;

                return (
                  <button
                    key={p.id}
                    onClick={() => disponivel && setPeriodoSelecionado(p.id)}
                    disabled={!disponivel}
                    className={cn(
                      'relative flex flex-col items-center gap-1 p-4 rounded-lg border-2 transition-all',
                      isSelected
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                        : disponivel
                        ? 'border-border hover:border-primary/50 cursor-pointer'
                        : 'border-border opacity-50 cursor-not-allowed bg-muted/30'
                    )}
                  >
                    <Icon className={cn('h-6 w-6', isSelected ? 'text-primary' : 'text-muted-foreground')} />
                    <span className={cn('font-semibold text-sm', isSelected && 'text-primary')}>
                      {p.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {p.horarioInicio} – {p.horarioFim}
                    </span>
                    <span className={cn(
                      'text-xs font-medium',
                      vagas === 0 ? 'text-destructive' : vagas <= 3 ? 'text-amber-600' : 'text-green-600'
                    )}>
                      {vagas === 0 ? 'Lotado' : `${vagas} vaga${vagas !== 1 ? 's' : ''}`}
                    </span>
                    {permiteEncaixe && vagas === 0 && (
                      <span className="text-[10px] text-amber-600 font-medium">Encaixe</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Switch encaixe */}
          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Permitir encaixe</p>
                <p className="text-xs text-muted-foreground">
                  Permite agendar mesmo quando não há vagas
                </p>
              </div>
            </div>
            <Switch checked={permiteEncaixe} onCheckedChange={setPermiteEncaixe} />
          </div>
        </div>
      )}

      {/* Endereço */}
      {periodoSelecionado && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <Label className="text-sm font-medium">Endereço onde o veículo estará</Label>
          </div>

          <div className="space-y-2">
            <Input
              placeholder="Rua / Avenida *"
              value={endereco.rua}
              onChange={(e) => setEndereco({ ...endereco, rua: e.target.value })}
            />
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="Número"
                value={endereco.numero}
                onChange={(e) => setEndereco({ ...endereco, numero: e.target.value })}
              />
              <Input
                className="col-span-2"
                placeholder="Bairro *"
                value={endereco.bairro}
                onChange={(e) => setEndereco({ ...endereco, bairro: e.target.value })}
              />
            </div>
            <Input
              placeholder="Cidade *"
              value={endereco.cidade}
              onChange={(e) => setEndereco({ ...endereco, cidade: e.target.value })}
            />
            <Input
              placeholder="Complemento / Referência"
              value={endereco.complemento}
              onChange={(e) => setEndereco({ ...endereco, complemento: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Confirmar */}
      {periodoSelecionado && (
        <Button
          className="w-full"
          disabled={!canConfirm || salvando}
          onClick={handleConfirmar}
        >
          {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Confirmar Agendamento
        </Button>
      )}
    </div>
  );
}
