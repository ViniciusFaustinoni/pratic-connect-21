import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, MapPin, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VeiculoRecuperadoEstado } from '@/types/sinistros';

interface RegistrarRecuperacaoDialogProps {
  open: boolean;
  onClose: () => void;
  sinistroId: string;
  protocolo: string;
  onSuccess?: () => void;
}

export function RegistrarRecuperacaoDialog({
  open,
  onClose,
  sinistroId,
  protocolo,
  onSuccess,
}: RegistrarRecuperacaoDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [recuperado, setRecuperado] = useState<'sim' | 'nao'>('sim');
  const [estado, setEstado] = useState<VeiculoRecuperadoEstado>('sem_dano');
  const [local, setLocal] = useState('');
  const [observacao, setObservacao] = useState('');

  const registrarMutation = useMutation({
    mutationFn: async () => {
      const foiRecuperado = recuperado === 'sim';
      
      // Determinar próximo status
      let novoStatus: string;
      if (!foiRecuperado) {
        // Não recuperado = Perda Total
        novoStatus = 'aguardando_pagamento';
      } else if (estado === 'sem_dano') {
        // Recuperado sem dano = Encerrar
        novoStatus = 'encerrado';
      } else if (estado === 'dano_total') {
        // Recuperado com dano total = Perda Total
        novoStatus = 'aguardando_pagamento';
      } else {
        // Recuperado com dano parcial = Regulação/Reparo
        novoStatus = 'em_regulacao';
      }

      // 1. Atualizar sinistro
      const updateData: any = {
        status: novoStatus,
        veiculo_recuperado: foiRecuperado,
        veiculo_recuperado_em: foiRecuperado ? new Date().toISOString() : null,
        veiculo_recuperado_local: foiRecuperado ? local : null,
        veiculo_recuperado_estado: foiRecuperado ? estado : null,
        tipo_dano: !foiRecuperado || estado === 'dano_total' ? 'perda_total' : 'parcial',
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('sinistros')
        .update(updateData)
        .eq('id', sinistroId);

      if (updateError) throw updateError;

      // 2. Registrar histórico
      let descricao = '';
      if (!foiRecuperado) {
        descricao = 'Veículo não recuperado. Prosseguindo para indenização.';
      } else if (estado === 'sem_dano') {
        descricao = `Veículo recuperado sem danos em: ${local}. ABP desonerada.`;
      } else if (estado === 'dano_total') {
        descricao = `Veículo recuperado com perda total em: ${local}. Prosseguindo para indenização.`;
      } else {
        descricao = `Veículo recuperado com danos parciais em: ${local}. Prosseguindo para regulação e reparo.`;
      }

      const { error: histError } = await supabase
        .from('sinistro_historico')
        .insert({
          sinistro_id: sinistroId,
          status_anterior: 'em_recuperacao',
          status_novo: novoStatus,
          usuario_id: user?.id,
          observacao: `${descricao}${observacao ? ` Obs: ${observacao}` : ''}`,
        });

      if (histError) throw histError;

      // 3. Notificar
      try {
        await supabase.functions.invoke('notificar-sinistro', {
          body: {
            sinistro_id: sinistroId,
            status: novoStatus,
            dados_extras: { recuperado: foiRecuperado, estado, local },
          },
        });
      } catch (err) {
        console.error('Erro ao notificar:', err);
      }
    },
    onSuccess: () => {
      toast.success('Recuperação registrada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-analise', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      handleClose();
      onSuccess?.();
    },
    onError: (error) => {
      console.error('Erro ao registrar:', error);
      toast.error('Erro ao registrar recuperação');
    },
  });

  const handleClose = () => {
    setRecuperado('sim');
    setEstado('sem_dano');
    setLocal('');
    setObservacao('');
    onClose();
  };

  const handleSubmit = () => {
    if (recuperado === 'sim' && !local.trim()) {
      toast.error('Informe o local de recuperação');
      return;
    }
    registrarMutation.mutate();
  };

  const estadoLabels: Record<VeiculoRecuperadoEstado, string> = {
    sem_dano: 'Sem danos (ABP desonerada)',
    dano_parcial: 'Danos parciais (<75% FIPE)',
    dano_total: 'Perda total (≥75% FIPE)',
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-fuchsia-600" />
            Registrar Recuperação
          </DialogTitle>
          <DialogDescription>
            Sinistro {protocolo} - Roubo/Furto
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Veículo foi recuperado? */}
          <div className="space-y-3">
            <Label>O veículo foi recuperado?</Label>
            <RadioGroup
              value={recuperado}
              onValueChange={(v) => setRecuperado(v as 'sim' | 'nao')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sim" id="rec-sim" />
                <Label htmlFor="rec-sim" className="font-normal">Sim</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="nao" id="rec-nao" />
                <Label htmlFor="rec-nao" className="font-normal">Não</Label>
              </div>
            </RadioGroup>
          </div>

          {recuperado === 'sim' && (
            <>
              {/* Estado do veículo */}
              <div className="space-y-3">
                <Label>Estado do veículo</Label>
                <RadioGroup
                  value={estado}
                  onValueChange={(v) => setEstado(v as VeiculoRecuperadoEstado)}
                  className="space-y-2"
                >
                  {(Object.keys(estadoLabels) as VeiculoRecuperadoEstado[]).map((key) => (
                    <div key={key} className="flex items-center space-x-2">
                      <RadioGroupItem value={key} id={`estado-${key}`} />
                      <Label htmlFor={`estado-${key}`} className="font-normal">
                        {estadoLabels[key]}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Local de recuperação */}
              <div className="space-y-2">
                <Label htmlFor="local" className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  Local de Recuperação *
                </Label>
                <Input
                  id="local"
                  placeholder="Ex: Pátio PRF - BR-101 km 320"
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                />
              </div>
            </>
          )}

          {recuperado === 'nao' && (
            <div className="p-3 rounded-md bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-800">
                ⚠️ Se o veículo não foi recuperado, o sinistro será classificado como 
                <strong> Perda Total</strong> e prosseguirá para indenização.
              </p>
            </div>
          )}

          {/* Observação */}
          <div className="space-y-2">
            <Label htmlFor="observacao">Observações</Label>
            <Textarea
              id="observacao"
              placeholder="Observações adicionais..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={registrarMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={registrarMutation.isPending}
            className="bg-fuchsia-600 hover:bg-fuchsia-700"
          >
            {registrarMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
