import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Beneficio {
  id: string;
  nome: string;
  tipo: string;
  fornecedor: string | null;
  valor_empresa: number | null;
  valor_funcionario: number | null;
  ativo: boolean;
}

interface BeneficioFormModalProps {
  open: boolean;
  onClose: () => void;
  beneficio?: Beneficio | null;
  mode: 'create' | 'edit' | 'view';
}

const tiposBeneficio = [
  { value: 'vale_transporte', label: 'Vale Transporte' },
  { value: 'vale_refeicao', label: 'Vale Refeição' },
  { value: 'vale_alimentacao', label: 'Vale Alimentação' },
  { value: 'plano_saude', label: 'Plano de Saúde' },
  { value: 'plano_odontologico', label: 'Plano Odontológico' },
  { value: 'seguro_vida', label: 'Seguro de Vida' },
  { value: 'gympass', label: 'Gympass' },
];

export function BeneficioFormModal({ open, onClose, beneficio, mode }: BeneficioFormModalProps) {
  const queryClient = useQueryClient();
  const isView = mode === 'view';
  
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('vale_transporte');
  const [fornecedor, setFornecedor] = useState('');
  const [valorEmpresa, setValorEmpresa] = useState('');
  const [valorFuncionario, setValorFuncionario] = useState('');
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (beneficio) {
      setNome(beneficio.nome);
      setTipo(beneficio.tipo);
      setFornecedor(beneficio.fornecedor || '');
      setValorEmpresa(beneficio.valor_empresa?.toString() || '');
      setValorFuncionario(beneficio.valor_funcionario?.toString() || '');
      setAtivo(beneficio.ativo);
    } else {
      setNome('');
      setTipo('vale_transporte');
      setFornecedor('');
      setValorEmpresa('');
      setValorFuncionario('');
      setAtivo(true);
    }
  }, [beneficio, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const data = {
        nome,
        tipo,
        fornecedor: fornecedor || null,
        valor_empresa: valorEmpresa ? parseFloat(valorEmpresa) : null,
        valor_funcionario: valorFuncionario ? parseFloat(valorFuncionario) : null,
        ativo
      };

      if (mode === 'edit' && beneficio) {
        const { error } = await supabase
          .from('beneficios')
          .update(data)
          .eq('id', beneficio.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('beneficios')
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficios'] });
      toast.success(mode === 'edit' ? 'Benefício atualizado!' : 'Benefício criado!');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao salvar benefício');
    }
  });

  const title = mode === 'create' ? 'Novo Benefício' : mode === 'edit' ? 'Editar Benefício' : 'Detalhes do Benefício';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input 
              value={nome} 
              onChange={(e) => setNome(e.target.value)} 
              disabled={isView}
              placeholder="Nome do benefício"
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo *</Label>
            <Select value={tipo} onValueChange={setTipo} disabled={isView}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tiposBeneficio.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fornecedor</Label>
            <Input 
              value={fornecedor} 
              onChange={(e) => setFornecedor(e.target.value)} 
              disabled={isView}
              placeholder="Nome do fornecedor"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor Empresa (R$)</Label>
              <Input 
                type="number"
                step="0.01"
                value={valorEmpresa} 
                onChange={(e) => setValorEmpresa(e.target.value)} 
                disabled={isView}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Valor Funcionário (R$)</Label>
              <Input 
                type="number"
                step="0.01"
                value={valorFuncionario} 
                onChange={(e) => setValorFuncionario(e.target.value)} 
                disabled={isView}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label>Ativo</Label>
            <Switch checked={ativo} onCheckedChange={setAtivo} disabled={isView} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {isView ? 'Fechar' : 'Cancelar'}
          </Button>
          {!isView && (
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !nome}>
              {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {mode === 'edit' ? 'Salvar' : 'Criar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
