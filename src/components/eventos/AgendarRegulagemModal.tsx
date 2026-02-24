import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Calendar, MapPin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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

interface AgendarRegulagemModalProps {
  open: boolean;
  onClose: () => void;
  sinistroId: string;
  protocolo: string;
}

export function AgendarRegulagemModal({ open, onClose, sinistroId, protocolo }: AgendarRegulagemModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [data, setData] = useState('');
  const [periodo, setPeriodo] = useState('');
  const [local, setLocal] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      // Atualizar sinistro com dados do agendamento
      const { error: updateError } = await supabase
        .from('sinistros')
        .update({
          agendamento_regulagem_data: new Date(data).toISOString(),
          agendamento_regulagem_local: local || null,
          agendamento_regulagem_periodo: periodo || null,
          agendamento_regulagem_obs: observacoes || null,
          status: 'aguardando_regulagem' as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sinistroId);

      if (updateError) throw updateError;

      // Registrar histórico
      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistroId,
        status_anterior: 'aguardando_agendamento',
        status_novo: 'aguardando_regulagem',
        usuario_id: user?.id,
        observacao: `Regulagem agendada para ${new Date(data).toLocaleDateString('pt-BR')} (${periodo || 'horário a definir'})${local ? ` - Local: ${local}` : ''}`,
      });
    },
    onSuccess: () => {
      toast.success('Agendamento de regulagem registrado!');
      queryClient.invalidateQueries({ queryKey: ['sinistro-analise', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-historico', sinistroId] });
      handleClose();
    },
    onError: (error) => {
      console.error('Erro ao agendar regulagem:', error);
      toast.error('Erro ao registrar agendamento');
    },
  });

  const handleClose = () => {
    setData('');
    setPeriodo('');
    setLocal('');
    setObservacoes('');
    onClose();
  };

  const handleSubmit = () => {
    if (!data) {
      toast.error('Informe a data do agendamento');
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Agendar Regulagem
          </DialogTitle>
          <DialogDescription>
            Sinistro {protocolo} — Agendar data para o regulador avaliar o veículo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="data-regulagem">Data *</Label>
            <Input
              id="data-regulagem"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="periodo-regulagem">Período</Label>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger id="periodo-regulagem">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manha">Manhã (8h - 12h)</SelectItem>
                <SelectItem value="tarde">Tarde (13h - 17h)</SelectItem>
                <SelectItem value="integral">Dia todo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="local-regulagem">Local do veículo</Label>
            <Input
              id="local-regulagem"
              placeholder="Endereço onde o veículo se encontra..."
              value={local}
              onChange={(e) => setLocal(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="obs-regulagem">Observações</Label>
            <Textarea
              id="obs-regulagem"
              placeholder="Informações adicionais sobre o agendamento..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!data || mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Agendamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
