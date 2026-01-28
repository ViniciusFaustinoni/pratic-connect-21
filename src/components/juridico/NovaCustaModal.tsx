import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, DollarSign, Loader2 } from 'lucide-react';
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
import { TIPO_CUSTA_LABELS } from '@/types/juridico';

interface NovaCustaModalProps {
  open: boolean;
  onClose: () => void;
  processoId: string;
}

export function NovaCustaModal({ open, onClose, processoId }: NovaCustaModalProps) {
  const queryClient = useQueryClient();

  const [tipo, setTipo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>();

  const handleClose = () => {
    setTipo('');
    setDescricao('');
    setValor('');
    setDataVencimento(undefined);
    onClose();
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const valorNumerico = parseFloat(valor.replace(',', '.'));
      if (isNaN(valorNumerico) || valorNumerico <= 0) {
        throw new Error('Valor inválido');
      }

      const { data, error } = await supabase
        .from('processos_custas')
        .insert({
          processo_id: processoId,
          tipo,
          descricao: descricao || null,
          valor: valorNumerico,
          data_vencimento: dataVencimento ? format(dataVencimento, 'yyyy-MM-dd') : null,
          status: 'pendente',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Custa registrada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['processos', processoId, 'custas'] });
      queryClient.invalidateQueries({ queryKey: ['processos', processoId] });
      handleClose();
    },
    onError: (error) => {
      toast.error('Erro ao registrar custa: ' + error.message);
    },
  });

  const isValid = tipo && valor && parseFloat(valor.replace(',', '.')) > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Nova Custa / Honorário
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo de Custa */}
          <div className="space-y-2">
            <Label>Tipo *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_CUSTA_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição opcional"
            />
          </div>

          {/* Valor */}
          <div className="space-y-2">
            <Label>Valor *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                R$
              </span>
              <Input
                className="pl-10"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Data de Vencimento */}
          <div className="space-y-2">
            <Label>Data de Vencimento</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !dataVencimento && 'text-muted-foreground'
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {dataVencimento
                    ? format(dataVencimento, 'dd/MM/yyyy', { locale: ptBR })
                    : 'Selecione (opcional)'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={dataVencimento}
                  onSelect={setDataVencimento}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
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
            Registrar Custa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
