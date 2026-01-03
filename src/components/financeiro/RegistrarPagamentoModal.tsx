import { useState, useEffect } from 'react';
import { DollarSign, Calendar, CreditCard, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Cobranca {
  id: string;
  tipo: string;
  valor: number;
  valor_liquido?: number;
  desconto?: number;
  competencia?: string;
  referencia?: string;
  data_vencimento: string;
  associado?: {
    id: string;
    nome: string;
  };
}

interface RegistrarPagamentoModalProps {
  open: boolean;
  onClose: () => void;
  cobranca: Cobranca | null;
}

const formasPagamento = [
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'PIX', label: 'PIX' },
  { value: 'CREDIT_CARD', label: 'Cartão de Crédito' },
  { value: 'DEBIT_CARD', label: 'Cartão de Débito' },
  { value: 'CASH', label: 'Dinheiro' },
  { value: 'TRANSFER', label: 'Transferência' },
];

const tipoLabels: Record<string, string> = {
  mensalidade: 'Mensalidade',
  adesao: 'Adesão',
  taxa_instalacao: 'Taxa de Instalação',
  taxa_vistoria: 'Taxa de Vistoria',
  participacao_sinistro: 'Participação Sinistro',
  avulso: 'Avulso',
  outros: 'Outros',
};

export function RegistrarPagamentoModal({ open, onClose, cobranca }: RegistrarPagamentoModalProps) {
  const queryClient = useQueryClient();
  
  const valorAPagar = cobranca?.valor_liquido ?? cobranca?.valor ?? 0;
  
  const [formData, setFormData] = useState({
    valor_pago: '',
    data_pagamento: format(new Date(), 'yyyy-MM-dd'),
    forma_pagamento: '',
    observacao: ''
  });

  // Reset form when modal opens with new cobranca
  useEffect(() => {
    if (open && cobranca) {
      setFormData({
        valor_pago: valorAPagar.toString(),
        data_pagamento: format(new Date(), 'yyyy-MM-dd'),
        forma_pagamento: '',
        observacao: ''
      });
    }
  }, [open, cobranca, valorAPagar]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const registrarMutation = useMutation({
    mutationFn: async () => {
      if (!cobranca) throw new Error('Cobrança não encontrada');
      
      const { data: { user } } = await supabase.auth.getUser();
      const valorPago = parseFloat(formData.valor_pago) || 0;
      
      // 1. Atualizar cobrança
      const { error: errorCobranca } = await supabase
        .from('asaas_cobrancas')
        .update({
          status: 'RECEIVED',
          pagamento_valor: valorPago,
          pagamento_data: new Date(formData.data_pagamento).toISOString(),
          pagamento_forma: formData.forma_pagamento,
          data_pagamento: formData.data_pagamento,
          updated_at: new Date().toISOString()
        })
        .eq('id', cobranca.id);
      
      if (errorCobranca) throw errorCobranca;
      
      // 2. Registrar movimentação financeira
      const { error: errorMov } = await supabase
        .from('movimentacoes_financeiras')
        .insert({
          tipo: 'entrada',
          categoria: cobranca.tipo || 'mensalidade',
          referencia_tipo: 'cobranca',
          referencia_id: cobranca.id,
          valor: valorPago,
          data_movimentacao: formData.data_pagamento,
          descricao: `Pagamento ${tipoLabels[cobranca.tipo] || cobranca.tipo} - ${cobranca.associado?.nome || 'Associado'}`,
          observacao: formData.observacao || null,
          registrado_por: user?.id
        });
      
      if (errorMov) {
        console.error('Erro ao registrar movimentação:', errorMov);
        // Não lança erro para não impedir o fluxo principal
      }
    },
    onSuccess: () => {
      toast.success('Pagamento registrado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['cobranca'] });
      queryClient.invalidateQueries({ queryKey: ['cobrancas'] });
      queryClient.invalidateQueries({ queryKey: ['cobrancas-lista'] });
      queryClient.invalidateQueries({ queryKey: ['movimentacoes'] });
      handleClose();
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar pagamento: ' + error.message);
    }
  });

  const handleClose = () => {
    setFormData({
      valor_pago: '',
      data_pagamento: format(new Date(), 'yyyy-MM-dd'),
      forma_pagamento: '',
      observacao: ''
    });
    onClose();
  };

  const isFormValid = formData.valor_pago && 
    parseFloat(formData.valor_pago) > 0 && 
    formData.data_pagamento && 
    formData.forma_pagamento;

  if (!cobranca) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Registrar Pagamento
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Cobrança de {cobranca.associado?.nome || 'Associado'}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info da Cobrança */}
          <Card className="bg-muted/50">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {tipoLabels[cobranca.tipo] || cobranca.tipo}
                  {cobranca.competencia && ` • ${cobranca.competencia}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Valor a pagar:</span>
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(valorAPagar)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Vencimento:</span>
                <span>
                  {format(new Date(cobranca.data_vencimento + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Formulário */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="valor_pago">Valor Pago (R$) *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="valor_pago"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  className="pl-9"
                  value={formData.valor_pago}
                  onChange={(e) => setFormData({ ...formData, valor_pago: e.target.value })}
                />
              </div>
              {parseFloat(formData.valor_pago) < valorAPagar && parseFloat(formData.valor_pago) > 0 && (
                <p className="text-xs text-amber-600">
                  Valor inferior ao esperado (pagamento parcial)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_pagamento">Data do Pagamento *</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="data_pagamento"
                  type="date"
                  className="pl-9"
                  value={formData.data_pagamento}
                  onChange={(e) => setFormData({ ...formData, data_pagamento: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="forma_pagamento">Forma de Pagamento *</Label>
              <Select
                value={formData.forma_pagamento}
                onValueChange={(value) => setFormData({ ...formData, forma_pagamento: value })}
              >
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Selecione..." />
                  </div>
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
              <Label htmlFor="observacao">Observação</Label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="observacao"
                  placeholder="Observações sobre o pagamento..."
                  className="pl-9 min-h-[80px]"
                  value={formData.observacao}
                  onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={() => registrarMutation.mutate()}
            disabled={!isFormValid || registrarMutation.isPending}
          >
            {registrarMutation.isPending ? 'Registrando...' : 'Confirmar Pagamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
