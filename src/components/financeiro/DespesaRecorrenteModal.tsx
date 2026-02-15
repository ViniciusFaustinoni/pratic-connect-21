import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DespesaRecorrenteModalProps {
  open: boolean;
  onClose: () => void;
  despesa?: any;
}

const categorias = [
  { value: 'prestador_assistencia', label: 'Prestador Assistência' },
  { value: 'oficina', label: 'Oficina' },
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'folha_pagamento', label: 'Folha de Pagamento' },
  { value: 'impostos', label: 'Impostos' },
  { value: 'aluguel', label: 'Aluguel' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'outros', label: 'Outros' },
];

const frequencias = [
  { value: 'mensal', label: 'Mensal' },
  { value: 'quinzenal', label: 'Quinzenal' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'anual', label: 'Anual' },
];

const formasPagamento = [
  { value: 'pix', label: 'PIX' },
  { value: 'transferencia', label: 'Transferência Bancária' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'dinheiro', label: 'Dinheiro' },
];

const initialFormData = {
  fornecedor_nome: '',
  fornecedor_documento: '',
  categoria: '',
  subcategoria: '',
  descricao: '',
  valor: '',
  frequencia: 'mensal',
  dia_vencimento: '1',
  forma_pagamento: '',
  banco: '',
  agencia: '',
  conta: '',
  pix_chave: '',
  observacao: '',
};

function calcularProximoLancamento(diaVencimento: number, frequencia: string): string {
  const hoje = new Date();
  let proximo: Date;

  if (frequencia === 'mensal') {
    proximo = new Date(hoje.getFullYear(), hoje.getMonth(), diaVencimento);
    if (proximo <= hoje) {
      proximo.setMonth(proximo.getMonth() + 1);
    }
  } else if (frequencia === 'anual') {
    proximo = new Date(hoje.getFullYear(), hoje.getMonth(), diaVencimento);
    if (proximo <= hoje) {
      proximo.setFullYear(proximo.getFullYear() + 1);
    }
  } else if (frequencia === 'quinzenal') {
    proximo = new Date(hoje);
    proximo.setDate(proximo.getDate() + 15);
  } else {
    proximo = new Date(hoje);
    proximo.setDate(proximo.getDate() + 7);
  }

  return proximo.toISOString().split('T')[0];
}

