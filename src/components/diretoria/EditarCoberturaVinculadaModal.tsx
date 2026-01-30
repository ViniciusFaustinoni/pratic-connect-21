import { useState, useEffect } from 'react';
import { Shield, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PlanoCobertura {
  id: string;
  plano_id: string;
  cobertura_id: string;
  percentual_cobertura: number | null;
  valor_limite: number | null;
  franquia_percentual: number | null;
  franquia_valor: number | null;
  carencia_dias: number | null;
  obrigatoria: boolean | null;
  cobertura?: {
    id: string;
    nome: string;
    descricao: string | null;
    tipo: string;
  };
}

interface EditarCoberturaVinculadaModalProps {
  open: boolean;
  onClose: () => void;
  cobertura: PlanoCobertura | null;
  planoId: string;
}

export function EditarCoberturaVinculadaModal({ 
  open, 
  onClose, 
  cobertura, 
  planoId 
}: EditarCoberturaVinculadaModalProps) {
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    percentual_cobertura: '',
    valor_limite: '',
    franquia_percentual: '',
    franquia_valor: '',
    carencia_dias: '',
    obrigatoria: false,
  });

  useEffect(() => {
    if (cobertura) {
      setFormData({
        percentual_cobertura: cobertura.percentual_cobertura?.toString() || '',
        valor_limite: cobertura.valor_limite?.toString() || '',
        franquia_percentual: cobertura.franquia_percentual?.toString() || '',
        franquia_valor: cobertura.franquia_valor?.toString() || '',
        carencia_dias: cobertura.carencia_dias?.toString() || '',
        obrigatoria: cobertura.obrigatoria || false,
      });
    }
  }, [cobertura, open]);

  const atualizarCobertura = useMutation({
    mutationFn: async () => {
      if (!cobertura) throw new Error('Cobertura não encontrada');

      const { error } = await supabase
        .from('planos_coberturas')
        .update({
          percentual_cobertura: formData.percentual_cobertura ? parseFloat(formData.percentual_cobertura) : null,
          valor_limite: formData.valor_limite ? parseFloat(formData.valor_limite) : null,
          franquia_percentual: formData.franquia_percentual ? parseFloat(formData.franquia_percentual) : null,
          franquia_valor: formData.franquia_valor ? parseFloat(formData.franquia_valor) : null,
          carencia_dias: formData.carencia_dias ? parseInt(formData.carencia_dias) : null,
          obrigatoria: formData.obrigatoria,
        })
        .eq('id', cobertura.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Cobertura atualizada!');
      queryClient.invalidateQueries({ queryKey: ['plano-coberturas', planoId] });
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    atualizarCobertura.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Editar Cobertura
          </DialogTitle>
        </DialogHeader>

        {cobertura && (
          <div className="bg-muted/50 rounded-lg p-3 mb-4">
            <p className="font-medium">{cobertura.cobertura?.nome}</p>
            {cobertura.cobertura?.descricao && (
              <p className="text-sm text-muted-foreground">{cobertura.cobertura.descricao}</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={atualizarCobertura.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {atualizarCobertura.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
