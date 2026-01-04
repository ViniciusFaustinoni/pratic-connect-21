import { useState } from 'react';
import { Shield, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VincularCoberturaModalProps {
  open: boolean;
  onClose: () => void;
  planoId: string;
}

export function VincularCoberturaModal({ open, onClose, planoId }: VincularCoberturaModalProps) {
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    cobertura_id: '',
    percentual_cobertura: '',
    valor_limite: '',
    franquia_percentual: '',
    franquia_valor: '',
    carencia_dias: '',
    obrigatoria: false,
  });

  // Coberturas disponíveis (não vinculadas)
  const { data: coberturas, isLoading } = useQuery({
    queryKey: ['coberturas-disponiveis', planoId],
    queryFn: async () => {
      const { data: vinculadas } = await supabase
        .from('planos_coberturas')
        .select('cobertura_id')
        .eq('plano_id', planoId);
      
      const idsVinculados = vinculadas?.map(v => v.cobertura_id) || [];
      
      let query = supabase.from('coberturas').select('*').eq('ativo', true).order('nome');
      if (idsVinculados.length > 0) {
        query = query.not('id', 'in', `(${idsVinculados.join(',')})`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open && !!planoId,
  });

  const vincularCobertura = useMutation({
    mutationFn: async () => {
      if (!formData.cobertura_id) {
        throw new Error('Selecione uma cobertura');
      }

      const { error } = await supabase
        .from('planos_coberturas')
        .insert({
          plano_id: planoId,
          cobertura_id: formData.cobertura_id,
          percentual_cobertura: formData.percentual_cobertura ? parseFloat(formData.percentual_cobertura) : null,
          valor_limite: formData.valor_limite ? parseFloat(formData.valor_limite) : null,
          franquia_percentual: formData.franquia_percentual ? parseFloat(formData.franquia_percentual) : null,
          franquia_valor: formData.franquia_valor ? parseFloat(formData.franquia_valor) : null,
          carencia_dias: formData.carencia_dias ? parseInt(formData.carencia_dias) : null,
          obrigatoria: formData.obrigatoria,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cobertura vinculada!');
      queryClient.invalidateQueries({ queryKey: ['coberturas-disponiveis'] });
      queryClient.invalidateQueries({ queryKey: ['planos-coberturas'] });
      queryClient.invalidateQueries({ queryKey: ['planos-coberturas-count'] });
      resetForm();
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const resetForm = () => {
    setFormData({
      cobertura_id: '',
      percentual_cobertura: '',
      valor_limite: '',
      franquia_percentual: '',
      franquia_valor: '',
      carencia_dias: '',
      obrigatoria: false,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    vincularCobertura.mutate();
  };

  const selectedCobertura = coberturas?.find(c => c.id === formData.cobertura_id);

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) { resetForm(); onClose(); }}}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Vincular Cobertura
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Cobertura *</Label>
            <Select
              value={formData.cobertura_id}
              onValueChange={(value) => setFormData({ ...formData, cobertura_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? 'Carregando...' : 'Selecione uma cobertura'} />
              </SelectTrigger>
              <SelectContent>
                {coberturas?.length === 0 ? (
                  <SelectItem value="_empty" disabled>Todas as coberturas já estão vinculadas</SelectItem>
                ) : (
                  coberturas?.map((cobertura) => (
                    <SelectItem key={cobertura.id} value={cobertura.id}>
                      {cobertura.nome}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedCobertura?.descricao && (
              <p className="text-xs text-muted-foreground">{selectedCobertura.descricao}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="percentual_cobertura">% Cobertura</Label>
              <Input
                id="percentual_cobertura"
                type="number"
                step="0.01"
                value={formData.percentual_cobertura}
                onChange={(e) => setFormData({ ...formData, percentual_cobertura: e.target.value })}
                placeholder="Ex: 100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor_limite">Valor Limite (R$)</Label>
              <Input
                id="valor_limite"
                type="number"
                step="0.01"
                value={formData.valor_limite}
                onChange={(e) => setFormData({ ...formData, valor_limite: e.target.value })}
                placeholder="Ex: 50000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="franquia_percentual">Franquia (%)</Label>
              <Input
                id="franquia_percentual"
                type="number"
                step="0.01"
                value={formData.franquia_percentual}
                onChange={(e) => setFormData({ ...formData, franquia_percentual: e.target.value })}
                placeholder="Ex: 5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="franquia_valor">Franquia (R$)</Label>
              <Input
                id="franquia_valor"
                type="number"
                step="0.01"
                value={formData.franquia_valor}
                onChange={(e) => setFormData({ ...formData, franquia_valor: e.target.value })}
                placeholder="Ex: 1000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="carencia_dias">Carência (dias)</Label>
              <Input
                id="carencia_dias"
                type="number"
                value={formData.carencia_dias}
                onChange={(e) => setFormData({ ...formData, carencia_dias: e.target.value })}
                placeholder="Ex: 30"
              />
            </div>
            <div className="flex items-center gap-2 pt-8">
              <Switch
                id="obrigatoria"
                checked={formData.obrigatoria}
                onCheckedChange={(checked) => setFormData({ ...formData, obrigatoria: checked })}
              />
              <Label htmlFor="obrigatoria">Obrigatória</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { resetForm(); onClose(); }}>
              Cancelar
            </Button>
            <Button type="submit" disabled={vincularCobertura.isPending || !formData.cobertura_id}>
              <Plus className="h-4 w-4 mr-2" />
              {vincularCobertura.isPending ? 'Vinculando...' : 'Vincular'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
