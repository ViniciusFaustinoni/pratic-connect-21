import { useEffect, useState } from 'react';
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
import { MarcasAtendidasSelect } from './MarcasAtendidasSelect';
import { EspecialidadesSelect } from './EspecialidadesSelect';
import { useCreatePrestadorEvento, useUpdatePrestadorEvento, type PrestadorEvento } from '@/hooks/usePrestadoresEvento';
import { buscarCep } from '@/lib/cep';

const formSchema = z.object({
  razao_social: z.string().min(3, 'Razão social é obrigatória'),
  nome_fantasia: z.string().optional(),
  cnpj: z.string().optional(),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().max(2).optional(),
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  pix_chave: z.string().optional(),
  pix_tipo: z.enum(['cpf', 'cnpj', 'email', 'telefone', 'aleatoria']).optional(),
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prestador?: PrestadorEvento | null;
}

export function PrestadorFormDialog({ open, onOpenChange, prestador }: Props) {
  const create = useCreatePrestadorEvento();
  const update = useUpdatePrestadorEvento();
  const [marcas, setMarcas] = useState<string[]>([]);
  const [especialidades, setEspecialidades] = useState<string[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { razao_social: '' },
  });

  useEffect(() => {
    if (open) {
      if (prestador) {
        form.reset({
          razao_social: prestador.razao_social,
          nome_fantasia: prestador.nome_fantasia || '',
          cnpj: prestador.cnpj || '',
          telefone: prestador.telefone || '',
          whatsapp: prestador.whatsapp || '',
          email: prestador.email || '',
          cep: prestador.cep || '',
          logradouro: prestador.logradouro || '',
          numero: prestador.numero || '',
          complemento: prestador.complemento || '',
          bairro: prestador.bairro || '',
          cidade: prestador.cidade || '',
          estado: prestador.estado || '',
          banco: prestador.banco || '',
          agencia: prestador.agencia || '',
          conta: prestador.conta || '',
          pix_chave: prestador.pix_chave || '',
          pix_tipo: prestador.pix_tipo as any || undefined,
          observacoes: prestador.observacoes || '',
        });
        setMarcas(prestador.marcas_atendidas || []);
        setEspecialidades(prestador.especialidades || []);
      } else {
        form.reset({ razao_social: '' });
        setMarcas([]);
        setEspecialidades([]);
      }
    }
  }, [open, prestador]);

  const handleCepBlur = async () => {
    const cep = form.getValues('cep');
    if (cep && cep.replace(/\D/g, '').length === 8) {
      const endereco = await buscarCep(cep.replace(/\D/g, ''));
      if (endereco) {
        form.setValue('logradouro', endereco.logradouro || '');
        form.setValue('bairro', endereco.bairro || '');
        form.setValue('cidade', endereco.cidade || '');
        form.setValue('estado', endereco.uf || '');
      }
    }
  };

  const onSubmit = async (data: FormData) => {
    const payload = {
      razao_social: data.razao_social,
      nome_fantasia: data.nome_fantasia || null,
      cnpj: data.cnpj || null,
      telefone: data.telefone || null,
      whatsapp: data.whatsapp || null,
      email: data.email || null,
      cep: data.cep || null,
      logradouro: data.logradouro || null,
      numero: data.numero || null,
      complemento: data.complemento || null,
      bairro: data.bairro || null,
      cidade: data.cidade || null,
      estado: data.estado || null,
      banco: data.banco || null,
      agencia: data.agencia || null,
      conta: data.conta || null,
      pix_chave: data.pix_chave || null,
      pix_tipo: data.pix_tipo || null,
      observacoes: data.observacoes || null,
      especialidades,
      marcas_atendidas: marcas,
      status: 'ativo',
    };

    if (prestador) {
      await update.mutateAsync({ id: prestador.id, ...payload });
    } else {
      await create.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{prestador ? 'Editar Prestador' : 'Novo Prestador'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Dados da Empresa */}
            <div className="space-y-4">
              <h3 className="font-medium">Dados da Empresa</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="razao_social" render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Razão Social *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="nome_fantasia" render={({ field }) => (
                  <FormItem><FormLabel>Nome Fantasia</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="cnpj" render={({ field }) => (
                  <FormItem><FormLabel>CNPJ</FormLabel><FormControl><Input {...field} placeholder="00.000.000/0000-00" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            {/* Contato */}
            <div className="space-y-4">
              <h3 className="font-medium">Contato</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField control={form.control} name="telefone" render={({ field }) => (
                  <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="whatsapp" render={({ field }) => (
                  <FormItem><FormLabel>WhatsApp</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-4">
              <h3 className="font-medium">Endereço</h3>
              <div className="grid gap-4 sm:grid-cols-4">
                <FormField control={form.control} name="cep" render={({ field }) => (
                  <FormItem><FormLabel>CEP</FormLabel><FormControl><Input {...field} onBlur={handleCepBlur} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="logradouro" render={({ field }) => (
                  <FormItem className="sm:col-span-2"><FormLabel>Logradouro</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="numero" render={({ field }) => (
                  <FormItem><FormLabel>Número</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="bairro" render={({ field }) => (
                  <FormItem><FormLabel>Bairro</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="cidade" render={({ field }) => (
                  <FormItem><FormLabel>Cidade</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="estado" render={({ field }) => (
                  <FormItem><FormLabel>Estado</FormLabel><FormControl><Input {...field} maxLength={2} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            {/* Dados Bancários */}
            <div className="space-y-4">
              <h3 className="font-medium">Dados Bancários</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField control={form.control} name="banco" render={({ field }) => (
                  <FormItem><FormLabel>Banco</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="agencia" render={({ field }) => (
                  <FormItem><FormLabel>Agência</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="conta" render={({ field }) => (
                  <FormItem><FormLabel>Conta</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="pix_tipo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo PIX</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="cpf">CPF</SelectItem>
                        <SelectItem value="cnpj">CNPJ</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="telefone">Telefone</SelectItem>
                        <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="pix_chave" render={({ field }) => (
                  <FormItem className="sm:col-span-2"><FormLabel>Chave PIX</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            {/* Marcas e Especialidades */}
            <MarcasAtendidasSelect value={marcas} onChange={setMarcas} />
            <EspecialidadesSelect value={especialidades} onChange={setEspecialidades} />

            {/* Observações */}
            <FormField control={form.control} name="observacoes" render={({ field }) => (
              <FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>
            )} />

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={create.isPending || update.isPending}>
                {prestador ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
