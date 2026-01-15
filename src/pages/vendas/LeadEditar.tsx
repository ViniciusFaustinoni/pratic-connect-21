import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLead } from '@/hooks/useLeads';
import { useLeadActions } from '@/hooks/useLeadActions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { ArrowLeft, Save, User, Car, Settings, AlertCircle } from 'lucide-react';
import { LeadDocumentUploader } from '@/components/leads/LeadDocumentUploader';
import { ORIGEM_LABELS, ETAPA_LABELS } from '@/types/database';
import type { OrigemLead, EtapaLead } from '@/types/database';

// ============================================
// VALIDAÇÃO CPF
// ============================================
function validarCPF(cpf: string): boolean {
  if (!cpf) return true;
  cpf = cpf.replace(/\D/g, '');
  
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;
  
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(9))) return false;
  
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i)) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cpf.charAt(10))) return false;
  
  return true;
}

// ============================================
// CONSTANTES
// ============================================
const ETAPAS_TODAS: EtapaLead[] = [
  'novo', 'contato', 'qualificado', 'cotacao_enviada', 'negociacao',
  'vistoria_agendada', 'contrato_enviado', 'contrato_assinado',
  'instalacao_agendada', 'ganho', 'perdido',
];

const ORIGENS_TODAS: OrigemLead[] = [
  'indicacao', 'site', 'facebook', 'instagram', 'google', 
  'telefone', 'presencial', 'parceiro', 'api', 'outro',
];

// ============================================
// SCHEMA DE VALIDAÇÃO
// ============================================
const editarLeadSchema = z.object({
  nome: z
    .string()
    .min(3, 'Nome deve ter pelo menos 3 caracteres')
    .max(255, 'Nome muito longo'),
  telefone: z
    .string()
    .min(14, 'Telefone inválido')
    .max(15, 'Telefone inválido'),
  email: z
    .string()
    .email('Email inválido')
    .max(255, 'Email muito longo')
    .optional()
    .or(z.literal('')),
  cpf: z
    .string()
    .optional()
    .refine((val) => !val || validarCPF(val), 'CPF inválido'),
  veiculo_marca: z.string().max(100).optional().or(z.literal('')),
  veiculo_modelo: z.string().max(100).optional().or(z.literal('')),
  veiculo_ano: z
    .string()
    .optional()
    .refine(
      (val) => !val || (parseInt(val) >= 1990 && parseInt(val) <= new Date().getFullYear() + 1),
      'Ano inválido'
    ),
  veiculo_placa: z.string().max(8).optional().or(z.literal('')),
  origem: z.enum([
    'indicacao', 'site', 'whatsapp', 'facebook', 'instagram', 'google', 
    'telefone', 'presencial', 'parceiro', 'api', 'cotador', 'outro',
  ] as const),
  etapa: z.enum([
    'novo', 'contato', 'contato_inicial', 'apresentacao', 'qualificado', 'cotacao_enviada', 'negociacao',
    'vistoria_agendada', 'contrato_enviado', 'contrato_assinado',
    'instalacao_agendada', 'ganho', 'perdido',
  ] as const),
  motivo_perda: z.string().max(500).optional().or(z.literal('')),
  observacoes: z.string().max(1000).optional().or(z.literal('')),
}).refine((data) => {
  if (data.etapa === 'perdido') {
    return data.motivo_perda && data.motivo_perda.length >= 10;
  }
  return true;
}, {
  message: 'Informe o motivo da perda (mínimo 10 caracteres)',
  path: ['motivo_perda'],
});

type EditarLeadFormData = z.infer<typeof editarLeadSchema>;

// ============================================
// MÁSCARAS
// ============================================
const maskPhone = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
    .replace(/(-\d{4})\d+?$/, '$1');
};

const maskCPF = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

const maskPlaca = (value: string) => {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/^([A-Z]{3})(\d)/, '$1-$2')
    .substring(0, 8);
};

const formatPhoneForDisplay = (phone: string | null) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
};

const formatCPFForDisplay = (cpf: string | null) => {
  if (!cpf) return '';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return cpf;
};

