import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AprovarSinistroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sinistroId: string;
  protocolo: string;
  onSuccess?: () => void;
}

export function AprovarSinistroDialog({
  open,
  onOpenChange,
  sinistroId,
  protocolo,
  onSuccess,
}: AprovarSinistroDialogProps) {
  const queryClient = useQueryClient();
  const [observacao, setObservacao] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('aprovar-sinistro', {
        body: {
          sinistro_id: sinistroId,
          observacao: observacao.trim() || undefined,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Erro ao aprovar sinistro');

      return data;
    },
    onSuccess: () => {
      toast.success('Sinistro aprovado com sucesso!', {
        description: 'O associado foi notificado via WhatsApp.',
      });
      queryClient.invalidateQueries({ queryKey: ['sinistro'] });
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      queryClient.invalidateQueries({ queryKey: ['sinistros-pendentes-analise'] });
      setObservacao('');
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error) => {
      console.error('Erro ao aprovar sinistro:', error);
      toast.error('Erro ao aprovar sinistro', {
        description: error instanceof Error ? error.message : 'Tente novamente',
      });
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            Aprovar Sinistro
          </AlertDialogTitle>
          <AlertDialogDescription>
            Confirma a aprovação do sinistro <strong>{protocolo}</strong>?
            O status será alterado para "Em Análise" e o associado será notificado.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          <Label htmlFor="observacao">Observação (opcional)</Label>
          <Textarea
            id="observacao"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Adicione uma observação sobre a aprovação..."
            className="mt-2"
            rows={3}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancelar</AlertDialogCancel>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Aprovando...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirmar Aprovação
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
