import { useState, useEffect, useMemo } from 'react';
import { format, addDays, isSunday, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, CalendarIcon, User, Car, MessageCircle, Sun, Sunset, Home, Radio } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfissionaisEquipe } from '@/hooks/useEquipe';
import { cn } from '@/lib/utils';
import { buscarCep } from '@/lib/cep';
import { toast } from 'sonner';
import { type Servico } from '@/hooks/useServicos';
import { type MotivoRetirada, MOTIVO_RETIRADA_LABELS } from '@/types/retirada';
import {
  PERIODOS_DISPONIVEIS,
  type Periodo,
} from '@/data/autovistoriaConfig';

// Tipo local para dados de retirada
interface RetiradaData extends Servico {
  motivo_retirada?: MotivoRetirada;
  solicitado_por_modulo?: string;
  cancelamento_bloqueado_ate_devolucao?: boolean;
  rastreador?: {
    id: string;
    codigo: string;
    imei?: string;
    plataforma?: string;
  };
}

interface AgendarRetiradaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  retirada: RetiradaData | null;
}

type LocalTipo = 'base' | 'volante';

export function AgendarRetiradaModal({
  open,
  onOpenChange,
  retirada,
}: AgendarRetiradaModalProps) {
  const [dataAgendada, setDataAgendada] = useState<Date | undefined>(undefined);
  const [periodo, setPeriodo] = useState<Periodo | ''>('');
  const [localTipo, setLocalTipo] = useState<LocalTipo>('base');
  const [profissionalId, setProfissionalId] = useState('');
  const [notificarWhatsApp, setNotificarWhatsApp] = useState(true);

  // Estados para endereço
  const [tipoEndereco, setTipoEndereco] = useState<'cadastrado' | 'outro'>('cadastrado');
  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);

  const { data: equipe, isLoading: loadingEquipe } = useProfissionaisEquipe();
  const queryClient = useQueryClient();

  // Mutation para agendar
  const agendarMutation = useMutation({
    mutationFn: async (dados: {
      servicoId: string;
      dataAgendada: string;
      periodo: Periodo;
      profissionalId: string;
      localTipo: LocalTipo;
      endereco?: {
        cep?: string;
        logradouro?: string;
        numero?: string;
        bairro?: string;
        cidade?: string;
        uf?: string;
      };
      notificarWhatsApp: boolean;
    }) => {
      const updateData: any = {
        status: 'agendada',
        data_agendada: dados.dataAgendada,
        periodo: dados.periodo,
        profissional_id: dados.profissionalId,
        local_tipo_manutencao: dados.localTipo,
        updated_at: new Date().toISOString(),
      };

      if (dados.endereco) {
        updateData.cep = dados.endereco.cep;
        updateData.logradouro = dados.endereco.logradouro;
        updateData.numero = dados.endereco.numero;
        updateData.bairro = dados.endereco.bairro;
        updateData.cidade = dados.endereco.cidade;
        updateData.uf = dados.endereco.uf;
      }

      const { error } = await supabase
        .from('servicos')
        .update(updateData)
        .eq('id', dados.servicoId);

      if (error) throw error;

      // Notificar via WhatsApp se marcado
      if (dados.notificarWhatsApp) {
        try {
          await supabase.functions.invoke('notificar-retirada-whatsapp', {
            body: {
              servico_id: dados.servicoId,
            },
          });
        } catch (e) {
          console.warn('Erro ao notificar WhatsApp:', e);
          // Não bloqueia o fluxo
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      toast.success('Retirada agendada com sucesso!');
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Erro ao agendar retirada:', error);
      toast.error('Erro ao agendar retirada');
    },
  });

  // Configuração de datas - hoje + próximos 2 dias (excluindo domingos)
  const datasDisponiveis = useMemo(() => {
    const datas: Date[] = [];
    let data = startOfDay(new Date());
    let count = 0;

    while (count < 3) {
      if (!isSunday(data)) {
        datas.push(data);
        count++;
      }
      data = addDays(data, 1);
    }

    return datas;
  }, []);

  // Reset form quando modal abre
  useEffect(() => {
    if (open && retirada) {
      setDataAgendada(undefined);
      setPeriodo('');
      setLocalTipo('base');
      setProfissionalId('');
      setNotificarWhatsApp(true);
      setTipoEndereco('cadastrado');
      setCep('');
      setLogradouro('');
      setNumero('');
      setBairro('');
      setCidade('');
      setUf('');
    }
  }, [open, retirada]);

  // Buscar CEP
  const handleBuscarCep = async () => {
    if (!cep || cep.length < 8) return;

    setBuscandoCep(true);
    try {
      const endereco = await buscarCep(cep);
      if (endereco) {
        setLogradouro(endereco.logradouro || '');
        setBairro(endereco.bairro || '');
        setCidade(endereco.cidade || '');
        setUf(endereco.uf || '');
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    } finally {
      setBuscandoCep(false);
    }
  };

  const handleSubmit = async () => {
    if (!retirada || !dataAgendada || !periodo || !profissionalId) return;

    await agendarMutation.mutateAsync({
      servicoId: retirada.id,
      dataAgendada: format(dataAgendada, 'yyyy-MM-dd'),
      periodo: periodo as Periodo,
      profissionalId,
      localTipo,
      endereco: tipoEndereco === 'outro'
        ? { cep, logradouro, numero, bairro, cidade, uf }
        : undefined,
      notificarWhatsApp,
    });
  };

  const isFormValid = dataAgendada && periodo && profissionalId && (
    localTipo === 'base' ||
    tipoEndereco === 'cadastrado' ||
    (logradouro && bairro && cidade)
  );

  if (!retirada) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Agendar Retirada de Rastreador
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Info do serviço */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{retirada.associado?.nome || '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-muted-foreground" />
              <span>
                {retirada.veiculo?.marca} {retirada.veiculo?.modelo} • {retirada.veiculo?.placa}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono">{retirada.rastreador?.codigo || '-'}</span>
            </div>
            {retirada.motivo_retirada && (
              <div className="text-muted-foreground">
                Motivo: {MOTIVO_RETIRADA_LABELS[retirada.motivo_retirada]}
              </div>
            )}
          </div>

          {/* Local do atendimento */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Local do Atendimento</Label>
            <RadioGroup
              value={localTipo}
              onValueChange={(v) => setLocalTipo(v as LocalTipo)}
              className="grid grid-cols-2 gap-3"
            >
              <div
                className={cn(
                  'flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors',
                  localTipo === 'base' ? 'border-primary bg-primary/5' : 'border-border'
                )}
                onClick={() => setLocalTipo('base')}
              >
                <RadioGroupItem value="base" id="base" />
                <Label htmlFor="base" className="cursor-pointer flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Base
                </Label>
              </div>
              <div
                className={cn(
                  'flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors',
                  localTipo === 'volante' ? 'border-primary bg-primary/5' : 'border-border'
                )}
                onClick={() => setLocalTipo('volante')}
              >
                <RadioGroupItem value="volante" id="volante" />
                <Label htmlFor="volante" className="cursor-pointer flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Volante
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Endereço (se volante) */}
          {localTipo === 'volante' && (
            <div className="space-y-3 pl-2 border-l-2 border-primary/30">
              <RadioGroup
                value={tipoEndereco}
                onValueChange={(v) => setTipoEndereco(v as 'cadastrado' | 'outro')}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="cadastrado" id="end-cadastrado" />
                  <Label htmlFor="end-cadastrado" className="cursor-pointer text-sm">
                    Endereço cadastrado
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="outro" id="end-outro" />
                  <Label htmlFor="end-outro" className="cursor-pointer text-sm">
                    Outro endereço
                  </Label>
                </div>
              </RadioGroup>

              {tipoEndereco === 'outro' && (
                <div className="grid gap-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="CEP"
                      value={cep}
                      onChange={(e) => setCep(e.target.value.replace(/\D/g, ''))}
                      onBlur={handleBuscarCep}
                      maxLength={8}
                      className="w-32"
                    />
                    {buscandoCep && <Loader2 className="h-4 w-4 animate-spin self-center" />}
                  </div>
                  <Input
                    placeholder="Logradouro"
                    value={logradouro}
                    onChange={(e) => setLogradouro(e.target.value)}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="Número"
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                    />
                    <Input
                      placeholder="Bairro"
                      value={bairro}
                      onChange={(e) => setBairro(e.target.value)}
                      className="col-span-2"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="Cidade"
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      className="col-span-2"
                    />
                    <Input
                      placeholder="UF"
                      value={uf}
                      onChange={(e) => setUf(e.target.value.toUpperCase())}
                      maxLength={2}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Data */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !dataAgendada && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataAgendada
                    ? format(dataAgendada, "dd 'de' MMMM, yyyy", { locale: ptBR })
                    : 'Selecione a data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataAgendada}
                  onSelect={setDataAgendada}
                  disabled={(date) => !datasDisponiveis.some(d => d.getTime() === date.getTime())}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Período */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Período</Label>
            <div className="grid grid-cols-2 gap-3">
              {PERIODOS_DISPONIVEIS.map((config) => (
                <div
                  key={config.id}
                  className={cn(
                    'flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors',
                    periodo === config.id ? 'border-primary bg-primary/5' : 'border-border'
                  )}
                  onClick={() => setPeriodo(config.id as Periodo)}
                >
                  {config.id === 'manha' ? (
                    <Sun className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Sunset className="h-4 w-4 text-orange-500" />
                  )}
                  <span className="text-sm font-medium">{config.label}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {config.horarioInicio} - {config.horarioFim}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Profissional */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Técnico Responsável</Label>
            <Select value={profissionalId} onValueChange={setProfissionalId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o técnico" />
              </SelectTrigger>
              <SelectContent>
                {loadingEquipe ? (
                  <SelectItem value="loading" disabled>
                    Carregando...
                  </SelectItem>
                ) : (
                  equipe?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Notificar WhatsApp */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="notificar"
              checked={notificarWhatsApp}
              onCheckedChange={(checked) => setNotificarWhatsApp(checked as boolean)}
            />
            <Label htmlFor="notificar" className="cursor-pointer flex items-center gap-2 text-sm">
              <MessageCircle className="h-4 w-4 text-green-600" />
              Notificar associado via WhatsApp (prazo 48h)
            </Label>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={agendarMutation.isPending}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || agendarMutation.isPending}
            className="flex-1"
          >
            {agendarMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
