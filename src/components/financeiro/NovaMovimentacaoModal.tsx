import { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NovaMovimentacaoModalProps {
  open: boolean;
  onClose: () => void;
}

const categoriasEntrada = [
  { value: 'mensalidade', label: 'Mensalidade' },
  { value: 'adesao', label: 'Adesão' },
  { value: 'taxa', label: 'Taxa' },
  { value: 'outros', label: 'Outros' },
];

const categoriasSaida = [
  { value: 'prestador_assistencia', label: 'Prestador Assistência' },
  { value: 'oficina', label: 'Oficina' },
  { value: 'folha_pagamento', label: 'Folha de Pagamento' },
  { value: 'impostos', label: 'Impostos' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'outros', label: 'Outros' },
];

export function NovaMovimentacaoModal({ open, onClose }: NovaMovimentacaoModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    tipo: 'entrada',
    categoria: '',
    valor: '',
    data_movimentacao: new Date().toISOString().split('T')[0],
    descricao: '',
    observacao: '',
  });

  const categoriasDisponiveis = formData.tipo === 'entrada' ? categoriasEntrada : categoriasSaida;

  useEffect(() => {
    setFormData(prev => ({ ...prev, categoria: '' }));
  }, [formData.tipo]);

  const formatValor = (value: string) => {
    const clean = value.replace(/\D/g, '');
    const number = parseInt(clean || '0') / 100;
    return number.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const parseValor = (value: string) => {
    return value.replace(/\./g, '').replace(',', '.');
  };

  const isFormValid = () => {
    return (
      formData.tipo !== '' &&
      formData.categoria !== '' &&
      formData.valor !== '' &&
      parseFloat(parseValor(formData.valor)) > 0 &&
      formData.data_movimentacao !== '' &&
      formData.descricao.trim() !== ''
    );
  };

  const handleClose = () => {
    setFormData({
      tipo: 'entrada',
      categoria: '',
      valor: '',
      data_movimentacao: new Date().toISOString().split('T')[0],
      descricao: '',
      observacao: '',
    });
    onClose();
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: movimentacao, error } = await supabase
        .from('movimentacoes_financeiras')
        .insert({
          tipo: data.tipo,
          categoria: data.categoria,
          referencia_tipo: 'manual',
          valor: parseFloat(parseValor(data.valor)),
          data_movimentacao: data.data_movimentacao,
          descricao: data.descricao,
          observacao: data.observacao || null,
          registrado_por: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return movimentacao;
    },
    onSuccess: () => {
      toast.success('Movimentação registrada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] });
      handleClose();
    },
    onError: () => {
      toast.error('Erro ao registrar movimentação');
    },
  });

  const handleSubmit = () => {
    if (isFormValid()) {
      createMutation.mutate(formData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Movimentação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo de Movimentação */}
          <div className="space-y-2">
            <Label>Tipo de Movimentação</Label>
            <RadioGroup
              value={formData.tipo}
              onValueChange={(value) => setFormData(prev => ({ ...prev, tipo: value }))}
              className="grid grid-cols-2 gap-3"
            >
              <Label
                htmlFor="entrada"
                className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                  formData.tipo === 'entrada'
                    ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <RadioGroupItem value="entrada" id="entrada" className="sr-only" />
                <TrendingUp className={`h-4 w-4 ${formData.tipo === 'entrada' ? 'text-green-600' : 'text-muted-foreground'}`} />
                <span className={formData.tipo === 'entrada' ? 'text-green-700 dark:text-green-400 font-medium' : ''}>
                  Entrada
                </span>
              </Label>
              <Label
                htmlFor="saida"
                className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                  formData.tipo === 'saida'
                    ? 'border-red-500 bg-red-50 dark:bg-red-950/30'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <RadioGroupItem value="saida" id="saida" className="sr-only" />
                <TrendingDown className={`h-4 w-4 ${formData.tipo === 'saida' ? 'text-red-600' : 'text-muted-foreground'}`} />
                <span className={formData.tipo === 'saida' ? 'text-red-700 dark:text-red-400 font-medium' : ''}>
                  Saída
                </span>
              </Label>
            </RadioGroup>
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label htmlFor="categoria">Categoria *</Label>
            <Select
              value={formData.categoria}
              onValueChange={(value) => setFormData(prev => ({ ...prev, categoria: value }))}
            >
              <SelectTrigger id="categoria">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {categoriasDisponiveis.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Valor e Data */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="valor">Valor *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  R$
                </span>
                <Input
                  id="valor"
                  className="pl-9"
                  value={formData.valor}
                  onChange={(e) => setFormData(prev => ({ ...prev, valor: formatValor(e.target.value) }))}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="data">Data *</Label>
              <Input
                id="data"
                type="date"
                value={formData.data_movimentacao}
                onChange={(e) => setFormData(prev => ({ ...prev, data_movimentacao: e.target.value }))}
              />
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Input
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
              placeholder="Descreva a movimentação"
            />
          </div>

          {/* Observação */}
          <div className="space-y-2">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              rows={3}
              value={formData.observacao}
              onChange={(e) => setFormData(prev => ({ ...prev, observacao: e.target.value }))}
              placeholder="Observações adicionais..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isFormValid() || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
