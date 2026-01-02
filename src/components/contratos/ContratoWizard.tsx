import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Check, User, Car, FileText, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CpfInput, TelefoneInput, PlacaInput, CepInput, CurrencyInput } from '@/components/inputs/MaskedInputs';
import { associadoSchema, veiculoSchema } from '@/lib/validations';
import { useCotacao, useUpdateCotacao } from '@/hooks/useCotacoes';
import { useCreateContrato } from '@/hooks/useContratos';
import { useCreateAssociado } from '@/hooks/useAssociados';
import { useCreateVeiculo } from '@/hooks/useVeiculos';
import { useUpdateLead } from '@/hooks/useLeads';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const wizardSchema = z.object({
  // Associado
  nome: associadoSchema.shape.nome,
  cpf: associadoSchema.shape.cpf,
  rg: z.string().optional(),
  data_nascimento: z.string().optional(),
  sexo: z.enum(['M', 'F']).optional().nullable(),
  estado_civil: z.string().optional(),
  profissao: z.string().optional(),
  email: associadoSchema.shape.email,
  telefone: associadoSchema.shape.telefone,
  telefone_secundario: z.string().optional(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  // Veículo
  placa: veiculoSchema.shape.placa,
  marca: veiculoSchema.shape.marca,
  modelo: veiculoSchema.shape.modelo,
  ano_fabricacao: veiculoSchema.shape.ano_fabricacao,
  ano_modelo: veiculoSchema.shape.ano_modelo,
  cor: z.string().optional(),
  combustivel: z.string().optional(),
  chassi: z.string().optional(),
  renavam: z.string().optional(),
  codigo_fipe: z.string().optional(),
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
  
  const { data: cotacao } = useCotacao(cotacaoId);
  const createContrato = useCreateContrato();
  const createAssociado = useCreateAssociado();
  const createVeiculo = useCreateVeiculo();
  const updateCotacao = useUpdateCotacao();
  const updateLead = useUpdateLead();

  const form = useForm<WizardFormData>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      nome: '',
      cpf: '',
      email: '',
      telefone: '',
      placa: '',
      marca: '',
      modelo: '',
      ano_fabricacao: new Date().getFullYear(),
      ano_modelo: new Date().getFullYear(),
    },
  });

  // Pre-fill from cotacao/lead
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
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

  const onSubmit = async (data: WizardFormData) => {
    if (!cotacao) return;
    
    setIsSubmitting(true);
    try {
      // 1. Create associado
      const associado = await createAssociado.mutateAsync({
        nome: data.nome,
        cpf: data.cpf,
        rg: data.rg || null,
        data_nascimento: data.data_nascimento || null,
        sexo: data.sexo || null,
        estado_civil: data.estado_civil || null,
        profissao: data.profissao || null,
        email: data.email,
        telefone: data.telefone,
        telefone_secundario: data.telefone_secundario || null,
        cep: data.cep || null,
        logradouro: data.logradouro || null,
        numero: data.numero || null,
        complemento: data.complemento || null,
        bairro: data.bairro || null,
        cidade: data.cidade || null,
        uf: data.uf || null,
        status: 'em_analise',
        plano_id: cotacao.plano_id,
      });

      // 2. Create veículo
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
        codigo_fipe: data.codigo_fipe || null,
        valor_fipe: data.valor_fipe || null,
      });

      // 3. Create contrato
      await createContrato.mutateAsync({
        cotacao_id: cotacao.id,
        plano_id: cotacao.plano_id,
        associado_id: associado.id,
        valor_adesao: cotacao.valor_adesao,
        valor_mensal: cotacao.valor_total_mensal,
        data_inicio: new Date().toISOString().split('T')[0],
        status: 'pendente',
      });

      // 4. Update cotacao status
      await updateCotacao.mutateAsync({
        id: cotacao.id,
        status: 'aceita',
      });

      // 5. Update lead status if exists
      if (cotacao.lead_id) {
        await updateLead.mutateAsync({
          id: cotacao.lead_id,
          etapa: 'ganho',
        });
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

            {/* Step 2: Associado */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Nome Completo *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF *</FormLabel>
                        <FormControl>
                          <CpfInput value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="rg"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RG</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                        <FormLabel>E-mail *</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="telefone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone *</FormLabel>
                        <FormControl>
                          <TelefoneInput value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                            onCepComplete={fetchCep}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="logradouro"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Logradouro</FormLabel>
                        <FormControl>
                          <Input {...field} />
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
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bairro"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bairro</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cidade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="uf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>UF</FormLabel>
                        <FormControl>
                          <Input maxLength={2} className="uppercase" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Veículo */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="placa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Placa *</FormLabel>
                        <FormControl>
                          <PlacaInput value={field.value} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="renavam"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Renavam</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="marca"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Marca *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="modelo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Modelo *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ano_fabricacao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ano Fabricação *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ano_modelo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ano Modelo *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cor</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="chassi"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chassi</FormLabel>
                        <FormControl>
                          <Input className="uppercase" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="valor_fipe"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Valor FIPE</FormLabel>
                        <FormControl>
                          <CurrencyInput 
                            value={field.value ?? 0} 
                            onChange={field.onChange} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* Step 4: Confirmação */}
            {step === 4 && (
              <Card className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900">
                <CardContent className="p-6 text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="h-8 w-8 text-white" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold">Pronto para finalizar!</h3>
                  <p className="text-muted-foreground">
                    Revise os dados e clique em "Criar Contrato" para finalizar.
                  </p>
                  <div className="text-left bg-background rounded-lg p-4 space-y-2 text-sm">
                    <p><strong>Associado:</strong> {form.getValues('nome')}</p>
                    <p><strong>CPF:</strong> {form.getValues('cpf')}</p>
                    <p><strong>Veículo:</strong> {form.getValues('marca')} {form.getValues('modelo')} - {form.getValues('placa')}</p>
                    <p><strong>Valor Mensal:</strong> {cotacao && formatCurrency(cotacao.valor_total_mensal)}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              {step > 1 && (
                <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                  Voltar
                </Button>
              )}
              {step < 4 ? (
                <Button type="button" onClick={() => setStep(step + 1)}>
                  Próximo
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Contrato
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
