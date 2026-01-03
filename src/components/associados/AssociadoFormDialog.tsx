import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { CpfInput, TelefoneInput, PlacaInput, CepInput } from '@/components/inputs/MaskedInputs';
import { usePlanos } from '@/hooks/usePlanos';
import { useCreateAssociado } from '@/hooks/useAssociados';
import { useCreateVeiculo } from '@/hooks/useVeiculos';
import { buscarCep } from '@/lib/cep';
import { Loader2, ChevronLeft, ChevronRight, User, MapPin, Car, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO'
];

const COMBUSTIVEL_OPTIONS = [
  { value: 'gasolina', label: 'Gasolina' },
  { value: 'etanol', label: 'Etanol' },
  { value: 'flex', label: 'Flex' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'eletrico', label: 'Elétrico' },
  { value: 'hibrido', label: 'Híbrido' },
];

const PLATAFORMA_OPTIONS = [
  { value: 'uber', label: 'Uber' },
  { value: '99', label: '99' },
  { value: 'ifood', label: 'iFood' },
  { value: 'rappi', label: 'Rappi' },
  { value: 'outro', label: 'Outro' },
];

const formSchema = z.object({
  // Step 1 - Dados Pessoais
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  cpf: z.string().min(14, 'CPF inválido'),
  rg: z.string().optional(),
  data_nascimento: z.string().optional(),
  email: z.string().email('Email inválido'),
  telefone: z.string().min(14, 'Telefone inválido'),
  whatsapp: z.string().optional(),
  
  // Step 2 - Endereço
  cep: z.string().min(9, 'CEP inválido'),
  logradouro: z.string().min(1, 'Logradouro obrigatório'),
  numero: z.string().min(1, 'Número obrigatório'),
  complemento: z.string().optional(),
  bairro: z.string().min(1, 'Bairro obrigatório'),
  cidade: z.string().min(1, 'Cidade obrigatória'),
  uf: z.string().min(2, 'UF obrigatório'),
  
  // Step 3 - Veículo
  placa: z.string().min(7, 'Placa inválida'),
  marca: z.string().min(1, 'Marca obrigatória'),
  modelo: z.string().min(1, 'Modelo obrigatório'),
  ano_fabricacao: z.number().min(1900).max(new Date().getFullYear() + 1).optional(),
  ano_modelo: z.number().min(1900).max(new Date().getFullYear() + 1),
  cor: z.string().optional(),
  combustivel: z.string().optional(),
  renavam: z.string().optional(),
  chassi: z.string().optional(),
  uso_aplicativo: z.boolean().default(false),
  plataforma_app: z.string().optional(),
  
  // Step 4 - Plano
  plano_id: z.string().min(1, 'Plano obrigatório'),
  dia_vencimento: z.number().min(1).max(28),
  data_adesao: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AssociadoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const STEPS = [
  { id: 1, title: 'Dados Pessoais', icon: User },
  { id: 2, title: 'Endereço', icon: MapPin },
  { id: 3, title: 'Veículo', icon: Car },
  { id: 4, title: 'Plano', icon: FileText },
];

export function AssociadoFormDialog({ open, onOpenChange, onSuccess }: AssociadoFormDialogProps) {
  const [step, setStep] = useState(1);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const { toast } = useToast();
  const { data: planos } = usePlanos();
  const createAssociado = useCreateAssociado();
  const createVeiculo = useCreateVeiculo();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: '',
      cpf: '',
      rg: '',
      data_nascimento: '',
      email: '',
      telefone: '',
      whatsapp: '',
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      uf: '',
      placa: '',
      marca: '',
      modelo: '',
      ano_fabricacao: undefined,
      ano_modelo: new Date().getFullYear(),
      cor: '',
      combustivel: '',
      renavam: '',
      chassi: '',
      uso_aplicativo: false,
      plataforma_app: '',
      plano_id: '',
      dia_vencimento: 10,
      data_adesao: new Date().toISOString().split('T')[0],
    },
  });

  const { watch, setValue, trigger, formState: { errors } } = form;
  const usoAplicativo = watch('uso_aplicativo');

  const handleBuscarCep = async (cep: string) => {
    setBuscandoCep(true);
    try {
      const endereco = await buscarCep(cep);
      if (endereco) {
        setValue('logradouro', endereco.logradouro);
        setValue('bairro', endereco.bairro);
        setValue('cidade', endereco.cidade);
        setValue('uf', endereco.uf);
      }
    } finally {
      setBuscandoCep(false);
    }
  };

  const validateStep = async (currentStep: number): Promise<boolean> => {
    const fieldsToValidate: (keyof FormData)[][] = [
      ['nome', 'cpf', 'email', 'telefone'],
      ['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf'],
      ['placa', 'marca', 'modelo', 'ano_modelo'],
      ['plano_id', 'dia_vencimento'],
    ];
    
    return await trigger(fieldsToValidate[currentStep - 1]);
  };

  const handleNext = async () => {
    const isValid = await validateStep(step);
    if (isValid) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = async (data: FormData) => {
    try {
      // Create associado
      const associado = await createAssociado.mutateAsync({
        nome: data.nome,
        cpf: data.cpf,
        rg: data.rg || null,
        data_nascimento: data.data_nascimento || null,
        email: data.email,
        telefone: data.telefone,
        whatsapp: data.whatsapp || null,
        cep: data.cep,
        logradouro: data.logradouro,
        numero: data.numero,
        complemento: data.complemento || null,
        bairro: data.bairro,
        cidade: data.cidade,
        uf: data.uf,
        plano_id: data.plano_id,
        dia_vencimento: data.dia_vencimento,
        data_adesao: data.data_adesao || new Date().toISOString().split('T')[0],
        status: 'em_analise',
      });

      // Create veiculo
      await createVeiculo.mutateAsync({
        associado_id: associado.id,
        placa: data.placa.toUpperCase(),
        marca: data.marca,
        modelo: data.modelo,
        ano_fabricacao: data.ano_fabricacao || data.ano_modelo,
        ano_modelo: data.ano_modelo,
        cor: data.cor || null,
        combustivel: data.combustivel || null,
        renavam: data.renavam || null,
        chassi: data.chassi || null,
        uso_aplicativo: data.uso_aplicativo,
        plataforma_app: data.uso_aplicativo ? data.plataforma_app : null,
        status: 'em_analise',
      });

      toast({
        title: 'Associado cadastrado!',
        description: 'O associado foi criado e está aguardando análise.',
      });

      form.reset();
      setStep(1);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Erro ao cadastrar',
        description: error.message || 'Não foi possível criar o associado',
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    form.reset();
    setStep(1);
    onOpenChange(false);
  };

  const isLoading = createAssociado.isPending || createVeiculo.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Associado</DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((s, index) => {
            const Icon = s.icon;
            const isActive = s.id === step;
            const isCompleted = s.id < step;
            
            return (
              <div key={s.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors',
                      isActive && 'border-primary bg-primary text-primary-foreground',
                      isCompleted && 'border-primary bg-primary/10 text-primary',
                      !isActive && !isCompleted && 'border-muted-foreground/25 text-muted-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={cn(
                    'text-xs mt-1',
                    isActive ? 'text-primary font-medium' : 'text-muted-foreground'
                  )}>
                    {s.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={cn(
                    'h-0.5 w-8 mx-2',
                    isCompleted ? 'bg-primary' : 'bg-muted-foreground/25'
                  )} />
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Step 1 - Dados Pessoais */}
          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="nome">Nome completo *</Label>
                <Input
                  id="nome"
                  {...form.register('nome')}
                  placeholder="Nome completo do associado"
                />
                {errors.nome && <p className="text-sm text-destructive mt-1">{errors.nome.message}</p>}
              </div>
              
              <div>
                <Label htmlFor="cpf">CPF *</Label>
                <CpfInput
                  value={watch('cpf')}
                  onChange={(v) => setValue('cpf', v)}
                />
                {errors.cpf && <p className="text-sm text-destructive mt-1">{errors.cpf.message}</p>}
              </div>
              
              <div>
                <Label htmlFor="rg">RG</Label>
                <Input id="rg" {...form.register('rg')} placeholder="RG" />
              </div>
              
              <div>
                <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                <Input
                  id="data_nascimento"
                  type="date"
                  {...form.register('data_nascimento')}
                />
              </div>
              
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  {...form.register('email')}
                  placeholder="email@exemplo.com"
                />
                {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
              </div>
              
              <div>
                <Label htmlFor="telefone">Telefone *</Label>
                <TelefoneInput
                  value={watch('telefone')}
                  onChange={(v) => setValue('telefone', v)}
                />
                {errors.telefone && <p className="text-sm text-destructive mt-1">{errors.telefone.message}</p>}
              </div>
              
              <div>
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <TelefoneInput
                  value={watch('whatsapp') || ''}
                  onChange={(v) => setValue('whatsapp', v)}
                />
              </div>
            </div>
          )}

          {/* Step 2 - Endereço */}
          {step === 2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="cep">CEP *</Label>
                <CepInput
                  value={watch('cep')}
                  onChange={(v) => setValue('cep', v)}
                  onCepComplete={handleBuscarCep}
                  disabled={buscandoCep}
                />
                {buscandoCep && <p className="text-sm text-muted-foreground mt-1">Buscando...</p>}
                {errors.cep && <p className="text-sm text-destructive mt-1">{errors.cep.message}</p>}
              </div>
              
              <div className="sm:col-span-2">
                <Label htmlFor="logradouro">Logradouro *</Label>
                <Input id="logradouro" {...form.register('logradouro')} placeholder="Rua, Avenida..." />
                {errors.logradouro && <p className="text-sm text-destructive mt-1">{errors.logradouro.message}</p>}
              </div>
              
              <div>
                <Label htmlFor="numero">Número *</Label>
                <Input id="numero" {...form.register('numero')} placeholder="Número" />
                {errors.numero && <p className="text-sm text-destructive mt-1">{errors.numero.message}</p>}
              </div>
              
              <div>
                <Label htmlFor="complemento">Complemento</Label>
                <Input id="complemento" {...form.register('complemento')} placeholder="Apto, Bloco..." />
              </div>
              
              <div>
                <Label htmlFor="bairro">Bairro *</Label>
                <Input id="bairro" {...form.register('bairro')} placeholder="Bairro" />
                {errors.bairro && <p className="text-sm text-destructive mt-1">{errors.bairro.message}</p>}
              </div>
              
              <div>
                <Label htmlFor="cidade">Cidade *</Label>
                <Input id="cidade" {...form.register('cidade')} placeholder="Cidade" />
                {errors.cidade && <p className="text-sm text-destructive mt-1">{errors.cidade.message}</p>}
              </div>
              
              <div>
                <Label htmlFor="uf">Estado *</Label>
                <Select value={watch('uf')} onValueChange={(v) => setValue('uf', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {UF_OPTIONS.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.uf && <p className="text-sm text-destructive mt-1">{errors.uf.message}</p>}
              </div>
            </div>
          )}

          {/* Step 3 - Veículo */}
          {step === 3 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="placa">Placa *</Label>
                <PlacaInput
                  value={watch('placa')}
                  onChange={(v) => setValue('placa', v)}
                />
                {errors.placa && <p className="text-sm text-destructive mt-1">{errors.placa.message}</p>}
              </div>
              
              <div>
                <Label htmlFor="marca">Marca *</Label>
                <Input id="marca" {...form.register('marca')} placeholder="Ex: Chevrolet" />
                {errors.marca && <p className="text-sm text-destructive mt-1">{errors.marca.message}</p>}
              </div>
              
              <div>
                <Label htmlFor="modelo">Modelo *</Label>
                <Input id="modelo" {...form.register('modelo')} placeholder="Ex: Onix" />
                {errors.modelo && <p className="text-sm text-destructive mt-1">{errors.modelo.message}</p>}
              </div>
              
              <div>
                <Label htmlFor="ano_fabricacao">Ano Fabricação</Label>
                <Input
                  id="ano_fabricacao"
                  type="number"
                  {...form.register('ano_fabricacao', { valueAsNumber: true })}
                  placeholder="Ex: 2023"
                />
              </div>
              
              <div>
                <Label htmlFor="ano_modelo">Ano Modelo *</Label>
                <Input
                  id="ano_modelo"
                  type="number"
                  {...form.register('ano_modelo', { valueAsNumber: true })}
                  placeholder="Ex: 2024"
                />
                {errors.ano_modelo && <p className="text-sm text-destructive mt-1">{errors.ano_modelo.message}</p>}
              </div>
              
              <div>
                <Label htmlFor="cor">Cor</Label>
                <Input id="cor" {...form.register('cor')} placeholder="Ex: Prata" />
              </div>
              
              <div>
                <Label htmlFor="combustivel">Combustível</Label>
                <Select value={watch('combustivel') || ''} onValueChange={(v) => setValue('combustivel', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMBUSTIVEL_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="renavam">RENAVAM</Label>
                <Input id="renavam" {...form.register('renavam')} placeholder="RENAVAM" />
              </div>
              
              <div>
                <Label htmlFor="chassi">Chassi</Label>
                <Input id="chassi" {...form.register('chassi')} placeholder="Chassi" />
              </div>
              
              <div className="sm:col-span-2 flex items-center space-x-2">
                <Checkbox
                  id="uso_aplicativo"
                  checked={usoAplicativo}
                  onCheckedChange={(checked) => setValue('uso_aplicativo', !!checked)}
                />
                <Label htmlFor="uso_aplicativo" className="cursor-pointer">
                  Veículo usado para aplicativo (Uber, 99, etc.)
                </Label>
              </div>
              
              {usoAplicativo && (
                <div className="sm:col-span-2">
                  <Label htmlFor="plataforma_app">Plataforma</Label>
                  <Select value={watch('plataforma_app') || ''} onValueChange={(v) => setValue('plataforma_app', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a plataforma" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATAFORMA_OPTIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Step 4 - Plano */}
          {step === 4 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="plano_id">Plano *</Label>
                <Select value={watch('plano_id')} onValueChange={(v) => setValue('plano_id', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {planos?.map((plano) => (
                      <SelectItem key={plano.id} value={plano.id}>
                        {plano.nome} - {plano.codigo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.plano_id && <p className="text-sm text-destructive mt-1">{errors.plano_id.message}</p>}
              </div>
              
              <div>
                <Label htmlFor="dia_vencimento">Dia de Vencimento *</Label>
                <Select 
                  value={watch('dia_vencimento')?.toString()} 
                  onValueChange={(v) => setValue('dia_vencimento', parseInt(v))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((dia) => (
                      <SelectItem key={dia} value={dia.toString()}>
                        Dia {dia}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.dia_vencimento && <p className="text-sm text-destructive mt-1">{errors.dia_vencimento.message}</p>}
              </div>
              
              <div>
                <Label htmlFor="data_adesao">Data de Adesão</Label>
                <Input
                  id="data_adesao"
                  type="date"
                  {...form.register('data_adesao')}
                />
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-4 border-t">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={handleBack} disabled={isLoading}>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            ) : (
              <div />
            )}
            
            {step < 4 ? (
              <Button type="button" onClick={handleNext}>
                Próximo
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Associado
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
