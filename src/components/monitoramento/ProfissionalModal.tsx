import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CpfInput, TelefoneInput, CepInput } from '@/components/inputs/MaskedInputs';
import { buscarCep } from '@/lib/cep';
import { validateCPF } from '@/lib/validations';
import { REGIOES_ATENDIMENTO } from '@/types/monitoramento';

// ============================================
// TIPOS
// ============================================

export type StatusProfissional = 'disponivel' | 'indisponivel';
export type FuncaoProfissional = 'vistoriador' | 'instalador';

export interface Profissional {
  id: string;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  whatsapp?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  regioes: string[];
  funcoes: FuncaoProfissional[];
  capacidadeDiaria: number;
  status: StatusProfissional;
  criarAcesso?: boolean;
}

export interface ProfissionalFormData {
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  whatsapp: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  regioes: string[];
  funcoes: FuncaoProfissional[];
  capacidadeDiaria: number;
  status: StatusProfissional;
  criarAcesso: boolean;
  senhaProvisoria: string;
}

interface ProfissionalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profissional?: Profissional | null;
  onSave: (data: ProfissionalFormData) => void;
}

// ============================================
// CONSTANTES
// ============================================

const ESTADOS_BRASIL = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
];

const FUNCOES_OPTIONS: { value: FuncaoProfissional; label: string }[] = [
  { value: 'vistoriador', label: 'Vistoriador' },
  { value: 'instalador', label: 'Instalador' },
];

// ============================================
// SCHEMA DE VALIDAÇÃO
// ============================================

const profissionalSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  cpf: z.string()
    .min(14, 'CPF inválido')
    .refine(val => validateCPF(val), 'CPF inválido'),
  email: z.string().email('Email inválido'),
  telefone: z.string().min(14, 'Telefone obrigatório'),
  whatsapp: z.string().optional().default(''),
  cep: z.string().min(9, 'CEP obrigatório'),
  logradouro: z.string().min(1, 'Logradouro obrigatório'),
  numero: z.string().min(1, 'Número obrigatório'),
  bairro: z.string().min(1, 'Bairro obrigatório'),
  cidade: z.string().min(1, 'Cidade obrigatória'),
  uf: z.string().length(2, 'Estado obrigatório'),
  regioes: z.array(z.string()).min(1, 'Selecione pelo menos uma região'),
  funcoes: z.array(z.string()).min(1, 'Selecione pelo menos uma função'),
  capacidadeDiaria: z.coerce.number().min(1, 'Mínimo 1').max(10, 'Máximo 10'),
  status: z.enum(['disponivel', 'indisponivel']),
  criarAcesso: z.boolean().default(false),
  senhaProvisoria: z.string().optional().default(''),
}).refine(
  data => !data.criarAcesso || (data.criarAcesso && data.senhaProvisoria && data.senhaProvisoria.length >= 6),
  { message: 'Senha deve ter pelo menos 6 caracteres', path: ['senhaProvisoria'] }
);

type FormSchema = z.infer<typeof profissionalSchema>;

// ============================================
// COMPONENTE
// ============================================

