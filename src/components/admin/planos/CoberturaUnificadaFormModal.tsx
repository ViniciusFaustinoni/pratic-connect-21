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
import { Textarea } from '@/components/ui/textarea';
import { useCreateCobertura, useUpdateCobertura } from '@/hooks/usePlansAdmin';
import type { Cobertura } from '@/types/plans';
import { EligibilityRulesEditor } from './EligibilityRulesEditor';
import { CarenciaConfigSection } from './CarenciaConfigSection';

interface CoberturaUnificadaFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cobertura: Cobertura | null;
}

export function CoberturaUnificadaFormModal({
  open,
  onOpenChange,
  cobertura,
}: CoberturaUnificadaFormModalProps) {
  const createCobertura = useCreateCobertura();
  const updateCobertura = useUpdateCobertura();

  const isEditing = !!cobertura;

  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    descricao: '',
    icon: '',
    subtitle: '',
    display_order: '0',
    carencia_dias: '',
    carencia_ativa: false,
    carencia_tipo: '',
    carencia_multiplicador: '',
    ativo: true,
  });

  useEffect(() => {
    if (cobertura) {
      const c = cobertura as any;
      setFormData({
        nome: cobertura.nome || '',
        codigo: cobertura.codigo || '',
        descricao: cobertura.descricao || '',
        icon: cobertura.icon || '',
        subtitle: cobertura.subtitle || '',
        display_order: cobertura.display_order?.toString() || '0',
        carencia_dias: c.carencia_dias?.toString() || '',
        carencia_ativa: c.carencia_ativa ?? false,
        carencia_tipo: c.carencia_tipo || '',
        carencia_multiplicador: c.carencia_multiplicador?.toString() || '',
        ativo: cobertura.ativo ?? true,
      });
    } else {
      setFormData({
        nome: '',
        codigo: '',
        descricao: '',
        icon: '',
        subtitle: '',
        display_order: '0',
        carencia_dias: '',
        carencia_ativa: false,
        carencia_tipo: '',
        carencia_multiplicador: '',
        ativo: true,
      });
    }
  }, [cobertura]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      nome: formData.nome,
      codigo: formData.codigo || undefined,
      descricao: formData.descricao || null,
      icon: formData.icon || null,
      subtitle: formData.subtitle || null,
      display_order: parseInt(formData.display_order) || 0,
      carencia_dias: formData.carencia_dias ? parseInt(formData.carencia_dias) : null,
      ativo: formData.ativo,
    };

    try {
      if (isEditing && cobertura) {
        await updateCobertura.mutateAsync({ id: cobertura.id, ...payload });
      } else {
        await createCobertura.mutateAsync(payload);
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
                onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                placeholder="🛡️"
                className="text-center text-xl"
              />
            </div>
            <div className="col-span-3 space-y-2">
              <Label htmlFor="nome">Nome *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código</Label>
              <Input
                id="codigo"
                value={formData.codigo}
                onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value }))}
                placeholder="COB-XXX"
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subtitle">Subtítulo</Label>
              <Input
                id="subtitle"
                value={formData.subtitle}
                onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                placeholder="Texto curto para exibição"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
              placeholder="Descrição detalhada da cobertura"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="display_order">Ordem</Label>
              <Input
                id="display_order"
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData(prev => ({ ...prev, display_order: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="carencia_dias">Carência (dias)</Label>
              <Input
                id="carencia_dias"
                type="number"
                min="0"
                value={formData.carencia_dias}
                onChange={(e) => setFormData(prev => ({ ...prev, carencia_dias: e.target.value }))}
                placeholder="Ex: 30"
              />
            </div>
            <div className="flex items-center gap-2 pt-7">
              <Switch
                id="ativo"
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, ativo: checked }))}
              />
              <Label htmlFor="ativo">Ativo</Label>
            </div>
          </div>

          {/* Regras de Elegibilidade */}
          {isEditing && cobertura && (
            <div className="border-t pt-4">
              <EligibilityRulesEditor entityType="cobertura" entityId={cobertura.id} />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createCobertura.isPending || updateCobertura.isPending}>
              {isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
