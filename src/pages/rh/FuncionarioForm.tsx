import { ArrowLeft, User, Phone, Briefcase, Wallet, FileText, Save, Building, Users, ChevronsUpDown, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useForm, Controller } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { CpfInput, TelefoneInput, CepInput, CurrencyInput } from '@/components/inputs/MaskedInputs';
import { buscarCep } from '@/lib/cep';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface FormData {
  nome_completo: string;
  cpf: string;
  rg: string;
  rg_orgao: string;
  data_nascimento: string;
  sexo: string;
  estado_civil: string;
  nacionalidade: string;
  naturalidade: string;
  email_pessoal: string;
  telefone: string;
  celular: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  matricula: string;
  cargo_id: string;
  departamento_id: string;
  gestor_id: string;
  tipo_contrato: string;
  data_admissao: string;
  periodo_experiencia: string;
  carga_horaria_semanal: number;
  horario_entrada: string;
  horario_saida: string;
  intervalo_minutos: number;
  salario_atual: number;
  banco: string;
  agencia: string;
  conta: string;
  tipo_conta: string;
  pix_chave: string;
  pix_tipo: string;
  ctps_numero: string;
  ctps_serie: string;
  ctps_uf: string;
  pis: string;
  titulo_eleitor: string;
  zona_eleitoral: string;
  secao_eleitoral: string;
  certificado_reservista: string;
  cnh: string;
  cnh_categoria: string;
  cnh_validade: string;
}

const estadosCivis = [
  { value: 'solteiro', label: 'Solteiro(a)' },
  { value: 'casado', label: 'Casado(a)' },
  { value: 'divorciado', label: 'Divorciado(a)' },
  { value: 'viuvo', label: 'Viúvo(a)' },
  { value: 'uniao_estavel', label: 'União Estável' },
];

const tiposContrato = [
  { value: 'clt', label: 'CLT' },
  { value: 'pj', label: 'PJ' },
  { value: 'estagio', label: 'Estágio' },
  { value: 'temporario', label: 'Temporário' },
  { value: 'autonomo', label: 'Autônomo' },
];

const tiposPix = [
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'email', label: 'E-mail' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'aleatoria', label: 'Chave Aleatória' },
];

const categoriasCNH = ['A', 'B', 'AB', 'C', 'D', 'E', 'AC', 'AD', 'AE'];

