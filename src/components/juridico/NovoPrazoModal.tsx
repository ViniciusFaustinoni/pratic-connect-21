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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { supabase } from '@/integrations/supabase/client';
import { PRIORIDADE_LABELS, PrioridadePrazo } from '@/types/juridico';

interface NovoPrazoModalProps {
  open: boolean;
  onClose: () => void;
  processoId: string;
}

export function NovoPrazoModal({ open, onClose, processoId }: NovoPrazoModalProps) {
  const queryClient = useQueryClient();

  const [descricao, setDescricao] = useState('');
  const [dataInicio, setDataInicio] = useState<Date>(new Date());
  const [prazoDias, setPrazoDias] = useState<number | ''>('');
  const [dataFim, setDataFim] = useState<Date | null>(null);
  const [prioridade, setPrioridade] = useState<PrioridadePrazo>('normal');

  // Auto-calculate data_fim when days change
  useEffect(() => {
    if (prazoDias && typeof prazoDias === 'number' && prazoDias > 0) {
      const novaDataFim = addDays(dataInicio, prazoDias);
      setDataFim(novaDataFim);
    }
  }, [prazoDias, dataInicio]);

  const handleDataFimChange = (newDate: Date | undefined) => {
    if (newDate) {
      setDataFim(newDate);
      setPrazoDias('');
    }
  };

  const handleClose = () => {
    setDescricao('');
    setDataInicio(new Date());
    setPrazoDias('');
    setDataFim(null);
    setPrioridade('normal');
    onClose();
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!dataFim) throw new Error('Data de vencimento é obrigatória');

      const { data, error } = await supabase
        .from('processos_prazos')
        .insert({
          processo_id: processoId,
          descricao,
          data_inicio: format(dataInicio, 'yyyy-MM-dd'),
          data_fim: format(dataFim, 'yyyy-MM-dd'),
          prioridade,
          status: 'pendente',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Prazo criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['processos', processoId] });
      queryClient.invalidateQueries({ queryKey: ['processos_prazos'] });
      queryClient.invalidateQueries({ queryKey: ['prazos-controle'] });
      queryClient.invalidateQueries({ queryKey: ['juridico-stats'] });
      handleClose();
    },
    onError: (error) => {
      toast.error('Erro ao criar prazo: ' + error.message);
    },
  });

  const isValid = descricao.trim().length >= 5 && dataFim !== null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Novo Prazo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Descrição */}
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Prazo para contestação"
            />
          </div>

          {/* Data de Início */}
          <div className="space-y-2">
            <Label>Data de Início *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !dataInicio && 'text-muted-foreground'
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {format(dataInicio, 'dd/MM/yyyy', { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={dataInicio}
                  onSelect={(d) => d && setDataInicio(d)}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Dias ou Data de Vencimento */}
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
              <Label>Ou data específica *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dataFim && 'text-muted-foreground'
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {dataFim
                      ? format(dataFim, 'dd/MM/yyyy', { locale: ptBR })
                      : 'Selecione'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={dataFim || undefined}
                    onSelect={handleDataFimChange}
                    locale={ptBR}
                    disabled={(date) => date < new Date()}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Prioridade */}
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select
              value={prioridade}
              onValueChange={(v) => setPrioridade(v as PrioridadePrazo)}
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
            Criar Prazo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
