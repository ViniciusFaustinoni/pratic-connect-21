import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ArrowLeft, Car, FileText, Loader2, User, MapPin, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { CpfInput, TelefoneInput, CepInput } from '@/components/inputs/MaskedInputs';
import { buscarCep } from '@/lib/cep';
import { useEffect } from 'react';

const cadastroComplementarSchema = z.object({
  // Dados pessoais
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  cpf: z.string().min(14, 'CPF inválido'),
  data_nascimento: z.string().min(1, 'Data de nascimento obrigatória'),
  rg: z.string().optional(),
  email: z.string().email('E-mail inválido'),
  telefone: z.string().min(14, 'Telefone inválido'),
  
  // Endereço
  cep: z.string().min(9, 'CEP inválido'),
  logradouro: z.string().min(1, 'Logradouro obrigatório'),
  numero: z.string().min(1, 'Número obrigatório'),
  complemento: z.string().optional(),
  bairro: z.string().min(1, 'Bairro obrigatório'),
  cidade: z.string().min(1, 'Cidade obrigatória'),
  estado: z.string().min(2, 'Estado obrigatório'),
  
  // Veículo
  chassi: z.string().length(17, 'Chassi deve ter 17 caracteres'),
  renavam: z.string().optional(),
  cor: z.string().optional(),
  combustivel: z.string().optional(),
});

type CadastroComplementarForm = z.infer<typeof cadastroComplementarSchema>;

const ESTADOS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const COMBUSTIVEIS = [
  { value: 'gasolina', label: 'Gasolina' },
  { value: 'alcool', label: 'Álcool' },
  { value: 'flex', label: 'Flex' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'eletrico', label: 'Elétrico' },
  { value: 'hibrido', label: 'Híbrido' },
];

