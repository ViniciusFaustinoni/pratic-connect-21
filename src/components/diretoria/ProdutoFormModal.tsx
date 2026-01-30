import { useState, useEffect } from 'react';
import { Package, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Plano {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  tipo_veiculo: string | null;
  uso: string | null;
  fipe_minima: number | null;
  fipe_maxima: number | null;
  valor_adesao: number | null;
  ano_fabricacao_minimo: number | null;
  ano_fabricacao_maximo: number | null;
  destaque: boolean | null;
  ordem: number | null;
  ativo: boolean | null;
}

interface ProdutoFormModalProps {
  open: boolean;
  onClose: () => void;
  produto?: Plano | null;
}

const tiposVeiculo = [
  { value: 'carro', label: 'Carro' },
  { value: 'moto', label: 'Moto' },
  { value: 'caminhao', label: 'Caminhão' },
  { value: 'van', label: 'Van' },
  { value: 'utilitario', label: 'Utilitário' },
];

const tiposUso = [
  { value: 'particular', label: 'Particular' },
  { value: 'aplicativo', label: 'Aplicativo' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'taxi', label: 'Táxi' },
  { value: 'frota', label: 'Frota' },
];

export function ProdutoFormModal({ open, onClose, produto }: ProdutoFormModalProps) {
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    codigo: '',
    nome: '',
    descricao: '',
    tipo_veiculo: '',
    uso: '',
    fipe_minima: '',
    fipe_maxima: '',
    valor_adesao: '',
    ano_fabricacao_minimo: '',
    ano_fabricacao_maximo: '',
    destaque: false,
    ordem: '0',
    ativo: true,
  });

  useEffect(() => {
    if (produto) {
      setFormData({
        codigo: produto.codigo || '',
        nome: produto.nome || '',
        descricao: produto.descricao || '',
        tipo_veiculo: produto.tipo_veiculo || '',
        uso: produto.uso || '',
        fipe_minima: produto.fipe_minima?.toString() || '',
        fipe_maxima: produto.fipe_maxima?.toString() || '',
        valor_adesao: produto.valor_adesao?.toString() || '',
        ano_fabricacao_minimo: produto.ano_fabricacao_minimo?.toString() || '',
        ano_fabricacao_maximo: produto.ano_fabricacao_maximo?.toString() || '',
        destaque: produto.destaque || false,
        ordem: produto.ordem?.toString() || '0',
        ativo: produto.ativo ?? true,
      });
    } else {
      setFormData({
        codigo: '',
        nome: '',
        descricao: '',
        tipo_veiculo: '',
        uso: '',
        fipe_minima: '',
        fipe_maxima: '',
        valor_adesao: '',
        ano_fabricacao_minimo: '',
        ano_fabricacao_maximo: '',
        destaque: false,
        ordem: '0',
        ativo: true,
      });
    }
  }, [produto, open]);

  const saveProduto = useMutation({
    mutationFn: async () => {
      const data = {
        codigo: formData.codigo,
        nome: formData.nome,
        descricao: formData.descricao || null,
        tipo_veiculo: formData.tipo_veiculo || null,
        uso: formData.uso || null,
        fipe_minima: formData.fipe_minima ? parseFloat(formData.fipe_minima) : null,
        fipe_maxima: formData.fipe_maxima ? parseFloat(formData.fipe_maxima) : null,
        valor_adesao: formData.valor_adesao ? parseFloat(formData.valor_adesao) : null,
        ano_fabricacao_minimo: formData.ano_fabricacao_minimo ? parseInt(formData.ano_fabricacao_minimo) : null,
        ano_fabricacao_maximo: formData.ano_fabricacao_maximo ? parseInt(formData.ano_fabricacao_maximo) : null,
        destaque: formData.destaque,
        ordem: formData.ordem ? parseInt(formData.ordem) : 0,
        ativo: formData.ativo,
        updated_at: new Date().toISOString(),
      };

      if (produto) {
        const { error } = await supabase
          .from('planos')
          .update(data)
          .eq('id', produto.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('planos')
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(produto ? 'Produto atualizado!' : 'Produto criado!');
      queryClient.invalidateQueries({ queryKey: ['planos-gestao'] });
      if (produto) {
        queryClient.invalidateQueries({ queryKey: ['plano', produto.id] });
      }
      onClose();
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar: ' + error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.codigo || !formData.nome) {
      toast.error('Código e Nome são obrigatórios');
      return;
    }
    saveProduto.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {produto ? 'Editar Produto' : 'Novo Produto'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código *</Label>
              <Input
                id="codigo"
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                placeholder="Ex: CARRO-BASICO"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Proteção Carro Básica"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descrição do produto..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Veículo</Label>
              <Select
                value={formData.tipo_veiculo}
                onValueChange={(value) => setFormData({ ...formData, tipo_veiculo: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {tiposVeiculo.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Uso</Label>
              <Select
                value={formData.uso}
                onValueChange={(value) => setFormData({ ...formData, uso: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {tiposUso.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fipe_minima">FIPE Mínima (R$)</Label>
              <Input
                id="fipe_minima"
                type="number"
                value={formData.fipe_minima}
                onChange={(e) => setFormData({ ...formData, fipe_minima: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fipe_maxima">FIPE Máxima (R$)</Label>
              <Input
                id="fipe_maxima"
                type="number"
                value={formData.fipe_maxima}
                onChange={(e) => setFormData({ ...formData, fipe_maxima: e.target.value })}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor_adesao">Taxa de Filiação (R$)</Label>
              <Input
                id="valor_adesao"
                type="number"
                value={formData.valor_adesao}
                onChange={(e) => setFormData({ ...formData, valor_adesao: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ano_min">Ano Fabricação Mín.</Label>
              <Input
                id="ano_min"
                type="number"
                value={formData.ano_fabricacao_minimo}
                onChange={(e) => setFormData({ ...formData, ano_fabricacao_minimo: e.target.value })}
                placeholder="Ex: 2010"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ano_max">Ano Fabricação Máx.</Label>
              <Input
                id="ano_max"
                type="number"
                value={formData.ano_fabricacao_maximo}
                onChange={(e) => setFormData({ ...formData, ano_fabricacao_maximo: e.target.value })}
                placeholder="Ex: 2025"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ordem">Ordem de Exibição</Label>
              <Input
                id="ordem"
                type="number"
                value={formData.ordem}
                onChange={(e) => setFormData({ ...formData, ordem: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center gap-8 pt-2">
            <div className="flex items-center gap-2">
              <Switch
                id="destaque"
                checked={formData.destaque}
                onCheckedChange={(checked) => setFormData({ ...formData, destaque: checked })}
              />
              <Label htmlFor="destaque">Destaque</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              />
              <Label htmlFor="ativo">Ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveProduto.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {saveProduto.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
