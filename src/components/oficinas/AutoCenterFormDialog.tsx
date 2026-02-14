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
import { TiposPecasSelect } from './TiposPecasSelect';
import { useCreateAutoCenter, useUpdateAutoCenter, type AutoCenter } from '@/hooks/useAutoCenters';
import { buscarCep } from '@/lib/cep';

const formSchema = z.object({
  nome: z.string().min(2, 'Nome é obrigatório'),
  razao_social: z.string().optional(),
  nome_fantasia: z.string().optional(),
  cnpj: z.string().optional(),
  inscricao_estadual: z.string().optional(),
  tipo: z.enum(['auto_center', 'ferro_velho', 'montadora']),
  status: z.enum(['ativo', 'inativo', 'suspenso']).optional(),
  whatsapp: z.string().min(1, 'WhatsApp é obrigatório para Auto Centers'),
  contato_nome: z.string().optional(),
  contato_telefone: z.string().optional(),
  contato_email: z.string().email('Email inválido').optional().or(z.literal('')),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().max(2).optional(),
  cep: z.string().optional(),
  bairro: z.string().optional(),
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
  autoCenter?: AutoCenter | null;
}

export function AutoCenterFormDialog({ open, onOpenChange, autoCenter }: Props) {
  const create = useCreateAutoCenter();
  const update = useUpdateAutoCenter();
  const [marcas, setMarcas] = useState<string[]>([]);
  const [tiposPecas, setTiposPecas] = useState<string[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: '',
      tipo: 'auto_center',
      whatsapp: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (autoCenter) {
        form.reset({
          nome: autoCenter.nome,
          razao_social: (autoCenter as any).razao_social || '',
          nome_fantasia: (autoCenter as any).nome_fantasia || '',
          cnpj: (autoCenter as any).cnpj || '',
          inscricao_estadual: (autoCenter as any).inscricao_estadual || '',
          tipo: autoCenter.tipo as any,
          status: (autoCenter as any).status || 'ativo',
          whatsapp: (autoCenter as any).whatsapp || '',
          contato_nome: autoCenter.contato_nome || '',
          contato_telefone: autoCenter.contato_telefone || '',
          contato_email: autoCenter.contato_email || '',
          endereco: autoCenter.endereco || '',
          cidade: autoCenter.cidade || '',
          estado: autoCenter.estado || '',
          cep: autoCenter.cep || '',
          bairro: (autoCenter as any).bairro || '',
          banco: (autoCenter as any).banco || '',
          agencia: (autoCenter as any).agencia || '',
          conta: (autoCenter as any).conta || '',
          pix_chave: (autoCenter as any).pix_chave || '',
          pix_tipo: (autoCenter as any).pix_tipo || undefined,
          observacoes: autoCenter.observacoes || '',
        });
        setMarcas((autoCenter as any).marcas_atendidas || []);
        setTiposPecas((autoCenter as any).especialidades || []);
      } else {
        form.reset({ nome: '', tipo: 'auto_center', whatsapp: '', status: 'ativo', inscricao_estadual: '' });
        setMarcas([]);
        setTiposPecas([]);
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
        form.setValue('bairro', endereco.bairro || '');
      }
    }
  };

  const onSubmit = async (data: FormData) => {
    const payload = {
      nome: data.nome,
      tipo: data.tipo,
      razao_social: data.razao_social || null,
      nome_fantasia: data.nome_fantasia || null,
      cnpj: data.cnpj || null,
      inscricao_estadual: data.inscricao_estadual || null,
      status: data.status || 'ativo',
      whatsapp: data.whatsapp || null,
      endereco: data.endereco || null,
      cidade: data.cidade || null,
      estado: data.estado || null,
      cep: data.cep || null,
      bairro: data.bairro || null,
      contato_nome: data.contato_nome || null,
      contato_telefone: data.contato_telefone || null,
      contato_email: data.contato_email || null,
      banco: data.banco || null,
      agencia: data.agencia || null,
      conta: data.conta || null,
      pix_chave: data.pix_chave || null,
      pix_tipo: data.pix_tipo || null,
      observacoes: data.observacoes || null,
      especialidades: tiposPecas,
      marcas_atendidas: marcas,
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{autoCenter ? 'Editar Auto Center' : 'Novo Auto Center'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Dados Básicos */}
            <div className="space-y-4">
              <h3 className="font-medium">Dados da Empresa</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="nome" render={({ field }) => (
                  <FormItem className="sm:col-span-2"><FormLabel>Nome *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="razao_social" render={({ field }) => (
                  <FormItem><FormLabel>Razão Social</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="cnpj" render={({ field }) => (
                  <FormItem><FormLabel>CNPJ</FormLabel><FormControl><Input {...field} placeholder="00.000.000/0000-00" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="inscricao_estadual" render={({ field }) => (
                  <FormItem><FormLabel>Inscrição Estadual</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="tipo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="auto_center">Auto Center</SelectItem>
                        <SelectItem value="ferro_velho">Ferro Velho</SelectItem>
                        <SelectItem value="montadora">Montadora</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'ativo'}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                        <SelectItem value="suspenso">Suspenso</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Contato */}
            <div className="space-y-4">
              <h3 className="font-medium">Contato</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField control={form.control} name="whatsapp" render={({ field }) => (
                  <FormItem><FormLabel>WhatsApp *</FormLabel><FormControl><Input {...field} placeholder="(00) 00000-0000" /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="contato_nome" render={({ field }) => (
                  <FormItem><FormLabel>Nome do Contato</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="contato_telefone" render={({ field }) => (
                  <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="contato_email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} type="email" /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-4">
              <h3 className="font-medium">Endereço</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField control={form.control} name="cep" render={({ field }) => (
                  <FormItem><FormLabel>CEP</FormLabel><FormControl><Input {...field} onBlur={handleCepBlur} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="endereco" render={({ field }) => (
                  <FormItem className="sm:col-span-2"><FormLabel>Endereço</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
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
            <TiposPecasSelect value={tiposPecas} onChange={setTiposPecas} />

            {/* Observações */}
            <FormField control={form.control} name="observacoes" render={({ field }) => (
              <FormItem><FormLabel>Observações</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>
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
