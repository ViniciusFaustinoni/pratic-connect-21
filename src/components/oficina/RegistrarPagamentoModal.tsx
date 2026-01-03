import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { X, Upload, Building2, CreditCard } from 'lucide-react';
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

interface RegistrarPagamentoModalProps {
  open: boolean;
  onClose: () => void;
  ordemServico: OrdemServico;
}

export function RegistrarPagamentoModal({
  open,
  onClose,
  ordemServico,
}: RegistrarPagamentoModalProps) {
  const queryClient = useQueryClient();
  const [comprovante, setComprovante] = useState<File | null>(null);

  // Cálculos de valores
  const valorAprovado = ordemServico.valor_aprovado || ordemServico.valor_orcamento || 0;
  const valorJaPago = ordemServico.valor_pago || 0;
  const saldoAPagar = Math.max(0, valorAprovado - valorJaPago);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      valor: saldoAPagar,
      forma_pagamento: 'pix',
      data_pagamento: new Date().toISOString().split('T')[0],
      observacao: '',
    },
  });

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      form.reset({
        valor: saldoAPagar,
        forma_pagamento: 'pix',
        data_pagamento: new Date().toISOString().split('T')[0],
        observacao: '',
      });
      setComprovante(null);
    }
  }, [open, saldoAPagar, form]);

  const uploadComprovante = async (file: File): Promise<string> => {
    const fileName = `${ordemServico.id}/${Date.now()}_${file.name}`;

    const { error } = await supabase.storage
      .from('ordens-servico')
      .upload(fileName, file);

    if (error) throw error;

    const { data } = supabase.storage
      .from('ordens-servico')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const pagarMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      // 1. Upload do comprovante (se houver)
      let comprovanteUrl: string | undefined;
      if (comprovante) {
        comprovanteUrl = await uploadComprovante(comprovante);
      }

      // 2. Registrar pagamento
      const { error: pagError } = await supabase
        .from('oficinas_pagamentos')
        .insert({
          oficina_id: ordemServico.oficina_id,
          ordem_servico_id: ordemServico.id,
          valor: data.valor,
          forma_pagamento: data.forma_pagamento,
          data_pagamento: data.data_pagamento,
          comprovante_url: comprovanteUrl,
          status: 'pago',
          pago_por: userId,
          observacao: data.observacao,
        });

      if (pagError) throw pagError;

      // 3. Calcular novo valor pago e determinar novo status
      const novoValorPago = valorJaPago + data.valor;
      const novoStatus = novoValorPago >= valorAprovado ? 'pago' : 'aguardando_pagamento';

      // 4. Atualizar OS
      const { error: osError } = await supabase
        .from('ordens_servico')
        .update({
          valor_pago: novoValorPago,
          status: novoStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ordemServico.id);

      if (osError) throw osError;

      // 5. Registrar histórico (se status mudou para pago)
      if (novoStatus === 'pago' && ordemServico.status !== 'pago') {
        await supabase.from('ordens_servico_historico').insert({
          ordem_servico_id: ordemServico.id,
          status_anterior: ordemServico.status,
          status_novo: 'pago',
          usuario_id: userId,
          observacao: `Pagamento finalizado: R$ ${data.valor.toFixed(2)} via ${FORMA_PAGAMENTO_LABELS[data.forma_pagamento]}`,
        });
      }
    },
    onSuccess: () => {
      toast.success('Pagamento registrado!');
      queryClient.invalidateQueries({ queryKey: ['ordem-servico'] });
      queryClient.invalidateQueries({ queryKey: ['ordem_servico'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      queryClient.invalidateQueries({ queryKey: ['oficina-pagamentos'] });
      onClose();
    },
    onError: (error: Error) => {
      toast.error('Erro ao registrar pagamento: ' + error.message);
    },
  });

  const onSubmit = (data: FormData) => {
    pagarMutation.mutate(data);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const oficina = ordemServico.oficina as any;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info da OS */}
          <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{ordemServico.numero}</span>
              {oficina?.nome_fantasia && (
                <span className="text-muted-foreground">• {oficina.nome_fantasia}</span>
              )}
            </div>

            {/* Dados bancários */}
            {oficina && (oficina.banco || oficina.pix_chave) && (
              <div className="pt-2 border-t space-y-1 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CreditCard className="h-3.5 w-3.5" />
                  <span className="font-medium">Dados Bancários</span>
                </div>
                {oficina.banco && (
                  <p className="text-muted-foreground">
                    {oficina.banco}
                    {oficina.agencia && ` | Ag: ${oficina.agencia}`}
                    {oficina.conta && ` | Conta: ${oficina.conta}`}
                  </p>
                )}
                {oficina.pix_chave && (
                  <p className="text-muted-foreground">
                    PIX ({oficina.pix_tipo?.toUpperCase() || 'Chave'}): {oficina.pix_chave}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Valores */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Valor Aprovado</p>
              <p className="font-semibold">{formatCurrency(valorAprovado)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Já Pago</p>
              <p className="font-semibold">{formatCurrency(valorJaPago)}</p>
            </div>
            <div className="rounded-lg border border-primary bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground">Saldo a Pagar</p>
              <p className="font-semibold text-primary">{formatCurrency(saldoAPagar)}</p>
            </div>
          </div>

          {/* Formulário */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

              <div className="grid grid-cols-2 gap-3">
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
              </div>

              {/* Upload de comprovante */}
              <div className="space-y-2">
                <FormLabel>Comprovante</FormLabel>
                <div className="flex items-center gap-2">
                  <label className="flex-1">
                    <div className="flex items-center gap-2 px-3 py-2 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {comprovante ? comprovante.name : 'Selecionar arquivo...'}
                      </span>
                    </div>
                    <Input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => setComprovante(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                  {comprovante && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setComprovante(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {comprovante && (
                  <p className="text-xs text-muted-foreground">
                    {(comprovante.size / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>

              <FormField
                control={form.control}
                name="observacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observação</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={2}
                        placeholder="Observação sobre o pagamento..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={pagarMutation.isPending}>
                  Registrar Pagamento
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
