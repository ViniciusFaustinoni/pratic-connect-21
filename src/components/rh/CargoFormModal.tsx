import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Cargo {
  id: string;
  nome: string;
  departamento_id: string | null;
  nivel: number | null;
  cbo: string | null;
  salario_base: number | null;
  ativo: boolean;
}

interface CargoFormModalProps {
  open: boolean;
  onClose: () => void;
  cargo?: Cargo | null;
}

const niveis = [
  { value: '1', label: 'Junior' },
  { value: '2', label: 'Pleno' },
  { value: '3', label: 'Senior' },
  { value: '4', label: 'Coordenador' },
  { value: '5', label: 'Gerente' },
  { value: '6', label: 'Diretor' },
];

export function CargoFormModal({ open, onClose, cargo }: CargoFormModalProps) {
  const queryClient = useQueryClient();
  const isEdit = !!cargo;
  
  const [nome, setNome] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');
  const [nivel, setNivel] = useState('');
  const [cbo, setCbo] = useState('');
  const [salarioBase, setSalarioBase] = useState('');
  const [ativo, setAtivo] = useState(true);

  const { data: departamentos } = useQuery({
    queryKey: ['departamentos'],
    queryFn: async () => {
      const { data } = await supabase
        .from('departamentos')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      return data || [];
    }
  });

  useEffect(() => {
    if (cargo) {
      setNome(cargo.nome);
      setDepartamentoId(cargo.departamento_id || '');
      setNivel(cargo.nivel?.toString() || '');
      setCbo(cargo.cbo || '');
      setSalarioBase(cargo.salario_base?.toString() || '');
      setAtivo(cargo.ativo);
    } else {
      setNome('');
      setDepartamentoId('');
      setNivel('');
      setCbo('');
      setSalarioBase('');
      setAtivo(true);
    }
  }, [cargo, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const data = {
        nome,
        departamento_id: departamentoId || null,
        nivel: nivel ? parseInt(nivel) : null,
        cbo: cbo || null,
        salario_base: salarioBase ? parseFloat(salarioBase) : null,
        ativo
      };

      if (isEdit && cargo) {
        const { error } = await supabase
          .from('cargos')
          .update(data)
          .eq('id', cargo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cargos')
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargos'] });
      toast.success(isEdit ? 'Cargo atualizado!' : 'Cargo criado!');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao salvar cargo');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!cargo) return;
      const { error } = await supabase
        .from('cargos')
        .delete()
        .eq('id', cargo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargos'] });
      toast.success('Cargo excluído!');
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
          <DialogTitle>{isEdit ? 'Editar Cargo' : 'Novo Cargo'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input 
              value={nome} 
              onChange={(e) => setNome(e.target.value)} 
              placeholder="Nome do cargo"
            />
          </div>

          <div className="space-y-2">
            <Label>Departamento</Label>
            <Select value={departamentoId} onValueChange={setDepartamentoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {departamentos?.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nível</Label>
              <Select value={nivel} onValueChange={setNivel}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {niveis.map(n => (
                    <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>CBO</Label>
              <Input 
                value={cbo} 
                onChange={(e) => setCbo(e.target.value)} 
                placeholder="000000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Salário Base (R$)</Label>
            <Input 
              type="number"
              step="0.01"
              value={salarioBase} 
              onChange={(e) => setSalarioBase(e.target.value)} 
              placeholder="0,00"
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
