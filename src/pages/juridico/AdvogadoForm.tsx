import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';

import { useAdvogados, useAdvogado } from '@/hooks/useAdvogados';
import { ESPECIALIDADES_ADVOGADO, ESPECIALIDADE_LABELS } from '@/types/juridico';
import { CpfInput, CnpjInput, TelefoneInput, CepInput, CurrencyInput } from '@/components/inputs/MaskedInputs';

const ESTADOS_BR = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const advogadoSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  tipo: z.enum(['interno', 'externo', 'escritorio']),
  cpf_cnpj: z.string().optional().nullable(),
  oab: z.string().optional().nullable(),
  oab_estado: z.string().optional().nullable(),
  email: z.string().email('Email inválido').optional().or(z.literal('')).nullable(),
  telefone: z.string().optional().nullable(),
  whatsapp: z.string().optional().nullable(),
  especialidades: z.array(z.string()).default([]),
  tipo_contrato: z.string().optional().nullable(),
  valor_fixo: z.number().optional().nullable(),
  percentual_exito: z.number().optional().nullable(),
  cep: z.string().optional().nullable(),
  logradouro: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  estado: z.string().optional().nullable(),
  banco: z.string().optional().nullable(),
  agencia: z.string().optional().nullable(),
  conta: z.string().optional().nullable(),
  pix_chave: z.string().optional().nullable(),
  pix_tipo: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  ativo: z.boolean().default(true),
});

type AdvogadoFormData = z.infer<typeof advogadoSchema>;

