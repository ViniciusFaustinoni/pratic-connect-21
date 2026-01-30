import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Search, UserCheck } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { PRAZOS_SINISTRO } from '@/types/sinistros';

interface EncaminharSindicanciaDialogProps {
  open: boolean;
  onClose: () => void;
  sinistroId: string;
  protocolo: string;
  onSuccess?: () => void;
}

export function EncaminharSindicanciaDialog({
  open,
  onClose,
  sinistroId,
  protocolo,
  onSuccess,
}: EncaminharSindicanciaDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sindicanteId, setSindicanteId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [prazoFim, setPrazoFim] = useState(
    format(addDays(new Date(), PRAZOS_SINISTRO.sindicancia), 'yyyy-MM-dd')
  );

  // Buscar sindicantes disponíveis (profissionais com role apropriada)
  const { data: sindicantes = [] } = useQuery({
    queryKey: ['sindicantes-disponiveis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome, email')
        .eq('ativo', true)
        .eq('tipo', 'funcionario')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const encaminharMutation = useMutation({
    mutationFn: async () => {
      // 1. Atualizar sinistro
      const { error: updateError } = await supabase
        .from('sinistros')
        .update({
          status: 'em_sindicancia' as any,
          sindicante_id: sindicanteId,
          sindicancia_prazo_fim: prazoFim,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sinistroId);

      if (updateError) throw updateError;

      // 2. Registrar histórico
      const { error: histError } = await supabase
        .from('sinistro_historico')
        .insert({
          sinistro_id: sinistroId,
          status_novo: 'em_sindicancia',
          usuario_id: user?.id,
          observacao: `Encaminhado para sindicância. Motivo: ${motivo}. Prazo: ${format(new Date(prazoFim), 'dd/MM/yyyy')}`,
        });

      if (histError) throw histError;

      // 3. Notificar via WhatsApp
      try {
        await supabase.functions.invoke('notificar-sinistro', {
          body: {
            sinistro_id: sinistroId,
            status: 'em_sindicancia',
          },
        });
      } catch (err) {
        console.error('Erro ao notificar:', err);
      }
    },
    onSuccess: () => {
      toast.success('Sinistro encaminhado para sindicância!');
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-analise', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      handleClose();
      onSuccess?.();
    },
    onError: (error) => {
      console.error('Erro ao encaminhar:', error);
      toast.error('Erro ao encaminhar para sindicância');
    },
  });

  const handleClose = () => {
    setSindicanteId('');
    setMotivo('');
    setPrazoFim(format(addDays(new Date(), PRAZOS_SINISTRO.sindicancia), 'yyyy-MM-dd'));
    onClose();
  };

  const handleSubmit = () => {
    if (!sindicanteId) {
      toast.error('Selecione um sindicante');
      return;
    }
    if (!motivo.trim()) {
      toast.error('Informe o motivo da sindicância');
      return;
    }
    encaminharMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-rose-600" />
            Encaminhar para Sindicância
          </DialogTitle>
          <DialogDescription>
            Sinistro {protocolo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Sindicante */}
          <div className="space-y-2">
            <Label htmlFor="sindicante">Sindicante Responsável *</Label>
            <Select value={sindicanteId} onValueChange={setSindicanteId}>
              <SelectTrigger id="sindicante">
                <SelectValue placeholder="Selecione o sindicante" />
              </SelectTrigger>
              <SelectContent>
                {sindicantes.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      {s.nome}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prazo */}
          <div className="space-y-2">
            <Label htmlFor="prazo">Prazo Final</Label>
            <Input
              id="prazo"
              type="date"
              value={prazoFim}
              onChange={(e) => setPrazoFim(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
            />
            <p className="text-xs text-muted-foreground">
              Padrão: {PRAZOS_SINISTRO.sindicancia} dias
            </p>
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo da Sindicância *</Label>
            <Textarea
              id="motivo"
              placeholder="Descreva o motivo do encaminhamento para sindicância..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={encaminharMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={encaminharMutation.isPending}
            className="bg-rose-600 hover:bg-rose-700"
          >
            {encaminharMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Encaminhar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
