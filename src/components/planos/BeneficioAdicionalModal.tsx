import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useCreateBeneficio, useUpdateBeneficio, CATEGORIAS_BENEFICIO } from '@/hooks/useBeneficiosAdmin';
import type { Tables } from '@/integrations/supabase/types';

type BeneficioAdicional = Tables<'beneficios_adicionais'>;

interface BeneficioAdicionalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  beneficio: BeneficioAdicional | null;
}

export function BeneficioAdicionalModal({ open, onOpenChange, beneficio }: BeneficioAdicionalModalProps) {
  const createBeneficio = useCreateBeneficio();
  const updateBeneficio = useUpdateBeneficio();
  const isEditing = !!beneficio;

  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    categoria: 'Outro',
    descricao: '',
    preco: 0,
    ativo: true,
    ordem: 0,
  });

  useEffect(() => {
    if (beneficio) {
      setFormData({
        nome: beneficio.nome,
        codigo: beneficio.codigo,
        categoria: beneficio.categoria,
        descricao: beneficio.descricao || '',
        preco: beneficio.preco,
        ativo: beneficio.ativo ?? true,
        ordem: beneficio.ordem ?? 0,
      });
    } else {
      setFormData({
        nome: '',
        codigo: '',
        categoria: 'Outro',
        descricao: '',
        preco: 0,
        ativo: true,
        ordem: 0,
      });
    }
  }, [beneficio, open]);

  const generateSlug = (nome: string) => {
    return nome
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  };

  const handleSubmit = async () => {
    if (!formData.nome.trim() || formData.preco <= 0) return;

    const codigo = formData.codigo.trim() || generateSlug(formData.nome);

    try {
      if (isEditing && beneficio) {
        await updateBeneficio.mutateAsync({
          id: beneficio.id,
          codigo,
          nome: formData.nome,
          categoria: formData.categoria,
          descricao: formData.descricao || null,
          preco: formData.preco,
          ativo: formData.ativo,
          ordem: formData.ordem,
        });
      } else {
        await createBeneficio.mutateAsync({
          codigo,
          nome: formData.nome,
          categoria: formData.categoria,
          descricao: formData.descricao || null,
          preco: formData.preco,
          ativo: formData.ativo,
          ordem: formData.ordem,
        });
      }
      onOpenChange(false);
    } catch (error) {
      // Erro já tratado nos hooks
    }
  };

  const isPending = createBeneficio.isPending || updateBeneficio.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Benefício Adicional' : 'Novo Benefício Adicional'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: 1000km Reboque"
            />
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label htmlFor="categoria">Categoria</Label>
            <Select
              value={formData.categoria}
              onValueChange={(value) => setFormData({ ...formData, categoria: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS_BENEFICIO.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Descreva o benefício..."
              rows={3}
            />
          </div>

          {/* Preço */}
          <div className="space-y-2">
            <Label htmlFor="preco">Preço Mensal (R$) *</Label>
            <Input
              id="preco"
              type="number"
              step="0.01"
              min="0"
              value={formData.preco}
              onChange={(e) => setFormData({ ...formData, preco: parseFloat(e.target.value) || 0 })}
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Ordem */}
            <div className="space-y-2">
              <Label htmlFor="ordem">Ordem de Exibição</Label>
              <Input
                id="ordem"
                type="number"
                min="0"
                value={formData.ordem}
                onChange={(e) => setFormData({ ...formData, ordem: parseInt(e.target.value) || 0 })}
              />
            </div>

            {/* Ativo */}
            <div className="flex items-center justify-between pt-6">
              <Label htmlFor="ativo">Ativo</Label>
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isPending || !formData.nome.trim() || formData.preco <= 0}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
