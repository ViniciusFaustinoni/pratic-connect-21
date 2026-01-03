import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAddOSItem } from '@/hooks/useOrdensServico';

const TIPO_ITEM_OPTIONS = [
  { value: 'peca', label: 'Peça' },
  { value: 'mao_de_obra', label: 'Mão de Obra' },
  { value: 'servico_terceiro', label: 'Serviço Terceiro' },
] as const;

const formSchema = z.object({
  tipo: z.enum(['peca', 'mao_de_obra', 'servico_terceiro']),
  descricao: z.string().min(3, 'Descrição deve ter no mínimo 3 caracteres'),
  quantidade: z.coerce.number().min(0.01, 'Quantidade deve ser maior que 0'),
  valor_unitario: z.coerce.number().min(0.01, 'Valor deve ser maior que 0'),
  marca: z.string().optional(),
  numero_peca: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AdicionarItemOSModalProps {
  open: boolean;
  onClose: () => void;
  ordemServicoId: string;
}

export function AdicionarItemOSModal({
  open,
  onClose,
  ordemServicoId,
}: AdicionarItemOSModalProps) {
  const addItemMutation = useAddOSItem();

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
  const quantidade = form.watch('quantidade') || 0;
  const valorUnitario = form.watch('valor_unitario') || 0;
  const valorTotal = quantidade * valorUnitario;

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const onSubmit = async (data: FormData) => {
    const total = data.quantidade * data.valor_unitario;

    await addItemMutation.mutateAsync({
      ordem_servico_id: ordemServicoId,
      tipo: data.tipo,
      descricao: data.descricao,
      quantidade: data.quantidade,
      valor_unitario: data.valor_unitario,
      valor_total: total,
      aprovado: false,
      marca: data.tipo === 'peca' ? data.marca || undefined : undefined,
      numero_peca: data.tipo === 'peca' ? data.numero_peca || undefined : undefined,
    });

    form.reset();
    onClose();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
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
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TIPO_ITEM_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
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
                    <Input placeholder="Descrição do item" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {tipo === 'peca' && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="marca"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Bosch" {...field} />
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
                        <Input placeholder="Ex: 123456" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantidade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="1"
                        {...field}
                      />
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
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0,00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="p-4 bg-muted rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Valor Total</span>
                <span className="text-lg font-semibold">
                  {formatCurrency(valorTotal)}
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={addItemMutation.isPending}>
                {addItemMutation.isPending ? 'Adicionando...' : 'Adicionar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