const estados = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export default function FuncionarioForm() {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [gestorOpen, setGestorOpen] = useState(false);

  const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      nome_completo: '',
      cpf: '',
      rg: '',
      rg_orgao: '',
      data_nascimento: '',
      sexo: '',
      estado_civil: '',
      nacionalidade: 'Brasileira',
      naturalidade: '',
      email_pessoal: '',
      telefone: '',
      celular: '',
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
      matricula: '',
      cargo_id: '',
      departamento_id: '',
      gestor_id: '',
      tipo_contrato: 'clt',
      data_admissao: '',
      periodo_experiencia: '',
      carga_horaria_semanal: 44,
      horario_entrada: '08:00',
      horario_saida: '18:00',
      intervalo_minutos: 60,
      salario_atual: 0,
      banco: '',
      agencia: '',
      conta: '',
      tipo_conta: 'corrente',
      pix_chave: '',
      pix_tipo: '',
      ctps_numero: '',
      ctps_serie: '',
      ctps_uf: '',
      pis: '',
      titulo_eleitor: '',
      zona_eleitoral: '',
      secao_eleitoral: '',
      certificado_reservista: '',
      cnh: '',
      cnh_categoria: '',
      cnh_validade: '',
    }
  });

  const gestorId = watch('gestor_id');

  const { data: funcionario, isLoading: isLoadingFuncionario } = useQuery({
    queryKey: ['funcionario-edit', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('funcionarios').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    enabled: isEditing
  });

  const { data: cargos } = useQuery({
    queryKey: ['cargos-select'],
    queryFn: async () => {
      const { data } = await supabase.from('cargos').select('id, nome').eq('ativo', true).order('nome');
      return data || [];
    }
  });

  const { data: departamentos } = useQuery({
    queryKey: ['departamentos-select'],
    queryFn: async () => {
      const { data } = await supabase.from('departamentos').select('id, nome').eq('ativo', true).order('nome');
      return data || [];
    }
  });

  const { data: gestores } = useQuery({
    queryKey: ['funcionarios-gestores'],
    queryFn: async () => {
      const { data } = await supabase
        .from('funcionarios')
        .select('id, nome_completo')
        .eq('status', 'ativo')
        .order('nome_completo');
      return data || [];
    }
  });

  useEffect(() => {
    if (funcionario) {
      reset({
        nome_completo: funcionario.nome_completo || '',
        cpf: funcionario.cpf || '',
        rg: funcionario.rg || '',
        rg_orgao: funcionario.rg_orgao || '',
        data_nascimento: funcionario.data_nascimento || '',
        sexo: funcionario.sexo || '',
        estado_civil: funcionario.estado_civil || '',
        nacionalidade: funcionario.nacionalidade || 'Brasileira',
        naturalidade: funcionario.naturalidade || '',
        email_pessoal: funcionario.email_pessoal || '',
        telefone: funcionario.telefone || '',
        celular: funcionario.celular || '',
        cep: funcionario.cep || '',
        logradouro: funcionario.logradouro || '',
        numero: funcionario.numero || '',
        complemento: funcionario.complemento || '',
        bairro: funcionario.bairro || '',
        cidade: funcionario.cidade || '',
        estado: funcionario.estado || '',
        matricula: funcionario.matricula || '',
        cargo_id: funcionario.cargo_id || '',
        departamento_id: funcionario.departamento_id || '',
        gestor_id: funcionario.gestor_id || '',
        tipo_contrato: funcionario.tipo_contrato || 'clt',
        data_admissao: funcionario.data_admissao || '',
        periodo_experiencia: (funcionario as Record<string, unknown>).periodo_experiencia as string || '',
        carga_horaria_semanal: funcionario.carga_horaria_semanal || 44,
        horario_entrada: funcionario.horario_entrada || '08:00',
        horario_saida: funcionario.horario_saida || '18:00',
        intervalo_minutos: funcionario.intervalo_minutos || 60,
        salario_atual: funcionario.salario_atual || 0,
        banco: funcionario.banco || '',
        agencia: funcionario.agencia || '',
        conta: funcionario.conta || '',
        tipo_conta: funcionario.tipo_conta || 'corrente',
        pix_chave: funcionario.pix_chave || '',
        pix_tipo: funcionario.pix_tipo || '',
        ctps_numero: funcionario.ctps_numero || '',
        ctps_serie: funcionario.ctps_serie || '',
        ctps_uf: funcionario.ctps_uf || '',
        pis: funcionario.pis || '',
        titulo_eleitor: funcionario.titulo_eleitor || '',
        zona_eleitoral: funcionario.zona_eleitoral || '',
        secao_eleitoral: funcionario.secao_eleitoral || '',
        certificado_reservista: funcionario.certificado_reservista || '',
        cnh: funcionario.cnh || '',
        cnh_categoria: funcionario.cnh_categoria || '',
        cnh_validade: funcionario.cnh_validade || '',
      });
    }
  }, [funcionario, reset]);

  const handleCepComplete = async (cep: string) => {
    const endereco = await buscarCep(cep);
    if (endereco) {
      setValue('logradouro', endereco.logradouro);
      setValue('bairro', endereco.bairro);
      setValue('cidade', endereco.cidade);
      setValue('estado', endereco.uf);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const payload = {
        ...formData,
        carga_horaria_semanal: Number(formData.carga_horaria_semanal),
        intervalo_minutos: Number(formData.intervalo_minutos),
        salario_atual: Number(formData.salario_atual),
        cargo_id: formData.cargo_id || null,
        departamento_id: formData.departamento_id || null,
        gestor_id: formData.gestor_id || null,
      };

      if (isEditing) {
        const { data, error } = await supabase
          .from('funcionarios')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('funcionarios')
          .insert({ ...payload, status: 'ativo' })
          .select()
          .single();
        if (error) throw error;

        // Criar registro de admissão no histórico
        await supabase.from('funcionarios_historico').insert({
          funcionario_id: data.id,
          tipo: 'admissao',
          cargo_novo_id: formData.cargo_id || null,
          departamento_novo_id: formData.departamento_id || null,
          salario_novo: Number(formData.salario_atual),
          data_vigencia: formData.data_admissao,
          motivo: 'Admissão do funcionário'
        });

        return data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
      toast.success(isEditing ? 'Funcionário atualizado!' : 'Funcionário cadastrado!');
      navigate(`/rh/funcionarios/${data.id}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao salvar funcionário');
    }
  });

  const onSubmit = (data: FormData) => {
    saveMutation.mutate(data);
  };

  const selectedGestor = gestores?.find(g => g.id === gestorId);

  if (isEditing && isLoadingFuncionario) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">
          {isEditing ? 'Editar Funcionário' : 'Novo Funcionário'}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Tabs defaultValue="pessoais" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="pessoais" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Dados Pessoais</span>
            </TabsTrigger>
            <TabsTrigger value="contato" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">Contato</span>
            </TabsTrigger>
            <TabsTrigger value="profissional" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Profissional</span>
            </TabsTrigger>
            <TabsTrigger value="remuneracao" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Remuneração</span>
            </TabsTrigger>
            <TabsTrigger value="documentos" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Documentos</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab Dados Pessoais */}
          <TabsContent value="pessoais">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Dados Pessoais
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-2">
                  <Label htmlFor="nome_completo">Nome Completo *</Label>
                  <Controller
                    name="nome_completo"
                    control={control}
                    rules={{ required: 'Nome é obrigatório' }}
                    render={({ field }) => (
                      <Input id="nome_completo" placeholder="Nome completo" {...field} />
                    )}
                  />
                  {errors.nome_completo && (
                    <span className="text-sm text-destructive">{errors.nome_completo.message}</span>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF *</Label>
                  <Controller
                    name="cpf"
                    control={control}
                    rules={{ required: 'CPF é obrigatório' }}
                    render={({ field }) => (
                      <CpfInput id="cpf" value={field.value} onChange={field.onChange} />
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rg">RG</Label>
                  <Controller
                    name="rg"
                    control={control}
                    render={({ field }) => (
                      <Input id="rg" placeholder="RG" {...field} />
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rg_orgao">Órgão Emissor</Label>
                  <Controller
                    name="rg_orgao"
                    control={control}
                    render={({ field }) => (
                      <Input id="rg_orgao" placeholder="SSP/SP" {...field} />
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                  <Controller
                    name="data_nascimento"
                    control={control}
                    render={({ field }) => (
                      <Input id="data_nascimento" type="date" {...field} />
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sexo">Sexo</Label>
                  <Controller
                    name="sexo"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">Masculino</SelectItem>
                          <SelectItem value="F">Feminino</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estado_civil">Estado Civil</Label>
                  <Controller
                    name="estado_civil"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {estadosCivis.map((ec) => (
                            <SelectItem key={ec.value} value={ec.value}>{ec.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nacionalidade">Nacionalidade</Label>
                  <Controller
                    name="nacionalidade"
                    control={control}
                    render={({ field }) => (
                      <Input id="nacionalidade" placeholder="Brasileira" {...field} />
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="naturalidade">Naturalidade</Label>
                  <Controller
                    name="naturalidade"
                    control={control}
                    render={({ field }) => (
                      <Input id="naturalidade" placeholder="Cidade/UF" {...field} />
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Contato e Endereço */}
          <TabsContent value="contato">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  Contato e Endereço
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email_pessoal">E-mail Pessoal</Label>
                    <Controller
                      name="email_pessoal"
                      control={control}
                      render={({ field }) => (
                        <Input id="email_pessoal" type="email" placeholder="email@exemplo.com" {...field} />
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Controller
                      name="telefone"
                      control={control}
                      render={({ field }) => (
                        <TelefoneInput id="telefone" value={field.value} onChange={field.onChange} />
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="celular">Celular (WhatsApp)</Label>
                    <Controller
                      name="celular"
                      control={control}
                      render={({ field }) => (
                        <TelefoneInput id="celular" value={field.value} onChange={field.onChange} />
                      )}
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-4">Endereço</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cep">CEP</Label>
                      <Controller
                        name="cep"
                        control={control}
                        render={({ field }) => (
                          <CepInput
                            id="cep"
                            value={field.value}
                            onChange={field.onChange}
                            onCepComplete={handleCepComplete}
                          />
                        )}
                      />
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="logradouro">Logradouro</Label>
                      <Controller
                        name="logradouro"
                        control={control}
                        render={({ field }) => (
                          <Input id="logradouro" placeholder="Rua, Avenida..." {...field} />
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="numero">Número</Label>
                      <Controller
                        name="numero"
                        control={control}
                        render={({ field }) => (
                          <Input id="numero" placeholder="123" {...field} />
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="complemento">Complemento</Label>
                      <Controller
                        name="complemento"
                        control={control}
                        render={({ field }) => (
                          <Input id="complemento" placeholder="Apto, Sala..." {...field} />
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bairro">Bairro</Label>
                      <Controller
                        name="bairro"
                        control={control}
                        render={({ field }) => (
                          <Input id="bairro" placeholder="Bairro" {...field} />
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cidade">Cidade</Label>
                      <Controller
                        name="cidade"
                        control={control}
                        render={({ field }) => (
                          <Input id="cidade" placeholder="Cidade" {...field} />
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="estado">Estado</Label>
                      <Controller
                        name="estado"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="UF" />
                            </SelectTrigger>
                            <SelectContent>
                              {estados.map((uf) => (
                                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Dados Profissionais */}
          <TabsContent value="profissional">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Dados Profissionais
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="matricula">Matrícula</Label>
                  <Controller
                    name="matricula"
                    control={control}
                    render={({ field }) => (
                      <Input id="matricula" placeholder="Auto-gerada se vazio" {...field} />
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cargo_id">Cargo</Label>
                  <Controller
                    name="cargo_id"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cargo" />
                        </SelectTrigger>
                        <SelectContent>
                          {cargos?.map((cargo) => (
                            <SelectItem key={cargo.id} value={cargo.id}>{cargo.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="departamento_id">Departamento</Label>
                  <Controller
                    name="departamento_id"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o departamento" />
                        </SelectTrigger>
                        <SelectContent>
                          {departamentos?.map((dep) => (
                            <SelectItem key={dep.id} value={dep.id}>{dep.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Gestor</Label>
                  <Popover open={gestorOpen} onOpenChange={setGestorOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal"
                      >
                        {selectedGestor?.nome_completo || "Selecione o gestor"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Buscar gestor..." />
                        <CommandList>
                          <CommandEmpty>Nenhum gestor encontrado.</CommandEmpty>
                          <CommandGroup>
                            {gestores?.map((gestor) => (
                              <CommandItem
                                key={gestor.id}
                                value={gestor.nome_completo}
                                onSelect={() => {
                                  setValue('gestor_id', gestor.id);
                                  setGestorOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    gestorId === gestor.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {gestor.nome_completo}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo_contrato">Tipo de Contrato</Label>
                  <Controller
                    name="tipo_contrato"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {tiposContrato.map((tc) => (
                            <SelectItem key={tc.value} value={tc.value}>{tc.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="data_admissao">Data de Admissão *</Label>
                  <Controller
                    name="data_admissao"
                    control={control}
                    rules={{ required: 'Data de admissão é obrigatória' }}
                    render={({ field }) => (
                      <Input id="data_admissao" type="date" {...field} />
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="periodo_experiencia">Período de Experiência</Label>
                  <Controller
                    name="periodo_experiencia"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="45">45 dias</SelectItem>
                          <SelectItem value="90">45 + 45 dias (90 dias)</SelectItem>
                          <SelectItem value="nao_aplicavel">Não aplicável</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="carga_horaria_semanal">Carga Horária Semanal</Label>
                  <Controller
                    name="carga_horaria_semanal"
                    control={control}
                    render={({ field }) => (
                      <Input id="carga_horaria_semanal" type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} />
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="horario_entrada">Horário de Entrada</Label>
                  <Controller
                    name="horario_entrada"
                    control={control}
                    render={({ field }) => (
                      <Input id="horario_entrada" type="time" {...field} />
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="horario_saida">Horário de Saída</Label>
                  <Controller
                    name="horario_saida"
                    control={control}
                    render={({ field }) => (
                      <Input id="horario_saida" type="time" {...field} />
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="intervalo_minutos">Intervalo (minutos)</Label>
                  <Controller
                    name="intervalo_minutos"
                    control={control}
                    render={({ field }) => (
                      <Input id="intervalo_minutos" type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} />
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Remuneração */}
          <TabsContent value="remuneracao">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Remuneração e Dados Bancários
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="salario_atual">Salário Atual</Label>
                    <Controller
                      name="salario_atual"
                      control={control}
                      render={({ field }) => (
                        <CurrencyInput
                          id="salario_atual"
                          value={field.value}
                          onChange={field.onChange}
                        />
                      )}
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-4">Dados Bancários</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="banco">Banco</Label>
                      <Controller
                        name="banco"
                        control={control}
                        render={({ field }) => (
                          <Input id="banco" placeholder="Nome do banco" {...field} />
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="agencia">Agência</Label>
                      <Controller
                        name="agencia"
                        control={control}
                        render={({ field }) => (
                          <Input id="agencia" placeholder="0000" {...field} />
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="conta">Conta</Label>
                      <Controller
                        name="conta"
                        control={control}
                        render={({ field }) => (
                          <Input id="conta" placeholder="00000-0" {...field} />
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tipo_conta">Tipo de Conta</Label>
                      <Controller
                        name="tipo_conta"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="corrente">Corrente</SelectItem>
                              <SelectItem value="poupanca">Poupança</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pix_tipo">Tipo de Chave PIX</Label>
                      <Controller
                        name="pix_tipo"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {tiposPix.map((tp) => (
                                <SelectItem key={tp.value} value={tp.value}>{tp.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pix_chave">Chave PIX</Label>
                      <Controller
                        name="pix_chave"
                        control={control}
                        render={({ field }) => (
                          <Input id="pix_chave" placeholder="Chave PIX" {...field} />
                        )}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Documentos Trabalhistas */}
          <TabsContent value="documentos">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Documentos Trabalhistas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium mb-4">CTPS</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ctps_numero">Número</Label>
                      <Controller
                        name="ctps_numero"
                        control={control}
                        render={({ field }) => (
                          <Input id="ctps_numero" placeholder="Número CTPS" {...field} />
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ctps_serie">Série</Label>
                      <Controller
                        name="ctps_serie"
                        control={control}
                        render={({ field }) => (
                          <Input id="ctps_serie" placeholder="Série" {...field} />
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ctps_uf">UF</Label>
                      <Controller
                        name="ctps_uf"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="UF" />
                            </SelectTrigger>
                            <SelectContent>
                              {estados.map((uf) => (
                                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-4">Outros Documentos</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pis">PIS/PASEP</Label>
                      <Controller
                        name="pis"
                        control={control}
                        render={({ field }) => (
                          <Input id="pis" placeholder="000.00000.00-0" {...field} />
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="titulo_eleitor">Título de Eleitor</Label>
                      <Controller
                        name="titulo_eleitor"
                        control={control}
                        render={({ field }) => (
                          <Input id="titulo_eleitor" placeholder="Número" {...field} />
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="zona_eleitoral">Zona</Label>
                        <Controller
                          name="zona_eleitoral"
                          control={control}
                          render={({ field }) => (
                            <Input id="zona_eleitoral" placeholder="000" {...field} />
                          )}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="secao_eleitoral">Seção</Label>
                        <Controller
                          name="secao_eleitoral"
                          control={control}
                          render={({ field }) => (
                            <Input id="secao_eleitoral" placeholder="0000" {...field} />
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="certificado_reservista">Certificado Reservista</Label>
                      <Controller
                        name="certificado_reservista"
                        control={control}
                        render={({ field }) => (
                          <Input id="certificado_reservista" placeholder="Número" {...field} />
                        )}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-4">CNH</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cnh">Número CNH</Label>
                      <Controller
                        name="cnh"
                        control={control}
                        render={({ field }) => (
                          <Input id="cnh" placeholder="00000000000" {...field} />
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cnh_categoria">Categoria</Label>
                      <Controller
                        name="cnh_categoria"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              {categoriasCNH.map((cat) => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cnh_validade">Validade</Label>
                      <Controller
                        name="cnh_validade"
                        control={control}
                        render={({ field }) => (
                          <Input id="cnh_validade" type="date" {...field} />
                        )}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex justify-end gap-4 pt-6">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? 'Salvando...' : (isEditing ? 'Atualizar' : 'Salvar')}
          </Button>
        </div>
      </form>
    </div>
  );
}
