import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateAutoCenter, useUpdateAutoCenter, type AutoCenter } from '@/hooks/useAutoCenters';
import { buscarCep } from '@/lib/cep';

const formSchema = z.object({
  nome: z.string().min(2, 'Nome é obrigatório'),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().max(2).optional(),
  cep: z.string().optional(),
  tipo: z.enum(['auto_center', 'ferro_velho']),
  contato_nome: z.string().optional(),
  contato_telefone: z.string().optional(),
  contato_email: z.string().email('Email inválido').optional().or(z.literal('')),
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  autoCenter?: AutoCenter | null;
}

export function AutoCenterFormDialog({ open, onOpenChange, autoCenter }: Props) {
  const create = useCreateAutoCenter();
  const update = useUpdateAutoCenter();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: '',
      tipo: 'auto_center',
      endereco: '',
      cidade: '',
      estado: '',
      cep: '',
      contato_nome: '',
      contato_telefone: '',
      contato_email: '',
      observacoes: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (autoCenter) {
        form.reset({
          nome: autoCenter.nome,
          tipo: autoCenter.tipo as 'auto_center' | 'ferro_velho',
          endereco: autoCenter.endereco || '',
          cidade: autoCenter.cidade || '',
          estado: autoCenter.estado || '',
          cep: autoCenter.cep || '',
          contato_nome: autoCenter.contato_nome || '',
          contato_telefone: autoCenter.contato_telefone || '',
          contato_email: autoCenter.contato_email || '',
          observacoes: autoCenter.observacoes || '',
        });
      } else {
        form.reset({
          nome: '', tipo: 'auto_center', endereco: '', cidade: '', estado: '',
          cep: '', contato_nome: '', contato_telefone: '', contato_email: '', observacoes: '',
        });
      }
    }
  }, [open, autoCenter]);

  const handleCepBlur = async () => {
    const cep = form.getValues('cep');
    if (cep && cep.replace(/\D/g, '').length === 8) {
      const endereco = await buscarCep(cep);
      if (endereco) {
        form.setValue('endereco', endereco.logradouro || '');
        form.setValue('cidade', endereco.cidade || '');
        form.setValue('estado', endereco.uf || '');
      }
    }
  };

  const onSubmit = async (data: FormData) => {
    const payload = {
      nome: data.nome,
      tipo: data.tipo,
      endereco: data.endereco || null,
      cidade: data.cidade || null,
      estado: data.estado || null,
      cep: data.cep || null,
      contato_nome: data.contato_nome || null,
      contato_telefone: data.contato_telefone || null,
      contato_email: data.contato_email || null,
      observacoes: data.observacoes || null,
    };

    if (autoCenter) {
      await update.mutateAsync({ id: autoCenter.id, ...payload });
    } else {
      await create.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{autoCenter ? 'Editar Auto Center' : 'Novo Auto Center'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField control={form.control} name="nome" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Nome *</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="tipo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="auto_center">Auto Center</SelectItem>
                      <SelectItem value="ferro_velho">Ferro Velho</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="space-y-4">
              <h3 className="font-medium">Endereço</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField control={form.control} name="cep" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <FormControl><Input {...field} onBlur={handleCepBlur} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="endereco" render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Endereço</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="cidade" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="estado" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <FormControl><Input {...field} maxLength={2} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-medium">Contato</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField control={form.control} name="contato_nome" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="contato_telefone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="contato_email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input {...field} type="email" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <FormField control={form.control} name="observacoes" render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl><Textarea {...field} rows={3} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {autoCenter ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
