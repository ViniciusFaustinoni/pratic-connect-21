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
import { MarcaModeloExclusionEditor } from './MarcaModeloExclusionEditor';
import { useRulesForEntity, useSaveRule, useUpdateRule, useDeleteRule } from '@/hooks/useEntityEligibilityRules';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  const saveRule = useSaveRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();

  const isEditing = !!productLine;

  const { data: existingRules } = useRulesForEntity('linha', productLine?.id);

  // Derive ano_range rule from existing rules
  const anoRule = existingRules?.find((r) => r.rule_type === 'ano_range');

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    icon: '',
    color: 'blue',
    vehicle_type: 'car',
    display_order: '0',
    is_active: true,
  });

  const [anoEnabled, setAnoEnabled] = useState(false);
  const [anoMin, setAnoMin] = useState('');
  const [anoMax, setAnoMax] = useState('');
  const [marcaModeloEnabled, setMarcaModeloEnabled] = useState(false);

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
      setAnoEnabled(false);
      setAnoMin('');
      setAnoMax('');
      setMarcaModeloEnabled(false);
    }
  }, [productLine]);

  // Sync ano rule state when rules load
  useEffect(() => {
    if (anoRule) {
      setAnoEnabled(true);
      setAnoMin(anoRule.rule_config?.ano_min?.toString() || '');
      setAnoMax(anoRule.rule_config?.ano_max?.toString() || '');
    } else {
      setAnoEnabled(false);
      setAnoMin('');
      setAnoMax('');
    }
  }, [anoRule]);

  // Sync marca/modelo toggle from existing rules
  useEffect(() => {
    const hasMarcaRule = existingRules?.some((r) => r.rule_type === 'marca_modelo');
    setMarcaModeloEnabled(!!hasMarcaRule);
  }, [existingRules]);

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      slug: isEditing ? prev.slug : generateSlug(name),
    }));
  };

  const handleSaveAnoRule = async (entityId: string) => {
    if (anoEnabled && (anoMin || anoMax)) {
      await saveRule.mutateAsync({
        id: anoRule?.id,
        entity_type: 'linha',
        entity_id: entityId,
        rule_type: 'ano_range',
        rule_mode: 'include',
        rule_config: {
          ano_min: anoMin ? parseInt(anoMin) : null,
          ano_max: anoMax ? parseInt(anoMax) : null,
        },
        is_active: true,
      });
    } else if (!anoEnabled && anoRule) {
      await deleteRule.mutateAsync(anoRule.id);
    }
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
        await handleSaveAnoRule(productLine.id);
      } else {
        const result = await createLine.mutateAsync(payload);
        // After creating, save ano rule if enabled
        if (result?.id) {
          await handleSaveAnoRule(result.id);
        }
      }
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>
            {isEditing ? 'Editar Linha de Produto' : 'Nova Linha de Produto'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
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

            {/* Regras de Elegibilidade */}
            <div className="border-t pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Regras de Elegibilidade</h3>

              {/* Regra de Ano */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Restringir por Ano de Fabricação</Label>
                    <p className="text-xs text-muted-foreground">Define a faixa de ano aceita nesta linha</p>
                  </div>
                  <Switch
                    checked={anoEnabled}
                    onCheckedChange={(checked) => {
                      setAnoEnabled(checked);
                      if (!checked) {
                        setAnoMin('');
                        setAnoMax('');
                      }
                    }}
                    disabled={!isEditing}
                  />
                </div>
                {anoEnabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="ano_min" className="text-xs">Ano Mínimo</Label>
                      <Input
                        id="ano_min"
                        type="number"
                        value={anoMin}
                        onChange={(e) => setAnoMin(e.target.value)}
                        placeholder="Ex: 2005"
                        disabled={!isEditing}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ano_max" className="text-xs">Ano Máximo</Label>
                      <Input
                        id="ano_max"
                        type="number"
                        value={anoMax}
                        onChange={(e) => setAnoMax(e.target.value)}
                        placeholder="Ex: 2025"
                        disabled={!isEditing}
                      />
                    </div>
                  </div>
                )}
                {!isEditing && (
                  <p className="text-xs text-muted-foreground italic">Salve a linha primeiro para configurar regras</p>
                )}
              </div>

              {/* Regra de Marca/Modelo */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium">Restringir por Marca / Modelo</Label>
                    <p className="text-xs text-muted-foreground">Exclui marcas ou modelos específicos desta linha</p>
                  </div>
                  <Switch
                    checked={marcaModeloEnabled}
                    onCheckedChange={setMarcaModeloEnabled}
                    disabled={!isEditing}
                  />
                </div>
                {marcaModeloEnabled && isEditing && productLine && (
                  <MarcaModeloExclusionEditor entityType="linha" entityId={productLine.id} />
                )}
                {!isEditing && (
                  <p className="text-xs text-muted-foreground italic">Salve a linha primeiro para configurar regras</p>
                )}
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
