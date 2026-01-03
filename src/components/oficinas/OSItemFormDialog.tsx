import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAddOSItem } from '@/hooks/useOrdensServico';
import { TIPO_ITEM_OS_LABELS, type TipoItemOS } from '@/types/database';
import { useEffect } from 'react';

const formSchema = z.object({
  tipo: z.enum(['peca', 'mao_de_obra', 'servico_terceiro']),
  descricao: z.string().min(3, 'Descrição é obrigatória'),
  quantidade: z.coerce.number().min(0.01, 'Quantidade deve ser maior que 0'),
  valor_unitario: z.coerce.number().min(0.01, 'Valor deve ser maior que 0'),
  marca: z.string().optional(),
  numero_peca: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  osId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OSItemFormDialog({ osId, open, onOpenChange }: Props) {
  const addItem = useAddOSItem();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo: 'peca',
      descricao: '',
      quantidade: 1,
      valor_unitario: 0,
      marca: '',
      numero_peca: '',
    },
  });

  const tipo = form.watch('tipo');
  const quantidade = form.watch('quantidade');
  const valorUnitario = form.watch('valor_unitario');
  const valorTotal = quantidade * valorUnitario;

  const onSubmit = async (data: FormData) => {
    await addItem.mutateAsync({
      ordem_servico_id: osId,
      tipo: data.tipo as TipoItemOS,
      descricao: data.descricao,
      quantidade: data.quantidade,
      valor_unitario: data.valor_unitario,
      valor_total: data.quantidade * data.valor_unitario,
      aprovado: false,
      marca: data.marca || undefined,
      numero_peca: data.numero_peca || undefined,
    });
    onOpenChange(false);
    form.reset();
  };

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Item</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(TIPO_ITEM_OS_LABELS).map(([value, label]) => (
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
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Descrição do item" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {tipo === 'peca' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="marca"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="numero_peca"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número da Peça</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="quantidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="valor_unitario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Unitário *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <FormLabel>Valor Total</FormLabel>
                <div className="mt-2 rounded-md border bg-muted px-3 py-2 text-sm font-medium">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotal)}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={addItem.isPending}>
                Adicionar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
