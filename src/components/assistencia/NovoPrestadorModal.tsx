import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';

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
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const TIPOS_SERVICO = [
  { value: 'reboque', label: 'Reboque / Guincho' },
  { value: 'pane_seca', label: 'Pane Seca' },
  { value: 'socorro_mecanico', label: 'Socorro Mecânico' },
  { value: 'socorro_eletrico', label: 'Socorro Elétrico' },
  { value: 'troca_pneu', label: 'Troca de Pneu' },
  { value: 'chaveiro', label: 'Chaveiro' },
  { value: 'bateria', label: 'Bateria' },
  { value: 'taxi', label: 'Táxi / Transporte' },
  { value: 'hospedagem', label: 'Hospedagem' },
  { value: 'outro', label: 'Outros' },
];

const TIPOS_REBOQUE = [
  { value: 'leve', label: 'Leves', desc: 'motos, carros de passeio' },
  { value: 'utilitario', label: 'Utilitários', desc: 'vans, pickups, SUVs' },
  { value: 'pesado', label: 'Pesados', desc: 'sprinters, caminhões' },
];

// Serviços que usam valor_saida + valor_km
const SERVICOS_KM = ['reboque', 'pane_seca', 'socorro_mecanico', 'socorro_eletrico', 'troca_pneu', 'bateria'];
// Serviços que usam valor_fixo
const SERVICOS_FIXO = ['chaveiro', 'taxi', 'hospedagem'];

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
  telefone_extra: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().min(2, 'Cidade é obrigatória'),
  estado: z.string().length(2, 'Selecione o estado'),
  raio_atendimento_km: z.number().min(1).max(500).default(50),
  tipos_servico: z.array(z.string()).min(1, 'Selecione pelo menos um tipo de serviço'),
  tipos_reboque: z.array(z.string()).default([]),
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  pix_chave: z.string().optional(),
  pix_tipo: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ValorItem {
  tipo_servico: string;
  tipo_reboque: string | null;
  valor_saida: string;
  valor_km: string;
  valor_fixo: string;
  observacoes: string;
  km_franquia: string;
  hr_trabalhada: string;
  hr_parada: string;
  diaria_base: string;
  valor_sugerido: string;
}

