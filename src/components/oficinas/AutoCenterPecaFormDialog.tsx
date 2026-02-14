import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreatePeca } from '@/hooks/useAutoCenters';
import { Loader2 } from 'lucide-react';
import { PecaSelectFields, PecaSelectValues } from './PecaSelectFields';

const formSchema = z.object({
  valor: z.string().optional(),
  condicao: z.enum(['novo', 'usado']),
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoCenterId: string;
}

const defaultPecaValues: PecaSelectValues = {
  tipoPeca: '', marcaCodigo: '', marcaNome: '', modeloCodigo: '', modeloNome: '', anoCodigo: '', anoNome: '',
};

export function AutoCenterPecaFormDialog({ open, onOpenChange, autoCenterId }: Props) {
  const create = useCreatePeca();
  const [pecaValues, setPecaValues] = useState<PecaSelectValues>(defaultPecaValues);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { valor: '', condicao: 'novo' },
  });

  const onSubmit = async (data: FormData) => {
    if (!pecaValues.tipoPeca || !pecaValues.marcaCodigo || !pecaValues.modeloCodigo || !pecaValues.anoCodigo) return;

    const nome = `${pecaValues.tipoPeca} - ${pecaValues.marcaNome} ${pecaValues.modeloNome} ${pecaValues.anoNome}`.trim();
    await create.mutateAsync({
      auto_center_id: autoCenterId,
      nome,
      valor: data.valor ? parseFloat(data.valor) : null,
      condicao: data.condicao,
      tipo_peca: pecaValues.tipoPeca,
      veiculo_marca: pecaValues.marcaNome,
      veiculo_modelo: pecaValues.modeloNome,
      veiculo_ano: pecaValues.anoNome,
    });
    handleOpenChange(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      form.reset();
      setPecaValues(defaultPecaValues);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar Peça</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <PecaSelectFields values={pecaValues} onChange={setPecaValues} active={open} />

            {/* Valor + Condição */}
            <div className="grid gap-4 grid-cols-2">
              <FormField control={form.control} name="valor" render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$)</FormLabel>
                  <FormControl><Input {...field} type="number" step="0.01" min="0" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="condicao" render={({ field }) => (
                <FormItem>
                  <FormLabel>Condição *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="novo">Novo</SelectItem>
                      <SelectItem value="usado">Usado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={create.isPending || !pecaValues.tipoPeca || !pecaValues.marcaCodigo || !pecaValues.modeloCodigo || !pecaValues.anoCodigo}>
                {create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Adicionar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
