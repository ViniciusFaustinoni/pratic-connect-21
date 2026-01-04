import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

import { supabase } from '@/integrations/supabase/client';
import {
  TIPO_ANDAMENTO_LABELS,
  PRIORIDADE_LABELS,
  TipoAndamento,
  PrioridadePrazo,
} from '@/types/juridico';

interface NovoAndamentoModalProps {
  open: boolean;
  onClose: () => void;
  processoId: string;
}

export function NovoAndamentoModal({
  open,
  onClose,
  processoId,
}: NovoAndamentoModalProps) {
  const queryClient = useQueryClient();

  // Form state
  const [data, setData] = useState<Date>(new Date());
  const [tipo, setTipo] = useState<TipoAndamento>('despacho');
  const [descricao, setDescricao] = useState('');

  // Prazo state
  const [geraPrazo, setGeraPrazo] = useState(false);
  const [prazoDias, setPrazoDias] = useState<number | ''>('');
  const [prazoData, setPrazoData] = useState<Date | null>(null);
  const [prazoDescricao, setPrazoDescricao] = useState('');
  const [prazoPrioridade, setPrazoPrioridade] = useState<PrioridadePrazo>('normal');

  // Auto-calculate prazo date when days change
  useEffect(() => {
    if (prazoDias && typeof prazoDias === 'number' && prazoDias > 0) {
      const novaDataPrazo = addDays(data, prazoDias);
      setPrazoData(novaDataPrazo);
    }
  }, [prazoDias, data]);

  const handlePrazoDataChange = (newDate: Date | undefined) => {
    if (newDate) {
      setPrazoData(newDate);
      setPrazoDias('');
    }
  };

  const handleClose = () => {
    setData(new Date());
    setTipo('despacho');
    setDescricao('');
    setGeraPrazo(false);
    setPrazoDias('');
    setPrazoData(null);
    setPrazoDescricao('');
    setPrazoPrioridade('normal');
    onClose();
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const user = await supabase.auth.getUser();

      // 1. Create andamento
      const { data: andamento, error: andamentoError } = await supabase
        .from('processos_andamentos')
        .insert({
          processo_id: processoId,
          data: format(data, 'yyyy-MM-dd'),
          descricao,
          tipo,
          gera_prazo: geraPrazo,
          prazo_dias: geraPrazo && prazoDias ? Number(prazoDias) : null,
          prazo_data: geraPrazo && prazoData ? format(prazoData, 'yyyy-MM-dd') : null,
          prazo_descricao: geraPrazo ? prazoDescricao || null : null,
          registrado_por: user.data.user?.id,
        })
        .select()
        .single();

      if (andamentoError) throw andamentoError;

      // 2. Create prazo if needed
      if (geraPrazo && prazoData) {
        const { error: prazoError } = await supabase
          .from('processos_prazos')
          .insert({
            processo_id: processoId,
            andamento_id: andamento.id,
            descricao: prazoDescricao || descricao,
            data_inicio: format(data, 'yyyy-MM-dd'),
            data_fim: format(prazoData, 'yyyy-MM-dd'),
            prioridade: prazoPrioridade,
            status: 'pendente',
          });

        if (prazoError) throw prazoError;
      }

      return andamento;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processo', processoId] });
      queryClient.invalidateQueries({ queryKey: ['processos_prazos'] });
      queryClient.invalidateQueries({ queryKey: ['prazos-controle'] });
      toast.success('Andamento registrado com sucesso!');
      handleClose();
    },
    onError: (error) => {
      toast.error('Erro ao registrar andamento: ' + error.message);
    },
  });

  const isValid =
    descricao.trim().length >= 10 &&
    (!geraPrazo || (geraPrazo && prazoData !== null));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Andamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Data do Andamento */}
          <div className="space-y-2">
            <Label>Data do Andamento *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !data && 'text-muted-foreground'
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {format(data, 'dd/MM/yyyy', { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={data}
                  onSelect={(d) => d && setData(d)}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo *</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoAndamento)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_ANDAMENTO_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o andamento processual (mínimo 10 caracteres)..."
              rows={3}
            />
          </div>

          {/* Seção Prazo */}
          <Collapsible open={geraPrazo} onOpenChange={setGeraPrazo}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center space-x-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <Checkbox
                  checked={geraPrazo}
                  onCheckedChange={(c) => setGeraPrazo(!!c)}
                />
                <Label className="cursor-pointer flex items-center gap-2 flex-1">
                  <Clock className="h-4 w-4" />
                  Gera prazo processual?
                </Label>
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-4 space-y-4 border-l-2 border-primary pl-4 ml-2">
              {/* Dias ou Data */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Dias para prazo</Label>
                  <Input
                    type="number"
                    min={1}
                    value={prazoDias}
                    onChange={(e) =>
                      setPrazoDias(e.target.value ? Number(e.target.value) : '')
                    }
                    placeholder="Ex: 15"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Ou data específica</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !prazoData && 'text-muted-foreground'
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {prazoData
                          ? format(prazoData, 'dd/MM/yyyy', { locale: ptBR })
                          : 'Selecione'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={prazoData || undefined}
                        onSelect={handlePrazoDataChange}
                        locale={ptBR}
                        disabled={(date) => date < new Date()}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Descrição do Prazo */}
              <div className="space-y-2">
                <Label>Descrição do prazo</Label>
                <Input
                  value={prazoDescricao}
                  onChange={(e) => setPrazoDescricao(e.target.value)}
                  placeholder="Ex: Prazo para contestação"
                />
              </div>

              {/* Prioridade */}
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select
                  value={prazoPrioridade}
                  onValueChange={(v) => setPrazoPrioridade(v as PrioridadePrazo)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORIDADE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!isValid || createMutation.isPending}
          >
            {createMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Registrar Andamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
