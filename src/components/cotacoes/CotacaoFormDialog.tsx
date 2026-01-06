import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Car, Search, CheckCircle2, Shield, FileText, ChevronRight, ChevronLeft, Check, AlertCircle } from 'lucide-react';
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
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { CurrencyInput } from '@/components/inputs/MaskedInputs';
import { cotacaoSchema, type CotacaoFormData } from '@/lib/validations';
import { useCreateCotacao } from '@/hooks/useCotacoes';
import { usePlanos, useTabelaPrecoByFipe } from '@/hooks/usePlanos';
import { useLead } from '@/hooks/useLeads';
import { useFipe, type PlateResult, type FipeMarca, type FipeModelo, type FipeAno } from '@/hooks/useFipe';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface CotacaoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string;
}

interface PlanoComPreco {
  plano: {
    id: string;
    nome: string;
    codigo: string;
    valor_adesao: number;
    tipo_uso: string | null;
    descricao: string | null;
  };
  valorCota: number;
  taxaAdmin: number;
  rastreamento: number;
  assistencia: number;
  totalMensal: number;
}

type Step = 1 | 2 | 3;

const steps = [
  { number: 1, label: 'Veículo', icon: Car },
  { number: 2, label: 'Plano', icon: Shield },
  { number: 3, label: 'Resumo', icon: FileText },
];

