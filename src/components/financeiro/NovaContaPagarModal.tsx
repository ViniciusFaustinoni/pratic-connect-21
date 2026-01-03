import { useState } from 'react';
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

interface NovaContaPagarModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
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

const formasPagamento = [
  { value: 'pix', label: 'PIX' },
  { value: 'transferencia', label: 'Transferência Bancária' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cheque', label: 'Cheque' },
];

const initialFormData = {
  fornecedor_nome: '',
  fornecedor_documento: '',
  categoria: '',
  subcategoria: '',
  valor: '',
  data_vencimento: '',
  forma_pagamento: '',
  banco: '',
  agencia: '',
  conta: '',
  pix_chave: '',
  observacao: '',
};

export function NovaContaPagarModal({ open, onClose, onSuccess }: NovaContaPagarModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(initialFormData);

  const formatCpfCnpj = (value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 14);
    if (clean.length <= 11) {
      return clean
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      return clean
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
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

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: conta, error } = await supabase
        .from('contas_pagar')
        .insert({
          fornecedor_nome: data.fornecedor_nome,
          fornecedor_documento: data.fornecedor_documento || null,
          categoria: data.categoria,
          subcategoria: data.subcategoria || null,
          valor: parseFloat(parseValor(data.valor)),
          data_vencimento: data.data_vencimento,
          forma_pagamento: data.forma_pagamento || null,
          banco: data.banco || null,
          agencia: data.agencia || null,
          conta: data.conta || null,
          pix_chave: data.pix_chave || null,
          observacao: data.observacao || null,
          status: 'pendente'
        })
        .select()
        .single();
      
      if (error) throw error;
      return conta;
    },
    onSuccess: () => {
      toast.success('Conta a pagar cadastrada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
      queryClient.invalidateQueries({ queryKey: ['contas-pagar-kpis'] });
      handleClose();
      onSuccess?.();
    },
    onError: () => {
      toast.error('Erro ao cadastrar conta');
    }
  });

  const isFormValid = () => {
    return (
      formData.fornecedor_nome.trim() !== '' &&
      formData.categoria !== '' &&
      formData.valor !== '' &&
      parseFloat(parseValor(formData.valor)) > 0 &&
      formData.data_vencimento !== ''
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    
    createMutation.mutate(formData);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Conta a Pagar</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados do Fornecedor */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Dados do Fornecedor
            </h4>
            
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

          {/* Dados da Conta */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Dados da Conta
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(value) => handleChange('categoria', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
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
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    R$
                  </span>
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
                <Label htmlFor="data_vencimento">Vencimento *</Label>
                <Input
                  id="data_vencimento"
                  type="date"
                  value={formData.data_vencimento}
                  onChange={(e) => handleChange('data_vencimento', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Dados para Pagamento */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Dados para Pagamento
            </h4>

            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select
                value={formData.forma_pagamento}
                onValueChange={(value) => handleChange('forma_pagamento', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {formasPagamento.map((forma) => (
                    <SelectItem key={forma.value} value={forma.value}>
                      {forma.label}
                    </SelectItem>
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
                  <Input
                    id="banco"
                    value={formData.banco}
                    onChange={(e) => handleChange('banco', e.target.value)}
                    placeholder="Nome do banco"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="agencia">Agência</Label>
                    <Input
                      id="agencia"
                      value={formData.agencia}
                      onChange={(e) => handleChange('agencia', e.target.value)}
                      placeholder="0000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="conta">Conta</Label>
                    <Input
                      id="conta"
                      value={formData.conta}
                      onChange={(e) => handleChange('conta', e.target.value)}
                      placeholder="00000-0"
                    />
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
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !isFormValid()}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cadastrar Conta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
