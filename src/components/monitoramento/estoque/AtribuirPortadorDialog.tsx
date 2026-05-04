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
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { User } from 'lucide-react';
import { useProfissionaisEquipe } from '@/hooks/useEquipe';
import { ProfissionalPicker } from './ProfissionalPicker';
import { Badge } from '@/components/ui/badge';

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
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <User className="h-4 w-4" />
            </div>
            Atribuir Portador
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 pt-1">
            <Badge variant="outline" className="font-mono">
              {rastreador?.codigo}
            </Badge>
            {rastreador?.portador_nome && (
              <span className="text-xs">
                Atualmente com{' '}
                <strong className="text-foreground">
                  {rastreador.portador_nome}
                </strong>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">
              Profissional Responsável
            </label>
            <span className="text-xs text-muted-foreground">
              {profissionaisAtivos.length} disponíveis
            </span>
          </div>
          <ProfissionalPicker
            profissionais={profissionaisAtivos}
            value={portadorId}
            onChange={setPortadorId}
            loading={loadingProfissionais}
            currentPortadorId={rastreador?.portador_id}
            allowRemove
          />
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => atribuirMutation.mutate()}
            disabled={!portadorId || atribuirMutation.isPending}
          >
            {atribuirMutation.isPending ? 'Salvando...' : 'Confirmar Atribuição'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
