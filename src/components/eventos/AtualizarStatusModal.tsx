import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

import { WORKFLOW_SINISTRO, STATUS_SINISTRO_LABELS, STATUS_SINISTRO_COLORS } from '@/types/sinistros';

// Usar workflow do types/sinistros.ts
const fluxoStatus = WORKFLOW_SINISTRO;

const statusConfig: Record<string, { label: string; class: string }> = Object.fromEntries(
  Object.entries(STATUS_SINISTRO_LABELS).map(([key, label]) => [
    key,
    { label, class: STATUS_SINISTRO_COLORS[key as keyof typeof STATUS_SINISTRO_COLORS] || 'bg-gray-100 text-gray-800' }
  ])
);

interface Sinistro {
  id: string;
  protocolo: string;
  status: string;
}

interface AtualizarStatusModalProps {
  open: boolean;
  onClose: () => void;
  sinistro: Sinistro | null;
}

export function AtualizarStatusModal({ open, onClose, sinistro }: AtualizarStatusModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [novoStatus, setNovoStatus] = useState('');
  const [observacao, setObservacao] = useState('');

  const statusPermitidos = sinistro ? (fluxoStatus[sinistro.status] || []) : [];

  const updateMutation = useMutation({
    mutationFn: async ({ novoStatus, observacao }: { novoStatus: string; observacao: string }) => {
      if (!sinistro) throw new Error('Sinistro não encontrado');

      // 1. Atualizar sinistro
      const { error: updateError } = await supabase
        .from('sinistros')
        .update({ 
          status: novoStatus as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', sinistro.id);
      
      if (updateError) throw updateError;
      
      // 2. Registrar histórico
      const { error: histError } = await supabase
        .from('sinistro_historico')
        .insert({
          sinistro_id: sinistro.id,
          status_anterior: sinistro.status,
          status_novo: novoStatus,
          usuario_id: user?.id,
          observacao: observacao || null
        });
      
      if (histError) throw histError;

      // 3. Notificar associado via WhatsApp
      try {
        await supabase.functions.invoke('notificar-sinistro', {
          body: {
            sinistro_id: sinistro.id,
            status: novoStatus,
          }
        });
        console.log('[AtualizarStatus] Notificação enviada');
      } catch (notifErr) {
        console.error('[AtualizarStatus] Erro ao notificar:', notifErr);
        // Não falhar a operação por erro de notificação
      }
    },
    onSuccess: () => {
      toast.success('Status atualizado com sucesso!', {
        description: 'O associado foi notificado via WhatsApp.'
      });
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistro?.id] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-historico', sinistro?.id] });
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      queryClient.invalidateQueries({ queryKey: ['sinistros-contadores'] });
      handleClose();
    },
    onError: (error) => {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status do sinistro');
    }
  });

  const handleClose = () => {
    setNovoStatus('');
    setObservacao('');
    onClose();
  };

  const handleSubmit = () => {
    if (!novoStatus) {
      toast.error('Selecione o novo status');
      return;
    }
    updateMutation.mutate({ novoStatus, observacao });
  };

  if (!sinistro) return null;

  const statusAtual = statusConfig[sinistro.status] || { label: sinistro.status, class: 'bg-gray-100 text-gray-800' };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atualizar Status</DialogTitle>
          <DialogDescription>
            Sinistro {sinistro.protocolo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Status Atual */}
          <div className="space-y-2">
            <Label>Status Atual</Label>
            <div>
              <Badge className={statusAtual.class}>
                {statusAtual.label}
              </Badge>
            </div>
          </div>

          {/* Novo Status */}
          <div className="space-y-2">
            <Label htmlFor="novo-status">Novo Status</Label>
            {statusPermitidos.length > 0 ? (
              <Select value={novoStatus} onValueChange={setNovoStatus}>
                <SelectTrigger id="novo-status">
                  <SelectValue placeholder="Selecione o novo status" />
                </SelectTrigger>
                <SelectContent>
                  {statusPermitidos.map((status) => {
                    const config = statusConfig[status] || { label: status, class: '' };
                    return (
                      <SelectItem key={status} value={status}>
                        {config.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm text-muted-foreground">
                Não há transições permitidas para este status.
              </p>
            )}
          </div>

          {/* Observação */}
          <div className="space-y-2">
            <Label htmlFor="observacao">Observação (opcional)</Label>
            <Textarea
              id="observacao"
              placeholder="Adicione uma observação sobre a mudança de status..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={updateMutation.isPending}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!novoStatus || updateMutation.isPending}
          >
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
