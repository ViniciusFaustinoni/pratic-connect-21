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
import { useCreateMainCoverage, useUpdateMainCoverage } from '@/hooks/usePlansAdmin';
import type { MainCoverage } from '@/types/plans';

interface CoberturaFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coverage: MainCoverage | null;
}

export function CoberturaFormModal({
  open,
  onOpenChange,
  coverage,
}: CoberturaFormModalProps) {
  const createCoverage = useCreateMainCoverage();
  const updateCoverage = useUpdateMainCoverage();

  const isEditing = !!coverage;

  const [formData, setFormData] = useState({
    name: '',
    subtitle: '',
    icon: '',
    display_order: '0',
    is_active: true,
  });

  useEffect(() => {
    if (coverage) {
      setFormData({
        name: coverage.name || '',
        subtitle: coverage.subtitle || '',
        icon: coverage.icon || '',
        display_order: coverage.display_order?.toString() || '0',
        is_active: coverage.is_active ?? true,
      });
    } else {
      setFormData({
        name: '',
        subtitle: '',
        icon: '',
        display_order: '0',
        is_active: true,
      });
    }
  }, [coverage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      name: formData.name,
      subtitle: formData.subtitle || null,
      icon: formData.icon || null,
      display_order: parseInt(formData.display_order) || 0,
      is_active: formData.is_active,
    };

    try {
      if (isEditing && coverage) {
        await updateCoverage.mutateAsync({ id: coverage.id, ...payload });
      } else {
        await createCoverage.mutateAsync(payload);
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
            {isEditing ? 'Editar Cobertura' : 'Nova Cobertura'}
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
                placeholder="🛡️"
                className="text-center text-xl"
              />
            </div>
            <div className="col-span-3 space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subtitle">Subtítulo</Label>
            <Input
              id="subtitle"
              value={formData.subtitle}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, subtitle: e.target.value }))
              }
              placeholder="Descrição breve"
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
              disabled={createCoverage.isPending || updateCoverage.isPending}
            >
              {isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