export function CotacaoFormDialog({ open, onOpenChange, leadId }: CotacaoFormDialogProps) {
  const navigate = useNavigate();
  const createCotacao = useCreateCotacao();
  const { data: planos, isLoading: planosLoading } = usePlanos();
  const { data: lead } = useLead(leadId);
  const { getMarcas, getModelos, getAnos, getPreco, getByPlaca, buscarPorNome, loading: fipeLoading } = useFipe();

  // Step state
  const [step, setStep] = useState<Step>(1);

  // Estados para busca por placa
  const [placa, setPlaca] = useState('');
  const [buscandoPlaca, setBuscandoPlaca] = useState(false);
  const [veiculoEncontrado, setVeiculoEncontrado] = useState<PlateResult | null>(null);

  // Estados para seleção FIPE manual
  const [marcas, setMarcas] = useState<FipeMarca[]>([]);
  const [modelos, setModelos] = useState<FipeModelo[]>([]);
  const [anos, setAnos] = useState<FipeAno[]>([]);
  const [marcaSelecionada, setMarcaSelecionada] = useState('');
  const [modeloSelecionado, setModeloSelecionado] = useState('');
  const [anoSelecionado, setAnoSelecionado] = useState('');
  
  // Loading states
  const [loadingMarcas, setLoadingMarcas] = useState(false);
  const [loadingModelos, setLoadingModelos] = useState(false);
  const [loadingAnos, setLoadingAnos] = useState(false);
  const [buscandoFipe, setBuscandoFipe] = useState(false);

  // Estado para plano selecionado
  const [planoSelecionadoData, setPlanoSelecionadoData] = useState<PlanoComPreco | null>(null);

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

  // Combinar planos com seus preços para o valor FIPE atual
  const planosComPrecos = useMemo<PlanoComPreco[]>(() => {
    if (!planos || !tabelasPreco || valorFipe <= 0) return [];

    return planos.map(plano => {
      const tabela = tabelasPreco.find(t => t.plano_id === plano.id);
      if (!tabela) return null;

      return {
        plano: {
          id: plano.id,
          nome: plano.nome,
          codigo: plano.codigo,
          valor_adesao: plano.valor_adesao || 0,
          tipo_uso: plano.tipo_uso,
          descricao: plano.descricao,
        },
        valorCota: tabela.valor_cota,
        taxaAdmin: tabela.taxa_administrativa,
        rastreamento: tabela.valor_rastreamento,
        assistencia: tabela.valor_assistencia || 0,
        totalMensal: tabela.valor_cota + tabela.taxa_administrativa + 
                     tabela.valor_rastreamento + (tabela.valor_assistencia || 0),
      };
    }).filter((p): p is PlanoComPreco => p !== null);
  }, [planos, tabelasPreco, valorFipe]);

  // Validação por etapa
  const canGoToStep2 = valorFipe > 0;
  const canGoToStep3 = valorFipe > 0 && planoId;

  // Carregar marcas quando dialog abre
  useEffect(() => {
    if (open && marcas.length === 0) {
      const fetchMarcas = async () => {
        setLoadingMarcas(true);
        try {
          const data = await getMarcas('carros');
          setMarcas(data);
        } catch (error) {
          console.error('Erro ao carregar marcas:', error);
        } finally {
          setLoadingMarcas(false);
        }
      };
      fetchMarcas();
    }
  }, [open, getMarcas, marcas.length]);

  // Reset step when dialog closes
  useEffect(() => {
    if (!open) {
      setStep(1);
    }
  }, [open]);

  // Auto-buscar FIPE quando marca, modelo e ano estiverem selecionados
  useEffect(() => {
    if (marcaSelecionada && modeloSelecionado && anoSelecionado) {
      const buscarFipeAutomatico = async () => {
        setBuscandoFipe(true);
        try {
          const resultado = await getPreco(marcaSelecionada, modeloSelecionado, anoSelecionado, 'carros');
          if (resultado && resultado.valorNumerico) {
            form.setValue('valor_fipe', resultado.valorNumerico);
            toast.success(`Valor FIPE: ${resultado.valor}`);
          }
        } catch (error) {
          console.error('Erro ao buscar FIPE:', error);
        } finally {
          setBuscandoFipe(false);
        }
      };
      buscarFipeAutomatico();
    }
  }, [marcaSelecionada, modeloSelecionado, anoSelecionado, getPreco, form]);

  // Handler para mudança de marca
  const handleMarcaChange = async (value: string) => {
    setMarcaSelecionada(value);
    setModeloSelecionado('');
    setAnoSelecionado('');
    setModelos([]);
    setAnos([]);
    form.setValue('valor_fipe', 0);

    if (value) {
      setLoadingModelos(true);
      try {
        const data = await getModelos(value, 'carros');
        setModelos(data);
      } catch (error) {
        console.error('Erro ao carregar modelos:', error);
      } finally {
        setLoadingModelos(false);
      }
    }
  };

  // Handler para mudança de modelo
  const handleModeloChange = async (value: string) => {
    setModeloSelecionado(value);
    setAnoSelecionado('');
    setAnos([]);
    form.setValue('valor_fipe', 0);

    if (marcaSelecionada && value) {
      setLoadingAnos(true);
      try {
        const data = await getAnos(marcaSelecionada, value, 'carros');
        setAnos(data);
      } catch (error) {
        console.error('Erro ao carregar anos:', error);
      } finally {
        setLoadingAnos(false);
      }
    }
  };

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
      
      if (resultado.success && resultado.vehicleData) {
        setVeiculoEncontrado(resultado);
        
        const marcaNome = resultado.vehicleData.marca?.toLowerCase();
        const modeloNome = resultado.vehicleData.modelo?.toLowerCase();
        const anoVeiculo = resultado.vehicleData.ano?.split('/')[0];

        let marcasCarregadas = marcas;
        if (marcasCarregadas.length === 0) {
          setLoadingMarcas(true);
          marcasCarregadas = await getMarcas('carros');
          setMarcas(marcasCarregadas);
          setLoadingMarcas(false);
        }

        const marcaEncontrada = marcasCarregadas.find(
          m => m.nome.toLowerCase().includes(marcaNome) || marcaNome?.includes(m.nome.toLowerCase())
        );

        if (marcaEncontrada) {
          setMarcaSelecionada(marcaEncontrada.codigo);
          
          setLoadingModelos(true);
          const modelosData = await getModelos(marcaEncontrada.codigo, 'carros');
          setModelos(modelosData);
          setLoadingModelos(false);

          const modeloEncontrado = modelosData.find(
            m => m.nome.toLowerCase().includes(modeloNome) || modeloNome?.includes(m.nome.toLowerCase())
          );

          if (modeloEncontrado) {
            setModeloSelecionado(modeloEncontrado.codigo.toString());

            setLoadingAnos(true);
            const anosData = await getAnos(marcaEncontrada.codigo, modeloEncontrado.codigo.toString(), 'carros');
            setAnos(anosData);
            setLoadingAnos(false);

            const anoEncontrado = anosData.find(a => a.nome.includes(anoVeiculo || ''));
            if (anoEncontrado) {
              setAnoSelecionado(anoEncontrado.codigo);
            }
          }
        }

        if (resultado.fipeData?.valor) {
          form.setValue('valor_fipe', resultado.fipeData.valor);
          toast.success(`Veículo encontrado! FIPE: R$ ${resultado.fipeData.valor.toLocaleString('pt-BR')}`);
        } else {
          toast.success(`Veículo encontrado: ${resultado.vehicleData.marca} ${resultado.vehicleData.modelo}`);
          if (!marcaEncontrada) {
            const fipeResult = await buscarPorNome(
              resultado.vehicleData.marca,
              resultado.vehicleData.modelo,
              anoVeiculo,
              'carros'
            );
            if (fipeResult?.valorNumerico) {
              form.setValue('valor_fipe', fipeResult.valorNumerico);
              toast.success(`Valor FIPE: ${fipeResult.valor}`);
            } else {
              toast.info('Selecione marca/modelo/ano para buscar o valor FIPE');
            }
          }
        }
      } else {
        toast.error(resultado.error || 'Veículo não encontrado');
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

  // Handler de seleção de plano
  const handleSelectPlano = (planoPreco: PlanoComPreco) => {
    form.setValue('plano_id', planoPreco.plano.id);
    form.setValue('valor_cota', planoPreco.valorCota);
    form.setValue('taxa_administrativa', planoPreco.taxaAdmin);
    form.setValue('valor_rastreamento', planoPreco.rastreamento);
    form.setValue('valor_adesao', planoPreco.plano.valor_adesao);
    form.setValue('valor_total_mensal', planoPreco.totalMensal);
    setPlanoSelecionadoData(planoPreco);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const onSubmit = async (data: CotacaoFormData) => {
    try {
      // Extrair ano numérico do texto (ex: "2022 Gasolina" -> 2022)
      const anoTexto = getAnoNome();
      const anoNumerico = anoTexto ? parseInt(anoTexto.split(' ')[0]) : null;
      
      await createCotacao.mutateAsync({
        lead_id: data.lead_id,
        plano_id: data.plano_id,
        valor_fipe: data.valor_fipe,
        valor_cota: data.valor_cota,
        taxa_administrativa: data.taxa_administrativa,
        valor_rastreamento: data.valor_rastreamento,
        valor_adesao: data.valor_adesao,
        valor_total_mensal: data.valor_total_mensal,
        valor_assistencia: planoSelecionadoData?.assistencia || 0,
        validade_dias: data.validade_dias,
        status: 'rascunho',
        // Dados do veículo
        veiculo_marca: getMarcaNome() || null,
        veiculo_modelo: getModeloNome() || null,
        veiculo_ano: anoNumerico,
        codigo_fipe: veiculoEncontrado?.fipeData?.codigo || null,
      });
      
      toast.success('Cotação criada com sucesso!');
      
      // Resetar estados
      form.reset();
      setVeiculoEncontrado(null);
      setPlaca('');
      setPlanoSelecionadoData(null);
      setMarcaSelecionada('');
      setModeloSelecionado('');
      setAnoSelecionado('');
      setModelos([]);
      setAnos([]);
      setStep(1);
      
      // Fechar modal
      onOpenChange(false);
      
      // Redirecionar para a página de cotações
      navigate('/vendas/cotacoes');
    } catch (error) {
      toast.error('Erro ao criar cotação');
      console.error(error);
    }
  };

  // Get marca/modelo names for display
  const getMarcaNome = () => {
    if (veiculoEncontrado?.vehicleData?.marca) return veiculoEncontrado.vehicleData.marca;
    const marca = marcas.find(m => m.codigo === marcaSelecionada);
    return marca?.nome || '';
  };

  const getModeloNome = () => {
    if (veiculoEncontrado?.vehicleData?.modelo) return veiculoEncontrado.vehicleData.modelo;
    const modelo = modelos.find(m => m.codigo.toString() === modeloSelecionado);
    return modelo?.nome || '';
  };

  const getAnoNome = () => {
    if (veiculoEncontrado?.vehicleData?.ano) return veiculoEncontrado.vehicleData.ano;
    const ano = anos.find(a => a.codigo === anoSelecionado);
    return ano?.nome || '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Cotação</DialogTitle>
          <DialogDescription>
            {lead ? `Cotação para ${lead.nome}` : 'Crie uma nova cotação para o cliente'}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-1 mb-4">
          {steps.map((s, i) => (
            <div key={s.number} className="flex items-center">
              <button
                type="button"
                onClick={() => {
                  if (s.number === 1) setStep(1);
                  else if (s.number === 2 && canGoToStep2) setStep(2);
                  else if (s.number === 3 && canGoToStep3) setStep(3);
                }}
                disabled={
                  (s.number === 2 && !canGoToStep2) ||
                  (s.number === 3 && !canGoToStep3)
                }
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all",
                  step === s.number 
                    ? "bg-primary text-primary-foreground" 
                    : step > s.number 
                      ? "bg-primary/20 text-primary cursor-pointer hover:bg-primary/30"
                      : "bg-muted text-muted-foreground",
                  ((s.number === 2 && !canGoToStep2) || (s.number === 3 && !canGoToStep3)) && "opacity-50 cursor-not-allowed"
                )}
              >
                <s.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            {/* STEP 1: Veículo */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Busca por Placa */}
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Car className="h-5 w-5 text-primary" />
                      <span className="font-medium">Busca Rápida por Placa</span>
                      <Badge variant="outline" className="ml-auto text-xs">Recomendado</Badge>
                    </div>
                    
                    <div className="flex gap-2">
                      <Input
                        placeholder="ABC1D23"
                        value={placa}
                        onChange={(e) => setPlaca(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                        maxLength={8}
                        className="uppercase font-mono text-lg tracking-wider flex-1"
                      />
                      <Button 
                        type="button"
                        onClick={buscarPorPlaca}
                        disabled={buscandoPlaca || fipeLoading || placa.replace(/[^A-Z0-9]/g, '').length < 7}
                      >
                        {buscandoPlaca ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* Veículo encontrado */}
                    {veiculoEncontrado?.success && veiculoEncontrado.vehicleData && (
                      <div className="mt-3 p-3 bg-background rounded-lg border border-green-500/30">
                        <div className="flex items-center gap-2 text-green-600 mb-2">
                          <CheckCircle2 className="h-4 w-4" />
                          <span className="text-sm font-medium">Veículo Encontrado</span>
                        </div>
                        <p className="font-medium">
                          {veiculoEncontrado.vehicleData.marca} {veiculoEncontrado.vehicleData.modelo}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {veiculoEncontrado.vehicleData.ano} • {veiculoEncontrado.vehicleData.cor} • {veiculoEncontrado.vehicleData.combustivel}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Divisor */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-background px-3 text-xs text-muted-foreground">
                      ou selecione manualmente
                    </span>
                  </div>
                </div>

                {/* Seleção FIPE Manual - Grid compacto */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Marca</Label>
                    <Select 
                      value={marcaSelecionada} 
                      onValueChange={handleMarcaChange}
                      disabled={loadingMarcas}
                    >
                      <SelectTrigger className="h-9">
                        {loadingMarcas ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <SelectValue placeholder="Marca" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {marcas.map((marca) => (
                          <SelectItem key={marca.codigo} value={marca.codigo}>
                            {marca.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Modelo</Label>
                    <Select 
                      value={modeloSelecionado} 
                      onValueChange={handleModeloChange}
                      disabled={!marcaSelecionada || loadingModelos}
                    >
                      <SelectTrigger className="h-9">
                        {loadingModelos ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <SelectValue placeholder="Modelo" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {modelos.map((modelo) => (
                          <SelectItem key={modelo.codigo} value={modelo.codigo.toString()}>
                            {modelo.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Ano</Label>
                    <Select 
                      value={anoSelecionado} 
                      onValueChange={setAnoSelecionado}
                      disabled={!modeloSelecionado || loadingAnos}
                    >
                      <SelectTrigger className="h-9">
                        {loadingAnos ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <SelectValue placeholder="Ano" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {anos.map((ano) => (
                          <SelectItem key={ano.codigo} value={ano.codigo}>
                            {ano.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Valor FIPE */}
                <FormField
                  control={form.control}
                  name="valor_fipe"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor FIPE *</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <CurrencyInput 
                            value={field.value} 
                            onChange={field.onChange}
                            disabled={buscandoFipe}
                          />
                          {buscandoFipe && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            </div>
                          )}
                          {field.value > 0 && !buscandoFipe && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Botão Próximo */}
                <div className="flex justify-end pt-2">
                  <Button 
                    type="button"
                    onClick={() => setStep(2)} 
                    disabled={!canGoToStep2}
                  >
                    Selecionar Plano
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: Seleção de Plano */}
            {step === 2 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="text-center pb-2">
                  <p className="text-sm text-muted-foreground">
                    Veículo FIPE: <span className="font-semibold text-foreground">{formatCurrency(valorFipe)}</span>
                  </p>
                </div>

                {planosLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : planosComPrecos.length === 0 ? (
                  <Card className="border-amber-500/30 bg-amber-500/5">
                    <CardContent className="p-4 text-center">
                      <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                      <p className="font-medium text-amber-700 dark:text-amber-400">
                        Nenhum plano disponível para este valor FIPE
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Verifique se há tabelas de preço cadastradas para a faixa de R$ {valorFipe.toLocaleString('pt-BR')}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {planosComPrecos.map((planoPreco) => (
                      <Card 
                        key={planoPreco.plano.id}
                        className={cn(
                          "cursor-pointer transition-all hover:shadow-md",
                          planoId === planoPreco.plano.id 
                            ? "ring-2 ring-primary border-primary bg-primary/5" 
                            : "hover:border-primary/50"
                        )}
                        onClick={() => handleSelectPlano(planoPreco)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-sm">{planoPreco.plano.nome}</h4>
                            {planoId === planoPreco.plano.id && (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <p className="text-xl font-bold text-primary mb-3">
                            {formatCurrency(planoPreco.totalMensal)}
                            <span className="text-xs font-normal text-muted-foreground">/mês</span>
                          </p>
                          <ul className="text-xs space-y-1 text-muted-foreground">
                            <li>• Cota: {formatCurrency(planoPreco.valorCota)}</li>
                            <li>• Taxa: {formatCurrency(planoPreco.taxaAdmin)}</li>
                            <li>• Rast.: {formatCurrency(planoPreco.rastreamento)}</li>
                            {planoPreco.assistencia > 0 && (
                              <li>• Assist.: {formatCurrency(planoPreco.assistencia)}</li>
                            )}
                          </ul>
                          <Separator className="my-3" />
                          <div className="text-xs">
                            <span className="text-muted-foreground">Adesão: </span>
                            <span className="font-medium">{formatCurrency(planoPreco.plano.valor_adesao)}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Navegação */}
                <div className="flex justify-between pt-2">
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Voltar
                  </Button>
                  <Button 
                    type="button"
                    onClick={() => setStep(3)} 
                    disabled={!canGoToStep3}
                  >
                    Revisar Cotação
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: Resumo */}
            {step === 3 && planoSelecionadoData && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Card do Veículo */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Car className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Veículo</span>
                    </div>
                    <div className="text-sm">
                      {getMarcaNome() && getModeloNome() ? (
                        <>
                          <p className="font-medium">{getMarcaNome()} {getModeloNome()}</p>
                          <p className="text-muted-foreground">
                            {getAnoNome()} {placa && `• Placa: ${placa}`}
                          </p>
                        </>
                      ) : (
                        <p className="text-muted-foreground">Valor FIPE informado manualmente</p>
                      )}
                      <p className="font-semibold text-primary mt-1">
                        FIPE: {formatCurrency(valorFipe)}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Card do Plano */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{planoSelecionadoData.plano.nome}</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cota mensal</span>
                        <span>{formatCurrency(planoSelecionadoData.valorCota)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Taxa administrativa</span>
                        <span>{formatCurrency(planoSelecionadoData.taxaAdmin)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rastreamento</span>
                        <span>{formatCurrency(planoSelecionadoData.rastreamento)}</span>
                      </div>
                      {planoSelecionadoData.assistencia > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Assistência 24h</span>
                          <span>{formatCurrency(planoSelecionadoData.assistencia)}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between font-bold text-lg pt-1">
                        <span>Total Mensal</span>
                        <span className="text-primary">{formatCurrency(planoSelecionadoData.totalMensal)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Adesão e Validade */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Adesão</p>
                    <p className="font-bold">{formatCurrency(planoSelecionadoData.plano.valor_adesao)}</p>
                  </div>
                  <FormField
                    control={form.control}
                    name="validade_dias"
                    render={({ field }) => (
                      <FormItem className="bg-muted/50 rounded-lg p-3 text-center space-y-0">
                        <FormLabel className="text-xs text-muted-foreground">Validade</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={1} 
                            max={30}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            className="h-7 text-center font-bold bg-transparent border-0 p-0"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">dias</p>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Navegação */}
                <div className="flex justify-between pt-2">
                  <Button type="button" variant="outline" onClick={() => setStep(2)}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Alterar Plano
                  </Button>
                  <Button type="submit" disabled={createCotacao.isPending}>
                    {createCotacao.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Check className="h-4 w-4 mr-1" />
                    )}
                    Criar Cotação
                  </Button>
                </div>
              </div>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
