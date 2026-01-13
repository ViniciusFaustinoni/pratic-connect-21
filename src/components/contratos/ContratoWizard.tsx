import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Check, User, Car, FileText, CheckCircle, Upload, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CpfInput, TelefoneInput, PlacaInput, CepInput } from '@/components/inputs/MaskedInputs';
import { useCotacao, useUpdateCotacao } from '@/hooks/useCotacoes';
import { useCreateContrato } from '@/hooks/useContratos';
import { useCreateAssociado } from '@/hooks/useAssociados';
import { useCreateVeiculo } from '@/hooks/useVeiculos';
import { useUpdateLead } from '@/hooks/useLeads';
import { DocumentUploader, type UploadedDocument } from './DocumentUploader';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const wizardSchema = z.object({
  // Associado
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  cpf: z.string().min(11, "CPF inválido"),
  rg: z.string().optional(),
  email: z.string().email("E-mail inválido"),
  telefone: z.string().min(10, "Telefone inválido"),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  // Veículo
  placa: z.string().min(7, "Placa inválida"),
  marca: z.string().min(2, "Marca obrigatória"),
  modelo: z.string().min(2, "Modelo obrigatório"),
  ano_fabricacao: z.coerce.number().min(1900, "Ano inválido"),
  ano_modelo: z.coerce.number().min(1900, "Ano inválido"),
  cor: z.string().optional(),
  combustivel: z.string().optional(),
  chassi: z.string().optional(),
  renavam: z.string().optional(),
  valor_fipe: z.number().optional().nullable(),
});

type WizardFormData = z.infer<typeof wizardSchema>;

interface ContratoWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cotacaoId: string;
}

const steps = [
  { id: 1, title: 'Cotação', icon: FileText },
  { id: 2, title: 'Associado', icon: User },
  { id: 3, title: 'Veículo', icon: Car },
  { id: 4, title: 'Confirmação', icon: CheckCircle },
];

