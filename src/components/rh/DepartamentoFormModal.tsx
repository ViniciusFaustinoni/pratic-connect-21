import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Departamento {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

interface DepartamentoFormModalProps {
  open: boolean;
  onClose: () => void;
  departamento?: Departamento | null;
}

export function DepartamentoFormModal({ open, onClose, departamento }: DepartamentoFormModalProps) {
  const queryClient = useQueryClient();
  const isEdit = !!departamento;
  
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (departamento) {
      setNome(departamento.nome);
      setDescricao(departamento.descricao || '');
      setAtivo(departamento.ativo);
    } else {
      setNome('');
      setDescricao('');
      setAtivo(true);
    }
  }, [departamento, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const data = {
        nome,
        descricao: descricao || null,
        ativo
      };

      if (isEdit && departamento) {
        const { error } = await supabase
          .from('departamentos')
          .update(data)
          .eq('id', departamento.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('departamentos')
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departamentos'] });
      toast.success(isEdit ? 'Departamento atualizado!' : 'Departamento criado!');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao salvar departamento');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!departamento) return;
      const { error } = await supabase
        .from('departamentos')
        .delete()
        .eq('id', departamento.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departamentos'] });
      toast.success('Departamento excluído!');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao excluir. Verifique se não há funcionários vinculados.');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Departamento' : 'Novo Departamento'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input 
              value={nome} 
              onChange={(e) => setNome(e.target.value)} 
              placeholder="Nome do departamento"
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição do departamento..."
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Ativo</Label>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {isEdit && (
              <Button 
                variant="destructive" 
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !nome}>
              {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