const formatPlacaForDisplay = (placa: string | null) => {
  if (!placa) return '';
  const clean = placa.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (clean.length >= 4) {
    return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  }
  return clean;
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function LeadEditar() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: lead, isLoading, error } = useLead(id);
  const { atualizarLead, isUpdating } = useLeadActions();

  const form = useForm<EditarLeadFormData>({
    resolver: zodResolver(editarLeadSchema),
    defaultValues: {
      nome: '',
      telefone: '',
      email: '',
      cpf: '',
      veiculo_marca: '',
      veiculo_modelo: '',
      veiculo_ano: '',
      veiculo_placa: '',
      origem: 'outro',
      etapa: 'novo',
      motivo_perda: '',
      observacoes: '',
    },
  });

  const etapaAtual = form.watch('etapa');

  // Handler para dados extraídos do OCR
  const handleOcrDataExtracted = (dados: { nome?: string; cpf?: string }) => {
    if (dados.nome && !form.getValues('nome')) {
      form.setValue('nome', dados.nome);
    }
    if (dados.cpf) {
      form.setValue('cpf', formatCPFForDisplay(dados.cpf));
    }
  };

  useEffect(() => {
    if (lead) {
      // Map legacy values to valid schema values
      const validOrigens = ['indicacao', 'site', 'facebook', 'instagram', 'google', 'telefone', 'presencial', 'parceiro', 'api', 'outro'] as const;
      const validEtapas = ['novo', 'contato', 'contato_inicial', 'apresentacao', 'qualificado', 'cotacao_enviada', 'negociacao', 'vistoria_agendada', 'contrato_enviado', 'contrato_assinado', 'instalacao_agendada', 'ganho', 'perdido'] as const;
      
      const origem = validOrigens.includes(lead.origem as typeof validOrigens[number]) 
        ? (lead.origem as typeof validOrigens[number])
        : 'outro';
      const etapa = validEtapas.includes(lead.etapa as typeof validEtapas[number])
        ? (lead.etapa as typeof validEtapas[number])
        : 'novo';
      
      form.reset({
        nome: lead.nome,
        telefone: formatPhoneForDisplay(lead.telefone),
        email: lead.email || '',
        cpf: formatCPFForDisplay(lead.cpf),
        veiculo_marca: lead.veiculo_marca || '',
        veiculo_modelo: lead.veiculo_modelo || '',
        veiculo_ano: lead.veiculo_ano?.toString() || '',
        veiculo_placa: formatPlacaForDisplay(lead.veiculo_placa),
        origem,
        etapa,
        motivo_perda: lead.motivo_perda || '',
        observacoes: lead.observacoes || '',
      });
    }
  }, [lead, form]);

  const onSubmit = async (data: EditarLeadFormData) => {
    if (!id) return;

    try {
      await atualizarLead({
        id,
        data: {
          nome: data.nome,
          telefone: data.telefone.replace(/\D/g, ''),
          email: data.email || null,
          cpf: data.cpf?.replace(/\D/g, '') || null,
          veiculo_marca: data.veiculo_marca || null,
          veiculo_modelo: data.veiculo_modelo || null,
          veiculo_ano: data.veiculo_ano ? parseInt(data.veiculo_ano) : null,
          veiculo_placa: data.veiculo_placa?.replace('-', '') || null,
          origem: data.origem,
          etapa: data.etapa,
          motivo_perda: data.etapa === 'perdido' ? data.motivo_perda : null,
          observacoes: data.observacoes || null,
        },
      });
      
      navigate(`/vendas/leads/${id}`);
    } catch {
      // Error already handled in hook
    }
  };

  // Loading State
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[150px] w-full" />
      </div>
    );
  }

  // Error State
  if (error || !lead) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive" />
              <h2 className="text-xl font-semibold">Lead não encontrado</h2>
              <p className="text-muted-foreground">
                O lead solicitado não existe ou foi removido.
              </p>
              <Button onClick={() => navigate('/vendas/leads')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para lista
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/vendas/leads" className="hover:text-foreground">Vendas</Link>
        <span className="mx-2">/</span>
        <Link to="/vendas/leads" className="hover:text-foreground">Leads</Link>
        <span className="mx-2">/</span>
        <Link to={`/vendas/leads/${id}`} className="hover:text-foreground">
          {lead.nome}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Editar</span>
      </nav>

      {/* Botão Voltar */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/vendas/leads/${id}`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Editar Lead</h1>
        <p className="text-muted-foreground">
          Atualize as informações do lead
        </p>
      </div>

      {/* Formulário */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Card: Dados Pessoais */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Dados Pessoais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload de documento com OCR */}
              <LeadDocumentUploader
                leadId={id!}
                onDataExtracted={handleOcrDataExtracted}
              />

              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome completo *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do lead" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="telefone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="(00) 00000-0000"
                          {...field}
                          onChange={(e) => field.onChange(maskPhone(e.target.value))}
                          maxLength={15}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="email@exemplo.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="000.000.000-00"
                        {...field}
                        onChange={(e) => field.onChange(maskCPF(e.target.value))}
                        maxLength={14}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Card: Dados do Veículo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Dados do Veículo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="veiculo_marca"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Marca</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Fiat" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="veiculo_modelo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Uno" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="veiculo_ano"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ano</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 2020" type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="veiculo_placa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Placa</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="ABC-1234"
                          {...field}
                          onChange={(e) => field.onChange(maskPlaca(e.target.value))}
                          maxLength={8}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Card: Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Status do Lead
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="origem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Origem</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a origem" />
                          </SelectTrigger>
                          <SelectContent>
                            {ORIGENS_TODAS.map((origem) => (
                              <SelectItem key={origem} value={origem}>
                                {ORIGEM_LABELS[origem]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="etapa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Etapa atual</FormLabel>
                      <FormControl>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a etapa" />
                          </SelectTrigger>
                          <SelectContent>
                            {ETAPAS_TODAS.map((etapa) => (
                              <SelectItem key={etapa} value={etapa}>
                                {ETAPA_LABELS[etapa]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {etapaAtual === 'perdido' && (
                <FormField
                  control={form.control}
                  name="motivo_perda"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motivo da perda *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descreva o motivo pelo qual o lead foi perdido..."
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Informe o motivo para análise futura (mínimo 10 caracteres)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="observacoes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Observações adicionais sobre o lead..."
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Ações */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/vendas/leads/${id}`)}
                  disabled={isUpdating}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    'Salvando...'
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
