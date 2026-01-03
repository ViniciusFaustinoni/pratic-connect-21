import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

type StatusOrdemServico = 
  | 'rascunho'
  | 'aguardando_orcamento'
  | 'orcamento_enviado'
  | 'aguardando_aprovacao'
  | 'aprovado'
  | 'em_execucao'
  | 'aguardando_peca'
  | 'concluido'
  | 'aguardando_pagamento'
  | 'pago'
  | 'cancelado';

interface OrdemServico {
  id: string;
  numero: string;
  status: StatusOrdemServico;
}

interface AtualizarStatusOSModalProps {
  open: boolean;
  onClose: () => void;
  ordemServico: OrdemServico;
}

const FLUXO_STATUS: Record<StatusOrdemServico, StatusOrdemServico[]> = {
  rascunho: ['aguardando_orcamento', 'cancelado'],
  aguardando_orcamento: ['orcamento_enviado', 'cancelado'],
  orcamento_enviado: ['aguardando_aprovacao', 'cancelado'],
  aguardando_aprovacao: ['aprovado', 'aguardando_orcamento', 'cancelado'],
  aprovado: ['em_execucao', 'cancelado'],
  em_execucao: ['aguardando_peca', 'concluido', 'cancelado'],
  aguardando_peca: ['em_execucao'],
  concluido: ['aguardando_pagamento'],
  aguardando_pagamento: ['pago'],
  pago: [],
  cancelado: [],
};

const STATUS_LABELS: Record<StatusOrdemServico, string> = {
  rascunho: 'Rascunho',
  aguardando_orcamento: 'Aguardando Orçamento',
  orcamento_enviado: 'Orçamento Enviado',
  aguardando_aprovacao: 'Aguardando Aprovação',
  aprovado: 'Aprovado',
  em_execucao: 'Em Execução',
  aguardando_peca: 'Aguardando Peça',
  concluido: 'Concluído',
  aguardando_pagamento: 'Aguardando Pagamento',
  pago: 'Pago',
  cancelado: 'Cancelado',
};

const getStatusColor = (status: StatusOrdemServico): string => {
  const colors: Record<StatusOrdemServico, string> = {
    rascunho: 'bg-gray-100 text-gray-800',
    aguardando_orcamento: 'bg-yellow-100 text-yellow-800',
    orcamento_enviado: 'bg-blue-100 text-blue-800',
    aguardando_aprovacao: 'bg-orange-100 text-orange-800',
    aprovado: 'bg-green-100 text-green-800',
    em_execucao: 'bg-indigo-100 text-indigo-800',
    aguardando_peca: 'bg-purple-100 text-purple-800',
    concluido: 'bg-emerald-100 text-emerald-800',
    aguardando_pagamento: 'bg-amber-100 text-amber-800',
    pago: 'bg-green-200 text-green-900',
    cancelado: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

export function AtualizarStatusOSModal({ 
  open, 
  onClose, 
  ordemServico 
}: AtualizarStatusOSModalProps) {
  const queryClient = useQueryClient();
  const [novoStatus, setNovoStatus] = useState<string>('');
  const [observacao, setObservacao] = useState('');

  const statusAtual = ordemServico.status as StatusOrdemServico;
  const opcoesDisponiveis = FLUXO_STATUS[statusAtual] || [];

  useEffect(() => {
    if (open) {
      setNovoStatus('');
      setObservacao('');
    }
  }, [open]);

  const updateMutation = useMutation({
    mutationFn: async ({ novoStatus, observacao }: { 
      novoStatus: StatusOrdemServico; 
      observacao?: string 
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const updateData: Record<string, unknown> = {
        status: novoStatus,
        updated_at: new Date().toISOString(),
      };

      if (novoStatus === 'concluido') {
        updateData.data_conclusao = new Date().toISOString().split('T')[0];
      }

      const { error } = await supabase
        .from('ordens_servico')
        .update(updateData)
        .eq('id', ordemServico.id);

      if (error) throw error;

      await supabase.from('ordens_servico_historico').insert({
        ordem_servico_id: ordemServico.id,
        status_anterior: ordemServico.status,
        status_novo: novoStatus,
        usuario_id: userId,
        observacao: observacao || `Status alterado de ${STATUS_LABELS[statusAtual]} para ${STATUS_LABELS[novoStatus]}`,
      });
    },
    onSuccess: () => {
      toast.success('Status atualizado!');
      queryClient.invalidateQueries({ queryKey: ['ordem-servico'] });
      queryClient.invalidateQueries({ queryKey: ['ordem_servico'] });
      queryClient.invalidateQueries({ queryKey: ['os-historico'] });
      queryClient.invalidateQueries({ queryKey: ['os_historico'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      onClose();
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar status: ' + error.message);
    },
  });

  const handleConfirmar = () => {
    if (!novoStatus) {
      toast.error('Selecione um status');
      return;
    }

    updateMutation.mutate({
      novoStatus: novoStatus as StatusOrdemServico,
      observacao: observacao.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Atualizar Status</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Status Atual */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Status Atual</Label>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1.5 rounded-md text-sm font-medium ${getStatusColor(statusAtual)}`}>
                {STATUS_LABELS[statusAtual]}
              </span>
            </div>
          </div>

          {/* Novo Status */}
          {opcoesDisponiveis.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="novo-status">Novo Status *</Label>
              <Select value={novoStatus} onValueChange={setNovoStatus}>
                <SelectTrigger id="novo-status">
                  <SelectValue placeholder="Selecione o novo status" />
                </SelectTrigger>
                <SelectContent>
                  {opcoesDisponiveis.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4 bg-muted rounded-md">
              Este status é final e não pode ser alterado.
            </p>
          )}

          {/* Observação */}
          {opcoesDisponiveis.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="observacao">Observação</Label>
              <Textarea
                id="observacao"
                placeholder="Motivo da mudança de status..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          {opcoesDisponiveis.length > 0 && (
            <Button 
              onClick={handleConfirmar}
              disabled={updateMutation.isPending || !novoStatus}
            >
              {updateMutation.isPending ? 'Atualizando...' : 'Confirmar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
