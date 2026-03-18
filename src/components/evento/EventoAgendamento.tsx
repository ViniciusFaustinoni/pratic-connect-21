import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CalendarDays, MapPin, CheckCircle } from 'lucide-react';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { format, addDays, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  token: string;
  onAgendado: () => void;
}

export default function EventoAgendamento({ token, onAgendado }: Props) {
  const [dataSelecionada, setDataSelecionada] = useState<Date | undefined>();
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null);
  const [slots, setSlots] = useState<{ horario: string; disponivel: boolean }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
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

  // Calcular datas disponíveis (próximos 15 dias úteis)
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diasUteis: Date[] = [];
  let dia = addDays(hoje, 1);
  while (diasUteis.length < 15) {
    if (!isWeekend(dia)) diasUteis.push(new Date(dia));
    dia = addDays(dia, 1);
  }

  const disabledDays = (date: Date) => {
    return !diasUteis.some(d => d.toDateString() === date.toDateString());
  };

  const buscarHorarios = async (date: Date) => {
    setLoadingSlots(true);
    setHorarioSelecionado(null);
    try {
      const dataStr = format(date, 'yyyy-MM-dd');
      const { data, error } = await publicSupabase.functions.invoke('agendar-vistoria-evento', {
        body: { action: 'horarios', data_agendada: dataStr },
      });
      if (error) throw error;
      setSlots(data?.slots || []);
    } catch {
      toast.error('Erro ao buscar horários');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSelectDate = (date: Date | undefined) => {
    setDataSelecionada(date);
    if (date) buscarHorarios(date);
  };

  const handleConfirmar = async () => {
    if (!dataSelecionada || !horarioSelecionado) return;
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
          horario_agendado: horarioSelecionado,
          endereco,
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
              <span className="text-muted-foreground">Horário</span>
              <span className="font-medium">{dadosAgendamento.horario_agendado?.substring(0, 5)}</span>
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

  const canConfirm = dataSelecionada && horarioSelecionado && endereco.rua && endereco.bairro && endereco.cidade;

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

      {/* Calendário */}
      <div>
        <Label className="text-sm font-medium mb-2 block">Selecione a data</Label>
        <div className="flex justify-center">
          <Calendar
            mode="single"
            selected={dataSelecionada}
            onSelect={handleSelectDate}
            disabled={disabledDays}
            locale={ptBR}
            className="rounded-md border pointer-events-auto"
          />
        </div>
      </div>

      {/* Horários */}
      {dataSelecionada && (
        <div>
          <Label className="text-sm font-medium mb-2 block">Selecione o horário</Label>
          {loadingSlots ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map((slot) => (
                <Button
                  key={slot.horario}
                  variant={horarioSelecionado === slot.horario ? 'default' : 'outline'}
                  size="sm"
                  disabled={!slot.disponivel}
                  onClick={() => setHorarioSelecionado(slot.horario)}
                  className={cn(
                    'text-xs',
                    !slot.disponivel && 'opacity-40 line-through'
                  )}
                >
                  {slot.horario}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Endereço */}
      {horarioSelecionado && (
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

      {/* Botão confirmar */}
      {horarioSelecionado && (
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
