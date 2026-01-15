import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { ArrowLeft, Scale, Building, User, Calendar, DollarSign, FileText, Save, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import { supabase } from '@/integrations/supabase/client';
import { useAdvogados } from '@/hooks/useAdvogados';
import { AssociadoCombobox } from '@/components/cadastro/AssociadoCombobox';
import { SinistroCombobox } from '@/components/oficina/SinistroCombobox';
import { 
  TIPO_PROCESSO_LABELS, NATUREZA_PROCESSO_LABELS, RITO_PROCESSO_LABELS,
  TipoProcesso, NaturezaProcesso, RitoProcesso
} from '@/types/juridico';

const processoSchema = z.object({
  // Dados do Processo
  tipo: z.string().min(1, 'Tipo é obrigatório'),
  natureza: z.string().min(1, 'Natureza é obrigatória'),
  rito: z.string().optional().nullable(),
  numero_processo: z.string().optional().nullable(),
  
  // Tribunal
  tribunal: z.string().optional().nullable(),
  comarca: z.string().optional().nullable(),
  vara: z.string().optional().nullable(),
  
  // Partes
  parte_contraria_nome: z.string().min(1, 'Nome da parte contrária é obrigatório'),
  parte_contraria_cpf_cnpj: z.string().optional().nullable(),
  parte_contraria_advogado: z.string().optional().nullable(),
  parte_contraria_oab: z.string().optional().nullable(),
  
  // Vinculações
  associado_id: z.string().optional().nullable(),
  sinistro_id: z.string().optional().nullable(),
  advogado_id: z.string().optional().nullable(),
  
  // Valores
  valor_causa: z.number().optional().nullable(),
  valor_condenacao: z.number().optional().nullable(),
  valor_acordo: z.number().optional().nullable(),
  
  // Datas
  data_distribuicao: z.date().optional().nullable(),
  data_citacao: z.date().optional().nullable(),
  data_audiencia: z.date().optional().nullable(),
  
  // Objeto
  objeto: z.string().min(1, 'Objeto/Descrição é obrigatório'),
  observacoes: z.string().optional().nullable(),
});

type ProcessoFormData = z.infer<typeof processoSchema>;

// Helper para formatar valor monetário
const formatCurrencyValue = (value: number | null | undefined): string => {
  if (!value) return '';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Helper para parsear valor monetário
const parseCurrencyValue = (value: string): number | null => {
  if (!value) return null;
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

export default function ProcessoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isEditing = !!id;
  
  // Obter sinistro_id da URL (quando vindo de um sinistro)
  const sinistroIdFromUrl = searchParams.get('sinistro_id');

  // Estados para campos monetários
  const [valorCausaDisplay, setValorCausaDisplay] = useState('');
  const [valorCondenacaoDisplay, setValorCondenacaoDisplay] = useState('');
  const [valorAcordoDisplay, setValorAcordoDisplay] = useState('');

  // Carregar processo para edição
  const { data: processo, isLoading: isLoadingProcesso } = useQuery({
    queryKey: ['processo-edit', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processos')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: isEditing
  });

  // Carregar advogados ativos
  const { advogados = [], isLoading: isLoadingAdvogados } = useAdvogados({ ativo: true });

  const form = useForm<ProcessoFormData>({
    resolver: zodResolver(processoSchema),
    defaultValues: {
      tipo: '',
      natureza: '',
      rito: null,
      numero_processo: null,
      tribunal: null,
      comarca: null,
      vara: null,
      parte_contraria_nome: '',
      parte_contraria_cpf_cnpj: null,
      parte_contraria_advogado: null,
      parte_contraria_oab: null,
      associado_id: null,
      sinistro_id: sinistroIdFromUrl || null,
      advogado_id: null,
      valor_causa: null,
      valor_condenacao: null,
      valor_acordo: null,
      data_distribuicao: null,
      data_citacao: null,
      data_audiencia: null,
      objeto: '',
      observacoes: null,
    },
  });

  // Preencher form quando carregar processo (edição)
  useEffect(() => {
    if (processo) {
      form.reset({
        tipo: processo.tipo || '',
        natureza: processo.natureza || '',
        rito: processo.rito,
        numero_processo: processo.numero_processo,
        tribunal: processo.tribunal,
        comarca: processo.comarca,
        vara: processo.vara,
        parte_contraria_nome: processo.parte_contraria_nome || '',
        parte_contraria_cpf_cnpj: processo.parte_contraria_cpf_cnpj,
        parte_contraria_advogado: processo.parte_contraria_advogado,
        parte_contraria_oab: processo.parte_contraria_oab,
        associado_id: processo.associado_id,
        sinistro_id: processo.sinistro_id,
        advogado_id: processo.advogado_id,
        valor_causa: processo.valor_causa,
        valor_condenacao: processo.valor_condenacao,
        valor_acordo: processo.valor_acordo,
        data_distribuicao: processo.data_distribuicao ? new Date(processo.data_distribuicao) : null,
        data_citacao: processo.data_citacao ? new Date(processo.data_citacao) : null,
        data_audiencia: processo.data_audiencia ? new Date(processo.data_audiencia) : null,
        objeto: processo.objeto || '',
        observacoes: processo.observacoes,
      });
      // Atualizar displays de valores
      setValorCausaDisplay(formatCurrencyValue(processo.valor_causa));
      setValorCondenacaoDisplay(formatCurrencyValue(processo.valor_condenacao));
      setValorAcordoDisplay(formatCurrencyValue(processo.valor_acordo));
    }
  }, [processo, form]);

  // Buscar sinistro quando vindo da URL (para pré-preencher associado)
  const { data: sinistroFromUrl } = useQuery({
    queryKey: ['sinistro-from-url', sinistroIdFromUrl],
    queryFn: async () => {
      if (!sinistroIdFromUrl) return null;
      const { data, error } = await supabase
        .from('sinistros')
        .select(`
          id, protocolo, tipo,
          associado:associados(id, nome, cpf)
        `)
        .eq('id', sinistroIdFromUrl)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!sinistroIdFromUrl && !isEditing,
  });

  // Auto-preencher associado do sinistro quando vindo da URL
  useEffect(() => {
    if (sinistroFromUrl?.associado && !isEditing) {
      form.setValue('associado_id', sinistroFromUrl.associado.id);
    }
  }, [sinistroFromUrl, isEditing, form]);

  const saveMutation = useMutation({
    mutationFn: async (formData: ProcessoFormData) => {
      const user = await supabase.auth.getUser();
      
      // Preparar dados para envio
      const processData = {
        tipo: formData.tipo as TipoProcesso,
        natureza: formData.natureza as NaturezaProcesso,
        rito: formData.rito as RitoProcesso | null,
        numero_processo: formData.numero_processo || null,
        tribunal: formData.tribunal || null,
        comarca: formData.comarca || null,
        vara: formData.vara || null,
        parte_contraria_nome: formData.parte_contraria_nome,
        parte_contraria_cpf_cnpj: formData.parte_contraria_cpf_cnpj || null,
        parte_contraria_advogado: formData.parte_contraria_advogado || null,
        parte_contraria_oab: formData.parte_contraria_oab || null,
        associado_id: formData.associado_id || null,
        sinistro_id: formData.sinistro_id || null,
        advogado_id: formData.advogado_id || null,
        valor_causa: formData.valor_causa || null,
        valor_condenacao: formData.valor_condenacao || null,
        valor_acordo: formData.valor_acordo || null,
        data_distribuicao: formData.data_distribuicao?.toISOString().split('T')[0] || null,
        data_citacao: formData.data_citacao?.toISOString().split('T')[0] || null,
        data_audiencia: formData.data_audiencia?.toISOString().split('T')[0] || null,
        objeto: formData.objeto,
        observacoes: formData.observacoes || null,
      };
      
      if (isEditing) {
        const { data, error } = await supabase
          .from('processos')
          .update({
            ...processData,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('processos')
          .insert({
            ...processData,
            status: 'ativo',
            fase: 'inicial',
            criado_por: user.data.user?.id
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['processos'] });
      toast.success(isEditing ? 'Processo atualizado com sucesso!' : 'Processo criado com sucesso!');
      navigate(`/juridico/processos/${data.id}`);
    },
    onError: (error) => {
      toast.error('Erro ao salvar processo: ' + error.message);
    }
  });

  const onSubmit = (data: ProcessoFormData) => {
    saveMutation.mutate(data);
  };

  // Loading skeleton para edição
  if (isEditing && isLoadingProcesso) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Card>
          <CardContent className="pt-6 space-y-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-6 w-40" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/juridico/processos')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="h-6 w-6" />
            {isEditing ? `Editar Processo #${processo?.numero || ''}` : 'Novo Processo'}
          </h1>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Dados do Processo
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(TIPO_PROCESSO_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="natureza"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Natureza *</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a natureza" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(NATUREZA_PROCESSO_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rito"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rito</FormLabel>
                    <Select value={field.value || ''} onValueChange={(v) => field.onChange(v || null)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o rito" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(RITO_PROCESSO_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="numero_processo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número CNJ</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="0000000-00.0000.0.00.0000" 
                        {...field} 
                        value={field.value || ''} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Tribunal
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="tribunal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tribunal</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: TJSP" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="comarca"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comarca</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: São Paulo" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vara"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vara</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 1ª Vara Cível" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Partes
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="parte_contraria_nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Parte Contrária *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parte_contraria_cpf_cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF/CNPJ</FormLabel>
                    <FormControl>
                      <Input placeholder="000.000.000-00" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parte_contraria_advogado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Advogado Contrário</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do advogado" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parte_contraria_oab"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OAB do Advogado Contrário</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 123456/SP" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Vinculações
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="associado_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Associado</FormLabel>
                    <FormControl>
                      <AssociadoCombobox
                        value={field.value || undefined}
                        onSelect={(id) => field.onChange(id)}
                        placeholder="Buscar associado..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sinistro_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sinistro</FormLabel>
                    <FormControl>
                      <SinistroCombobox
                        value={field.value || undefined}
                        onSelect={(sinistro) => field.onChange(sinistro.id)}
                        placeholder="Buscar sinistro..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="advogado_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Advogado Responsável</FormLabel>
                    <Select value={field.value || ''} onValueChange={(v) => field.onChange(v || null)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o advogado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {advogados.map((adv) => (
                          <SelectItem key={adv.id} value={adv.id}>
                            {adv.nome} - OAB {adv.oab}/{adv.oab_estado}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Valores
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="valor_causa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor da Causa</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                        <Input
                          className="pl-10"
                          placeholder="0,00"
                          value={valorCausaDisplay}
                          onChange={(e) => {
                            setValorCausaDisplay(e.target.value);
                            field.onChange(parseCurrencyValue(e.target.value));
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isEditing && (
                <>
                  <FormField
                    control={form.control}
                    name="valor_condenacao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor Condenação</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                            <Input
                              className="pl-10"
                              placeholder="0,00"
                              value={valorCondenacaoDisplay}
                              onChange={(e) => {
                                setValorCondenacaoDisplay(e.target.value);
                                field.onChange(parseCurrencyValue(e.target.value));
                              }}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="valor_acordo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor Acordo</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                            <Input
                              className="pl-10"
                              placeholder="0,00"
                              value={valorAcordoDisplay}
                              onChange={(e) => {
                                setValorAcordoDisplay(e.target.value);
                                field.onChange(parseCurrencyValue(e.target.value));
                              }}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Datas
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="data_distribuicao"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data Distribuição</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data'}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          locale={ptBR}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_citacao"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data Citação</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data'}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          locale={ptBR}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_audiencia"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data Audiência</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecione a data'}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          locale={ptBR}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Objeto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="objeto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Objeto / Descrição *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Descreva o objeto do processo..."
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Observações adicionais..."
                        className="min-h-[80px]"
                        {...field} 
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate('/juridico/processos')}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {isEditing ? 'Salvar Alterações' : 'Criar Processo'}
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