export function ProfissionalModal({ open, onOpenChange, profissional, onSave }: ProfissionalModalProps) {
  const [loadingCep, setLoadingCep] = useState(false);
  const isEditing = !!profissional;

  const defaultValues: FormSchema = {
    nome: '',
    cpf: '',
    email: '',
    telefone: '',
    whatsapp: '',
    cep: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: '',
    uf: '',
    regioes: [],
    funcoes: [],
    capacidadeDiaria: 5,
    status: 'disponivel',
    criarAcesso: false,
    senhaProvisoria: '',
  };

  const form = useForm<FormSchema>({
    resolver: zodResolver(profissionalSchema),
    defaultValues,
  });

  const criarAcesso = form.watch('criarAcesso');
  const regioesValue = form.watch('regioes');
  const funcoesValue = form.watch('funcoes');

  // Resetar form quando modal abre/fecha ou profissional muda
  useEffect(() => {
    if (open) {
      if (profissional) {
        form.reset({
          nome: profissional.nome,
          cpf: profissional.cpf,
          email: profissional.email,
          telefone: profissional.telefone,
          whatsapp: profissional.whatsapp || '',
          cep: profissional.cep || '',
          logradouro: profissional.logradouro || '',
          numero: profissional.numero || '',
          bairro: profissional.bairro || '',
          cidade: profissional.cidade || '',
          uf: profissional.uf || '',
          regioes: profissional.regioes || [],
          funcoes: profissional.funcoes || [],
          capacidadeDiaria: profissional.capacidadeDiaria || 5,
          status: profissional.status || 'disponivel',
          criarAcesso: false,
          senhaProvisoria: '',
        });
      } else {
        form.reset(defaultValues);
      }
    }
  }, [open, profissional, form]);

  const handleCepComplete = async (cep: string) => {
    setLoadingCep(true);
    const endereco = await buscarCep(cep);
    if (endereco) {
      form.setValue('logradouro', endereco.logradouro);
      form.setValue('bairro', endereco.bairro);
      form.setValue('cidade', endereco.cidade);
      form.setValue('uf', endereco.uf);
    }
    setLoadingCep(false);
  };

  const toggleRegiao = (value: string) => {
    const current = regioesValue || [];
    if (current.includes(value)) {
      form.setValue('regioes', current.filter(r => r !== value));
    } else {
      form.setValue('regioes', [...current, value]);
    }
  };

  const toggleFuncao = (value: FuncaoProfissional) => {
    const current = funcoesValue || [];
    if (current.includes(value)) {
      form.setValue('funcoes', current.filter(f => f !== value) as FuncaoProfissional[]);
    } else {
      form.setValue('funcoes', [...current, value] as FuncaoProfissional[]);
    }
  };

  const onSubmit = (data: FormSchema) => {
    onSave(data as ProfissionalFormData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Profissional' : 'Novo Profissional'}
          </DialogTitle>
          <DialogDescription>
            Preencha os dados do profissional
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Seção: Dados Pessoais */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Dados Pessoais
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome completo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Nome do profissional" {...field} />
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
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@exemplo.com" {...field} />
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
                  name="whatsapp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WhatsApp</FormLabel>
                      <FormControl>
                        <TelefoneInput value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Seção: Endereço Base */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Endereço Base (ponto de partida das rotas)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="cep"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <CepInput 
                            value={field.value} 
                            onChange={field.onChange}
                            onCepComplete={handleCepComplete}
                          />
                          {loadingCep && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="logradouro"
                  render={({ field }) => (
                    <FormItem className="md:col-span-3">
                      <FormLabel>Logradouro *</FormLabel>
                      <FormControl>
                        <Input placeholder="Rua, Avenida..." {...field} />
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
                      <FormLabel>Número *</FormLabel>
                      <FormControl>
                        <Input placeholder="123" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="bairro"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bairro *</FormLabel>
                      <FormControl>
                        <Input placeholder="Bairro" {...field} />
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
                      <FormLabel>Cidade *</FormLabel>
                      <FormControl>
                        <Input placeholder="Cidade" {...field} />
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
                      <FormLabel>Estado *</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ESTADOS_BRASIL.map((estado) => (
                            <SelectItem key={estado.value} value={estado.value}>
                              {estado.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Seção: Configurações de Trabalho */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Configurações de Trabalho
              </h3>
              
              {/* Regiões de atuação */}
              <FormField
                control={form.control}
                name="regioes"
                render={() => (
                  <FormItem>
                    <FormLabel>Regiões de atuação *</FormLabel>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                      {REGIOES_ATENDIMENTO.map((regiao) => (
                        <div
                          key={regiao.value}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`regiao-${regiao.value}`}
                            checked={regioesValue?.includes(regiao.value)}
                            onCheckedChange={() => toggleRegiao(regiao.value)}
                          />
                          <label
                            htmlFor={`regiao-${regiao.value}`}
                            className="text-sm cursor-pointer"
                          >
                            {regiao.label}
                          </label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Funções */}
              <FormField
                control={form.control}
                name="funcoes"
                render={() => (
                  <FormItem>
                    <FormLabel>Funções *</FormLabel>
                    <div className="flex gap-6 mt-2">
                      {FUNCOES_OPTIONS.map((funcao) => (
                        <div
                          key={funcao.value}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`funcao-${funcao.value}`}
                            checked={funcoesValue?.includes(funcao.value)}
                            onCheckedChange={() => toggleFuncao(funcao.value)}
                          />
                          <label
                            htmlFor={`funcao-${funcao.value}`}
                            className="text-sm cursor-pointer"
                          >
                            {funcao.label}
                          </label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="capacidadeDiaria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacidade diária</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          max={10}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 5)}
                        />
                      </FormControl>
                      <FormDescription>
                        Quantidade máxima de tarefas por dia (1-10)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status inicial</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="disponivel">Disponível</SelectItem>
                          <SelectItem value="indisponivel">Indisponível</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Seção: Acesso ao Sistema */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Acesso ao Sistema
              </h3>
              
              <FormField
                control={form.control}
                name="criarAcesso"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="cursor-pointer">
                        Criar acesso ao app mobile
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              {criarAcesso && (
                <FormField
                  control={form.control}
                  name="senhaProvisoria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha provisória *</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="Mínimo 6 caracteres" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        O profissional receberá as credenciais por email
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
