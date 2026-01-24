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
import { Users, Loader2 } from 'lucide-react';
import { useProfissionaisEquipe } from '@/hooks/useEquipe';

interface AtribuirPortadorLoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rastreadorIds: string[];
  onSuccess: () => void;
}

export function AtribuirPortadorLoteDialog({ 
  open, 
  onOpenChange, 
  rastreadorIds,
  onSuccess
}: AtribuirPortadorLoteDialogProps) {
  const queryClient = useQueryClient();
  const { data: profissionais, isLoading: loadingProfissionais } = useProfissionaisEquipe();
  const [portadorId, setPortadorId] = useState<string>('');

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setPortadorId('');
    }
  }, [open]);

  const atribuirLoteMutation = useMutation({
    mutationFn: async () => {
      if (rastreadorIds.length === 0) throw new Error('Nenhum rastreador selecionado');
      if (!portadorId) throw new Error('Nenhum portador selecionado');
      
      const profissionalSelecionado = profissionais?.find(p => p.id === portadorId);
      
      // Atualizar todos os rastreadores selecionados
      const { error } = await supabase
        .from('rastreadores')
        .update({ 
          portador_id: portadorId,
          updated_at: new Date().toISOString(),
        })
        .in('id', rastreadorIds);

      if (error) throw error;

      // Registrar movimentações em lote
      const movimentacoes = rastreadorIds.map(id => ({
        rastreador_id: id,
        tipo: 'atribuicao_portador' as const,
        quantidade: 1,
        observacoes: `Atribuído ao profissional: ${profissionalSelecionado?.nome || 'N/A'} (lote de ${rastreadorIds.length})`,
      }));

      const { error: movError } = await supabase
        .from('estoque_movimentacoes')
        .insert(movimentacoes);

      if (movError) {
        console.error('Erro ao registrar movimentações:', movError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lista-rastreadores'] });
      queryClient.invalidateQueries({ queryKey: ['rastreadores-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentacoes'] });
      queryClient.invalidateQueries({ queryKey: ['profissionais-equipe'] });
      toast.success(`${rastreadorIds.length} rastreador(es) atribuído(s) com sucesso!`);
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Erro ao atribuir portador em lote:', error);
      toast.error('Erro ao atribuir portador');
    },
  });

  const profissionaisAtivos = profissionais?.filter(p => p.ativo) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Atribuir Portador em Lote
          </DialogTitle>
          <DialogDescription>
            Atribuir {rastreadorIds.length} rastreador(es) a um profissional
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <Users className="h-4 w-4" />
            <AlertDescription>
              <strong>{rastreadorIds.length}</strong> rastreador(es) serão atribuídos ao profissional selecionado.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium">Profissional Responsável</label>
            <Select value={portadorId} onValueChange={setPortadorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o profissional" />
              </SelectTrigger>
              <SelectContent>
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
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                      {p.rastreadores_atribuidos > 0 && (
                        <span className="ml-2 text-muted-foreground">
                          ({p.rastreadores_atribuidos} em posse)
                        </span>
                      )}
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
            onClick={() => atribuirLoteMutation.mutate()}
            disabled={!portadorId || atribuirLoteMutation.isPending}
          >
            {atribuirLoteMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Atribuindo...
              </>
            ) : (
              `Atribuir ${rastreadorIds.length} Rastreador(es)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
