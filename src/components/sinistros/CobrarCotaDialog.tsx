import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2, DollarSign, CreditCard } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PRAZOS_SINISTRO, VALORES_SINISTRO } from '@/types/sinistros';

interface CobrarCotaDialogProps {
  open: boolean;
  onClose: () => void;
  sinistroId: string;
  protocolo: string;
  associadoId: string;
  valorSugerido?: number;
  onSuccess?: () => void;
}

export function CobrarCotaDialog({
  open,
  onClose,
  sinistroId,
  protocolo,
  associadoId,
  valorSugerido = VALORES_SINISTRO.cota_participacao_padrao,
  onSuccess,
}: CobrarCotaDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [valor, setValor] = useState(valorSugerido.toString());
  const [formaPagamento, setFormaPagamento] = useState<'pix' | 'boleto'>('pix');
  const [enviarWhatsApp, setEnviarWhatsApp] = useState(true);
  const [dataVencimento, setDataVencimento] = useState(
    format(addDays(new Date(), 3), 'yyyy-MM-dd')
  );

  const cobrarMutation = useMutation({
    mutationFn: async () => {
      const valorNumerico = parseFloat(valor);
      if (isNaN(valorNumerico) || valorNumerico <= 0) {
        throw new Error('Valor inválido');
      }

      // 1. Criar cobrança no Asaas (via edge function)
      const { data: cobrancaData, error: cobrancaError } = await supabase.functions.invoke('criar-cobranca-asaas', {
        body: {
          associado_id: associadoId,
          valor: valorNumerico,
          descricao: `Cota de Participação - Sinistro ${protocolo}`,
          tipo: 'cota_sinistro',
          referencia: sinistroId,
          forma_pagamento: formaPagamento,
          data_vencimento: dataVencimento,
        },
      });

      if (cobrancaError) {
        console.error('Erro ao criar cobrança:', cobrancaError);
        // Continuar mesmo se falhar o Asaas - marcar como aguardando_cota
      }

      // 2. Atualizar sinistro
      const { error: updateError } = await supabase
        .from('sinistros')
        .update({
          status: 'aguardando_cota' as any,
          valor_cota_participacao: valorNumerico,
          data_prazo_cota: addDays(new Date(dataVencimento), PRAZOS_SINISTRO.cota_pendente).toISOString(),
          cobranca_cota_id: cobrancaData?.cobranca_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sinistroId);

      if (updateError) throw updateError;

      // 3. Registrar histórico
      const { error: histError } = await supabase
        .from('sinistro_historico')
        .insert({
          sinistro_id: sinistroId,
          status_novo: 'aguardando_cota',
          usuario_id: user?.id,
          observacao: `Cota de participação cobrada: R$ ${valorNumerico.toFixed(2)} via ${formaPagamento.toUpperCase()}. Vencimento: ${format(new Date(dataVencimento), 'dd/MM/yyyy')}`,
        });

      if (histError) throw histError;

      // 4. Notificar via WhatsApp
      if (enviarWhatsApp) {
        try {
          await supabase.functions.invoke('notificar-sinistro', {
            body: {
              sinistro_id: sinistroId,
              status: 'aguardando_cota',
              dados_extras: {
                valor_cota: valorNumerico,
                forma_pagamento: formaPagamento,
                vencimento: format(new Date(dataVencimento), 'dd/MM/yyyy'),
              },
            },
          });
        } catch (err) {
          console.error('Erro ao notificar:', err);
        }
      }
    },
    onSuccess: () => {
      toast.success('Cota de participação cobrada!', {
        description: enviarWhatsApp ? 'Associado foi notificado via WhatsApp' : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistro-analise', sinistroId] });
      queryClient.invalidateQueries({ queryKey: ['sinistros'] });
      handleClose();
      onSuccess?.();
    },
    onError: (error) => {
      console.error('Erro ao cobrar cota:', error);
      toast.error('Erro ao cobrar cota de participação');
    },
  });

  const handleClose = () => {
    setValor(valorSugerido.toString());
    setFormaPagamento('pix');
    setEnviarWhatsApp(true);
    setDataVencimento(format(addDays(new Date(), 3), 'yyyy-MM-dd'));
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-lime-600" />
            Cobrar Cota de Participação
          </DialogTitle>
          <DialogDescription>
            Sinistro {protocolo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Valor */}
          <div className="space-y-2">
            <Label htmlFor="valor">Valor da Cota (R$)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                R$
              </span>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Valor padrão: R$ {VALORES_SINISTRO.cota_participacao_padrao.toFixed(2)}
            </p>
          </div>

          {/* Forma de Pagamento */}
          <div className="space-y-2">
            <Label>Forma de Pagamento</Label>
            <Select value={formaPagamento} onValueChange={(v) => setFormaPagamento(v as 'pix' | 'boleto')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    PIX (Instantâneo)
                  </div>
                </SelectItem>
                <SelectItem value="boleto">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Boleto Bancário
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Data de Vencimento */}
          <div className="space-y-2">
            <Label htmlFor="vencimento">Data de Vencimento</Label>
            <Input
              id="vencimento"
              type="date"
              value={dataVencimento}
              onChange={(e) => setDataVencimento(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          {/* Enviar WhatsApp */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="enviar-whatsapp"
              checked={enviarWhatsApp}
              onCheckedChange={(checked) => setEnviarWhatsApp(checked as boolean)}
            />
            <Label htmlFor="enviar-whatsapp" className="font-normal">
              Enviar link de pagamento via WhatsApp
            </Label>
          </div>

          {/* Informativo */}
          <div className="p-3 rounded-md bg-lime-50 border border-lime-200">
            <p className="text-sm text-lime-800">
              💰 Após o pagamento da cota, o veículo será encaminhado para reparo na oficina credenciada.
              Prazo máximo: {PRAZOS_SINISTRO.cota_pendente} dias.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={cobrarMutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => cobrarMutation.mutate()}
            disabled={cobrarMutation.isPending}
            className="bg-lime-600 hover:bg-lime-700"
          >
            {cobrarMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Gerar Cobrança
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
