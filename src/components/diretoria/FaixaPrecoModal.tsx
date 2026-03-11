import { useState, useEffect } from 'react';
import { DollarSign, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FaixaMensalidade {
  id: string;
  linha_slug: string | null;
  regiao: string | null;
  combustivel_tipo: string | null;
  tipo_uso: string | null;
  fipe_min: number;
  fipe_max: number;
  valor_mensal: number;
  valor_desagio: number | null;
  is_active: boolean | null;
}

interface FaixaPrecoModalProps {
  open: boolean;
  onClose: () => void;
  planoId: string;
  faixa?: FaixaMensalidade | null;
}

export function FaixaPrecoModal({ open, onClose, planoId, faixa }: FaixaPrecoModalProps) {
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    linha_slug: '',
    regiao: 'rj',
    combustivel_tipo: '',
    tipo_uso: 'particular',
    fipe_min: '',
    fipe_max: '',
    valor_mensal: '',
    valor_desagio: '',
    is_active: true,
  });

  // Look up linha_slug from plano_preco_map when planoId is provided
  const { data: mapping } = useQuery({
    queryKey: ['plano-preco-map', planoId],
    queryFn: async () => {
      if (!planoId) return null;
      const { data, error } = await supabase
        .from('plano_preco_map')
        .select('linha_slug, tipo_uso')
        .eq('plano_id', planoId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: open && !!planoId,
  });

  useEffect(() => {
    if (faixa) {
      setFormData({
        linha_slug: faixa.linha_slug || '',
        regiao: faixa.regiao || 'rj',
        combustivel_tipo: faixa.combustivel_tipo || '',
        tipo_uso: faixa.tipo_uso || 'particular',
        fipe_min: faixa.fipe_min?.toString() || '',
        fipe_max: faixa.fipe_max?.toString() || '',
        valor_mensal: faixa.valor_mensal?.toString() || '',
        valor_desagio: faixa.valor_desagio?.toString() || '',
        is_active: faixa.is_active ?? true,
      });
    } else {
      setFormData({
        linha_slug: mapping?.linha_slug || '',
        regiao: 'rj',
        combustivel_tipo: '',
        tipo_uso: mapping?.tipo_uso || 'particular',
        fipe_min: '',
        fipe_max: '',
        valor_mensal: '',
        valor_desagio: '',
        is_active: true,
      });
    }
  }, [faixa, open, mapping]);

  // Check existing ranges for overlap
  const { data: existingRanges } = useQuery({
    queryKey: ['tabelas-preco-mensalidade-check', formData.linha_slug, formData.regiao, formData.tipo_uso, formData.combustivel_tipo],
    queryFn: async () => {
      let query = supabase
        .from('tabelas_preco_mensalidade')
        .select('id, fipe_min, fipe_max')
        .eq('is_active', true);
      
      if (formData.linha_slug) query = query.eq('linha_slug', formData.linha_slug);
      if (formData.regiao) query = query.eq('regiao', formData.regiao);
      if (formData.tipo_uso) query = query.eq('tipo_uso', formData.tipo_uso);
      
      // Handle NULL combustivel_tipo
      if (formData.combustivel_tipo) {
        query = query.eq('combustivel_tipo', formData.combustivel_tipo);
      } else {
        query = query.is('combustivel_tipo', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open && !!formData.linha_slug,
  });

  const saveFaixa = useMutation({
    mutationFn: async () => {
      const fipeMin = parseFloat(formData.fipe_min);
      const fipeMax = parseFloat(formData.fipe_max);

      if (fipeMin >= fipeMax) {
        throw new Error('FIPE Min deve ser menor que FIPE Max');
      }

      if (!formData.valor_mensal || parseFloat(formData.valor_mensal) <= 0) {
        throw new Error('Valor mensal é obrigatório');
      }

      // Check overlap
      const hasSobreposicao = existingRanges?.some(e => {
        if (faixa && e.id === faixa.id) return false;
        return (fipeMin >= Number(e.fipe_min) && fipeMin <= Number(e.fipe_max)) ||
               (fipeMax >= Number(e.fipe_min) && fipeMax <= Number(e.fipe_max)) ||
               (fipeMin <= Number(e.fipe_min) && fipeMax >= Number(e.fipe_max));
      });

      if (hasSobreposicao) {
        throw new Error('Faixa se sobrepõe a uma existente para esta linha/região/uso/combustível');
      }

      const data: any = {
        linha_slug: formData.linha_slug || null,
        regiao: formData.regiao || null,
        combustivel_tipo: formData.combustivel_tipo || null,
        tipo_uso: formData.tipo_uso || null,
        fipe_min: fipeMin,
        fipe_max: fipeMax,
        valor_mensal: parseFloat(formData.valor_mensal),
        valor_desagio: formData.valor_desagio ? parseFloat(formData.valor_desagio) : null,
        is_active: formData.is_active,
        updated_at: new Date().toISOString(),
      };

      if (faixa) {
        const { error } = await supabase
          .from('tabelas_preco_mensalidade')
          .update(data)
          .eq('id', faixa.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tabelas_preco_mensalidade')
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(faixa ? 'Faixa atualizada!' : 'Faixa criada!');
      queryClient.invalidateQueries({ queryKey: ['plano-precos'] });
      queryClient.invalidateQueries({ queryKey: ['tabela-precos-mensalidade'] });
      queryClient.invalidateQueries({ queryKey: ['tabelas_preco_mensalidade'] });
      queryClient.invalidateQueries({ queryKey: ['tabelas-preco-mensalidade-check'] });
      queryClient.invalidateQueries({ queryKey: ['planos-precos-info'] });
      queryClient.invalidateQueries({ queryKey: ['tabela-precos-gc'] });
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fipe_min || !formData.fipe_max || !formData.valor_mensal) {
      toast.error('FIPE Min, FIPE Max e Valor Mensal são obrigatórios');
      return;
    }
    if (!formData.linha_slug) {
      toast.error('Linha (slug) é obrigatória');
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
          {/* Linha e Região */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="linha_slug">Linha (slug) *</Label>
              <Input
                id="linha_slug"
                value={formData.linha_slug}
                onChange={(e) => setFormData({ ...formData, linha_slug: e.target.value })}
                placeholder="Ex: select, lancamento, especial"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="regiao">Região *</Label>
              <Select value={formData.regiao} onValueChange={(v) => setFormData({ ...formData, regiao: v })}>
                <SelectTrigger id="regiao">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rj">RJ</SelectItem>
                  <SelectItem value="sp">SP</SelectItem>
                  <SelectItem value="lagos">Lagos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Combustível e Tipo Uso */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="combustivel_tipo">Combustível</Label>
              <Select 
                value={formData.combustivel_tipo || 'null'} 
                onValueChange={(v) => setFormData({ ...formData, combustivel_tipo: v === 'null' ? '' : v })}
              >
                <SelectTrigger id="combustivel_tipo">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Nenhum (NULL)</SelectItem>
                  <SelectItem value="gasolina">Gasolina</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Select One usa NULL (aceita qualquer combustível)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo_uso">Tipo de Uso *</Label>
              <Select value={formData.tipo_uso} onValueChange={(v) => setFormData({ ...formData, tipo_uso: v })}>
                <SelectTrigger id="tipo_uso">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="particular">Particular</SelectItem>
                  <SelectItem value="aplicativo">Aplicativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Faixa FIPE */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fipe_min">FIPE Min (R$) *</Label>
              <Input
                id="fipe_min"
                type="number"
                value={formData.fipe_min}
                onChange={(e) => setFormData({ ...formData, fipe_min: e.target.value })}
                placeholder="Ex: 20000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fipe_max">FIPE Max (R$) *</Label>
              <Input
                id="fipe_max"
                type="number"
                value={formData.fipe_max}
                onChange={(e) => setFormData({ ...formData, fipe_max: e.target.value })}
                placeholder="Ex: 40000"
              />
            </div>
          </div>

          {/* Valores */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor_mensal">Valor Mensal (R$) *</Label>
              <Input
                id="valor_mensal"
                type="number"
                step="0.01"
                value={formData.valor_mensal}
                onChange={(e) => setFormData({ ...formData, valor_mensal: e.target.value })}
                placeholder="Ex: 218.90"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="valor_desagio">Valor Deságio (R$)</Label>
              <Input
                id="valor_desagio"
                type="number"
                step="0.01"
                value={formData.valor_desagio}
                onChange={(e) => setFormData({ ...formData, valor_desagio: e.target.value })}
                placeholder="Ex: 180.00"
              />
              <p className="text-xs text-muted-foreground">Valor com desconto de deságio (opcional)</p>
            </div>
          </div>

          {/* Ativo */}
          <div className="flex items-center gap-2 pt-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
            <Label htmlFor="is_active">Ativo</Label>
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