export default function AdvogadoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const { criarAdvogado, atualizarAdvogado, isCriando, isAtualizando } = useAdvogados();
  const { data: advogado, isLoading } = useAdvogado(id);

  const form = useForm<AdvogadoFormData>({
    resolver: zodResolver(advogadoSchema),
    defaultValues: {
      nome: '', tipo: 'interno', cpf_cnpj: '', oab: '', oab_estado: '',
      email: '', telefone: '', whatsapp: '', especialidades: [],
      tipo_contrato: null, valor_fixo: null, percentual_exito: null,
      cep: '', logradouro: '', numero: '', complemento: '', bairro: '',
      cidade: '', estado: '', banco: '', agencia: '', conta: '',
      pix_chave: '', pix_tipo: null, observacoes: '', ativo: true,
    },
  });

  const tipoWatch = form.watch('tipo');
  const isTerceirizado = tipoWatch === 'externo' || tipoWatch === 'escritorio';

  useEffect(() => {
    if (advogado) {
      form.reset({
        nome: advogado.nome || '',
        tipo: (advogado.tipo as any) || 'interno',
        cpf_cnpj: advogado.cpf_cnpj || '',
        oab: advogado.oab || '',
        oab_estado: advogado.oab_estado || '',
        email: advogado.email || '',
        telefone: advogado.telefone || '',
        whatsapp: advogado.whatsapp || '',
        especialidades: advogado.especialidades || [],
        tipo_contrato: advogado.tipo_contrato || null,
        valor_fixo: advogado.valor_fixo || null,
        percentual_exito: advogado.percentual_exito || null,
        cep: advogado.cep || '',
        logradouro: advogado.logradouro || '',
        numero: advogado.numero || '',
        complemento: advogado.complemento || '',
        bairro: advogado.bairro || '',
        cidade: advogado.cidade || '',
        estado: advogado.estado || '',
        banco: advogado.banco || '',
        agencia: advogado.agencia || '',
        conta: advogado.conta || '',
        pix_chave: advogado.pix_chave || '',
        pix_tipo: advogado.pix_tipo || null,
        observacoes: '',
        ativo: advogado.ativo ?? true,
      });
    }
  }, [advogado, form]);

  const onSubmit = async (data: AdvogadoFormData) => {
    try {
      const payload: any = {
        ...data,
        email: data.email || null,
        cpf_cnpj: data.cpf_cnpj || null,
        oab: data.oab || null,
        oab_estado: data.oab_estado || null,
        telefone: data.telefone || null,
        whatsapp: data.whatsapp || null,
      };
      delete payload.observacoes;

      if (isEditing) {
        await atualizarAdvogado({ id, ...payload });
      } else {
        await criarAdvogado(payload);
      }
      navigate('/juridico/advogados');
    } catch {}
  };

  const isSaving = isCriando || isAtualizando;

  if (isEditing && isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/juridico/advogados')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">
          {isEditing ? `Editar: ${advogado?.nome}` : 'Novo Advogado'}
        </h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Dados Pessoais */}
          <Card>
            <CardHeader><CardTitle>Dados Pessoais / Escritório</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="nome" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Nome Completo / Razão Social *</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="tipo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="interno">Interno</SelectItem>
                      <SelectItem value="externo">Terceirizado</SelectItem>
                      <SelectItem value="escritorio">Escritório</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="cpf_cnpj" render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF / CNPJ</FormLabel>
                  <FormControl>
                    {tipoWatch === 'escritorio' 
                      ? <CnpjInput value={field.value || ''} onChange={field.onChange} />
                      : <CpfInput value={field.value || ''} onChange={field.onChange} />
                    }
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="oab" render={({ field }) => (
                <FormItem>
                  <FormLabel>OAB Nº</FormLabel>
                  <FormControl><Input {...field} value={field.value || ''} placeholder="123.456" /></FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="oab_estado" render={({ field }) => (
                <FormItem>
                  <FormLabel>OAB Seccional</FormLabel>
                  <Select value={field.value || ''} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {ESTADOS_BR.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              <FormField control={form.control} name="telefone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl><TelefoneInput value={field.value || ''} onChange={field.onChange} /></FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input {...field} value={field.value || ''} type="email" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="whatsapp" render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp</FormLabel>
                  <FormControl><TelefoneInput value={field.value || ''} onChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Endereço */}
          {isTerceirizado && (
            <Card>
              <CardHeader><CardTitle>Endereço</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField control={form.control} name="cep" render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEP</FormLabel>
                    <FormControl><CepInput value={field.value || ''} onChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="logradouro" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Logradouro</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="numero" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nº</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="complemento" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Complemento</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="bairro" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="cidade" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="estado" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {ESTADOS_BR.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </CardContent>
            </Card>
          )}

          {/* Especialidades */}
          <Card>
            <CardHeader><CardTitle>Especialidades</CardTitle></CardHeader>
            <CardContent>
              <FormField control={form.control} name="especialidades" render={({ field }) => (
                <FormItem>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {ESPECIALIDADES_ADVOGADO.map((esp) => (
                      <div key={esp} className="flex items-center space-x-2">
                        <Checkbox
                          id={esp}
                          checked={field.value?.includes(esp)}
                          onCheckedChange={(checked) => {
                            const current = field.value || [];
                            field.onChange(
                              checked
                                ? [...current, esp]
                                : current.filter((e: string) => e !== esp)
                            );
                          }}
                        />
                        <Label htmlFor={esp} className="text-sm cursor-pointer">
                          {ESPECIALIDADE_LABELS[esp]}
                        </Label>
                      </div>
                    ))}
                  </div>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Informações Contratuais (terceirizados) */}
          {isTerceirizado && (
            <Card>
              <CardHeader><CardTitle>Informações Contratuais</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="tipo_contrato" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Contratação</FormLabel>
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="por_processo">Por Processo</SelectItem>
                        <SelectItem value="fixo">Mensalista (Fixo)</SelectItem>
                        <SelectItem value="hibrido">Híbrido</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <FormField control={form.control} name="valor_fixo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor (R$)</FormLabel>
                    <FormControl>
                      <CurrencyInput value={field.value || 0} onChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )} />

                <FormField control={form.control} name="percentual_exito" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Percentual de Êxito (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      />
                    </FormControl>
                  </FormItem>
                )} />
              </CardContent>
            </Card>
          )}

          {/* Conta para Pagamento (terceirizados) */}
          {isTerceirizado && (
            <Card>
              <CardHeader><CardTitle>Conta para Pagamento</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField control={form.control} name="banco" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Banco</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="agencia" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agência</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="conta" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Conta</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="pix_tipo" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo PIX</FormLabel>
                    <Select value={field.value || ''} onValueChange={field.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="cpf">CPF</SelectItem>
                        <SelectItem value="cnpj">CNPJ</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="telefone">Telefone</SelectItem>
                        <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="pix_chave" render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Chave PIX</FormLabel>
                    <FormControl><Input {...field} value={field.value || ''} /></FormControl>
                  </FormItem>
                )} />
              </CardContent>
            </Card>
          )}

          {/* Status */}
          <Card>
            <CardContent className="pt-6 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Status</h3>
                <p className="text-sm text-muted-foreground">Advogados inativos não aparecem na atribuição de processos</p>
              </div>
              <FormField control={form.control} name="ativo" render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate('/juridico/advogados')}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isEditing ? 'Salvar Alterações' : 'Cadastrar Advogado'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
