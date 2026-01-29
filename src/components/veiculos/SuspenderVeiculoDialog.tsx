import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, PauseCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Veiculo {
  id: string;
  placa: string;
  marca?: string | null;
  modelo?: string | null;
  associado_id?: string | null;
}

interface SuspenderVeiculoDialogProps {
  open: boolean;
  onClose: () => void;
  veiculo: Veiculo | null;
}

const motivosOpcoes = [
  { value: 'suspensao_temporaria', label: 'Suspensão temporária (férias/viagem)' },
  { value: 'cancelamento', label: 'Cancelamento do contrato' },
  { value: 'venda', label: 'Venda do veículo' },
  { value: 'outro', label: 'Outro motivo' },
];

export function SuspenderVeiculoDialog({ open, onClose, veiculo }: SuspenderVeiculoDialogProps) {
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState<string>('');
  const [observacoes, setObservacoes] = useState('');

  const handleClose = () => {
    setMotivo('');
    setObservacoes('');
    onClose();
  };

  const suspenderMutation = useMutation({
    mutationFn: async () => {
      if (!veiculo) throw new Error('Veículo não encontrado');
      if (!motivo) throw new Error('Selecione um motivo');

      console.log('[SuspenderVeiculo] Suspendendo veículo:', veiculo.placa);

      // Chamar edge function para inativar
      const { data, error } = await supabase.functions.invoke('rede-veiculos-inativar-veiculo', {
        body: {
          veiculoId: veiculo.id,
          motivo: motivo as 'suspensao_temporaria' | 'cancelamento' | 'venda' | 'outro',
          observacoes: observacoes || undefined,
          atualizarBancoLocal: true,
        },
      });

      if (error) {
        throw new Error(error.message || 'Erro ao suspender veículo');
      }

      return data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['associado'] });

      if (result?.apiSuccess) {
        toast.success(`Veículo ${veiculo?.placa} suspenso com sucesso!`);
      } else {
        toast.warning(`Veículo ${veiculo?.placa} suspenso localmente (erro na plataforma)`);
      }

      handleClose();
    },
    onError: (error) => {
      console.error('[SuspenderVeiculo] Erro:', error);
      toast.error(`Erro ao suspender veículo: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo) {
      toast.error('Selecione um motivo para a suspensão');
      return;
    }
    suspenderMutation.mutate();
  };

  if (!veiculo) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PauseCircle className="h-5 w-5 text-warning" />
            Suspender Veículo
          </DialogTitle>
          <DialogDescription>
            {veiculo.placa} - {veiculo.marca}/{veiculo.modelo}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo da Suspensão *</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {motivosOpcoes.map((opcao) => (
                  <SelectItem key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações adicionais (opcional)"
              rows={3}
            />
          </div>

          <div className="rounded-lg border border-warning/50 bg-warning/10 p-3">
            <p className="text-sm text-warning-foreground">
              <strong>Atenção:</strong> O veículo será inativado na plataforma de rastreamento 
              e não aparecerá mais no aplicativo do associado.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={suspenderMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!motivo || suspenderMutation.isPending}
            >
              {suspenderMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Suspender Veículo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
