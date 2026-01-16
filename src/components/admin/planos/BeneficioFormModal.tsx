import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { useCreateBenefit, useUpdateBenefit } from '@/hooks/usePlansAdmin';
import type { Benefit } from '@/types/plans';

interface BeneficioFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  benefit: Benefit | null;
}

const CATEGORIES = [
  { value: 'assistencia', label: 'Assistência' },
  { value: 'cobertura', label: 'Cobertura' },
  { value: 'protecao', label: 'Proteção' },
  { value: 'servico', label: 'Serviço' },
  { value: 'beneficio', label: 'Benefício' },
  { value: 'outros', label: 'Outros' },
];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function BeneficioFormModal({
  open,
  onOpenChange,
  benefit,
}: BeneficioFormModalProps) {
  const createBenefit = useCreateBenefit();
  const updateBenefit = useUpdateBenefit();

  const isEditing = !!benefit;

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    icon: '',
    description: '',
    category: '',
    display_order: '0',
    is_active: true,
  });

  useEffect(() => {
    if (benefit) {
      setFormData({
        name: benefit.name || '',
        slug: benefit.slug || '',
        icon: benefit.icon || '',
        description: benefit.description || '',
        category: benefit.category || '',
        display_order: benefit.display_order?.toString() || '0',
        is_active: benefit.is_active ?? true,
      });
    } else {
      setFormData({
        name: '',
        slug: '',
        icon: '',
        description: '',
        category: '',
        display_order: '0',
        is_active: true,
      });
    }
  }, [benefit]);

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: isEditing ? prev.slug : generateSlug(name),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      name: formData.name,
      slug: formData.slug,
      icon: formData.icon || null,
      description: formData.description || null,
      category: formData.category || null,
      display_order: parseInt(formData.display_order) || 0,
      is_active: formData.is_active,
    };

    try {
      if (isEditing && benefit) {
        await updateBenefit.mutateAsync({ id: benefit.id, ...payload });
      } else {
        await createBenefit.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Benefício' : 'Novo Benefício'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="icon">Ícone</Label>
              <Input
                id="icon"
                value={formData.icon}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, icon: e.target.value }))
                }
                placeholder="🚗"
                className="text-center text-xl"
              />
            </div>
            <div className="col-span-3 space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, slug: e.target.value }))
              }
              disabled={isEditing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select
              value={formData.category}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, category: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="display_order">Ordem</Label>
              <Input
                id="display_order"
                type="number"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, display_order: e.target.value }))
                }
              />
            </div>
            <div className="flex items-center gap-2 pt-7">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, is_active: checked }))
                }
              />
              <Label htmlFor="is_active">Ativo</Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createBenefit.isPending || updateBenefit.isPending}
            >
              {isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
