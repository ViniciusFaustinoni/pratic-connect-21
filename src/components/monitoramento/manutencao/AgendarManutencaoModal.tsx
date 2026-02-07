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
import { Loader2, CalendarIcon, MapPin, User, Car, MessageCircle, Puzzle, Sun, Sunset } from 'lucide-react';
import { useAgendarVistoriaManutencao } from '@/hooks/useVistoriaManutencao';
import { useProfissionaisEquipe } from '@/hooks/useEquipe';
import { useVagasPeriodo, temVagasDisponiveis } from '@/hooks/useVagasPeriodo';
import { usePermissions } from '@/hooks/usePermissions';
import { 
  LOCAL_TIPO_OPTIONS,
  type VistoriaManutencao,
  type LocalTipoManutencao,
} from '@/types/vistoriaManutencao';
import {
  PERIODOS_DISPONIVEIS,
  LIMITE_VAGAS_POR_PERIODO,
  getPeriodosDisponivelsPorHora,
  type Periodo,
  type PeriodoConfig,
} from '@/data/autovistoriaConfig';
import { cn } from '@/lib/utils';

interface AgendarManutencaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vistoria: VistoriaManutencao | null;
}

export function AgendarManutencaoModal({ 
  open, 
  onOpenChange,
  vistoria,
}: AgendarManutencaoModalProps) {
  const [dataAgendada, setDataAgendada] = useState<Date | undefined>(undefined);
  const [periodo, setPeriodo] = useState<Periodo | ''>('');
  const [localTipo, setLocalTipo] = useState<LocalTipoManutencao>('base');
  const [localEndereco, setLocalEndereco] = useState('');
  const [profissionalId, setProfissionalId] = useState('');
  const [notificarWhatsApp, setNotificarWhatsApp] = useState(true);
  const [permiteEncaixe, setPermiteEncaixe] = useState(false);

  const { data: equipe, isLoading: loadingEquipe } = useProfissionaisEquipe();
  const agendarMutation = useAgendarVistoriaManutencao();
  
  // Permissões para encaixe
  const { isDiretor, isCoordenadorMonitoramento } = usePermissions();
  const podeHabilitarEncaixe = isDiretor || isCoordenadorMonitoramento;

  // Configuração de datas - hoje + próximos 2 dias (excluindo domingos)
  const dataMinima = startOfDay(new Date());
  const dataMaxima = addDays(dataMinima, 2);
  
  const diasDesabilitados = (date: Date) => {
    const start = startOfDay(date);
    return isSunday(start) || start < dataMinima || start > dataMaxima;
  };

  // Verificação de vagas para a data selecionada
  const dataFormatada = dataAgendada ? format(dataAgendada, 'yyyy-MM-dd') : null;
  const { data: vagasData, isLoading: isLoadingVagas } = useVagasPeriodo(dataFormatada);

  // Períodos disponíveis baseados na data selecionada
  const periodosDisponiveis = useMemo((): PeriodoConfig[] => {
    if (!dataAgendada) return PERIODOS_DISPONIVEIS;
    return getPeriodosDisponivelsPorHora(dataAgendada);
  }, [dataAgendada]);

  // Limpar ao fechar
  useEffect(() => {
    if (!open) {
      setDataAgendada(undefined);
      setPeriodo('');
      setLocalTipo('base');
      setLocalEndereco('');
      setProfissionalId('');
      setNotificarWhatsApp(true);
      setPermiteEncaixe(false);
    }
  }, [open]);

  // Resetar período quando data muda (período pode não estar mais disponível)
  useEffect(() => {
    if (dataAgendada && periodo) {
      const periodoAindaDisponivel = periodosDisponiveis.some(p => p.id === periodo);
      if (!periodoAindaDisponivel) {
        setPeriodo('');
      }
    }
  }, [dataAgendada, periodo, periodosDisponiveis]);

  const handleSubmit = async () => {
    if (!vistoria || !dataAgendada || !profissionalId || !periodo) return;

    await agendarMutation.mutateAsync({
      servicoId: vistoria.id,
      dataAgendada: format(dataAgendada, 'yyyy-MM-dd'),
      periodo: periodo as Periodo,
      localTipo,
      localEndereco: localTipo === 'rota' ? localEndereco : undefined,
      profissionalId,
      notificarWhatsApp,
      permiteEncaixe,
    });

    onOpenChange(false);
  };

  const isValid = dataAgendada && periodo && profissionalId && (localTipo !== 'rota' || localEndereco);

  // Profissionais disponíveis (já filtrados pelo hook)
  const profissionais = equipe || [];

  if (!vistoria) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Agendar Vistoria de Manutenção</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info do serviço */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{vistoria.associado?.nome}</span>
            </div>
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-muted-foreground" />
              <span>
                {vistoria.veiculo?.marca} {vistoria.veiculo?.modelo} • {vistoria.veiculo?.placa}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              Rastreador: {vistoria.rastreador?.codigo}
            </div>
          </div>

          {/* Data */}
          <div className="space-y-2">
            <Label>Data da Vistoria *</Label>
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
                  {dataAgendada ? format(dataAgendada, 'PPP', { locale: ptBR }) : 'Selecione a data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                <Calendar
                  mode="single"
                  selected={dataAgendada}
                  onSelect={setDataAgendada}
                  disabled={diasDesabilitados}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Período com vagas */}
          <div className="space-y-2">
            <Label>Período *</Label>
            {!dataAgendada ? (
              <p className="text-sm text-muted-foreground">
                Selecione uma data para ver os períodos disponíveis
              </p>
            ) : isLoadingVagas ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Verificando vagas...</span>
              </div>
            ) : periodosDisponiveis.length === 0 ? (
              <p className="text-sm text-destructive">
                Nenhum período disponível para esta data
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {periodosDisponiveis.map((p) => {
                  const vagasRestantes = vagasData?.[p.id] ?? LIMITE_VAGAS_POR_PERIODO;
                  const semVagas = vagasRestantes === 0;
                  const isSelected = periodo === p.id;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => !semVagas && setPeriodo(p.id)}
                      disabled={semVagas}
                      className={cn(
                        'flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all',
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : semVagas
                          ? 'border-muted bg-muted/50 opacity-50 cursor-not-allowed'
                          : 'border-muted hover:border-primary/50 cursor-pointer'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {p.id === 'manha' ? (
                          <Sun className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Sunset className="h-4 w-4 text-orange-500" />
                        )}
                        <span className="font-medium">{p.label}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {p.horarioInicio} - {p.horarioFim}
                      </span>
                      <span className={cn(
                        'text-xs font-medium',
                        semVagas ? 'text-destructive' : vagasRestantes <= 3 ? 'text-amber-600' : 'text-emerald-600'
                      )}>
                        {semVagas ? 'Sem vagas' : `${vagasRestantes} vaga${vagasRestantes !== 1 ? 's' : ''}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tipo de local */}
          <div className="space-y-2">
            <Label>Local *</Label>
            <RadioGroup
              value={localTipo}
              onValueChange={(v) => setLocalTipo(v as LocalTipoManutencao)}
              className="space-y-2"
            >
              {LOCAL_TIPO_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-start space-x-2">
                  <RadioGroupItem value={opt.value} id={opt.value} className="mt-1" />
                  <div className="flex flex-col">
                    <Label htmlFor={opt.value} className="font-normal cursor-pointer">
                      {opt.label}
                    </Label>
                    <span className="text-xs text-muted-foreground">{opt.description}</span>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Endereço (se rota) */}
          {localTipo === 'rota' && (
            <div className="space-y-2">
              <Label>Endereço *</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Endereço para atendimento..."
                  value={localEndereco}
                  onChange={(e) => setLocalEndereco(e.target.value)}
                  className="pl-9"
                />
              </div>
              {vistoria.logradouro && (
                <button
                  type="button"
                  onClick={() => setLocalEndereco(
                    `${vistoria.logradouro}, ${vistoria.numero || 'S/N'} - ${vistoria.bairro}, ${vistoria.cidade}/${vistoria.uf}`
                  )}
                  className="text-xs text-primary hover:underline"
                >
                  Usar endereço cadastrado do associado
                </button>
              )}
            </div>
          )}

          {/* Técnico */}
          <div className="space-y-2">
            <Label>Técnico Responsável *</Label>
            <Select
              value={profissionalId}
              onValueChange={setProfissionalId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o técnico..." />
              </SelectTrigger>
              <SelectContent>
                {loadingEquipe ? (
                  <div className="p-2 text-center">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  </div>
                ) : profissionais.length > 0 ? (
                  profissionais.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))
                ) : (
                  <div className="p-2 text-center text-muted-foreground text-sm">
                    Nenhum técnico disponível
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Notificar WhatsApp */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="notificar"
              checked={notificarWhatsApp}
              onCheckedChange={(checked) => setNotificarWhatsApp(checked === true)}
            />
            <Label htmlFor="notificar" className="font-normal cursor-pointer flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              Contatar associado via WhatsApp
            </Label>
          </div>

          {/* Permitir encaixe - apenas para Diretor/Coordenador */}
          {podeHabilitarEncaixe && (
            <div className="flex items-center space-x-2 p-3 rounded-md bg-primary/5 border border-primary/20">
              <Checkbox
                id="encaixe"
                checked={permiteEncaixe}
                onCheckedChange={(checked) => setPermiteEncaixe(checked === true)}
              />
              <Label htmlFor="encaixe" className="font-normal cursor-pointer flex items-center gap-1">
                <Puzzle className="h-4 w-4 text-primary" />
                Permitir encaixe de horário
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!isValid || agendarMutation.isPending}
          >
            {agendarMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar Agendamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
