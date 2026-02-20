import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { CpfInput, CnpjInput, TelefoneInput, CepInput } from '@/components/inputs/MaskedInputs';

const TIPOS_SERVICO = [
  { value: 'reboque', label: 'Reboque/Guincho' },
  { value: 'chaveiro', label: 'Chaveiro' },
  { value: 'troca_pneu', label: 'Troca de Pneu' },
  { value: 'pane_seca', label: 'Pane Seca' },
  { value: 'bateria', label: 'Bateria' },
  { value: 'outro', label: 'Outros' },
];

const PIX_TIPOS = [
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'email', label: 'E-mail' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'aleatoria', label: 'Chave Aleatória' },
];

const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const formSchema = z.object({
  tipo_pessoa: z.enum(['pf', 'pj']),
  razao_social: z.string().min(2, 'Razão social é obrigatória'),
  nome_fantasia: z.string().optional(),
  cnpj: z.string().optional(),
  cpf: z.string().optional(),
  telefone: z.string().min(14, 'Telefone inválido'),
  whatsapp: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().min(2, 'Cidade é obrigatória'),
  estado: z.string().length(2, 'Selecione o estado'),
  raio_atendimento_km: z.number().min(1).max(500).default(50),
  tipos_servico: z.array(z.string()).min(1, 'Selecione pelo menos um tipo de serviço'),
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  pix_chave: z.string().optional(),
  pix_tipo: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface PrestadorParaEdicao {
  id: string;
  tipo_pessoa?: string | null;
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade: string;
  estado: string;
  raio_atendimento_km?: number | null;
  tipos_servico?: string[] | null;
  banco?: string | null;
  agencia?: string | null;
  conta?: string | null;
  pix_chave?: string | null;
  pix_tipo?: string | null;
}

interface NovoPrestadorModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  prestador?: PrestadorParaEdicao | null;
}

export function NovoPrestadorModal({ open, onClose, onSuccess, prestador }: NovoPrestadorModalProps) {
  const [activeTab, setActiveTab] = useState('dados');
  const queryClient = useQueryClient();
  const isEditing = !!prestador;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo_pessoa: 'pj',
      razao_social: '',
      nome_fantasia: '',
      cnpj: '',
      cpf: '',
      telefone: '',
      whatsapp: '',
      email: '',
      cep: '',
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      estado: '',
      raio_atendimento_km: 50,
      tipos_servico: [],
      banco: '',
      agencia: '',
      conta: '',
      pix_chave: '',
      pix_tipo: '',
    },
  });

  // Pré-preencher formulário quando editando
  useEffect(() => {
    if (open && prestador) {
      form.reset({
        tipo_pessoa: (prestador.tipo_pessoa as 'pf' | 'pj') || 'pj',
        razao_social: prestador.razao_social || '',
        nome_fantasia: prestador.nome_fantasia || '',
        cnpj: prestador.cnpj || '',
        cpf: prestador.cpf || '',
        telefone: prestador.telefone || '',
        whatsapp: prestador.whatsapp || '',
        email: prestador.email || '',
        cep: prestador.cep || '',
        logradouro: prestador.logradouro || '',
        numero: prestador.numero || '',
        bairro: prestador.bairro || '',
        cidade: prestador.cidade || '',
        estado: prestador.estado || '',
        raio_atendimento_km: prestador.raio_atendimento_km || 50,
        tipos_servico: prestador.tipos_servico || [],
        banco: prestador.banco || '',
        agencia: prestador.agencia || '',
        conta: prestador.conta || '',
        pix_chave: prestador.pix_chave || '',
        pix_tipo: prestador.pix_tipo || '',
      });
    } else if (open && !prestador) {
      form.reset({
        tipo_pessoa: 'pj',
        razao_social: '',
        nome_fantasia: '',
        cnpj: '',
        cpf: '',
        telefone: '',
        whatsapp: '',
        email: '',
        cep: '',
        logradouro: '',
        numero: '',
        bairro: '',
        cidade: '',
        estado: '',
        raio_atendimento_km: 50,
        tipos_servico: [],
        banco: '',
        agencia: '',
        conta: '',
        pix_chave: '',
        pix_tipo: '',
      });
    }
  }, [open, prestador]);

  const tipoPessoa = form.watch('tipo_pessoa');

  const buildPayload = (data: FormValues) => ({
    razao_social: data.razao_social,
    nome_fantasia: data.nome_fantasia || null,
    tipo_pessoa: data.tipo_pessoa,
    cnpj: data.tipo_pessoa === 'pj' ? data.cnpj || null : null,
    cpf: data.tipo_pessoa === 'pf' ? data.cpf || null : null,
    telefone: data.telefone,
    whatsapp: data.whatsapp || null,
    email: data.email || null,
    cep: data.cep || null,
    logradouro: data.logradouro || null,
    numero: data.numero || null,
    bairro: data.bairro || null,
    cidade: data.cidade,
    estado: data.estado,
    raio_atendimento_km: data.raio_atendimento_km,
    tipos_servico: data.tipos_servico,
    banco: data.banco || null,
    agencia: data.agencia || null,
    conta: data.conta || null,
    pix_chave: data.pix_chave || null,
    pix_tipo: data.pix_tipo || null,
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const { error } = await supabase
        .from('prestadores_assistencia')
        .insert({ ...buildPayload(data), status: 'ativo', disponivel: true });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Prestador cadastrado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['prestadores'] });
      queryClient.invalidateQueries({ queryKey: ['prestadores-metricas'] });
      form.reset();
      setActiveTab('dados');
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      console.error('Erro ao criar prestador:', error);
      toast.error('Erro ao cadastrar prestador');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const { error } = await supabase
        .from('prestadores_assistencia')
        .update(buildPayload(data))
        .eq('id', prestador!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Prestador atualizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['prestadores'] });
      queryClient.invalidateQueries({ queryKey: ['prestadores-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['prestador', prestador?.id] });
      onSuccess?.();
      onClose();
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar prestador:', error);
      toast.error('Erro ao atualizar prestador');
    },
  });

  const handleCepComplete = async (cep: string) => {
    try {
      const cleanCep = cep.replace(/\D/g, '');
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        form.setValue('logradouro', data.logradouro || '');
        form.setValue('bairro', data.bairro || '');
        form.setValue('cidade', data.localidade || '');
        form.setValue('estado', data.uf || '');
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    }
  };

  const handleClose = () => {
    setActiveTab('dados');
    onClose();
  };

  const onSubmit = (data: FormValues) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Prestador' : 'Novo Prestador de Serviço'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Atualize os dados do prestador de assistência' : 'Cadastre um novo prestador de assistência 24h'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dados">Dados Gerais</TabsTrigger>
                <TabsTrigger value="endereco">Endereço</TabsTrigger>
                <TabsTrigger value="bancario">Dados Bancários</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="space-y-4 mt-4">
                {/* Tipo Pessoa */}
                <FormField
                  control={form.control}
                  name="tipo_pessoa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Pessoa</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                          <SelectItem value="pf">Pessoa Física</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Razão Social */}
                <FormField
                  control={form.control}
                  name="razao_social"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {tipoPessoa === 'pj' ? 'Razão Social' : 'Nome Completo'} *
                      </FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={tipoPessoa === 'pj' ? 'Razão Social da empresa' : 'Nome completo'} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Nome Fantasia (só PJ) */}
                {tipoPessoa === 'pj' && (
                  <FormField
                    control={form.control}
                    name="nome_fantasia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Fantasia</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nome fantasia" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* CNPJ ou CPF */}
                {tipoPessoa === 'pj' ? (
                  <FormField
                    control={form.control}
                    name="cnpj"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ</FormLabel>
                        <FormControl>
                          <CnpjInput
                            value={field.value || ''}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF</FormLabel>
                        <FormControl>
                          <CpfInput
                            value={field.value || ''}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {/* Telefone e WhatsApp */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="telefone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone *</FormLabel>
                        <FormControl>
                          <TelefoneInput
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="whatsapp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp</FormLabel>
                        <FormControl>
                          <TelefoneInput
                            value={field.value || ''}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="email@exemplo.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Tipos de Serviço */}
                <FormField
                  control={form.control}
                  name="tipos_servico"
                  render={() => (
                    <FormItem>
                      <FormLabel>Tipos de Serviço *</FormLabel>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {TIPOS_SERVICO.map((tipo) => (
                          <FormField
                            key={tipo.value}
                            control={form.control}
                            name="tipos_servico"
                            render={({ field }) => (
                              <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(tipo.value)}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || [];
                                      if (checked) {
                                        field.onChange([...current, tipo.value]);
                                      } else {
                                        field.onChange(current.filter((v) => v !== tipo.value));
                                      }
                                    }}
                                  />
                                </FormControl>
                                <Label className="font-normal cursor-pointer">
                                  {tipo.label}
                                </Label>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Raio de Atendimento */}
                <FormField
                  control={form.control}
                  name="raio_atendimento_km"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Raio de Atendimento (km)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 50)}
                          min={1}
                          max={500}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="endereco" className="space-y-4 mt-4">
                {/* CEP */}
                <FormField
                  control={form.control}
                  name="cep"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <CepInput
                          value={field.value || ''}
                          onChange={field.onChange}
                          onCepComplete={handleCepComplete}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Logradouro e Número */}
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="logradouro"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Logradouro</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Rua, Av, etc." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="numero"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nº" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Bairro */}
                <FormField
                  control={form.control}
                  name="bairro"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bairro</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Bairro" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Cidade e Estado */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cidade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Cidade" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="estado"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="UF" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {UF_OPTIONS.map((uf) => (
                              <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="bancario" className="space-y-4 mt-4">
                {/* Banco */}
                <FormField
                  control={form.control}
                  name="banco"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Banco</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nome do banco" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Agência e Conta */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="agencia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agência</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="0000" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="conta"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Conta</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="00000-0" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* PIX */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="pix_tipo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Chave PIX</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PIX_TIPOS.map((tipo) => (
                              <SelectItem key={tipo.value} value={tipo.value}>
                                {tipo.label}
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
                    name="pix_chave"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chave PIX</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Chave PIX" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Atualizar Prestador' : 'Salvar Prestador'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
