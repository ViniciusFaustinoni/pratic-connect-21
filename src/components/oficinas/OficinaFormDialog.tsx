import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { geocodificarEmBackground } from '@/services/geocodingService';
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
import { useCreateOficina, useUpdateOficina } from '@/hooks/useOficinas';
import { MarcasAtendidasSelect } from './MarcasAtendidasSelect';
import { EspecialidadesSelect } from './EspecialidadesSelect';
import { buscarCep } from '@/lib/cep';
import type { Oficina } from '@/types/database';

const formSchema = z.object({
  razao_social: z.string().min(3, 'Razão social é obrigatória'),
  nome_fantasia: z.string().optional(),
  cnpj: z.string().min(14, 'CNPJ inválido'),
  inscricao_estadual: z.string().optional(),
  telefone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().min(2, 'Cidade é obrigatória'),
  estado: z.string().length(2, 'Estado deve ter 2 caracteres'),
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  pix_chave: z.string().optional(),
  pix_tipo: z.enum(['cpf', 'cnpj', 'email', 'telefone', 'aleatoria']).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oficina?: Oficina | null;
}

export function OficinaFormDialog({ open, onOpenChange, oficina }: Props) {
  const createOficina = useCreateOficina();
  const updateOficina = useUpdateOficina();
  const [marcas, setMarcas] = useState<string[]>([]);
  const [especialidades, setEspecialidades] = useState<string[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      razao_social: '',
      nome_fantasia: '',
      cnpj: '',
      cidade: '',
      estado: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (oficina) {
        form.reset({
          razao_social: oficina.razao_social,
          nome_fantasia: oficina.nome_fantasia || '',
          cnpj: oficina.cnpj,
          inscricao_estadual: oficina.inscricao_estadual || '',
          telefone: oficina.telefone || '',
          whatsapp: oficina.whatsapp || '',
          email: oficina.email || '',
          cep: oficina.cep || '',
          logradouro: oficina.logradouro || '',
          numero: oficina.numero || '',
          complemento: oficina.complemento || '',
          bairro: oficina.bairro || '',
          cidade: oficina.cidade,
          estado: oficina.estado,
          banco: oficina.banco || '',
          agencia: oficina.agencia || '',
          conta: oficina.conta || '',
          pix_chave: oficina.pix_chave || '',
          pix_tipo: oficina.pix_tipo || undefined,
        });
        setMarcas((oficina as any).marcas_atendidas || []);
        setEspecialidades(oficina.especialidades || []);
      } else {
        form.reset({ razao_social: '', nome_fantasia: '', cnpj: '', cidade: '', estado: '' });
        setMarcas([]);
        setEspecialidades([]);
      }
    }
  }, [open, oficina]);

  const handleCepBlur = async () => {
    const cep = form.getValues('cep');
    if (cep && cep.length >= 8) {
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
      cnpj: data.cnpj,
      cidade: data.cidade,
      estado: data.estado,
      nome_fantasia: data.nome_fantasia || undefined,
      inscricao_estadual: data.inscricao_estadual || undefined,
      telefone: data.telefone || undefined,
      whatsapp: data.whatsapp || undefined,
      email: data.email || undefined,
      cep: data.cep || undefined,
      logradouro: data.logradouro || undefined,
      numero: data.numero || undefined,
      complemento: data.complemento || undefined,
      bairro: data.bairro || undefined,
      banco: data.banco || undefined,
      agencia: data.agencia || undefined,
      conta: data.conta || undefined,
      pix_chave: data.pix_chave || undefined,
      pix_tipo: data.pix_tipo || undefined,
      especialidades,
      marcas_atendidas: marcas,
      status: 'ativo' as const,
    };
    if (oficina) {
      await updateOficina.mutateAsync({ id: oficina.id, ...payload });
      geocodificarEmBackground('oficina', oficina.id, {
        logradouro: data.logradouro, numero: data.numero, bairro: data.bairro,
        cidade: data.cidade, uf: data.estado, cep: data.cep,
      });
    } else {
      const result = await createOficina.mutateAsync(payload);
      if (result?.id) {
        geocodificarEmBackground('oficina', result.id, {
          logradouro: data.logradouro, numero: data.numero, bairro: data.bairro,
          cidade: data.cidade, uf: data.estado, cep: data.cep,
        });
      }
    }
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{oficina ? 'Editar Oficina' : 'Nova Oficina'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Dados da Empresa */}
            <div className="space-y-4">
              <h3 className="font-medium">Dados da Empresa</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="razao_social" render={({ field }) => (
                  <FormItem className="sm:col-span-2"><FormLabel>Razão Social *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="nome_fantasia" render={({ field }) => (
                  <FormItem><FormLabel>Nome Fantasia</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="cnpj" render={({ field }) => (
                  <FormItem><FormLabel>CNPJ *</FormLabel><FormControl><Input {...field} placeholder="00.000.000/0000-00" /></FormControl><FormMessage /></FormItem>
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
                  <FormItem><FormLabel>Cidade *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="estado" render={({ field }) => (
                  <FormItem><FormLabel>Estado *</FormLabel><FormControl><Input {...field} maxLength={2} /></FormControl><FormMessage /></FormItem>
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

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={createOficina.isPending || updateOficina.isPending}>
                {oficina ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
