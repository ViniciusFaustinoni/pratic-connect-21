import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Shield, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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

const fluxoStatus = WORKFLOW_SINISTRO;

const statusConfig: Record<string, { label: string; class: string }> = Object.fromEntries(
  Object.entries(STATUS_SINISTRO_LABELS).map(([key, label]) => [
    key,
    { label, class: STATUS_SINISTRO_COLORS[key as keyof typeof STATUS_SINISTRO_COLORS] || 'bg-gray-100 text-gray-800' }
  ])
);

const STATUS_FINAIS = ['concluido', 'finalizado', 'encerrado', 'entregue', 'pago', 'indenizado'];

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

interface ItemDisponivel {
  id: string;
  nome: string;
  tipo: 'cobertura' | 'beneficio';
  ref_id: string;
  ref_field: 'cobertura_id' | 'benefit_id';
}

interface ItemSelecionado {
  item: ItemDisponivel;
  valor: number;
  observacao: string;
}

export function AtualizarStatusModal({ open, onClose, sinistro }: AtualizarStatusModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [novoStatus, setNovoStatus] = useState('');
  const [observacao, setObservacao] = useState('');
  const [itensSelecionados, setItensSelecionados] = useState<ItemSelecionado[]>([]);

  const statusPermitidos = sinistro ? (fluxoStatus[sinistro.status] || []) : [];
  const isStatusFinal = STATUS_FINAIS.includes(novoStatus);

  // Fetch associado's plan coverages and benefits when concluding
  const { data: itensDisponiveis, isLoading: loadingItens } = useQuery({
    queryKey: ['sinistro-plano-itens', sinistro?.id],
    queryFn: async () => {
      if (!sinistro) return [];

      // Get sinistro's associado_id
      const { data: sinistroData } = await supabase
        .from('sinistros')
        .select('associado_id')
        .eq('id', sinistro.id)
        .single();

      if (!sinistroData?.associado_id) return [];

      // Get associado's plano_id
      const { data: associado } = await supabase
        .from('associados')
        .select('plano_id')
        .eq('id', sinistroData.associado_id)
        .single();

      if (!associado?.plano_id) return [];

      const items: ItemDisponivel[] = [];

      // Fetch coberturas do plano
      const { data: coberturas } = await supabase
        .from('planos_coberturas' as any)
        .select('cobertura_id, coberturas:cobertura_id(id, nome)')
        .eq('plano_id', associado.plano_id);

      if (coberturas) {
        for (const c of coberturas as any[]) {
          if (c.coberturas) {
            items.push({
              id: c.coberturas.id,
              nome: c.coberturas.nome,
              tipo: 'cobertura',
              ref_id: c.coberturas.id,
              ref_field: 'cobertura_id',
            });
          }
        }
      }

      // Fetch benefícios do plano
      const { data: beneficios } = await supabase
        .from('planos_beneficios')
        .select('benefit_id, benefits:benefit_id(id, name)')
        .eq('plano_id', associado.plano_id);

      if (beneficios) {
        for (const b of beneficios as any[]) {
          if (b.benefits) {
            items.push({
              id: b.benefits.id,
              nome: b.benefits.name,
              tipo: 'beneficio',
              ref_id: b.benefits.id,
              ref_field: 'benefit_id',
            });
          }
        }
      }

      return items;
    },
    enabled: !!sinistro && open && isStatusFinal,
  });

  const toggleItem = (item: ItemDisponivel) => {
    setItensSelecionados(prev => {
      const exists = prev.find(i => i.item.id === item.id);
      if (exists) return prev.filter(i => i.item.id !== item.id);
      return [...prev, { item, valor: 0, observacao: '' }];
    });
  };

  const updateItemValor = (itemId: string, valor: number) => {
    setItensSelecionados(prev =>
      prev.map(i => i.item.id === itemId ? { ...i, valor } : i)
    );
  };

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

      // 3. Inserir coberturas/benefícios utilizados (se status final)
      if (isStatusFinal && itensSelecionados.length > 0) {
        const registros = itensSelecionados.map(sel => ({
          sinistro_id: sinistro.id,
          [sel.item.ref_field]: sel.item.ref_id,
          tipo: sel.item.tipo,
          nome: sel.item.nome,
          valor: sel.valor,
          observacao: sel.observacao || null,
        }));

        const { error: cobError } = await supabase
          .from('sinistro_coberturas_utilizadas' as any)
          .insert(registros);

        if (cobError) throw cobError;
      }

      // 4. Notificar associado via WhatsApp
      try {
        await supabase.functions.invoke('notificar-sinistro', {
          body: { sinistro_id: sinistro.id, status: novoStatus }
        });
      } catch (notifErr) {
        console.error('[AtualizarStatus] Erro ao notificar:', notifErr);
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
      queryClient.invalidateQueries({ queryKey: ['sinistro-coberturas-utilizadas', sinistro?.id] });
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
    setItensSelecionados([]);
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
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
              <Badge className={statusAtual.class}>{statusAtual.label}</Badge>
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

          {/* Coberturas/Benefícios - apenas se status final */}
          {isStatusFinal && (
            <div className="space-y-3 border-t pt-4">
              <Label className="text-base font-semibold">Coberturas / Benefícios Utilizados</Label>
              <p className="text-xs text-muted-foreground">
                Marque os itens acionados neste evento e informe o custo de cada.
              </p>

              {loadingItens ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : !itensDisponiveis?.length ? (
                <p className="text-sm text-muted-foreground py-2">
                  Nenhuma cobertura ou benefício vinculado ao plano do associado.
                </p>
              ) : (
                <div className="space-y-2">
                  {itensDisponiveis.map((item) => {
                    const selecionado = itensSelecionados.find(i => i.item.id === item.id);
                    return (
                      <div key={item.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={!!selecionado}
                            onCheckedChange={() => toggleItem(item)}
                          />
                          {item.tipo === 'cobertura' ? (
                            <Shield className="h-4 w-4 text-primary" />
                          ) : (
                            <Gift className="h-4 w-4 text-accent-foreground" />
                          )}
                          <span className="text-sm font-medium flex-1">{item.nome}</span>
                          <Badge variant="outline" className="text-xs">
                            {item.tipo === 'cobertura' ? 'Cobertura' : 'Benefício'}
                          </Badge>
                        </div>
                        {selecionado && (
                          <div className="pl-8">
                            <Label className="text-xs">Valor (R$)</Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={selecionado.valor || ''}
                              onChange={(e) => updateItemValor(item.id, parseFloat(e.target.value) || 0)}
                              className="h-8 mt-1"
                              placeholder="0,00"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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
