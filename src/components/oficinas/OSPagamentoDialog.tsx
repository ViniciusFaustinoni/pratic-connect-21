import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLancamentosContabeis } from '@/hooks/useLancamentosContabeis';
import { CONTAS_PADRAO } from '@/lib/contabilidade-config';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { OrdemServico, FormaPagamentoOficina } from '@/types/database';

const FORMA_PAGAMENTO_LABELS: Record<FormaPagamentoOficina, string> = {
  pix: 'PIX',
  transferencia: 'Transferência',
  boleto: 'Boleto',
  cheque: 'Cheque',
};

const formSchema = z.object({
  valor: z.coerce.number().min(0.01, 'Valor deve ser maior que 0'),
  forma_pagamento: z.enum(['pix', 'transferencia', 'boleto', 'cheque']),
  data_pagamento: z.string().min(1, 'Data é obrigatória'),
  observacao: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  os: OrdemServico;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OSPagamentoDialog({ os, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { criarLancamentoAutomatico } = useLancamentosContabeis();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      valor: os.valor_aprovado || os.valor_orcamento || 0,
      forma_pagamento: 'pix',
      data_pagamento: new Date().toISOString().split('T')[0],
      observacao: '',
    },
  });

  const registrarPagamento = useMutation({
    mutationFn: async (data: FormData) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      // Create payment record
      const { error: pagError } = await supabase
        .from('oficinas_pagamentos')
        .insert({
          oficina_id: os.oficina_id,
          ordem_servico_id: os.id,
          valor: data.valor,
          forma_pagamento: data.forma_pagamento,
          data_pagamento: data.data_pagamento,
          status: 'pago',
          pago_por: userId,
          observacao: data.observacao,
        });

      if (pagError) throw pagError;

      // Update OS
      const { error: osError } = await supabase
        .from('ordens_servico')
        .update({
          status: 'pago',
          valor_pago: data.valor,
          updated_at: new Date().toISOString(),
        })
        .eq('id', os.id);

      if (osError) throw osError;

      // Add history
      await supabase.from('ordens_servico_historico').insert({
        ordem_servico_id: os.id,
        status_anterior: os.status,
        status_novo: 'pago',
        usuario_id: userId,
        observacao: `Pagamento registrado: R$ ${data.valor.toFixed(2)} via ${FORMA_PAGAMENTO_LABELS[data.forma_pagamento]}`,
      });

      // Lançamento contábil automático
      const contaCredito = ['pix', 'transferencia'].includes(data.forma_pagamento)
        ? CONTAS_PADRAO.BANCO_CONTA_MOVIMENTO
        : CONTAS_PADRAO.CAIXA_GERAL;

      const oficinaNome = (os as any).oficina?.nome_fantasia || (os as any).oficina?.razao_social || 'Oficina';

      try {
        await criarLancamentoAutomatico({
          origem: 'pagamento_oficina',
          origem_id: os.id,
          data_competencia: data.data_pagamento,
          historico: `Pgto OS ${(os as any).numero || os.id} - ${oficinaNome} - ${FORMA_PAGAMENTO_LABELS[data.forma_pagamento]}`,
          conta_debito_id: CONTAS_PADRAO.REPAROS_OFICINAS,
          conta_credito_id: contaCredito,
          valor: data.valor,
        });
      } catch (err) {
        console.error('Erro ao criar lançamento contábil para OS:', err);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordem_servico', os.id] });
      queryClient.invalidateQueries({ queryKey: ['os_historico', os.id] });
      queryClient.invalidateQueries({ queryKey: ['ordens_servico'] });
      toast.success('Pagamento registrado!');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar pagamento: ' + error.message);
    },
  });

  const onSubmit = (data: FormData) => {
    registrarPagamento.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-3 rounded-lg bg-muted p-3">
              <div>
                <p className="text-sm text-muted-foreground">Valor Aprovado</p>
                <p className="font-semibold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(os.valor_aprovado || os.valor_orcamento || 0)}
                </p>
              </div>
            </div>

            <FormField
              control={form.control}
              name="valor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor do Pagamento *</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="forma_pagamento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Forma de Pagamento *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(FORMA_PAGAMENTO_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="data_pagamento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data do Pagamento *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observacao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observação</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} placeholder="Observação sobre o pagamento..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={registrarPagamento.isPending}>
                Registrar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