interface PrestadorParaEdicao {
  id: string;
  tipo_pessoa?: string | null;
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  telefone_extra?: string | null;
  email?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade: string;
  estado: string;
  raio_atendimento_km?: number | null;
  tipos_servico?: string[] | null;
  tipos_reboque?: string[] | null;
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

function getValorKey(tipo_servico: string, tipo_reboque: string | null): string {
  return tipo_reboque ? `${tipo_servico}__${tipo_reboque}` : tipo_servico;
}

function getServicoLabel(tipo_servico: string, tipo_reboque: string | null): string {
  const servLabel = TIPOS_SERVICO.find(t => t.value === tipo_servico)?.label || tipo_servico;
  if (tipo_reboque) {
    const rebLabel = TIPOS_REBOQUE.find(t => t.value === tipo_reboque)?.label || tipo_reboque;
    return `${servLabel} - ${rebLabel}`;
  }
  return servLabel;
}

export function NovoPrestadorModal({ open, onClose, onSuccess, prestador }: NovoPrestadorModalProps) {
  const [activeTab, setActiveTab] = useState('dados');
  const [valores, setValores] = useState<Record<string, ValorItem>>({});
  const [valoresOpen, setValoresOpen] = useState(false);
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
      telefone_extra: '',
      email: '',
      cep: '',
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      estado: '',
      raio_atendimento_km: 50,
      tipos_servico: [],
      tipos_reboque: [],
      banco: '',
      agencia: '',
      conta: '',
      pix_chave: '',
      pix_tipo: '',
    },
  });

  // Carregar valores existentes quando editando
  const { data: valoresExistentes } = useQuery({
    queryKey: ['prestador-valores', prestador?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prestadores_assistencia_valores' as any)
        .select('*')
        .eq('prestador_id', prestador!.id);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!prestador?.id && open,
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
        telefone_extra: prestador.telefone_extra || '',
        email: prestador.email || '',
        cep: prestador.cep || '',
        logradouro: prestador.logradouro || '',
        numero: prestador.numero || '',
        bairro: prestador.bairro || '',
        cidade: prestador.cidade || '',
        estado: prestador.estado || '',
        raio_atendimento_km: prestador.raio_atendimento_km || 50,
        tipos_servico: prestador.tipos_servico || [],
        tipos_reboque: prestador.tipos_reboque || [],
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
        telefone_extra: '',
        email: '',
        cep: '',
        logradouro: '',
        numero: '',
        bairro: '',
        cidade: '',
        estado: '',
        raio_atendimento_km: 50,
        tipos_servico: [],
        tipos_reboque: [],
        banco: '',
        agencia: '',
        conta: '',
        pix_chave: '',
        pix_tipo: '',
      });
      setValores({});
      setValoresOpen(false);
    }
  }, [open, prestador]);

  // Carregar valores existentes no estado local
  useEffect(() => {
    if (valoresExistentes && valoresExistentes.length > 0) {
      const map: Record<string, ValorItem> = {};
      for (const v of valoresExistentes) {
        const key = getValorKey(v.tipo_servico, v.tipo_reboque);
        map[key] = {
          tipo_servico: v.tipo_servico,
          tipo_reboque: v.tipo_reboque || null,
          valor_saida: v.valor_saida ? String(v.valor_saida) : '',
          valor_km: v.valor_km ? String(v.valor_km) : '',
          valor_fixo: v.valor_fixo ? String(v.valor_fixo) : '',
          observacoes: v.observacoes || '',
          km_franquia: v.km_franquia ? String(v.km_franquia) : '',
          hr_trabalhada: v.hr_trabalhada ? String(v.hr_trabalhada) : '',
          hr_parada: v.hr_parada ? String(v.hr_parada) : '',
          diaria_base: v.diaria_base ? String(v.diaria_base) : '',
          valor_sugerido: v.valor_sugerido ? String(v.valor_sugerido) : '',
        };
      }
      setValores(map);
      setValoresOpen(true);
    }
  }, [valoresExistentes]);

  const tipoPessoa = form.watch('tipo_pessoa');
  const tiposServico = form.watch('tipos_servico');
  const tiposReboque = form.watch('tipos_reboque');

  const hasReboque = tiposServico?.includes('reboque');

  // Limpar tipos_reboque quando reboque é desmarcado
  useEffect(() => {
    if (!hasReboque) {
      form.setValue('tipos_reboque', []);
    }
  }, [hasReboque]);

  // Gerar lista de cards de valores baseado nos serviços selecionados
  const valoresCards = (() => {
    const cards: { key: string; tipo_servico: string; tipo_reboque: string | null; label: string; isKm: boolean }[] = [];
    for (const ts of (tiposServico || [])) {
      if (ts === 'reboque') {
        for (const tr of (tiposReboque || [])) {
          const key = getValorKey(ts, tr);
          cards.push({ key, tipo_servico: ts, tipo_reboque: tr, label: getServicoLabel(ts, tr), isKm: true });
        }
      } else if (ts === 'outro') {
        // skip "outro"
      } else {
        const key = getValorKey(ts, null);
        const isKm = SERVICOS_KM.includes(ts);
        cards.push({ key, tipo_servico: ts, tipo_reboque: null, label: getServicoLabel(ts, null), isKm });
      }
    }
    return cards;
  })();

  const updateValor = (key: string, field: keyof ValorItem, value: string) => {
    setValores(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
      }
    }));
  };

  const buildPayload = (data: FormValues) => ({
    razao_social: data.razao_social,
    nome_fantasia: data.nome_fantasia || null,
    tipo_pessoa: data.tipo_pessoa,
    cnpj: data.tipo_pessoa === 'pj' ? data.cnpj || null : null,
    cpf: data.tipo_pessoa === 'pf' ? data.cpf || null : null,
    telefone: data.telefone,
    whatsapp: data.whatsapp || null,
    telefone_extra: data.telefone_extra || null,
    email: data.email || null,
    cep: data.cep || null,
    logradouro: data.logradouro || null,
    numero: data.numero || null,
    bairro: data.bairro || null,
    cidade: data.cidade,
    estado: data.estado,
    raio_atendimento_km: data.raio_atendimento_km,
    tipos_servico: data.tipos_servico,
    tipos_reboque: data.tipos_reboque,
    banco: data.banco || null,
    agencia: data.agencia || null,
    conta: data.conta || null,
    pix_chave: data.pix_chave || null,
    pix_tipo: data.pix_tipo || null,
  });

  const saveValores = async (prestadorId: string) => {
    // Deletar valores antigos
    await supabase
      .from('prestadores_assistencia_valores' as any)
      .delete()
      .eq('prestador_id', prestadorId);

    // Inserir novos valores (só os que têm algum valor preenchido)
    const rows = valoresCards
      .map(card => {
        const v = valores[card.key];
        if (!v) return null;
        const hasValue = v.valor_saida || v.valor_km || v.valor_fixo || v.km_franquia || v.hr_trabalhada || v.hr_parada || v.diaria_base || v.valor_sugerido;
        if (!hasValue) return null;
        return {
          prestador_id: prestadorId,
          tipo_servico: card.tipo_servico,
          tipo_reboque: card.tipo_reboque,
          valor_saida: v.valor_saida ? parseFloat(v.valor_saida) : null,
          valor_km: v.valor_km ? parseFloat(v.valor_km) : null,
          valor_fixo: v.valor_fixo ? parseFloat(v.valor_fixo) : null,
          observacoes: v.observacoes || null,
          km_franquia: v.km_franquia ? parseFloat(v.km_franquia) : null,
          hr_trabalhada: v.hr_trabalhada ? parseFloat(v.hr_trabalhada) : null,
          hr_parada: v.hr_parada ? parseFloat(v.hr_parada) : null,
          diaria_base: v.diaria_base ? parseFloat(v.diaria_base) : null,
          valor_sugerido: v.valor_sugerido ? parseFloat(v.valor_sugerido) : null,
        };
      })
      .filter(Boolean);

    if (rows.length > 0) {
      const { error } = await supabase
        .from('prestadores_assistencia_valores' as any)
        .insert(rows);
      if (error) throw error;
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const { data: inserted, error } = await supabase
        .from('prestadores_assistencia')
        .insert({ ...buildPayload(data), status: 'ativo', disponivel: true } as any)
        .select('id')
        .single();
      if (error) throw error;
      await saveValores(inserted.id);
    },
    onSuccess: () => {
      toast.success('Prestador cadastrado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['prestadores'] });
      queryClient.invalidateQueries({ queryKey: ['prestadores-metricas'] });
      form.reset();
      setActiveTab('dados');
      setValores({});
      setValoresOpen(false);
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
        .update(buildPayload(data) as any)
        .eq('id', prestador!.id);
      if (error) throw error;
      await saveValores(prestador!.id);
    },
    onSuccess: () => {
      toast.success('Prestador atualizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['prestadores'] });
      queryClient.invalidateQueries({ queryKey: ['prestadores-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['prestador', prestador?.id] });
      queryClient.invalidateQueries({ queryKey: ['prestador-valores', prestador?.id] });
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
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="dados">Dados Gerais</TabsTrigger>
                <TabsTrigger value="endereco">Endereço</TabsTrigger>
                <TabsTrigger value="bancario">Bancário</TabsTrigger>
                <TabsTrigger value="valores">Valores</TabsTrigger>
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

                {/* Telefone Extra */}
                <FormField
                  control={form.control}
                  name="telefone_extra"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone Extra</FormLabel>
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

                {/* Tipos de Reboque (condicional) */}
                {hasReboque && (
                  <FormField
                    control={form.control}
                    name="tipos_reboque"
                    render={() => (
                      <FormItem>
                        <FormLabel>Quais tipos de veículo você reboca?</FormLabel>
                        <div className="space-y-2 mt-2 pl-2 border-l-2 border-primary/20">
                          {TIPOS_REBOQUE.map((tipo) => (
                            <FormField
                              key={tipo.value}
                              control={form.control}
                              name="tipos_reboque"
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
                                    {tipo.label} <span className="text-muted-foreground text-xs">({tipo.desc})</span>
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
                )}

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

              <TabsContent value="valores" className="space-y-4 mt-4">
                {valoresCards.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Selecione os tipos de serviço na aba "Dados Gerais" para configurar os valores.</p>
                    {hasReboque && (!tiposReboque || tiposReboque.length === 0) && (
                      <p className="mt-2 text-sm">Para reboque, selecione também os tipos de veículo.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Configure os valores para cada serviço. Todos os campos são opcionais.
                    </p>
                    {valoresCards.map((card) => {
                      const v = valores[card.key] || {
                        tipo_servico: card.tipo_servico,
                        tipo_reboque: card.tipo_reboque,
                        valor_saida: '',
                        valor_km: '',
                        valor_fixo: '',
                        observacoes: '',
                        km_franquia: '',
                        hr_trabalhada: '',
                        hr_parada: '',
                        diaria_base: '',
                        valor_sugerido: '',
                      };
                      // Initialize in state if not present
                      if (!valores[card.key]) {
                        setValores(prev => ({ ...prev, [card.key]: v }));
                      }
                      return (
                        <Card key={card.key} className="border">
                          <CardHeader className="py-3 px-4">
                            <CardTitle className="text-sm font-medium">{card.label}</CardTitle>
                          </CardHeader>
                          <CardContent className="px-4 pb-3 pt-0 space-y-2">
                            {card.isKm ? (
                              <>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Valor de Saída (R$)</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="0,00"
                                      value={v.valor_saida}
                                      onChange={(e) => updateValor(card.key, 'valor_saida', e.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Valor por Km (R$)</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="0,00"
                                      value={v.valor_km}
                                      onChange={(e) => updateValor(card.key, 'valor_km', e.target.value)}
                                    />
                                  </div>
                                </div>
                                {card.tipo_servico === 'reboque' && (
                                  <div className="space-y-1">
                                    <Label className="text-xs font-semibold text-primary">💰 Valor Sugerido (R$)</Label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      placeholder="Valor fixo enviado na mensagem de despacho"
                                      value={v.valor_sugerido}
                                      onChange={(e) => updateValor(card.key, 'valor_sugerido', e.target.value)}
                                    />
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="space-y-1">
                                <Label className="text-xs">Valor Fixo (R$)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0,00"
                                  value={v.valor_fixo}
                                  onChange={(e) => updateValor(card.key, 'valor_fixo', e.target.value)}
                                />
                              </div>
                            )}
                            {/* Novos campos - grid 2x2 */}
                            <div className="grid grid-cols-2 gap-3 pt-1">
                              <div className="space-y-1">
                                <Label className="text-xs">KM Franquia</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0"
                                  value={v.km_franquia}
                                  onChange={(e) => updateValor(card.key, 'km_franquia', e.target.value)}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Hora Trabalhada (R$)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0,00"
                                  value={v.hr_trabalhada}
                                  onChange={(e) => updateValor(card.key, 'hr_trabalhada', e.target.value)}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Hora Parada (R$)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0,00"
                                  value={v.hr_parada}
                                  onChange={(e) => updateValor(card.key, 'hr_parada', e.target.value)}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Diária Base (R$)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0,00"
                                  value={v.diaria_base}
                                  onChange={(e) => updateValor(card.key, 'diaria_base', e.target.value)}
                                />
                              </div>
                            </div>
                            <Collapsible>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-xs h-6 px-1 text-muted-foreground">
                                  Observações
                                </Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <Textarea
                                  placeholder="Observações sobre este serviço..."
                                  className="min-h-[60px] text-sm mt-1"
                                  value={v.observacoes}
                                  onChange={(e) => updateValor(card.key, 'observacoes', e.target.value)}
                                />
                              </CollapsibleContent>
                            </Collapsible>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
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
