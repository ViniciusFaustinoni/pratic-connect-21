import { useState } from 'react';
import { CalendarClock, Clock, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateLead } from '@/hooks/useLeads';
import { toast } from 'sonner';
import { format, addDays, addHours, setHours, setMinutes } from 'date-fns';

interface AgendarFollowupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadNome: string;
  dataAtual?: string | null;
  onSuccess?: () => void;
}

const TIPOS_FOLLOWUP = [
  { value: 'ligacao', label: 'Ligação', icon: '📞' },
  { value: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { value: 'email', label: 'Email', icon: '📧' },
  { value: 'visita', label: 'Visita', icon: '🏢' },
  { value: 'outro', label: 'Outro', icon: '📌' },
];

const ATALHOS = [
  { label: 'Em 1 hora', hours: 1, days: 0 },
  { label: 'Amanhã 9h', hours: 0, days: 1, setHour: 9 },
  { label: 'Em 2 dias', hours: 0, days: 2 },
  { label: 'Em 1 semana', hours: 0, days: 7 },
];

export function AgendarFollowupDialog({
  open,
  onOpenChange,
  leadId,
  leadNome,
  dataAtual,
  onSuccess,
}: AgendarFollowupDialogProps) {
  const updateLead = useUpdateLead();
  
  // Estado do formulário
  const [dataHora, setDataHora] = useState(() => {
    if (dataAtual) {
      return format(new Date(dataAtual), "yyyy-MM-dd'T'HH:mm");
    }
    // Default: amanhã às 9h
    const tomorrow = addDays(new Date(), 1);
    return format(setMinutes(setHours(tomorrow, 9), 0), "yyyy-MM-dd'T'HH:mm");
  });
  const [tipo, setTipo] = useState('ligacao');
  const [observacao, setObservacao] = useState('');

  const handleAtalho = (atalho: typeof ATALHOS[0]) => {
    let novaData = new Date();
    
    if (atalho.hours > 0) {
      novaData = addHours(novaData, atalho.hours);
    }
    if (atalho.days > 0) {
      novaData = addDays(novaData, atalho.days);
    }
    if (atalho.setHour !== undefined) {
      novaData = setMinutes(setHours(novaData, atalho.setHour), 0);
    }
    
    setDataHora(format(novaData, "yyyy-MM-dd'T'HH:mm"));
  };

  const handleSalvar = async () => {
    if (!dataHora) {
      toast.error('Selecione uma data e hora');
      return;
    }

    try {
      await updateLead.mutateAsync({
        id: leadId,
        data_proxima_acao: new Date(dataHora).toISOString(),
      });
      
      const tipoLabel = TIPOS_FOLLOWUP.find(t => t.value === tipo)?.label || tipo;
      toast.success(`Follow-up agendado: ${tipoLabel} em ${format(new Date(dataHora), 'dd/MM às HH:mm')}`);
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error('Erro ao agendar follow-up');
    }
  };

  const handleRemover = async () => {
    try {
      await updateLead.mutateAsync({
        id: leadId,
        data_proxima_acao: null,
      });
      
      toast.success('Agendamento removido');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error('Erro ao remover agendamento');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Agendar Follow-up
          </DialogTitle>
          <DialogDescription>
            Agende o próximo contato com <strong>{leadNome}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Atalhos rápidos */}
          <div className="flex flex-wrap gap-2">
            {ATALHOS.map((atalho) => (
              <Button
                key={atalho.label}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAtalho(atalho)}
              >
                {atalho.label}
              </Button>
            ))}
          </div>

          {/* Data e hora */}
          <div className="space-y-2">
            <Label htmlFor="dataHora" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Data e Hora
            </Label>
            <Input
              id="dataHora"
              type="datetime-local"
              value={dataHora}
              onChange={(e) => setDataHora(e.target.value)}
              min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
            />
          </div>

          {/* Tipo de contato */}
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo de Contato</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_FOLLOWUP.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.icon} {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observação */}
          <div className="space-y-2">
            <Label htmlFor="observacao" className="flex items-center gap-2">
              <StickyNote className="h-4 w-4" />
              Observação (opcional)
            </Label>
            <Textarea
              id="observacao"
              placeholder="Ex: Ligar para confirmar interesse no plano premium..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {dataAtual && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleRemover}
              className="text-destructive hover:text-destructive"
              disabled={updateLead.isPending}
            >
              Remover Agendamento
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSalvar}
              disabled={updateLead.isPending}
            >
              {updateLead.isPending ? 'Salvando...' : 'Agendar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
