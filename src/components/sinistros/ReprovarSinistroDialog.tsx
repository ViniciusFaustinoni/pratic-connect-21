import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { XCircle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MOTIVOS_REPROVACAO = [
  { value: 'fora_cobertura', label: 'Evento fora da cobertura' },
  { value: 'documentacao_invalida', label: 'Documentação inválida ou inconsistente' },
  { value: 'fraude_suspeita', label: 'Suspeita de fraude' },
  { value: 'prazo_expirado', label: 'Prazo para comunicação expirado' },
  { value: 'inadimplencia', label: 'Associado inadimplente' },
  { value: 'carencia', label: 'Veículo em período de carência' },
  { value: 'outro', label: 'Outro motivo' },
];

interface ReprovarSinistroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sinistroId: string;
  protocolo: string;
  onSuccess?: () => void;
}

export function ReprovarSinistroDialog({
  open,
  onOpenChange,
  sinistroId,
  protocolo,
  onSuccess,
}: ReprovarSinistroDialogProps) {
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState('');
  const [justificativa, setJustificativa] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      if (!motivo) throw new Error('Selecione o motivo da reprovação');
      if (!justificativa.trim()) throw new Error('Informe a justificativa');

      const { data, error } = await supabase.functions.invoke('reprovar-sinistro', {
        body: {
          sinistro_id: sinistroId,
          motivo,
          justificativa: justificativa.trim(),
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao reprovar sinistro');

      return data;
    },
    onSuccess: () => {
      toast.success('Sinistro reprovado', {
        description: 'O associado foi notificado via WhatsApp.',
      });
      queryClient.invalidateQueries({ queryKey: ['sinistro'] });
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      queryClient.invalidateQueries({ queryKey: ['sinistros-pendentes-analise'] });
      handleClose();
      onSuccess?.();
    },
    onError: (error) => {
      console.error('Erro ao reprovar sinistro:', error);
      toast.error('Erro ao reprovar sinistro', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    },
  });

  const handleClose = () => {
    setMotivo('');
    setJustificativa('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Reprovar Sinistro
          </DialogTitle>
          <DialogDescription>
            Informe o motivo e justificativa para reprovar o sinistro <strong>{protocolo}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="motivo">Motivo da Reprovação *</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_REPROVACAO.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="justificativa">Justificativa Detalhada *</Label>
            <Textarea
              id="justificativa"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Descreva detalhadamente o motivo da reprovação..."
              className="mt-2"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={!motivo || !justificativa.trim() || mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Reprovando...
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 mr-2" />
                Confirmar Reprovação
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
