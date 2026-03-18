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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateProductLine, useUpdateProductLine } from '@/hooks/usePlansAdmin';
import type { ProductLine } from '@/types/plans';

interface LinhaFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productLine: ProductLine | null;
}

const COLORS = [
  { value: 'green', label: 'Verde' },
  { value: 'orange', label: 'Laranja' },
  { value: 'purple', label: 'Roxo' },
  { value: 'red', label: 'Vermelho' },
  { value: 'blue', label: 'Azul' },
];

const VEHICLE_TYPES = [
  { value: 'car', label: 'Carros' },
  { value: 'motorcycle', label: 'Motos' },
];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function LinhaFormModal({
  open,
  onOpenChange,
  productLine,
}: LinhaFormModalProps) {
  const createLine = useCreateProductLine();
  const updateLine = useUpdateProductLine();

  const isEditing = !!productLine;

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    icon: '',
    color: 'blue',
    vehicle_type: 'car',
    display_order: '0',
    is_active: true,
  });

  useEffect(() => {
    if (productLine) {
      setFormData({
        name: productLine.name || '',
        slug: productLine.slug || '',
        icon: productLine.icon || '',
        color: productLine.color || 'blue',
        vehicle_type: productLine.vehicle_type || 'car',
        display_order: productLine.display_order?.toString() || '0',
        is_active: productLine.is_active ?? true,
      });
    } else {
      setFormData({
        name: '',
        slug: '',
        icon: '',
        color: 'blue',
        vehicle_type: 'car',
        display_order: '0',
        is_active: true,
      });
    }
  }, [productLine]);

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
      color: formData.color || null,
      vehicle_type: formData.vehicle_type || null,
      display_order: parseInt(formData.display_order) || 0,
      is_active: formData.is_active,
    };

    try {
      if (isEditing && productLine) {
        await updateLine.mutateAsync({ id: productLine.id, ...payload });
      } else {
        await createLine.mutateAsync(payload);
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
            {isEditing ? 'Editar Linha de Produto' : 'Nova Linha de Produto'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle_type">Tipo de Veículo</Label>
              <Select
                value={formData.vehicle_type}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, vehicle_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Cor</Label>
              <Select
                value={formData.color}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, color: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLORS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      {color.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
              disabled={createLine.isPending || updateLine.isPending}
            >
              {isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
