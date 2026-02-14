import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface EncaminharJuridicoEventoModalProps {
  open: boolean;
  onClose: () => void;
  sinistroId: string;
  protocolo: string;
  associadoId?: string | null;
  associadoNome?: string | null;
}

const MOTIVOS_JURIDICO = [
  { value: 'disputa_propriedade', label: 'Disputa de propriedade' },
  { value: 'gravame_judicial', label: 'Veículo com gravame judicial' },
  { value: 'espolio', label: 'Espólio / massa falida' },
  { value: 'litigio_partes', label: 'Litígio entre partes' },
  { value: 'outro', label: 'Outro (especificar)' },
] as const;

export function EncaminharJuridicoEventoModal({
  open, onClose, sinistroId, protocolo, associadoId, associadoNome,
}: EncaminharJuridicoEventoModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState('');
  const [descricao, setDescricao] = useState('');

  const encaminharMutation = useMutation({
    mutationFn: async () => {
      if (!motivo) throw new Error('Selecione um motivo');
      if (descricao.length < 20) throw new Error('Descrição deve ter pelo menos 20 caracteres');

      const motivoLabel = MOTIVOS_JURIDICO.find(m => m.value === motivo)?.label || motivo;

      // 1. Criar consulta jurídica
      const { error: consultaError } = await supabase.from('consultas_juridicas').insert({
        sinistro_id: sinistroId,
        associado_id: associadoId || undefined,
        solicitante_id: user?.id,
        assunto: `Encaminhamento Jurídico — ${motivoLabel}`,
        descricao: `Evento ${protocolo} encaminhado ao jurídico.\nMotivo: ${motivoLabel}\nAssociado: ${associadoNome || 'N/I'}\n\n${descricao}`,
        prioridade: 'alta',
        departamento: 'eventos',
        status: 'pendente',
      });
      if (consultaError) throw consultaError;

      // 2. Atualizar sinistro para suspenso
      const { error: updateError } = await supabase
        .from('sinistros')
        .update({
          status: 'suspenso',
          motivo_suspensao: `Encaminhado ao jurídico: ${motivoLabel}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sinistroId);
      if (updateError) throw updateError;

      // 3. Registrar histórico
      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistroId,
        status_novo: 'suspenso',
        usuario_id: user?.id,
        observacao: `Encaminhado para Jurídico. Motivo: ${motivoLabel}. ${descricao}`,
      });
    },
    onSuccess: () => {
      toast.success('Evento encaminhado para o Jurídico');
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-historico', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao encaminhar');
    },
  });

  const handleClose = () => {
    setMotivo('');
    setDescricao('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Encaminhar para Jurídico
          </DialogTitle>
          <DialogDescription>Evento {protocolo}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Motivo do Encaminhamento *</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_JURIDICO.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descrição Detalhada *</Label>
            <Textarea
              placeholder="Descreva o motivo do encaminhamento e detalhes relevantes... (mín. 20 caracteres)"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className={`text-xs ${descricao.length < 20 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {descricao.length}/20 caracteres mínimos
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={encaminharMutation.isPending}>Cancelar</Button>
          <Button
            onClick={() => encaminharMutation.mutate()}
            disabled={encaminharMutation.isPending || !motivo || descricao.length < 20}
          >
            {encaminharMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Encaminhar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
