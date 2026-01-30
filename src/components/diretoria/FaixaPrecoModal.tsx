import { useState, useEffect } from 'react';
import { DollarSign, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TabelaPreco {
  id: string;
  plano_id: string;
  fipe_de: number;
  fipe_ate: number;
  valor_cota: number;
  taxa_administrativa: number | null;
  valor_rastreamento: number | null;
  valor_assistencia: number | null;
  taxa_aplicativo: number | null;
  taxa_comercial: number | null;
  valor_adesao?: number | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  ativo: boolean;
}

interface FaixaPrecoModalProps {
  open: boolean;
  onClose: () => void;
  planoId: string;
  faixa?: TabelaPreco | null;
}

export function FaixaPrecoModal({ open, onClose, planoId, faixa }: FaixaPrecoModalProps) {
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    fipe_de: '',
    fipe_ate: '',
    valor_cota: '',
    taxa_administrativa: '',
    valor_rastreamento: '',
    valor_assistencia: '',
    taxa_aplicativo: '',
    taxa_comercial: '',
    valor_adesao: '',
    vigencia_inicio: '',
    vigencia_fim: '',
    ativo: true,
  });

  useEffect(() => {
    if (faixa) {
      setFormData({
        fipe_de: faixa.fipe_de?.toString() || '',
        fipe_ate: faixa.fipe_ate?.toString() || '',
        valor_cota: faixa.valor_cota?.toString() || '',
        taxa_administrativa: faixa.taxa_administrativa?.toString() || '',
        valor_rastreamento: faixa.valor_rastreamento?.toString() || '',
        valor_assistencia: faixa.valor_assistencia?.toString() || '',
        taxa_aplicativo: faixa.taxa_aplicativo?.toString() || '',
        taxa_comercial: faixa.taxa_comercial?.toString() || '',
        valor_adesao: faixa.valor_adesao?.toString() || '',
        vigencia_inicio: faixa.vigencia_inicio || '',
        vigencia_fim: faixa.vigencia_fim || '',
        ativo: faixa.ativo ?? true,
      });
    } else {
      const hoje = new Date().toISOString().split('T')[0];
      setFormData({
        fipe_de: '',
        fipe_ate: '',
        valor_cota: '',
        taxa_administrativa: '',
        valor_rastreamento: '',
        valor_assistencia: '',
        taxa_aplicativo: '',
        taxa_comercial: '',
        valor_adesao: '',
        vigencia_inicio: hoje,
        vigencia_fim: '',
        ativo: true,
      });
    }
  }, [faixa, open]);

  // Query existing ranges to check overlap
  const { data: existingRanges } = useQuery({
    queryKey: ['tabelas-preco-check', planoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tabelas_preco')
        .select('id, fipe_de, fipe_ate')
        .eq('plano_id', planoId)
        .eq('ativo', true);
      if (error) throw error;
      return data;
    },
    enabled: open && !!planoId,
  });

  const saveFaixa = useMutation({
    mutationFn: async () => {
      const fipeDe = parseFloat(formData.fipe_de);
      const fipeAte = parseFloat(formData.fipe_ate);

      // Validate range
      if (fipeDe >= fipeAte) {
        throw new Error('FIPE De deve ser menor que FIPE Até');
      }

      // Check overlap
      const hasSobreposicao = existingRanges?.some(e => {
        if (faixa && e.id === faixa.id) return false;
        return (fipeDe >= e.fipe_de && fipeDe <= e.fipe_ate) ||
               (fipeAte >= e.fipe_de && fipeAte <= e.fipe_ate) ||
               (fipeDe <= e.fipe_de && fipeAte >= e.fipe_ate);
      });

      if (hasSobreposicao) {
        throw new Error('Faixa se sobrepõe a uma existente');
      }

      const data = {
        plano_id: planoId,
        fipe_de: fipeDe,
        fipe_ate: fipeAte,
        valor_cota: parseFloat(formData.valor_cota),
        taxa_administrativa: formData.taxa_administrativa ? parseFloat(formData.taxa_administrativa) : null,
        valor_rastreamento: formData.valor_rastreamento ? parseFloat(formData.valor_rastreamento) : null,
        valor_assistencia: formData.valor_assistencia ? parseFloat(formData.valor_assistencia) : null,
        taxa_aplicativo: formData.taxa_aplicativo ? parseFloat(formData.taxa_aplicativo) : null,
        taxa_comercial: formData.taxa_comercial ? parseFloat(formData.taxa_comercial) : null,
        valor_adesao: formData.valor_adesao ? parseFloat(formData.valor_adesao) : null,
        vigencia_inicio: formData.vigencia_inicio || null,
        vigencia_fim: formData.vigencia_fim || null,
        ativo: formData.ativo,
        updated_at: new Date().toISOString(),
      };

      if (faixa) {
        const { error } = await supabase
          .from('tabelas_preco')
          .update(data)
          .eq('id', faixa.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tabelas_preco')
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(faixa ? 'Faixa atualizada!' : 'Faixa criada!');
      queryClient.invalidateQueries({ queryKey: ['plano-precos', planoId] });
      queryClient.invalidateQueries({ queryKey: ['tabela-precos'] });
      queryClient.invalidateQueries({ queryKey: ['tabelas-preco-check', planoId] });
      queryClient.invalidateQueries({ queryKey: ['planos-precos-info'] });
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fipe_de || !formData.fipe_ate || !formData.valor_cota) {
      toast.error('FIPE De, FIPE Até e Valor Cota são obrigatórios');
      return;
    }
    saveFaixa.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {faixa ? 'Editar Faixa de Preço' : 'Nova Faixa de Preço'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fipe_de">FIPE De (R$) *</Label>
              <Input
                id="fipe_de"
                type="number"
                value={formData.fipe_de}
                onChange={(e) => setFormData({ ...formData, fipe_de: e.target.value })}
                placeholder="Ex: 20000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fipe_ate">FIPE Até (R$) *</Label>
              <Input
                id="fipe_ate"
                type="number"
                value={formData.fipe_ate}
                onChange={(e) => setFormData({ ...formData, fipe_ate: e.target.value })}
                placeholder="Ex: 40000"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor_cota">Valor Cota (R$) *</Label>
              <Input
                id="valor_cota"
                type="number"
                step="0.01"
                value={formData.valor_cota}
                onChange={(e) => setFormData({ ...formData, valor_cota: e.target.value })}
                placeholder="Ex: 89.90"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxa_administrativa">Taxa Admin (R$)</Label>
              <Input
                id="taxa_administrativa"
                type="number"
                step="0.01"
                value={formData.taxa_administrativa}
                onChange={(e) => setFormData({ ...formData, taxa_administrativa: e.target.value })}
                placeholder="Ex: 15.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor_adesao">Taxa de Filiação (R$)</Label>
              <Input
                id="valor_adesao"
                type="number"
                step="0.01"
                value={formData.valor_adesao}
                onChange={(e) => setFormData({ ...formData, valor_adesao: e.target.value })}
                placeholder="Ex: 150.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor_rastreamento">Rastreamento (R$)</Label>
              <Input
                id="valor_rastreamento"
                type="number"
                step="0.01"
                value={formData.valor_rastreamento}
                onChange={(e) => setFormData({ ...formData, valor_rastreamento: e.target.value })}
                placeholder="Ex: 39.90"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor_assistencia">Assistência (R$)</Label>
              <Input
                id="valor_assistencia"
                type="number"
                step="0.01"
                value={formData.valor_assistencia}
                onChange={(e) => setFormData({ ...formData, valor_assistencia: e.target.value })}
                placeholder="Ex: 29.90"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxa_aplicativo">Taxa App (R$)</Label>
              <Input
                id="taxa_aplicativo"
                type="number"
                step="0.01"
                value={formData.taxa_aplicativo}
                onChange={(e) => setFormData({ ...formData, taxa_aplicativo: e.target.value })}
                placeholder="Ex: 50.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="taxa_comercial">Taxa Comercial (R$)</Label>
              <Input
                id="taxa_comercial"
                type="number"
                step="0.01"
                value={formData.taxa_comercial}
                onChange={(e) => setFormData({ ...formData, taxa_comercial: e.target.value })}
                placeholder="Ex: 30.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vigencia_inicio">Vigência Início</Label>
              <Input
                id="vigencia_inicio"
                type="date"
                value={formData.vigencia_inicio}
                onChange={(e) => setFormData({ ...formData, vigencia_inicio: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vigencia_fim">Vigência Fim</Label>
              <Input
                id="vigencia_fim"
                type="date"
                value={formData.vigencia_fim}
                onChange={(e) => setFormData({ ...formData, vigencia_fim: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Switch
              id="ativo"
              checked={formData.ativo}
              onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
            />
            <Label htmlFor="ativo">Ativo</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveFaixa.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {saveFaixa.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
