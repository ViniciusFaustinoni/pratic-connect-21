import { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';
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
import { Loader2, CalendarIcon, MapPin, User, Car, MessageCircle } from 'lucide-react';
import { useAgendarVistoriaManutencao } from '@/hooks/useVistoriaManutencao';
import { useProfissionaisEquipe } from '@/hooks/useEquipe';
import { 
  LOCAL_TIPO_OPTIONS,
  type VistoriaManutencao,
  type LocalTipoManutencao,
} from '@/types/vistoriaManutencao';
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
  const [dataAgendada, setDataAgendada] = useState<Date | undefined>(addDays(new Date(), 1));
  const [periodo, setPeriodo] = useState<'manha' | 'tarde'>('manha');
  const [localTipo, setLocalTipo] = useState<LocalTipoManutencao>('base');
  const [localEndereco, setLocalEndereco] = useState('');
  const [profissionalId, setProfissionalId] = useState('');
  const [notificarWhatsApp, setNotificarWhatsApp] = useState(true);

  const { data: equipe, isLoading: loadingEquipe } = useProfissionaisEquipe();
  const agendarMutation = useAgendarVistoriaManutencao();

  // Limpar ao fechar
  useEffect(() => {
    if (!open) {
      setDataAgendada(addDays(new Date(), 1));
      setPeriodo('manha');
      setLocalTipo('base');
      setLocalEndereco('');
      setProfissionalId('');
      setNotificarWhatsApp(true);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!vistoria || !dataAgendada || !profissionalId) return;

    await agendarMutation.mutateAsync({
      servicoId: vistoria.id,
      dataAgendada: format(dataAgendada, 'yyyy-MM-dd'),
      periodo,
      localTipo,
      localEndereco: localTipo === 'rota' ? localEndereco : undefined,
      profissionalId,
      notificarWhatsApp,
    });

    onOpenChange(false);
  };

  const isValid = dataAgendada && profissionalId && (localTipo !== 'rota' || localEndereco);

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
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataAgendada}
                  onSelect={setDataAgendada}
                  disabled={(date) => date < new Date()}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Período */}
          <div className="space-y-2">
            <Label>Período *</Label>
            <RadioGroup
              value={periodo}
              onValueChange={(v) => setPeriodo(v as 'manha' | 'tarde')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="manha" id="manha" />
                <Label htmlFor="manha" className="font-normal cursor-pointer">Manhã</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="tarde" id="tarde" />
                <Label htmlFor="tarde" className="font-normal cursor-pointer">Tarde</Label>
              </div>
            </RadioGroup>
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
