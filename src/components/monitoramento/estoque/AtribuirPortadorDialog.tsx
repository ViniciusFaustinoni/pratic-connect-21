import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User, UserMinus } from 'lucide-react';
import { useProfissionaisEquipe } from '@/hooks/useEquipe';

interface AtribuirPortadorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rastreador: {
    id: string;
    codigo: string;
    portador_id: string | null;
    portador_nome: string | null;
  } | null;
}

export function AtribuirPortadorDialog({ 
  open, 
  onOpenChange, 
  rastreador 
}: AtribuirPortadorDialogProps) {
  const queryClient = useQueryClient();
  const { data: profissionais, isLoading: loadingProfissionais } = useProfissionaisEquipe();
  const [portadorId, setPortadorId] = useState<string>('');

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setPortadorId('');
    }
  }, [open]);

  const atribuirMutation = useMutation({
    mutationFn: async () => {
      if (!rastreador) throw new Error('Rastreador não selecionado');
      
      const novoPortadorId = portadorId === 'remover' ? null : portadorId;
      const profissionalSelecionado = profissionais?.find(p => p.id === portadorId);
      
      // Atualizar rastreador
      const { error } = await supabase
        .from('rastreadores')
        .update({ 
          portador_id: novoPortadorId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rastreador.id);

      if (error) throw error;

      // Registrar movimentação no histórico
      const { error: movError } = await supabase
        .from('estoque_movimentacoes')
        .insert({
          rastreador_id: rastreador.id,
          tipo: novoPortadorId ? 'atribuicao_portador' : 'remocao_portador',
          quantidade: 1,
          observacoes: novoPortadorId 
            ? `Atribuído ao profissional: ${profissionalSelecionado?.nome || 'N/A'}` 
            : `Removido do portador: ${rastreador.portador_nome || 'N/A'}`,
        });

      if (movError) {
        console.error('Erro ao registrar movimentação:', movError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lista-rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores'] });
      if (rastreador?.id) {
        queryClient.invalidateQueries({ queryKey: ['rastreador', rastreador.id] });
      }
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentacoes'] });
      toast.success(
        portadorId === 'remover'
          ? 'Portador removido com sucesso!'
          : 'Portador atribuído com sucesso!'
      );
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Erro ao atribuir portador:', error);
      toast.error('Erro ao atribuir portador');
    },
  });

  const profissionaisAtivos = profissionais?.filter(p => p.ativo) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Atribuir Portador
          </DialogTitle>
          <DialogDescription>
            Rastreador: <span className="font-mono font-medium">{rastreador?.codigo}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {rastreador?.portador_nome && (
            <Alert>
              <User className="h-4 w-4" />
              <AlertDescription>
                Atualmente com: <strong>{rastreador.portador_nome}</strong>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Profissional Responsável</label>
            <Select value={portadorId} onValueChange={setPortadorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o profissional" />
              </SelectTrigger>
              <SelectContent>
                {rastreador?.portador_id && (
                  <SelectItem value="remover" className="text-destructive">
                    <span className="flex items-center gap-2">
                      <UserMinus className="h-4 w-4" />
                      Remover atribuição
                    </span>
                  </SelectItem>
                )}
                {loadingProfissionais ? (
                  <SelectItem value="_loading" disabled>
                    Carregando...
                  </SelectItem>
                ) : profissionaisAtivos.length === 0 ? (
                  <SelectItem value="_empty" disabled>
                    Nenhum profissional disponível
                  </SelectItem>
                ) : (
                  profissionaisAtivos.map((p) => (
                    <SelectItem 
                      key={p.id} 
                      value={p.id}
                      disabled={p.id === rastreador?.portador_id}
                    >
                      {p.nome}
                      {p.id === rastreador?.portador_id && ' (atual)'}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => atribuirMutation.mutate()}
            disabled={!portadorId || atribuirMutation.isPending}
          >
            {atribuirMutation.isPending ? 'Salvando...' : 'Atribuir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
