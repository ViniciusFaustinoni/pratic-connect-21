import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Wrench } from 'lucide-react';
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

interface RegistrarEntradaOficinaModalProps {
  open: boolean;
  onClose: () => void;
  sinistroId: string;
  protocolo: string;
}

export function RegistrarEntradaOficinaModal({ open, onClose, sinistroId, protocolo }: RegistrarEntradaOficinaModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dataEntrada, setDataEntrada] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const { error: updateError } = await supabase
        .from('sinistros')
        .update({
          agendamento_entrada_oficina_data: dataEntrada ? new Date(dataEntrada).toISOString() : new Date().toISOString(),
          agendamento_entrada_oficina_obs: observacoes || null,
          status: 'em_reparo' as any,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sinistroId);

      if (updateError) throw updateError;

      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistroId,
        status_anterior: 'aguardando_entrada_oficina',
        status_novo: 'em_reparo',
        usuario_id: user?.id,
        observacao: `Veículo entregue na oficina${dataEntrada ? ` em ${new Date(dataEntrada).toLocaleDateString('pt-BR')}` : ''}${observacoes ? `. ${observacoes}` : ''}`,
      });
    },
    onSuccess: () => {
      toast.success('Entrada na oficina registrada! Status atualizado para Em Reparo.');
      queryClient.invalidateQueries({ queryKey: ['sinistro-analise', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-historico', sinistroId] });
      handleClose();
    },
    onError: (error) => {
      console.error('Erro ao registrar entrada:', error);
      toast.error('Erro ao registrar entrada na oficina');
    },
  });

  const handleClose = () => {
    setDataEntrada('');
    setObservacoes('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Confirmar Entrada na Oficina
          </DialogTitle>
          <DialogDescription>
            Sinistro {protocolo} — Registrar que o veículo foi entregue na oficina
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="data-entrada">Data de entrada</Label>
            <Input
              id="data-entrada"
              type="date"
              value={dataEntrada}
              onChange={(e) => setDataEntrada(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Se não informar, será considerada a data atual.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="obs-entrada">Observações</Label>
            <Textarea
              id="obs-entrada"
              placeholder="Informações sobre a entrega do veículo..."
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
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Entrada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