export function ContratoWizard({ open, onOpenChange, cotacaoId }: ContratoWizardProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Documentos uploadados
  const [docsAssociado, setDocsAssociado] = useState<UploadedDocument[]>([]);
  const [docsVeiculo, setDocsVeiculo] = useState<UploadedDocument[]>([]);
  
  // Dados extraídos pela IA
  const [dadosExtraidosAssociado, setDadosExtraidosAssociado] = useState<Record<string, { value: string; fonte: string }>>({});
  const [dadosExtraidosVeiculo, setDadosExtraidosVeiculo] = useState<Record<string, { value: string; fonte: string }>>({});
  
  const { data: cotacao } = useCotacao(cotacaoId);
  const createContrato = useCreateContrato();
  const createAssociado = useCreateAssociado();
  const createVeiculo = useCreateVeiculo();
  const updateCotacao = useUpdateCotacao();
  const updateLead = useUpdateLead();

  const form = useForm<WizardFormData>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      nome: '', cpf: '', rg: '', email: '', telefone: '',
      cep: '', logradouro: '', numero: '', bairro: '', cidade: '', uf: '',
      placa: '', marca: '', modelo: '', ano_fabricacao: new Date().getFullYear(),
      ano_modelo: new Date().getFullYear(), cor: '', combustivel: '', chassi: '', renavam: '',
    },
  });

  // Pré-preencher dados da cotação/lead
  useEffect(() => {
    if (cotacao?.leads) {
      const lead = cotacao.leads;
      form.setValue('nome', lead.nome);
      form.setValue('telefone', lead.telefone);
      if (lead.email) form.setValue('email', lead.email);
      if (lead.cpf) form.setValue('cpf', lead.cpf);
      if (lead.veiculo_marca) form.setValue('marca', lead.veiculo_marca);
      if (lead.veiculo_modelo) form.setValue('modelo', lead.veiculo_modelo);
      if (lead.veiculo_ano) {
        form.setValue('ano_fabricacao', lead.veiculo_ano);
        form.setValue('ano_modelo', lead.veiculo_ano);
      }
      if (lead.veiculo_placa) form.setValue('placa', lead.veiculo_placa);
      if (lead.veiculo_fipe) form.setValue('valor_fipe', lead.veiculo_fipe);
    }
  }, [cotacao, form]);

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setStep(1);
      setDocsAssociado([]);
      setDocsVeiculo([]);
      setDadosExtraidosAssociado({});
      setDadosExtraidosVeiculo({});
      form.reset();
    }
  }, [open, form]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const fetchCep = async (cep: string) => {
    try {
      const cleanCep = cep.replace(/\D/g, '');
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        form.setValue('logradouro', data.logradouro);
        form.setValue('bairro', data.bairro);
        form.setValue('cidade', data.localidade);
        form.setValue('uf', data.uf);
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    }
  };

  // Handler para documentos do associado com OCR
  const handleDocsAssociadoChange = (docs: UploadedDocument[]) => {
    setDocsAssociado(docs);
  };

  const handleOcrAssociado = (dados: Record<string, string>) => {
    // Mapear dados do OCR para o form
    const fonte = 'Documento';
    
    if (dados.nome && !form.getValues('nome')) {
      form.setValue('nome', dados.nome);
      setDadosExtraidosAssociado(prev => ({ ...prev, nome: { value: dados.nome, fonte } }));
    }
    if (dados.cpf && !form.getValues('cpf')) {
      form.setValue('cpf', dados.cpf);
      setDadosExtraidosAssociado(prev => ({ ...prev, cpf: { value: dados.cpf, fonte } }));
    }
    if (dados.rg && !form.getValues('rg')) {
      form.setValue('rg', dados.rg);
      setDadosExtraidosAssociado(prev => ({ ...prev, rg: { value: dados.rg, fonte } }));
    }
    if (dados.logradouro && !form.getValues('logradouro')) {
      form.setValue('logradouro', dados.logradouro);
      setDadosExtraidosAssociado(prev => ({ ...prev, logradouro: { value: dados.logradouro, fonte } }));
    }
    if (dados.numero && !form.getValues('numero')) {
      form.setValue('numero', dados.numero);
      setDadosExtraidosAssociado(prev => ({ ...prev, numero: { value: dados.numero, fonte } }));
    }
    if (dados.bairro && !form.getValues('bairro')) {
      form.setValue('bairro', dados.bairro);
      setDadosExtraidosAssociado(prev => ({ ...prev, bairro: { value: dados.bairro, fonte } }));
    }
    if (dados.cidade && !form.getValues('cidade')) {
      form.setValue('cidade', dados.cidade);
      setDadosExtraidosAssociado(prev => ({ ...prev, cidade: { value: dados.cidade, fonte } }));
    }
    if (dados.uf && !form.getValues('uf')) {
      form.setValue('uf', dados.uf);
      setDadosExtraidosAssociado(prev => ({ ...prev, uf: { value: dados.uf, fonte } }));
    }
    if (dados.cep && !form.getValues('cep')) {
      form.setValue('cep', dados.cep);
      setDadosExtraidosAssociado(prev => ({ ...prev, cep: { value: dados.cep, fonte } }));
    }
  };

  // Handler para documentos do veículo com OCR
  const handleDocsVeiculoChange = (docs: UploadedDocument[]) => {
    setDocsVeiculo(docs);
  };

  const handleOcrVeiculo = (dados: Record<string, string>) => {
    const fonte = 'CRLV';
    
    if (dados.placa && !form.getValues('placa')) {
      form.setValue('placa', dados.placa);
      setDadosExtraidosVeiculo(prev => ({ ...prev, placa: { value: dados.placa, fonte } }));
    }
    if (dados.marca && !form.getValues('marca')) {
      form.setValue('marca', dados.marca);
      setDadosExtraidosVeiculo(prev => ({ ...prev, marca: { value: dados.marca, fonte } }));
    }
    if (dados.modelo && !form.getValues('modelo')) {
      form.setValue('modelo', dados.modelo);
      setDadosExtraidosVeiculo(prev => ({ ...prev, modelo: { value: dados.modelo, fonte } }));
    }
    if (dados.ano_fabricacao) {
      form.setValue('ano_fabricacao', parseInt(dados.ano_fabricacao));
      setDadosExtraidosVeiculo(prev => ({ ...prev, ano_fabricacao: { value: dados.ano_fabricacao, fonte } }));
    }
    if (dados.ano_modelo) {
      form.setValue('ano_modelo', parseInt(dados.ano_modelo));
      setDadosExtraidosVeiculo(prev => ({ ...prev, ano_modelo: { value: dados.ano_modelo, fonte } }));
    }
    if (dados.cor) {
      form.setValue('cor', dados.cor);
      setDadosExtraidosVeiculo(prev => ({ ...prev, cor: { value: dados.cor, fonte } }));
    }
    if (dados.renavam) {
      form.setValue('renavam', dados.renavam);
      setDadosExtraidosVeiculo(prev => ({ ...prev, renavam: { value: dados.renavam, fonte } }));
    }
    if (dados.chassi) {
      form.setValue('chassi', dados.chassi);
      setDadosExtraidosVeiculo(prev => ({ ...prev, chassi: { value: dados.chassi, fonte } }));
    }
  };

  // Verificar documentos
  const hasDocsAssociado = docsAssociado.some(d => d.status === 'success');
  const hasDocsVeiculo = docsVeiculo.some(d => d.status === 'success');

  const handleNext = async () => {
    if (step === 2) {
      const result = await form.trigger(['nome', 'cpf', 'email', 'telefone']);
      if (!result) return;
    } else if (step === 3) {
      const result = await form.trigger(['placa', 'marca', 'modelo', 'ano_fabricacao']);
      if (!result) return;
    }
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const onSubmit = async (data: WizardFormData) => {
    if (!cotacao) return;
    
    setIsSubmitting(true);
    try {
      // 1. Criar associado
      const associado = await createAssociado.mutateAsync({
        nome: data.nome,
        cpf: data.cpf,
        rg: data.rg || null,
        email: data.email,
        telefone: data.telefone,
        cep: data.cep || null,
        logradouro: data.logradouro || null,
        numero: data.numero || null,
        bairro: data.bairro || null,
        cidade: data.cidade || null,
        uf: data.uf || null,
        status: 'em_analise',
        plano_id: cotacao.plano_id,
      });

      // 2. Criar veículo
      await createVeiculo.mutateAsync({
        associado_id: associado.id,
        placa: data.placa,
        marca: data.marca,
        modelo: data.modelo,
        ano_fabricacao: data.ano_fabricacao,
        ano_modelo: data.ano_modelo,
        cor: data.cor || null,
        combustivel: data.combustivel || null,
        chassi: data.chassi || null,
        renavam: data.renavam || null,
        valor_fipe: data.valor_fipe || null,
      });

      // 3. Criar contrato
      await createContrato.mutateAsync({
        cotacao_id: cotacao.id,
        plano_id: cotacao.plano_id,
        associado_id: associado.id,
        valor_adesao: cotacao.valor_adesao,
        valor_mensal: cotacao.valor_total_mensal,
        data_inicio: new Date().toISOString().split('T')[0],
        status: 'pendente',
      });

      // 4. Atualizar status da cotação
      await updateCotacao.mutateAsync({ id: cotacao.id, status: 'aceita' });

      // 5. Atualizar lead se existir
      if (cotacao.lead_id) {
        await updateLead.mutateAsync({ id: cotacao.lead_id, etapa: 'ganho' });
      }

      toast.success('Contrato criado com sucesso!');
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao criar contrato');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Componente para exibir dado extraído
  const DadoExtraido = ({ label, campo, dados }: { label: string; campo: string; dados: Record<string, { value: string; fonte: string }> }) => {
    const dado = dados[campo];
    if (!dado) return null;
    return (
      <div className="flex items-center gap-2 text-sm py-1">
        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
        <span className="text-muted-foreground">{label}:</span>
        <span className="font-medium">{dado.value}</span>
        <Badge variant="outline" className="text-xs">via {dado.fonte}</Badge>
      </div>
    );
  };

  // Componente para campo faltante
  const CampoFaltante = ({ name, label, placeholder, children }: { name: keyof WizardFormData; label: string; placeholder?: string; children?: React.ReactNode }) => {
    return (
      <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              {label}
              <span className="text-xs text-muted-foreground">(não detectado)</span>
            </FormLabel>
            <FormControl>
              {children || <Input placeholder={placeholder} {...field} value={field.value?.toString() || ''} />}
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Contrato</DialogTitle>
          <DialogDescription>
            Finalize o contrato a partir da cotação aceita
          </DialogDescription>
        </DialogHeader>

        {/* Steps indicator */}
        <div className="flex items-center justify-between mb-6">
          {steps.map((s, index) => (
            <div key={s.id} className="flex items-center">
              <div className={cn(
                "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
                step >= s.id 
                  ? "border-primary bg-primary text-primary-foreground" 
                  : "border-muted-foreground/30 text-muted-foreground"
              )}>
                {step > s.id ? <Check className="h-5 w-5" /> : <s.icon className="h-5 w-5" />}
              </div>
              <span className={cn(
                "ml-2 text-sm font-medium hidden sm:block",
                step >= s.id ? "text-foreground" : "text-muted-foreground"
              )}>
                {s.title}
              </span>
              {index < steps.length - 1 && (
                <div className={cn(
                  "w-8 sm:w-16 h-0.5 mx-2",
                  step > s.id ? "bg-primary" : "bg-muted-foreground/30"
                )} />
              )}
            </div>
          ))}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Step 1: Cotação */}
            {step === 1 && cotacao && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Resumo da Cotação</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Número:</span>
                      <p className="font-mono">{cotacao.numero}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cliente:</span>
                      <p>{cotacao.leads?.nome || 'Não informado'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Plano:</span>
                      <p>{cotacao.planos?.nome}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Valor FIPE:</span>
                      <p>{formatCurrency(cotacao.valor_fipe)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Mensal:</span>
                      <p className="font-medium text-primary">{formatCurrency(cotacao.valor_total_mensal)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Adesão:</span>
                      <p>{formatCurrency(cotacao.valor_adesao)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Associado - Upload de Documentos */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Documentos do Associado
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Faça upload dos documentos pessoais. A IA irá extrair os dados automaticamente.
                  </p>
                </div>

                <DocumentUploader
                  cotacaoId={cotacaoId}
                  onDocumentsChange={handleDocsAssociadoChange}
                  onOcrDataExtracted={handleOcrAssociado}
                  tiposPermitidos={['cnh', 'rg', 'comprovante_residencia']}
                />

                {/* Dados extraídos pela IA */}
                {Object.keys(dadosExtraidosAssociado).length > 0 && (
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="font-medium text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Dados Extraídos pela IA
                    </h4>
                    <div className="space-y-1">
                      <DadoExtraido label="Nome" campo="nome" dados={dadosExtraidosAssociado} />
                      <DadoExtraido label="CPF" campo="cpf" dados={dadosExtraidosAssociado} />
                      <DadoExtraido label="RG" campo="rg" dados={dadosExtraidosAssociado} />
                      <DadoExtraido label="Logradouro" campo="logradouro" dados={dadosExtraidosAssociado} />
                      <DadoExtraido label="Bairro" campo="bairro" dados={dadosExtraidosAssociado} />
                      <DadoExtraido label="Cidade" campo="cidade" dados={dadosExtraidosAssociado} />
                      <DadoExtraido label="UF" campo="uf" dados={dadosExtraidosAssociado} />
                      <DadoExtraido label="CEP" campo="cep" dados={dadosExtraidosAssociado} />
                    </div>
                  </div>
                )}

                {/* Campos faltantes - aparecem após upload */}
                {hasDocsAssociado && (
                  <div className="space-y-4 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <h4 className="font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Complete os dados não detectados
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      {!dadosExtraidosAssociado.nome && (
                        <CampoFaltante name="nome" label="Nome Completo" placeholder="Digite o nome completo" />
                      )}
                      {!dadosExtraidosAssociado.cpf && (
                        <FormField
                          control={form.control}
                          name="cpf"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                                CPF <span className="text-xs text-muted-foreground">(não detectado)</span>
                              </FormLabel>
                              <FormControl>
                                <CpfInput value={field.value} onChange={field.onChange} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      {!dadosExtraidosAssociado.email && (
                        <CampoFaltante name="email" label="E-mail" placeholder="email@exemplo.com" />
                      )}
                      {!dadosExtraidosAssociado.telefone && (
                        <FormField
                          control={form.control}
                          name="telefone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                                Telefone <span className="text-xs text-muted-foreground">(não detectado)</span>
                              </FormLabel>
                              <FormControl>
                                <TelefoneInput value={field.value} onChange={field.onChange} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      {!dadosExtraidosAssociado.cep && (
                        <FormField
                          control={form.control}
                          name="cep"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                                CEP <span className="text-xs text-muted-foreground">(não detectado)</span>
                              </FormLabel>
                              <FormControl>
                                <CepInput value={field.value || ''} onChange={field.onChange} onCepComplete={fetchCep} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      {!dadosExtraidosAssociado.logradouro && (
                        <CampoFaltante name="logradouro" label="Logradouro" placeholder="Rua, Avenida..." />
                      )}
                      {!dadosExtraidosAssociado.numero && (
                        <CampoFaltante name="numero" label="Número" placeholder="123" />
                      )}
                      {!dadosExtraidosAssociado.bairro && (
                        <CampoFaltante name="bairro" label="Bairro" placeholder="Bairro" />
                      )}
                      {!dadosExtraidosAssociado.cidade && (
                        <CampoFaltante name="cidade" label="Cidade" placeholder="Cidade" />
                      )}
                      {!dadosExtraidosAssociado.uf && (
                        <CampoFaltante name="uf" label="UF" placeholder="SP" />
                      )}
                    </div>
                  </div>
                )}

                {!hasDocsAssociado && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Faça upload de pelo menos um documento pessoal (CNH ou RG) para continuar.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Veículo - Upload de Documentos */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Documento do Veículo
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Faça upload do CRLV. A IA irá extrair os dados do veículo automaticamente.
                  </p>
                </div>

                <DocumentUploader
                  cotacaoId={cotacaoId}
                  onDocumentsChange={handleDocsVeiculoChange}
                  onOcrDataExtracted={handleOcrVeiculo}
                  tiposPermitidos={['crlv']}
                />

                {/* Dados extraídos pela IA */}
                {Object.keys(dadosExtraidosVeiculo).length > 0 && (
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="font-medium text-green-700 dark:text-green-400 mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Dados Extraídos pela IA
                    </h4>
                    <div className="space-y-1">
                      <DadoExtraido label="Placa" campo="placa" dados={dadosExtraidosVeiculo} />
                      <DadoExtraido label="Marca" campo="marca" dados={dadosExtraidosVeiculo} />
                      <DadoExtraido label="Modelo" campo="modelo" dados={dadosExtraidosVeiculo} />
                      <DadoExtraido label="Ano" campo="ano_fabricacao" dados={dadosExtraidosVeiculo} />
                      <DadoExtraido label="Cor" campo="cor" dados={dadosExtraidosVeiculo} />
                      <DadoExtraido label="Renavam" campo="renavam" dados={dadosExtraidosVeiculo} />
                      <DadoExtraido label="Chassi" campo="chassi" dados={dadosExtraidosVeiculo} />
                    </div>
                  </div>
                )}

                {/* Campos faltantes - aparecem após upload */}
                {hasDocsVeiculo && (
                  <div className="space-y-4 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <h4 className="font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Complete os dados não detectados
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      {!dadosExtraidosVeiculo.placa && (
                        <FormField
                          control={form.control}
                          name="placa"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                                Placa <span className="text-xs text-muted-foreground">(não detectado)</span>
                              </FormLabel>
                              <FormControl>
                                <PlacaInput value={field.value} onChange={field.onChange} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      {!dadosExtraidosVeiculo.marca && (
                        <CampoFaltante name="marca" label="Marca" placeholder="Toyota" />
                      )}
                      {!dadosExtraidosVeiculo.modelo && (
                        <CampoFaltante name="modelo" label="Modelo" placeholder="Corolla XEi" />
                      )}
                      {!dadosExtraidosVeiculo.ano_fabricacao && (
                        <CampoFaltante name="ano_fabricacao" label="Ano Fabricação" placeholder="2023" />
                      )}
                      {!dadosExtraidosVeiculo.ano_modelo && (
                        <CampoFaltante name="ano_modelo" label="Ano Modelo" placeholder="2024" />
                      )}
                      {!dadosExtraidosVeiculo.cor && (
                        <CampoFaltante name="cor" label="Cor" placeholder="Prata" />
                      )}
                      {!dadosExtraidosVeiculo.renavam && (
                        <CampoFaltante name="renavam" label="Renavam" placeholder="00000000000" />
                      )}
                      {!dadosExtraidosVeiculo.chassi && (
                        <CampoFaltante name="chassi" label="Chassi" placeholder="9BRXXXXXXXXXXXXXXXX" />
                      )}
                    </div>
                  </div>
                )}

                {!hasDocsVeiculo && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Faça upload do CRLV para continuar.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Confirmação */}
            {step === 4 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">Confirmação dos Dados</h3>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Dados do Associado
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{form.getValues('nome')}</span></div>
                    <div><span className="text-muted-foreground">CPF:</span> <span className="font-medium">{form.getValues('cpf')}</span></div>
                    <div><span className="text-muted-foreground">E-mail:</span> <span className="font-medium">{form.getValues('email')}</span></div>
                    <div><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{form.getValues('telefone')}</span></div>
                    {form.getValues('logradouro') && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Endereço:</span>{' '}
                        <span className="font-medium">
                          {[form.getValues('logradouro'), form.getValues('numero'), form.getValues('bairro'), form.getValues('cidade'), form.getValues('uf')].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    Dados do Veículo
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Placa:</span> <span className="font-medium">{form.getValues('placa')}</span></div>
                    <div><span className="text-muted-foreground">Marca/Modelo:</span> <span className="font-medium">{form.getValues('marca')} {form.getValues('modelo')}</span></div>
                    <div><span className="text-muted-foreground">Ano:</span> <span className="font-medium">{form.getValues('ano_fabricacao')}/{form.getValues('ano_modelo')}</span></div>
                    {form.getValues('cor') && <div><span className="text-muted-foreground">Cor:</span> <span className="font-medium">{form.getValues('cor')}</span></div>}
                    {form.getValues('renavam') && <div><span className="text-muted-foreground">Renavam:</span> <span className="font-medium">{form.getValues('renavam')}</span></div>}
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Documentos Anexados
                  </h4>
                  <div className="space-y-2">
                    {[...docsAssociado, ...docsVeiculo].filter(d => d.status === 'success').map((doc, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>{doc.tipo === 'cnh' ? 'CNH' : doc.tipo === 'rg' ? 'RG' : doc.tipo === 'comprovante_residencia' ? 'Comprovante' : 'CRLV'}</span>
                        <span className="text-muted-foreground">- {doc.arquivo_nome}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-primary/10 rounded-lg">
                  <h4 className="font-medium mb-3">Resumo Financeiro</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Plano:</span> <span className="font-medium">{cotacao?.planos?.nome}</span></div>
                    <div><span className="text-muted-foreground">Adesão:</span> <span className="font-medium">{formatCurrency(cotacao?.valor_adesao || 0)}</span></div>
                    <div><span className="text-muted-foreground">Mensalidade:</span> <span className="font-medium">{formatCurrency(cotacao?.valor_total_mensal || 0)}</span></div>
                  </div>
                </div>
              </div>
            )}

            {/* Botões de navegação */}
            <div className="flex justify-between pt-4 border-t">
              <Button type="button" variant="outline" onClick={handleBack} disabled={step === 1}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>

              {step < 4 ? (
                <Button 
                  type="button" 
                  onClick={handleNext}
                  disabled={(step === 2 && !hasDocsAssociado) || (step === 3 && !hasDocsVeiculo)}
                >
                  Próximo
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Criar Contrato
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
