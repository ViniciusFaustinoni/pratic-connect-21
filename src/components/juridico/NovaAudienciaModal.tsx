import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar as CalendarIcon, MapPin, Video, FileText, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface NovaAudienciaModalProps {
  open: boolean;
  onClose: () => void;
  processoId: string;
}

const TIPOS_AUDIENCIA = [
  { value: 'conciliacao', label: 'Conciliação' },
  { value: 'instrucao', label: 'Instrução' },
  { value: 'julgamento', label: 'Julgamento' },
  { value: 'una', label: 'Una' },
  { value: 'especial', label: 'Especial' },
];

export function NovaAudienciaModal({ open, onClose, processoId }: NovaAudienciaModalProps) {
  const queryClient = useQueryClient();
  
  const [tipo, setTipo] = useState('');
  const [data, setData] = useState<Date | undefined>();
  const [hora, setHora] = useState('');
  const [local, setLocal] = useState('');
  const [link, setLink] = useState('');
  const [pauta, setPauta] = useState('');

  const handleClose = () => {
    setTipo('');
    setData(undefined);
    setHora('');
    setLocal('');
    setLink('');
    setPauta('');
    onClose();
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const dataFormatada = format(data!, 'yyyy-MM-dd');
      const { data: audiencia, error } = await supabase
        .from('processos_audiencias')
        .insert({
          processo_id: processoId,
          tipo,
          data_hora: `${dataFormatada}T${hora}:00`,
          local: local || null,
          link_videoconferencia: link || null,
          pauta: pauta || null,
          status: 'agendada'
        })
        .select()
        .single();
      if (error) throw error;
      return audiencia;
    },
    onSuccess: () => {
      toast.success('Audiência agendada!');
      queryClient.invalidateQueries({ queryKey: ['processo-audiencias'] });
      queryClient.invalidateQueries({ queryKey: ['audiencias'] });
      handleClose();
    },
    onError: (error: Error) => {
      toast.error('Erro ao agendar: ' + error.message);
    }
  });

  const isValid = tipo && data && hora;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar Audiência</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo de Audiência */}
          <div className="space-y-2">
            <Label>Tipo de Audiência *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_AUDIENCIA.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data e Hora */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !data && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {data ? format(data, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={data}
                    onSelect={setData}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Hora *</Label>
              <Input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
              />
            </div>
          </div>

          {/* Local */}
          <div className="space-y-2">
            <Label>Local</Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="Endereço do fórum/tribunal"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
              />
            </div>
          </div>

          {/* Link Videoconferência */}
          <div className="space-y-2">
            <Label>Link Videoconferência</Label>
            <div className="relative">
              <Video className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-10"
                placeholder="https://..."
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
            </div>
          </div>

          {/* Pauta */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Pauta
            </Label>
            <Textarea
              placeholder="Descreva a pauta da audiência..."
              value={pauta}
              onChange={(e) => setPauta(e.target.value)}
              rows={3}
            />
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
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Agendar Audiência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
