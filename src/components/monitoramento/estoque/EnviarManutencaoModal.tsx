import { useState, useMemo } from 'react';
import { format, addDays, isSaturday, isSunday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, Wrench, AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCriarManutencao } from '@/hooks/useCriarManutencao';
import { useVagasPeriodo, temVagasDisponiveis } from '@/hooks/useVagasPeriodo';
import { 
  PERIODOS_DISPONIVEIS, 
  LIMITE_VAGAS_POR_PERIODO, 
  getPeriodosDisponivelsPorHora,
  type Periodo 
} from '@/data/autovistoriaConfig';

interface RastreadorParaManutencao {
  id: string;
  codigo: string;
  imei?: string | null;
  status: 'estoque' | 'instalado' | 'manutencao' | 'baixado';
  veiculo?: {
    placa: string;
    modelo?: string | null;
  } | null;
}

interface EnviarManutencaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rastreador: RastreadorParaManutencao | null;
}

const statusLabels: Record<string, string> = {
  estoque: 'Estoque',
  instalado: 'Instalado',
  manutencao: 'Manutenção',
  baixado: 'Baixado',
};

export function EnviarManutencaoModal({ 
  open, 
  onOpenChange, 
  rastreador 
}: EnviarManutencaoModalProps) {
  const [dataSelecionada, setDataSelecionada] = useState<Date | undefined>();
  const [periodoSelecionado, setPeriodoSelecionado] = useState<Periodo | null>(null);
  const [motivo, setMotivo] = useState('');

  const { mutate: criarManutencao, isPending } = useCriarManutencao();

  // Formatar data para query
  const dataFormatada = dataSelecionada ? format(dataSelecionada, 'yyyy-MM-dd') : null;
  
  // Buscar vagas disponíveis para a data selecionada
  const { data: vagasData, isLoading: isLoadingVagas } = useVagasPeriodo(dataFormatada);

  // Períodos disponíveis para o dia selecionado (considera hora atual para hoje)
  const periodosDisponiveis = useMemo(() => {
    if (!dataSelecionada) return PERIODOS_DISPONIVEIS;
    return getPeriodosDisponivelsPorHora(dataSelecionada);
  }, [dataSelecionada]);

  // Datas mínima e máxima
  const dataMinima = addDays(new Date(), 1); // A partir de amanhã
  const dataMaxima = addDays(new Date(), 30); // Até 30 dias

  // Desabilitar domingos e datas passadas
  const diasDesabilitados = (date: Date) => {
    return isSunday(date) || date < dataMinima || date > dataMaxima;
  };

  const handleConfirmar = () => {
    if (!rastreador || !dataSelecionada || !periodoSelecionado) return;

    criarManutencao({
      rastreadorId: rastreador.id,
      dataAgendada: format(dataSelecionada, 'yyyy-MM-dd'),
      periodo: periodoSelecionado,
      motivo: motivo.trim() || undefined,
    }, {
      onSuccess: () => {
        handleClose();
      }
    });
  };

  const handleClose = () => {
    setDataSelecionada(undefined);
    setPeriodoSelecionado(null);
    setMotivo('');
    onOpenChange(false);
  };

  const podeConfirmar = dataSelecionada && periodoSelecionado && 
    temVagasDisponiveis(vagasData, periodoSelecionado);

  if (!rastreador) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-600" />
            Enviar para Manutenção
          </DialogTitle>
          <DialogDescription>
            Agende uma manutenção para este rastreador. Um vistoriador será atribuído automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Informações do Rastreador */}
          <Card className="p-4 bg-muted/50">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rastreador:</span>
                <span className="font-medium">{rastreador.codigo}</span>
              </div>
              {rastreador.imei && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IMEI:</span>
                  <span className="font-mono text-xs">{rastreador.imei}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status atual:</span>
                <Badge variant="outline" className="text-xs">
                  {statusLabels[rastreador.status]}
                </Badge>
              </div>
              {rastreador.veiculo && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Veículo:</span>
                  <span className="font-medium">
                    {rastreador.veiculo.placa}
                    {rastreador.veiculo.modelo && ` - ${rastreador.veiculo.modelo}`}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Seleção de Data */}
          <div className="space-y-2">
            <Label>Data do Agendamento *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dataSelecionada && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataSelecionada 
                    ? format(dataSelecionada, "EEEE, dd 'de' MMMM", { locale: ptBR })
                    : "Selecione uma data"
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataSelecionada}
                  onSelect={(date) => {
                    setDataSelecionada(date);
                    setPeriodoSelecionado(null);
                  }}
                  disabled={diasDesabilitados}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {dataSelecionada && isSaturday(dataSelecionada) && (
              <p className="text-xs text-amber-600">
                ⚠️ Sábado: apenas período da manhã disponível
              </p>
            )}
          </div>

          {/* Seleção de Período */}
          {dataSelecionada && (
            <div className="space-y-2">
              <Label>Período *</Label>
              <div className="grid grid-cols-2 gap-3">
                {periodosDisponiveis.map((periodo) => {
                  const vagasRestantes = vagasData?.[periodo.id] ?? LIMITE_VAGAS_POR_PERIODO;
                  const esgotado = vagasRestantes <= 0;
                  const selecionado = periodoSelecionado === periodo.id;

                  return (
                    <Card
                      key={periodo.id}
                      className={cn(
                        "p-4 cursor-pointer transition-all hover:border-primary/50",
                        selecionado && "ring-2 ring-primary border-primary",
                        esgotado && "opacity-50 cursor-not-allowed bg-muted"
                      )}
                      onClick={() => !esgotado && setPeriodoSelecionado(periodo.id)}
                    >
                      <div className="text-center space-y-1">
                        <span className="text-2xl">{periodo.icone}</span>
                        <h4 className="font-semibold">{periodo.label}</h4>
                        <p className="text-xs text-muted-foreground">
                          {periodo.horarioInicio} às {periodo.horarioFim}
                        </p>
                        <div className="pt-1">
                          {isLoadingVagas ? (
                            <span className="text-xs text-muted-foreground">Carregando...</span>
                          ) : esgotado ? (
                            <Badge variant="destructive" className="text-xs">Esgotado</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                              {vagasRestantes} vagas
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo da Manutenção</Label>
            <Textarea
              id="motivo"
              placeholder="Ex: Rastreador sem comunicação há 48h, necessita verificação..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
            />
          </div>

          {/* Aviso */}
          <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p className="text-xs">
              Ao confirmar, o rastreador será marcado como "Em Manutenção" e uma tarefa será criada 
              para o vistoriador mais próximo.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={!podeConfirmar || isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Agendando...
              </>
            ) : (
              'Confirmar Agendamento'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
