import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, PauseCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const MOTIVOS_SUSPENSAO = [
  'Inquérito policial',
  'Mandado judicial',
  'Aguardando perícia oficial',
  'Determinação da diretoria',
  'Outro',
] as const;

interface SuspenderEventoModalProps {
  open: boolean;
  onClose: () => void;
  sinistroId: string;
  protocolo: string;
}

export function SuspenderEventoModal({
  open, onClose, sinistroId, protocolo,
}: SuspenderEventoModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState('');
  const [numeroProcesso, setNumeroProcesso] = useState('');
  const [previsaoRetorno, setPrevisaoRetorno] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      if (!motivo) throw new Error('Selecione o motivo');

      const motivoCompleto = [
        motivo,
        numeroProcesso && `Processo/Inquérito: ${numeroProcesso}`,
        previsaoRetorno && `Previsão de retorno: ${format(new Date(previsaoRetorno), 'dd/MM/yyyy')}`,
        observacoes,
      ].filter(Boolean).join('. ');

      const { error } = await supabase.from('sinistros').update({
        status: 'suspenso' as any,
        motivo_suspensao: motivoCompleto,
        updated_at: new Date().toISOString(),
      }).eq('id', sinistroId);
      if (error) throw error;

      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistroId,
        status_novo: 'suspenso',
        usuario_id: user?.id,
        observacao: `Evento suspenso. ${motivoCompleto}`,
      });
    },
    onSuccess: () => {
      toast.success('Evento suspenso');
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-analise', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-historico', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      handleClose();
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao suspender'),
  });

  const handleClose = () => {
    setMotivo('');
    setNumeroProcesso('');
    setPrevisaoRetorno('');
    setObservacoes('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PauseCircle className="h-5 w-5 text-muted-foreground" />
            Suspender Evento
          </DialogTitle>
          <DialogDescription>Evento {protocolo}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Motivo *</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {MOTIVOS_SUSPENSAO.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nº do Inquérito/Processo</Label>
            <Input
              placeholder="Ex: 001234/2026"
              value={numeroProcesso}
              onChange={(e) => setNumeroProcesso(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Previsão de Retorno</Label>
            <Input
              type="date"
              value={previsaoRetorno}
              onChange={(e) => setPrevisaoRetorno(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Observações adicionais..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>Cancelar</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !motivo}
            variant="secondary"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Suspender
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