export default function CadastroComplementar() {
  const { cotacaoId } = useParams<{ cotacaoId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const form = useForm<CadastroComplementarForm>({
    resolver: zodResolver(cadastroComplementarSchema),
    defaultValues: {
      nome: '',
      cpf: '',
      data_nascimento: '',
      rg: '',
      email: '',
      telefone: '',
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
      chassi: '',
      renavam: '',
      cor: '',
      combustivel: '',
    },
  });

  // Buscar cotação
  const { data: cotacao, isLoading: isLoadingCotacao } = useQuery({
    queryKey: ['cotacao', cotacaoId],
    queryFn: async () => {
      if (!cotacaoId) throw new Error('ID da cotação não informado');
      
      const { data, error } = await supabase
        .from('cotacoes')
        .select('*')
        .eq('id', cotacaoId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!cotacaoId,
  });

  // Preencher formulário com dados da cotação
  useEffect(() => {
    if (cotacao) {
      const dadosExtras = cotacao.dados_extras as Record<string, unknown> | null;
      
      // Dados extras se existirem
      if (dadosExtras) {
        const cliente = dadosExtras.cliente as Record<string, string> | undefined;
        const endereco = dadosExtras.endereco as Record<string, string> | undefined;
        const veiculoComp = dadosExtras.veiculo_complementar as Record<string, string> | undefined;
        
        if (cliente) {
          if (cliente.nome) form.setValue('nome', cliente.nome);
          if (cliente.cpf) form.setValue('cpf', cliente.cpf);
          if (cliente.email) form.setValue('email', cliente.email);
          if (cliente.telefone) form.setValue('telefone', cliente.telefone);
          if (cliente.data_nascimento) form.setValue('data_nascimento', cliente.data_nascimento);
          if (cliente.rg) form.setValue('rg', cliente.rg);
        }
        
        if (endereco) {
          if (endereco.cep) form.setValue('cep', endereco.cep);
          if (endereco.logradouro) form.setValue('logradouro', endereco.logradouro);
          if (endereco.numero) form.setValue('numero', endereco.numero);
          if (endereco.complemento) form.setValue('complemento', endereco.complemento);
          if (endereco.bairro) form.setValue('bairro', endereco.bairro);
          if (endereco.cidade) form.setValue('cidade', endereco.cidade);
          if (endereco.estado) form.setValue('estado', endereco.estado);
        }
        
        if (veiculoComp) {
          if (veiculoComp.chassi) form.setValue('chassi', veiculoComp.chassi);
          if (veiculoComp.renavam) form.setValue('renavam', veiculoComp.renavam);
          if (veiculoComp.cor) form.setValue('cor', veiculoComp.cor);
          if (veiculoComp.combustivel) form.setValue('combustivel', veiculoComp.combustivel);
        }
      }
      
      // Combustível da cotação principal
      if (cotacao.combustivel && !form.getValues('combustivel')) {
        form.setValue('combustivel', cotacao.combustivel);
      }
      if (cotacao.veiculo_combustivel && !form.getValues('combustivel')) {
        form.setValue('combustivel', cotacao.veiculo_combustivel);
      }
    }
  }, [cotacao, form]);

  // Buscar CEP
  const handleCepComplete = async (cep: string) => {
    try {
      const endereco = await buscarCep(cep);
      if (endereco) {
        form.setValue('logradouro', endereco.logradouro || '');
        form.setValue('bairro', endereco.bairro || '');
        form.setValue('cidade', endereco.cidade || '');
        form.setValue('estado', endereco.uf || '');
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    }
  };

  // Mutation para salvar dados
  const salvarDados = useMutation({
    mutationFn: async (data: CadastroComplementarForm) => {
      if (!cotacaoId || !cotacao) throw new Error('Cotação não encontrada');

      const dadosExtrasAtuais = (cotacao.dados_extras as Record<string, unknown>) || {};
      
      const dadosExtrasNovos = {
        ...dadosExtrasAtuais,
        cliente: {
          nome: data.nome,
          cpf: data.cpf,
          data_nascimento: data.data_nascimento,
          rg: data.rg || null,
          email: data.email,
          telefone: data.telefone,
        },
        endereco: {
          cep: data.cep,
          logradouro: data.logradouro,
          numero: data.numero,
          complemento: data.complemento || null,
          bairro: data.bairro,
          cidade: data.cidade,
          estado: data.estado,
        },
        veiculo_complementar: {
          chassi: data.chassi,
          renavam: data.renavam || null,
          cor: data.cor || null,
          combustivel: data.combustivel || null,
        },
      };

      const { error } = await supabase
        .from('cotacoes')
        .update({
          cidade: data.cidade,
          combustivel: data.combustivel || null,
          dados_extras: dadosExtrasNovos,
          status: 'aceita',
        })
        .eq('id', cotacaoId);

      if (error) throw error;
      
      return cotacaoId;
    },
    onSuccess: (id) => {
      toast.success('Dados salvos com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['cotacao', id] });
      navigate(`/vendas/gerar-contrato/${id}`);
    },
    onError: (error: Error) => {
      console.error('Erro ao salvar dados:', error);
      toast.error(`Erro ao salvar dados: ${error.message}`);
    },
  });

  const onSubmit = (data: CadastroComplementarForm) => {
    salvarDados.mutate(data);
  };

  // Formatar valor FIPE
  const formatarValorFipe = (valor: number | null | undefined) => {
    if (!valor) return 'N/A';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Extrair dados do plano do dados_extras
  const dadosExtras = cotacao?.dados_extras as Record<string, unknown> | null;
  const planoNome = (dadosExtras?.plano_nome as string) || 'Plano não definido';
  const valorMensal = cotacao?.valor_total_mensal || 0;
  const valorAdesao = cotacao?.valor_adesao || 0;

  if (isLoadingCotacao) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cotacao) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Cotação não encontrada</p>
        <Button onClick={() => navigate('/vendas/cotacao')}>
          Voltar para Cotador
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/vendas/cotacao')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">FINALIZAR CADASTRO</h1>
          </div>
          <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
            Etapa 1 de 3
          </span>
        </div>

        {/* Card Resumo da Cotação */}
        <Card className="bg-slate-800 text-white border-0">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Car className="h-5 w-5 text-blue-400" />
              <span>
                {cotacao.veiculo_marca} {cotacao.veiculo_modelo} {cotacao.veiculo_ano}
                {cotacao.veiculo_placa && ` • ${cotacao.veiculo_placa}`}
                {cotacao.valor_fipe && ` • FIPE: ${formatarValorFipe(cotacao.valor_fipe)}`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-green-400" />
              <span>
                {planoNome} • {formatarValorFipe(valorMensal)}/mês • Adesão: {formatarValorFipe(valorAdesao)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Formulário */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Dados Pessoais */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Dados Pessoais</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome completo *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nome completo" {...field} />
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
                          <CpfInput
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="000.000.000-00"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="data_nascimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Nascimento *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
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
                          <Input placeholder="RG" {...field} />
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
                          <TelefoneInput
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="(00) 00000-0000"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Endereço */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Endereço</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="cep"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEP *</FormLabel>
                        <FormControl>
                          <CepInput
                            value={field.value}
                            onChange={field.onChange}
                            onCepComplete={handleCepComplete}
                            placeholder="00000-000"
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
                      <FormItem className="md:col-span-2">
                        <FormLabel>Logradouro *</FormLabel>
                        <FormControl>
                          <Input placeholder="Rua, Avenida, etc." {...field} />
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
                          <Input placeholder="Nº" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="complemento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Complemento</FormLabel>
                        <FormControl>
                          <Input placeholder="Apto, Sala, etc." {...field} />
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
                      <FormItem className="md:col-span-2">
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
                            {ESTADOS_BRASIL.map((uf) => (
                              <SelectItem key={uf} value={uf}>
                                {uf}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Dados do Veículo */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold">Dados do Veículo</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="chassi"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chassi * (17 caracteres)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: 9BWZZZ377VT004251"
                            maxLength={17}
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          />
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
                          <Input placeholder="Renavam" {...field} />
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
                          <Input placeholder="Ex: Preto, Branco, Prata" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="combustivel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Combustível</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {COMBUSTIVEIS.map((comb) => (
                              <SelectItem key={comb.value} value={comb.value}>
                                {comb.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Footer */}
            <div className="flex justify-between pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/vendas/cotacao')}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={salvarDados.isPending}>
                {salvarDados.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Continuar para Contrato →'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
