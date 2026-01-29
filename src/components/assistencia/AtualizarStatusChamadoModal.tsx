import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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

const fluxoStatus: Record<string, string[]> = {
  aberto: ['aguardando_prestador', 'cancelado_sistema'],
  aguardando_prestador: ['prestador_despachado', 'cancelado_sistema'],
  prestador_despachado: ['prestador_a_caminho', 'cancelado_sistema'],
  prestador_a_caminho: ['em_atendimento', 'cancelado_sistema'],
  em_atendimento: ['concluido', 'cancelado_sistema'],
};

const statusConfig: Record<string, { label: string; className: string }> = {
  aberto: { label: 'Aberto', className: 'bg-yellow-100 text-yellow-800' },
  aguardando_prestador: { label: 'Aguard. Prestador', className: 'bg-orange-100 text-orange-800' },
  prestador_despachado: { label: 'Despachado', className: 'bg-blue-100 text-blue-800' },
  prestador_a_caminho: { label: 'A Caminho', className: 'bg-purple-100 text-purple-800' },
  em_atendimento: { label: 'Em Atendimento', className: 'bg-indigo-100 text-indigo-800' },
  concluido: { label: 'Concluído', className: 'bg-green-100 text-green-800' },
  cancelado_associado: { label: 'Canc. Associado', className: 'bg-red-100 text-red-800' },
  cancelado_sistema: { label: 'Canc. Sistema', className: 'bg-red-100 text-red-800' },
};

interface Chamado {
  id: string;
  protocolo: string;
  status: string;
}

interface AtualizarStatusChamadoModalProps {
  open: boolean;
  onClose: () => void;
  chamado: Chamado | null;
  veiculoId?: string;
}

export function AtualizarStatusChamadoModal({ open, onClose, chamado, veiculoId }: AtualizarStatusChamadoModalProps) {
  const queryClient = useQueryClient();
  const [novoStatus, setNovoStatus] = useState('');
  const [observacao, setObservacao] = useState('');

  const statusPermitidos = chamado ? (fluxoStatus[chamado.status] || []) : [];

  const updateMutation = useMutation({
    mutationFn: async ({ novoStatus, observacao }: { novoStatus: string; observacao: string }) => {
      if (!chamado) throw new Error('Chamado não encontrado');

      const user = await supabase.auth.getUser();

      // 1. Preparar dados de atualização
      const updateData: Record<string, any> = {
        status: novoStatus as any,
        updated_at: new Date().toISOString(),
      };

      // Se concluído, adicionar data de conclusão e capturar posição final
      if (novoStatus === 'concluido') {
        updateData.data_conclusao = new Date().toISOString();

        // Capturar posição final do rastreador
        if (veiculoId) {
          try {
            console.log('[AtualizarStatus] Capturando posição final do veículo:', veiculoId);
            const { data: posicaoFinal, error: posicaoError } = await supabase.functions.invoke('posicao-veiculo', {
              body: { veiculo_id: veiculoId },
            });

            if (!posicaoError && posicaoFinal?.success && posicaoFinal?.posicao) {
              updateData.posicao_final_lat = posicaoFinal.posicao.latitude;
              updateData.posicao_final_lng = posicaoFinal.posicao.longitude;
              updateData.posicao_final_capturada_em = posicaoFinal.posicao.data_posicao || new Date().toISOString();
              console.log('[AtualizarStatus] Posição final capturada:', posicaoFinal.posicao.latitude, posicaoFinal.posicao.longitude);
            } else {
              console.warn('[AtualizarStatus] Não foi possível capturar posição final:', posicaoError);
            }
          } catch (err) {
            console.warn('[AtualizarStatus] Erro ao capturar posição final:', err);
          }
        }
      }

      // 2. Atualizar chamado
      const { error: updateError } = await supabase
        .from('chamados_assistencia')
        .update(updateData)
        .eq('id', chamado.id);

      if (updateError) throw updateError;

      // 3. Registrar no histórico
      const { error: histError } = await supabase
        .from('chamados_assistencia_historico')
        .insert({
          chamado_id: chamado.id,
          status_anterior: chamado.status,
          status_novo: novoStatus,
          usuario_id: user.data.user?.id,
          observacao: observacao || null,
        });

      if (histError) throw histError;

      // 4. Se concluído, atualizar atendimento ativo
      if (novoStatus === 'concluido') {
        await supabase
          .from('chamados_assistencia_atendimentos')
          .update({
            status: 'concluido',
            hora_conclusao: new Date().toISOString(),
          })
          .eq('chamado_id', chamado.id)
          .in('status', ['em_andamento', 'a_caminho', 'no_local', 'acionado', 'aceito']);
      }

      // 5. Notificar associado via WhatsApp
      try {
        await supabase.functions.invoke('notificar-status-assistencia', {
          body: {
            chamado_id: chamado.id,
            status_novo: novoStatus,
            observacao: observacao || undefined,
          },
        });
      } catch (notifError) {
        console.error('Erro ao enviar notificação WhatsApp:', notifError);
        // Não bloqueia o fluxo
      }
    },
    onSuccess: () => {
      toast.success('Status atualizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['chamado', chamado?.id] });
      queryClient.invalidateQueries({ queryKey: ['chamado-historico', chamado?.id] });
      queryClient.invalidateQueries({ queryKey: ['chamado-atendimentos', chamado?.id] });
      queryClient.invalidateQueries({ queryKey: ['chamados-assistencia'] });
      queryClient.invalidateQueries({ queryKey: ['chamados-contadores'] });
      handleClose();
    },
    onError: (error) => {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status do chamado');
    },
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

  if (!chamado) return null;

  const statusAtual = statusConfig[chamado.status] || { label: chamado.status, className: 'bg-gray-100 text-gray-800' };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atualizar Status</DialogTitle>
          <DialogDescription>
            Chamado {chamado.protocolo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Status Atual */}
          <div className="space-y-2">
            <Label>Status Atual</Label>
            <div>
              <Badge className={statusAtual.className}>
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
                    const config = statusConfig[status] || { label: status, className: '' };
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
