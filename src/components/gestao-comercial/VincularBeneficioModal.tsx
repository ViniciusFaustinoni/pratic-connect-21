import { useState } from 'react';
import { Gift, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VincularBeneficioModalProps {
  open: boolean;
  onClose: () => void;
  planoId: string;
}

export function VincularBeneficioModal({ open, onClose, planoId }: VincularBeneficioModalProps) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    benefit_id: '',
    custom_text: '',
    custom_value: '',
    is_highlighted: false,
  });

  // Benefits not yet linked to this plan
  const { data: availableBenefits, isLoading } = useQuery({
    queryKey: ['benefits-disponiveis', planoId],
    queryFn: async () => {
      const { data: vinculados } = await supabase
        .from('planos_beneficios')
        .select('benefit_id')
        .eq('plano_id', planoId);

      const idsVinculados = vinculados?.map(v => v.benefit_id).filter(Boolean) || [];

      let query = supabase.from('benefits').select('*').eq('is_active', true).order('name');
      if (idsVinculados.length > 0) {
        query = query.not('id', 'in', `(${idsVinculados.join(',')})`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open && !!planoId,
  });

  const vincularBeneficio = useMutation({
    mutationFn: async () => {
      if (!formData.benefit_id) throw new Error('Selecione um benefício');

      const { error } = await supabase
        .from('planos_beneficios')
        .insert({
          plano_id: planoId,
          benefit_id: formData.benefit_id,
          beneficio: '',
          custom_text: formData.custom_text || null,
          custom_value: formData.custom_value || null,
          is_highlighted: formData.is_highlighted,
          incluso: true,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Benefício vinculado!');
      queryClient.invalidateQueries({ queryKey: ['benefits-disponiveis', planoId] });
      queryClient.invalidateQueries({ queryKey: ['plano-beneficios', planoId] });
      queryClient.invalidateQueries({ queryKey: ['benefit-plan-associations'] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      resetForm();
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({ benefit_id: '', custom_text: '', custom_value: '', is_highlighted: false });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    vincularBeneficio.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Vincular Benefício
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Benefício *</Label>
            <Select
              value={formData.benefit_id}
              onValueChange={(value) => setFormData({ ...formData, benefit_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? 'Carregando...' : 'Selecione um benefício'} />
              </SelectTrigger>
              <SelectContent>
                {availableBenefits?.length === 0 ? (
                  <SelectItem value="_empty" disabled>Todos os benefícios já estão vinculados</SelectItem>
                ) : (
                  availableBenefits?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.icon ? `${b.icon} ` : ''}{b.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom_text">Texto personalizado</Label>
            <Input
              id="custom_text"
              value={formData.custom_text}
              onChange={(e) => setFormData({ ...formData, custom_text: e.target.value })}
              placeholder="Ex: Até R$ 50.000"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="custom_value">Valor personalizado</Label>
              <Input
                id="custom_value"
                value={formData.custom_value}
                onChange={(e) => setFormData({ ...formData, custom_value: e.target.value })}
                placeholder="Ex: 400km"
              />
            </div>
            <div className="flex items-center gap-2 pt-8">
              <Switch
                id="is_highlighted"
                checked={formData.is_highlighted}
                onCheckedChange={(checked) => setFormData({ ...formData, is_highlighted: checked })}
              />
              <Label htmlFor="is_highlighted">Destaque</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { resetForm(); onClose(); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={vincularBeneficio.isPending || !formData.benefit_id}>
              <Plus className="h-4 w-4 mr-2" />
              {vincularBeneficio.isPending ? 'Vinculando...' : 'Vincular'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
