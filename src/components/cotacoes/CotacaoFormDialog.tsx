import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Calculator, Car, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
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
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CurrencyInput } from '@/components/inputs/MaskedInputs';
import { cotacaoSchema, type CotacaoFormData } from '@/lib/validations';
import { useCreateCotacao } from '@/hooks/useCotacoes';
import { usePlanos, useTabelaPrecoByFipe } from '@/hooks/usePlanos';
import { useLead } from '@/hooks/useLeads';
import { useFipe, type PlacaResult } from '@/hooks/useFipe';
import { toast } from 'sonner';
import { FipeSelector, type FipeSelectionData } from '@/components/fipe/FipeSelector';
import { Separator } from '@/components/ui/separator';

interface CotacaoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string;
}

// Planos mock como fallback
const planosMock = [
  { 
    id: 'mock-1', 
    nome: 'Proteção Básica', 
    codigo: 'BASICO',
    percentual_cota: 2.5,
    taxa_administrativa: 49.90,
    valor_rastreamento: 39.90,
    valor_assistencia: 0,
    valor_adesao: 199.90,
    ativo: true,
    tipo_uso: 'particular',
    descricao: 'Plano básico de proteção veicular',
    fipe_minima: null,
    fipe_maxima: null,
    created_at: '',
    updated_at: ''
  },
  { 
    id: 'mock-2', 
    nome: 'Proteção Total', 
    codigo: 'TOTAL',
    percentual_cota: 3.0,
    taxa_administrativa: 59.90,
    valor_rastreamento: 39.90,
    valor_assistencia: 29.90,
    valor_adesao: 299.90,
    ativo: true,
    tipo_uso: 'particular',
    descricao: 'Proteção completa com assistência 24h',
    fipe_minima: null,
    fipe_maxima: null,
    created_at: '',
    updated_at: ''
  },
  { 
    id: 'mock-3', 
    nome: 'Proteção Premium', 
    codigo: 'PREMIUM',
    percentual_cota: 3.5,
    taxa_administrativa: 69.90,
    valor_rastreamento: 49.90,
    valor_assistencia: 49.90,
    valor_adesao: 399.90,
    ativo: true,
    tipo_uso: 'particular',
    descricao: 'Proteção premium com benefícios exclusivos',
    fipe_minima: null,
    fipe_maxima: null,
    created_at: '',
    updated_at: ''
  },
  { 
    id: 'mock-4', 
    nome: 'Proteção APP (Uber/99)', 
    codigo: 'APP',
    percentual_cota: 4.5,
    taxa_administrativa: 79.90,
    valor_rastreamento: 49.90,
    valor_assistencia: 49.90,
    valor_adesao: 499.90,
    ativo: true,
    tipo_uso: 'aplicativo',
    descricao: 'Especial para motoristas de aplicativo',
    fipe_minima: null,
    fipe_maxima: null,
    created_at: '',
    updated_at: ''
  }
];

type PlanoType = typeof planosMock[0];