export function DespesaRecorrenteModal({ open, onClose, despesa }: DespesaRecorrenteModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(initialFormData);
  const isEditing = !!despesa;

  useEffect(() => {
    if (despesa) {
      setFormData({
        fornecedor_nome: despesa.fornecedor_nome || '',
        fornecedor_documento: despesa.fornecedor_documento || '',
        categoria: despesa.categoria || '',
        subcategoria: despesa.subcategoria || '',
        descricao: despesa.descricao || '',
        valor: Number(despesa.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        frequencia: despesa.frequencia || 'mensal',
        dia_vencimento: String(despesa.dia_vencimento || 1),
        forma_pagamento: despesa.forma_pagamento || '',
        banco: despesa.banco || '',
        agencia: despesa.agencia || '',
        conta: despesa.conta || '',
        pix_chave: despesa.pix_chave || '',
        observacao: despesa.observacao || '',
      });
    } else {
      setFormData(initialFormData);
    }
  }, [despesa, open]);

  const formatCpfCnpj = (value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 14);
    if (clean.length <= 11) {
      return clean
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return clean
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  };

  const formatValor = (value: string) => {
    const clean = value.replace(/\D/g, '');
    const number = parseInt(clean || '0') / 100;
    return number.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseValor = (value: string) => {
    return value.replace(/\./g, '').replace(',', '.');
  };

  const handleClose = () => {
    setFormData(initialFormData);
    onClose();
  };

  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const dia = parseInt(data.dia_vencimento);
      const proximo = calcularProximoLancamento(dia, data.frequencia);
      const payload = {
        fornecedor_nome: data.fornecedor_nome,
        fornecedor_documento: data.fornecedor_documento || null,
        categoria: data.categoria,
        subcategoria: data.subcategoria || null,
        descricao: data.descricao,
        valor: parseFloat(parseValor(data.valor)),
        frequencia: data.frequencia,
        dia_vencimento: dia,
        forma_pagamento: data.forma_pagamento || null,
        banco: data.banco || null,
        agencia: data.agencia || null,
        conta: data.conta || null,
        pix_chave: data.pix_chave || null,
        observacao: data.observacao || null,
        proximo_lancamento: proximo,
      };

      if (isEditing) {
        const { error } = await supabase
          .from('despesas_recorrentes' as any)
          .update(payload as any)
          .eq('id', despesa.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('despesas_recorrentes' as any)
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Despesa atualizada!' : 'Despesa recorrente cadastrada!');
      queryClient.invalidateQueries({ queryKey: ['despesas-recorrentes'] });
      handleClose();
    },
    onError: () => {
      toast.error('Erro ao salvar despesa recorrente');
    },
  });

  const isFormValid = () => {
    return (
      formData.fornecedor_nome.trim() !== '' &&
      formData.categoria !== '' &&
      formData.descricao.trim() !== '' &&
      formData.valor !== '' &&
      parseFloat(parseValor(formData.valor)) > 0 &&
      formData.dia_vencimento !== ''
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Despesa Recorrente' : 'Nova Despesa Recorrente'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Fornecedor */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Fornecedor</h4>
            <div className="space-y-2">
              <Label htmlFor="fornecedor_nome">Nome / Razão Social *</Label>
              <Input
                id="fornecedor_nome"
                value={formData.fornecedor_nome}
                onChange={(e) => handleChange('fornecedor_nome', e.target.value)}
                placeholder="Nome do fornecedor"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fornecedor_documento">CPF / CNPJ</Label>
              <Input
                id="fornecedor_documento"
                value={formData.fornecedor_documento}
                onChange={(e) => handleChange('fornecedor_documento', formatCpfCnpj(e.target.value))}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
              />
            </div>
          </div>

          {/* Dados da Despesa */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Dados da Despesa</h4>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição *</Label>
              <Input
                id="descricao"
                value={formData.descricao}
                onChange={(e) => handleChange('descricao', e.target.value)}
                placeholder="Ex: Aluguel sede, Lovable mensal"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select value={formData.categoria} onValueChange={(v) => handleChange('categoria', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {categorias.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subcategoria">Subcategoria</Label>
                <Input
                  id="subcategoria"
                  value={formData.subcategoria}
                  onChange={(e) => handleChange('subcategoria', e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor">Valor *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                  <Input
                    id="valor"
                    value={formData.valor}
                    onChange={(e) => handleChange('valor', formatValor(e.target.value))}
                    placeholder="0,00"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Frequência *</Label>
                <Select value={formData.frequencia} onValueChange={(v) => handleChange('frequencia', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {frequencias.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dia_vencimento">Dia do vencimento (1-28) *</Label>
              <Input
                id="dia_vencimento"
                type="number"
                min={1}
                max={28}
                value={formData.dia_vencimento}
                onChange={(e) => handleChange('dia_vencimento', e.target.value)}
              />
            </div>
          </div>

          {/* Pagamento */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Dados para Pagamento</h4>
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={formData.forma_pagamento} onValueChange={(v) => handleChange('forma_pagamento', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {formasPagamento.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.forma_pagamento === 'pix' && (
              <div className="space-y-2">
                <Label htmlFor="pix_chave">Chave PIX</Label>
                <Input
                  id="pix_chave"
                  value={formData.pix_chave}
                  onChange={(e) => handleChange('pix_chave', e.target.value)}
                  placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                />
              </div>
            )}

            {formData.forma_pagamento === 'transferencia' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="banco">Banco</Label>
                  <Input id="banco" value={formData.banco} onChange={(e) => handleChange('banco', e.target.value)} placeholder="Nome do banco" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="agencia">Agência</Label>
                    <Input id="agencia" value={formData.agencia} onChange={(e) => handleChange('agencia', e.target.value)} placeholder="0000" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conta">Conta</Label>
                    <Input id="conta" value={formData.conta} onChange={(e) => handleChange('conta', e.target.value)} placeholder="00000-0" />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Observação */}
          <div className="space-y-2">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              value={formData.observacao}
              onChange={(e) => handleChange('observacao', e.target.value)}
              placeholder="Informações adicionais..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" disabled={saveMutation.isPending || !isFormValid()}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
