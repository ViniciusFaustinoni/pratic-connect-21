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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateBenefit, useUpdateBenefit } from '@/hooks/usePlansAdmin';
import { 
  useBenefitExclusionsByBenefitId, 
  useUpdateBenefitExclusions 
} from '@/hooks/useBenefitExclusions';
import { CATEGORIAS_VEICULO } from '@/components/cotador/VehicleCategorySelect';
import { AlertTriangle } from 'lucide-react';
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

// Categorias que podem ter exclusões (excluímos 'nenhuma')
const CATEGORIAS_PARA_EXCLUSAO = CATEGORIAS_VEICULO.filter(
  (cat) => cat.value !== 'nenhuma'
);

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
  const updateExclusions = useUpdateBenefitExclusions();
  
  // Buscar exclusões existentes se estiver editando
  const { data: existingExclusions } = useBenefitExclusionsByBenefitId(
    benefit?.id || null
  );

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
  
  // Estado para categorias excluídas
  const [excludedCategories, setExcludedCategories] = useState<string[]>([]);

  // Carregar exclusões existentes quando o benefício mudar
  useEffect(() => {
    if (existingExclusions) {
      setExcludedCategories(existingExclusions.map((e) => e.categoria_veiculo));
    } else {
      setExcludedCategories([]);
    }
  }, [existingExclusions]);

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
      setExcludedCategories([]);
    }
  }, [benefit]);

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: isEditing ? prev.slug : generateSlug(name),
    }));
  };

  const toggleCategoryExclusion = (categoria: string, checked: boolean) => {
    setExcludedCategories((prev) => {
      if (checked) {
        return [...prev, categoria];
      }
      return prev.filter((c) => c !== categoria);
    });
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
      let benefitId: string;
      
      if (isEditing && benefit) {
        await updateBenefit.mutateAsync({ id: benefit.id, ...payload });
        benefitId = benefit.id;
      } else {
        const createdBenefit = await createBenefit.mutateAsync(payload);
        benefitId = createdBenefit.id;
      }
      
      // Salvar exclusões de categoria
      await updateExclusions.mutateAsync({
        benefitId,
        categorias: excludedCategories,
      });
      
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Benefício' : 'Novo Benefício'}
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

          {/* Seção de Exclusão por Categoria */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <Label className="font-medium">Excluir para Categorias Especiais</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Selecione as categorias de veículo que <strong>NÃO</strong> terão direito a este benefício.
              Veículos destas categorias não verão este benefício em cotações, propostas ou contratos.
            </p>
            <div className="grid grid-cols-1 gap-2 max-h-[180px] overflow-y-auto p-2 border rounded-md bg-muted/20">
              {CATEGORIAS_PARA_EXCLUSAO.map((cat) => (
                <div key={cat.value} className="flex items-center gap-2">
                  <Checkbox
                    id={`exclude-${cat.value}`}
                    checked={excludedCategories.includes(cat.value)}
                    onCheckedChange={(checked) =>
                      toggleCategoryExclusion(cat.value, !!checked)
                    }
                  />
                  <Label 
                    htmlFor={`exclude-${cat.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {cat.label}
                  </Label>
                </div>
              ))}
            </div>
            {excludedCategories.length > 0 && (
              <p className="text-xs text-amber-600">
                ⚠️ Este benefício será excluído para {excludedCategories.length} categoria(s)
              </p>
            )}
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
