import { useState, useEffect } from 'react';
import { Loader2, Building2, Calendar, DollarSign, Tag } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useLancamentosContabeis } from '@/hooks/useLancamentosContabeis';
import { CONTAS_PADRAO, DESPESA_POR_CATEGORIA } from '@/lib/contabilidade-config';

interface Conta {
  id: string;
  fornecedor_nome: string;
  fornecedor_documento?: string | null;
  categoria: string;
  valor: number;
  data_vencimento: string;
  forma_pagamento?: string | null;
}

interface PagarContaModalProps {
  open: boolean;
  onClose: () => void;
  conta: Conta | null;
}

const formasPagamento = [
  { value: 'pix', label: 'PIX' },
  { value: 'transferencia', label: 'Transferência Bancária' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cheque', label: 'Cheque' },
];

const categoriaLabels: Record<string, string> = {
  'prestador_assistencia': 'Prestador Assistência',
  'oficina': 'Oficina',
  'fornecedor': 'Fornecedor',
  'folha_pagamento': 'Folha de Pagamento',
  'impostos': 'Impostos',
  'aluguel': 'Aluguel',
  'servicos': 'Serviços',
  'marketing': 'Marketing',
  'outros': 'Outros',
};

export function PagarContaModal({ open, onClose, conta }: PagarContaModalProps) {
  const queryClient = useQueryClient();
  const { criarLancamentoAutomatico } = useLancamentosContabeis();
  
  const [formData, setFormData] = useState({
    valor_pago: '',
    data_pagamento: new Date().toISOString().split('T')[0],
    forma_pagamento: '',
    comprovante_url: '',
  });

  // Inicializar valores quando modal abre com conta
  useEffect(() => {
    if (conta && open) {
      setFormData({
        valor_pago: formatValor((conta.valor * 100).toString()),
        data_pagamento: new Date().toISOString().split('T')[0],
        forma_pagamento: conta.forma_pagamento || '',
        comprovante_url: '',
      });
    }
  }, [conta, open]);

  // Formatar valor como moeda para exibição no input
  const formatValor = (value: string) => {
    const clean = value.replace(/\D/g, '');
    const number = parseInt(clean || '0') / 100;
    return number.toLocaleString('pt-BR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  // Converter valor formatado para número
  const parseValor = (value: string) => {
    return value.replace(/\./g, '').replace(',', '.');
  };

  // Formatar valor da conta para exibição
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);
  };

  // Formatar data para exibição
  const formatDate = (date: string) => {
    try {
      return format(parseISO(date), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return date;
    }
  };

  const handleClose = () => {
    setFormData({
      valor_pago: '',
      data_pagamento: new Date().toISOString().split('T')[0],
      forma_pagamento: '',
      comprovante_url: '',
    });
    onClose();
  };

  const pagarMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // 1. Atualizar conta para status 'pago'
      const { error: errorConta } = await supabase
        .from('contas_pagar')
        .update({
          status: 'pago',
          valor_pago: parseFloat(parseValor(data.valor_pago)),
          data_pagamento: data.data_pagamento,
          forma_pagamento: data.forma_pagamento || null,
          comprovante_url: data.comprovante_url || null,
          pago_por: user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', conta!.id);
      
      if (errorConta) throw errorConta;
      
      // 2. Registrar movimentação financeira de saída
      const valorPagoNum = parseFloat(parseValor(data.valor_pago));
      
      const { error: errorMov } = await supabase
        .from('movimentacoes_financeiras')
        .insert({
          tipo: 'saida',
          categoria: conta!.categoria,
          referencia_tipo: 'conta_pagar',
          referencia_id: conta!.id,
          valor: valorPagoNum,
          data_movimentacao: data.data_pagamento,
          descricao: `Pagamento ${conta!.categoria} - ${conta!.fornecedor_nome}`,
          registrado_por: user?.id
        });
      
      if (errorMov) throw errorMov;

      // 3. Criar lançamento contábil
      try {
        const contaDespesaId = DESPESA_POR_CATEGORIA[conta!.categoria] || CONTAS_PADRAO.TARIFAS_BANCARIAS;
        
        await criarLancamentoAutomatico({
          origem: 'pagamento',
          origem_id: conta!.id,
          data_competencia: data.data_pagamento,
          historico: `Pagamento ${categoriaLabels[conta!.categoria] || conta!.categoria} - ${conta!.fornecedor_nome}`,
          conta_debito_id: contaDespesaId,
          conta_credito_id: CONTAS_PADRAO.BANCO_CONTA_MOVIMENTO,
          valor: valorPagoNum
        });
      } catch (errContabil) {
        console.error('Erro ao criar lançamento contábil:', errContabil);
      }
    },
    onSuccess: () => {
      toast.success('Pagamento registrado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
      queryClient.invalidateQueries({ queryKey: ['contas-pagar-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['lancamentos-contabeis'] });
      handleClose();
    },
    onError: () => {
      toast.error('Erro ao registrar pagamento');
    }
  });

  const isFormValid = () => {
    return (
      formData.valor_pago !== '' &&
      parseFloat(parseValor(formData.valor_pago)) > 0 &&
      formData.data_pagamento !== ''
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid()) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    
    pagarMutation.mutate(formData);
  };

  if (!conta) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Card com informações da conta */}
          <Card className="bg-muted/50">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{conta.fornecedor_nome}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <Badge variant="secondary">
                  {categoriaLabels[conta.categoria] || conta.categoria}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-primary">
                  {formatCurrency(conta.valor)}
                </span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Vencimento: {formatDate(conta.data_vencimento)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Formulário de pagamento */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="valor_pago">Valor Pago *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    R$
                  </span>
                  <Input
                    id="valor_pago"
                    value={formData.valor_pago}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      valor_pago: formatValor(e.target.value) 
                    }))}
                    className="pl-10"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_pagamento">Data Pagamento *</Label>
                <Input
                  id="data_pagamento"
                  type="date"
                  value={formData.data_pagamento}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    data_pagamento: e.target.value 
                  }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="forma_pagamento">Forma de Pagamento</Label>
              <Select
                value={formData.forma_pagamento}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  forma_pagamento: value 
                }))}
              >
                <SelectTrigger id="forma_pagamento">
                  <SelectValue placeholder="Selecione..." />
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

            <div className="space-y-2">
              <Label htmlFor="comprovante_url">URL do Comprovante</Label>
              <Input
                id="comprovante_url"
                value={formData.comprovante_url}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  comprovante_url: e.target.value 
                }))}
                placeholder="https://..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={!isFormValid() || pagarMutation.isPending}
            >
              {pagarMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
