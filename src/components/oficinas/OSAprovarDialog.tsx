import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
import type { OrdemServico } from '@/types/database';

const formSchema = z.object({
  valor_aprovado: z.coerce.number().min(0.01, 'Valor deve ser maior que 0'),
  observacao: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  os: OrdemServico;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OSAprovarDialog({ os, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      valor_aprovado: os.valor_orcamento || 0,
      observacao: '',
    },
  });

  const aprovar = useMutation({
    mutationFn: async (data: FormData) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      // Update OS
      const { error } = await supabase
        .from('ordens_servico')
        .update({
          status: 'aprovado',
          valor_aprovado: data.valor_aprovado,
          aprovado_por: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', os.id);

      if (error) throw error;

      // Add history
      await supabase.from('ordens_servico_historico').insert({
        ordem_servico_id: os.id,
        status_anterior: os.status,
        status_novo: 'aprovado',
        usuario_id: userId,
        observacao: data.observacao || `Orçamento aprovado: R$ ${data.valor_aprovado.toFixed(2)}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordem_servico', os.id] });
      queryClient.invalidateQueries({ queryKey: ['os_historico', os.id] });
      queryClient.invalidateQueries({ queryKey: ['ordens_servico'] });
      toast.success('Orçamento aprovado!');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error('Erro ao aprovar: ' + error.message);
    },
  });

  const onSubmit = (data: FormData) => {
    aprovar.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Aprovar Orçamento</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm text-muted-foreground">Valor do Orçamento</p>
              <p className="text-lg font-semibold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(os.valor_orcamento || 0)}
              </p>
            </div>

            <FormField
              control={form.control}
              name="valor_aprovado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor Aprovado *</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
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
                    <Textarea {...field} rows={2} placeholder="Observação sobre a aprovação..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={aprovar.isPending}>
                Aprovar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