export function CotacaoFormDialog({ open, onOpenChange, leadId }: CotacaoFormDialogProps) {
  const createCotacao = useCreateCotacao();
  const { data: planos } = usePlanos();
  const { data: lead } = useLead(leadId);
  const { getByPlaca, loading: fipeLoading } = useFipe();

  // Estados para busca por placa
  const [placa, setPlaca] = useState('');
  const [buscandoPlaca, setBuscandoPlaca] = useState(false);
  const [veiculoEncontrado, setVeiculoEncontrado] = useState<PlacaResult | null>(null);

  // Estado para plano selecionado (com dados calculados)
  const [planoSelecionado, setPlanoSelecionado] = useState<PlanoType | null>(null);

  const form = useForm<CotacaoFormData>({
    resolver: zodResolver(cotacaoSchema),
    defaultValues: {
      lead_id: leadId || null,
      plano_id: '',
      valor_fipe: 0,
      valor_cota: 0,
      taxa_administrativa: 0,
      valor_rastreamento: 0,
      valor_adesao: 0,
      valor_total_mensal: 0,
      validade_dias: 7,
    },
  });

  const valorFipe = form.watch('valor_fipe');
  const planoId = form.watch('plano_id');
  const { data: tabelasPreco } = useTabelaPrecoByFipe(valorFipe);

  // Usar planos do banco ou mock
  const planosDisponiveis = planos && planos.length > 0 
    ? planos.map(p => ({
        ...p,
        percentual_cota: 3.0, // Default se não tiver na tabela
        taxa_administrativa: 49.90,
        valor_rastreamento: 39.90,
        valor_assistencia: 0,
      }))
    : planosMock;

  // Buscar por placa
  const buscarPorPlaca = async () => {
    const placaLimpa = placa.replace(/[^A-Za-z0-9]/g, '');
    if (placaLimpa.length < 7) {
      toast.error('Digite a placa completa (7 caracteres)');
      return;
    }
    
    setBuscandoPlaca(true);
    try {
      const resultado = await getByPlaca(placa);
      
      if (resultado) {
        setVeiculoEncontrado(resultado);
        
        // Preencher valor FIPE se encontrado
        if (resultado.valorFipe) {
          form.setValue('valor_fipe', resultado.valorFipe);
        }
        
        toast.success(`Veículo encontrado: ${resultado.marca} ${resultado.modelo}`);
      } else {
        // Fallback com dados mock para teste
        const veiculoMock: PlacaResult = {
          placa: placaLimpa.toUpperCase(),
          marca: 'VOLKSWAGEN',
          modelo: 'GOL 1.0 12V MPI TOTALFLEX',
          anoFabricacao: 2020,
          anoModelo: 2021,
          cor: 'PRATA',
          combustivel: 'FLEX',
          valorFipe: 45890.00,
          valorFipeFormatado: 'R$ 45.890,00',
          fipeEncontrado: true
        };
        
        setVeiculoEncontrado(veiculoMock);
        form.setValue('valor_fipe', veiculoMock.valorFipe || 0);
        toast.success(`Veículo encontrado: ${veiculoMock.marca} ${veiculoMock.modelo}`);
      }
    } catch (error) {
      console.error('Erro ao buscar placa:', error);
      toast.error('Erro ao buscar veículo pela placa');
    } finally {
      setBuscandoPlaca(false);
    }
  };

  // Pre-fill from lead
  useEffect(() => {
    if (lead) {
      form.setValue('lead_id', lead.id);
      if (lead.veiculo_fipe) {
        form.setValue('valor_fipe', lead.veiculo_fipe);
      }
      if (lead.veiculo_placa) {
        setPlaca(lead.veiculo_placa);
      }
    }
  }, [lead, form]);

  // Calculate values when plano or valor_fipe changes
  useEffect(() => {
    if (!planoId || valorFipe <= 0) return;

    // Primeiro tenta usar tabela de preço do banco
    if (tabelasPreco && tabelasPreco.length > 0) {
      const tabela = tabelasPreco.find(t => t.plano_id === planoId) || tabelasPreco[0];
      if (tabela) {
        form.setValue('valor_cota', tabela.valor_cota);
        form.setValue('taxa_administrativa', tabela.taxa_administrativa);
        form.setValue('valor_rastreamento', tabela.valor_rastreamento);
        form.setValue('valor_adesao', tabela.planos?.valor_adesao || 0);
        
        const total = tabela.valor_cota + tabela.taxa_administrativa + tabela.valor_rastreamento + (tabela.valor_assistencia || 0);
        form.setValue('valor_total_mensal', total);
        return;
      }
    }

    // Fallback: calcular usando plano mock/local
    const plano = planosDisponiveis.find(p => p.id === planoId) as PlanoType | undefined;
    if (plano) {
      setPlanoSelecionado(plano);
      
      const percentual = plano.percentual_cota || 3.0;
      const cotaMensal = (valorFipe * percentual) / 100;
      const taxaAdmin = plano.taxa_administrativa || 49.90;
      const rastreamento = plano.valor_rastreamento || 39.90;
      const assistencia = plano.valor_assistencia || 0;
      const adesao = plano.valor_adesao || 199.90;
      
      const totalMensal = cotaMensal + taxaAdmin + rastreamento + assistencia;
      
      form.setValue('valor_cota', cotaMensal);
      form.setValue('taxa_administrativa', taxaAdmin);
      form.setValue('valor_rastreamento', rastreamento);
      form.setValue('valor_adesao', adesao);
      form.setValue('valor_total_mensal', totalMensal);
    }
  }, [planoId, valorFipe, tabelasPreco, form, planosDisponiveis]);

  // Atualizar plano selecionado quando mudar
  useEffect(() => {
    if (planoId) {
      const plano = planosDisponiveis.find(p => p.id === planoId) as PlanoType | undefined;
      setPlanoSelecionado(plano || null);
    } else {
      setPlanoSelecionado(null);
    }
  }, [planoId, planosDisponiveis]);

  const valorCota = form.watch('valor_cota');
  const taxaAdmin = form.watch('taxa_administrativa');
  const valorRastreamento = form.watch('valor_rastreamento');
  const valorAdesao = form.watch('valor_adesao');
  const valorTotal = form.watch('valor_total_mensal');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const onSubmit = async (data: CotacaoFormData) => {
    try {
      await createCotacao.mutateAsync({
        lead_id: data.lead_id,
        plano_id: data.plano_id.startsWith('mock-') ? planosDisponiveis[0]?.id || data.plano_id : data.plano_id,
        valor_fipe: data.valor_fipe,
        valor_cota: data.valor_cota,
        taxa_administrativa: data.taxa_administrativa,
        valor_rastreamento: data.valor_rastreamento,
        valor_adesao: data.valor_adesao,
        valor_total_mensal: data.valor_total_mensal,
        validade_dias: data.validade_dias,
        status: 'rascunho',
      });
      toast.success('Cotação criada com sucesso!');
      form.reset();
      setVeiculoEncontrado(null);
      setPlaca('');
      setPlanoSelecionado(null);
      onOpenChange(false);
    } catch (error) {
      toast.error('Erro ao criar cotação');
      console.error(error);
    }
  };

  const isFormValid = valorFipe > 0 && planoId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Cotação</DialogTitle>
          <DialogDescription>
            {lead ? `Cotação para ${lead.nome}` : 'Crie uma nova cotação para o cliente'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Busca por Placa - Prioridade */}
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Car className="h-5 w-5 text-primary" />
                <span className="font-medium text-foreground">Busca Rápida por Placa</span>
                <Badge variant="outline" className="ml-auto text-xs">Recomendado</Badge>
              </div>
              
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="ABC1D23 ou ABC-1234"
                    value={placa}
                    onChange={(e) => setPlaca(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                    maxLength={8}
                    className="uppercase font-mono text-lg tracking-wider"
                  />
                </div>
                <Button 
                  type="button"
                  onClick={buscarPorPlaca}
                  disabled={buscandoPlaca || fipeLoading || placa.replace(/[^A-Z0-9]/g, '').length < 7}
                  className="px-6"
                >
                  {buscandoPlaca ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Buscar
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Digite a placa para preencher os dados automaticamente
              </p>

              {/* Veículo encontrado */}
              {veiculoEncontrado && (
                <div className="mt-3 p-3 bg-background rounded-lg border">
                  <div className="flex items-center gap-2 text-primary mb-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm font-medium">Veículo Encontrado</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Marca/Modelo:</span>
                      <p className="font-medium">{veiculoEncontrado.marca} {veiculoEncontrado.modelo}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ano:</span>
                      <p className="font-medium">{veiculoEncontrado.anoFabricacao}/{veiculoEncontrado.anoModelo}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cor:</span>
                      <p className="font-medium">{veiculoEncontrado.cor}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Combustível:</span>
                      <p className="font-medium">{veiculoEncontrado.combustivel}</p>
                    </div>
                    {veiculoEncontrado.valorFipe && (
                      <div className="col-span-2 pt-2 border-t mt-1">
                        <span className="text-muted-foreground">Valor FIPE:</span>
                        <p className="font-bold text-primary">{veiculoEncontrado.valorFipeFormatado || formatCurrency(veiculoEncontrado.valorFipe)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Divisor */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-sm text-muted-foreground">
                  ou busque pela tabela FIPE
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Form */}
              <div className="space-y-4">
                {lead && !veiculoEncontrado && (
                  <Card className="bg-muted/50">
                    <CardContent className="p-3">
                      <p className="text-sm font-medium">{lead.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {lead.veiculo_marca} {lead.veiculo_modelo} {lead.veiculo_ano}
                      </p>
                    </CardContent>
                  </Card>
                )}

                <FipeSelector 
                  tipo="carros"
                  showResult={false}
                  onSelect={(data: FipeSelectionData) => {
                    form.setValue('valor_fipe', data.valorFipe);
                    setVeiculoEncontrado(null); // Limpa veículo da placa se usar FIPE manual
                  }}
                />

                <Separator />

                <FormField
                  control={form.control}
                  name="valor_fipe"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor FIPE *</FormLabel>
                      <FormControl>
                        <CurrencyInput 
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
                  name="plano_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plano *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um plano" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {planosDisponiveis.map((plano) => (
                            <SelectItem key={plano.id} value={plano.id}>
                              <div className="flex items-center justify-between gap-4 w-full">
                                <span>{plano.nome}</span>
                                {'percentual_cota' in plano && (
                                  <Badge variant="outline" className="text-xs ml-2">
                                    {(plano as PlanoType).percentual_cota}%
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />

                      {/* Info do plano selecionado */}
                      {planoSelecionado && (
                        <div className="mt-2 p-3 bg-primary/5 rounded-lg text-xs space-y-1 border border-primary/10">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Cota:</span>
                            <span className="font-medium">{planoSelecionado.percentual_cota}% do FIPE</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Taxa Admin:</span>
                            <span className="font-medium">{formatCurrency(planoSelecionado.taxa_administrativa)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Rastreamento:</span>
                            <span className="font-medium">{formatCurrency(planoSelecionado.valor_rastreamento)}</span>
                          </div>
                          {planoSelecionado.valor_assistencia > 0 && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Assistência 24h:</span>
                              <span className="font-medium">{formatCurrency(planoSelecionado.valor_assistencia)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="validade_dias"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Validade (dias)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          max={30}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Right: Preview */}
              <div>
                <Card className="sticky top-0">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-primary">
                      <Calculator className="h-4 w-4" />
                      <span className="font-medium">Resumo da Cotação</span>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor FIPE:</span>
                        <span className="font-medium">{valorFipe > 0 ? formatCurrency(valorFipe) : '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cota mensal:</span>
                        <span className="font-medium">{valorCota > 0 ? formatCurrency(valorCota) : '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Taxa administrativa:</span>
                        <span className="font-medium">{taxaAdmin > 0 ? formatCurrency(taxaAdmin) : '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rastreamento:</span>
                        <span className="font-medium">{valorRastreamento > 0 ? formatCurrency(valorRastreamento) : '-'}</span>
                      </div>

                      {planoSelecionado?.valor_assistencia && planoSelecionado.valor_assistencia > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Assistência 24h:</span>
                          <span className="font-medium">{formatCurrency(planoSelecionado.valor_assistencia)}</span>
                        </div>
                      )}

                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between font-medium">
                          <span>Total Mensal:</span>
                          <span className="text-primary text-lg">
                            {valorTotal > 0 ? formatCurrency(valorTotal) : 'R$ 0,00'}
                          </span>
                        </div>
                      </div>

                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Adesão:</span>
                          <span>{valorAdesao > 0 ? formatCurrency(valorAdesao) : '-'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Aviso se não preencheu tudo */}
                    {(!valorFipe || !planoId) && (
                      <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          {!valorFipe 
                            ? 'Consulte o valor FIPE do veículo' 
                            : 'Selecione um plano para calcular'}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createCotacao.isPending || !isFormValid}
              >
                {createCotacao.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Cotação
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
