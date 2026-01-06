import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Car, Search, CheckCircle2, Shield, Check, AlertCircle, Copy, MessageCircle, Zap } from 'lucide-react';
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

export function CotacaoFormDialog({ open, onOpenChange, leadId }: CotacaoFormDialogProps) {
  const navigate = useNavigate();
  const createCotacao = useCreateCotacao();
  const { data: planos, isLoading: planosLoading } = usePlanos();
  const { data: lead } = useLead(leadId);
  const { getMarcas, getModelos, getAnos, getPreco, getByPlaca, buscarPorNome, loading: fipeLoading } = useFipe();

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
  const validadeDias = form.watch('validade_dias');
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

  // Copiar valores para clipboard
  const copiarValores = () => {
    if (!planoSelecionadoData) return;
    
    const veiculoInfo = getMarcaNome() && getModeloNome() 
      ? `${getMarcaNome()} ${getModeloNome()} ${getAnoNome()}`
      : 'Veículo não informado';
    
    const texto = `*Cotação Protecar*
Veículo: ${veiculoInfo}
FIPE: ${formatCurrency(valorFipe)}
Plano: ${planoSelecionadoData.plano.nome}
Valor Mensal: ${formatCurrency(planoSelecionadoData.totalMensal)}
Adesão: ${formatCurrency(planoSelecionadoData.plano.valor_adesao)}
Validade: ${validadeDias} dias`;
    
    navigator.clipboard.writeText(texto);
    toast.success('Valores copiados!');
  };

  // Enviar por WhatsApp
  const enviarWhatsApp = () => {
    if (!planoSelecionadoData) return;
    
    const veiculoInfo = getMarcaNome() && getModeloNome() 
      ? `${getMarcaNome()} ${getModeloNome()} ${getAnoNome()}`
      : 'Veículo não informado';
    
    const texto = encodeURIComponent(`*Cotação Protecar*
Veículo: ${veiculoInfo}
FIPE: ${formatCurrency(valorFipe)}
Plano: ${planoSelecionadoData.plano.nome}
Valor Mensal: ${formatCurrency(planoSelecionadoData.totalMensal)}
Adesão: ${formatCurrency(planoSelecionadoData.plano.valor_adesao)}`);
    
    window.open(`https://wa.me/?text=${texto}`, '_blank');
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
      
      // Fechar modal
      onOpenChange(false);
      
      // Redirecionar para a página de cotações
      navigate('/vendas/cotacoes');
    } catch (error) {
      toast.error('Erro ao criar cotação');
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Cotação Rápida
          </DialogTitle>
          <DialogDescription>
            {lead ? `Cotação para ${lead.nome}` : 'Faça uma cotação em segundos'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            
            {/* BLOCO 1: VEÍCULO */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Car className="h-4 w-4 text-primary" />
                Veículo
              </h3>
              
              {/* Busca por placa */}
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

              {/* Veículo encontrado - inline */}
              {veiculoEncontrado?.success && veiculoEncontrado.vehicleData && (
                <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                  <span className="font-medium">
                    {veiculoEncontrado.vehicleData.marca} {veiculoEncontrado.vehicleData.modelo} {veiculoEncontrado.vehicleData.ano}
                  </span>
                  <span className="text-muted-foreground">• {veiculoEncontrado.vehicleData.cor}</span>
                </div>
              )}

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

              {/* Seleção manual - grid compacto */}
              <div className="grid grid-cols-3 gap-2">
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
            </div>

            <Separator />

            {/* BLOCO 2: VALOR FIPE */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Valor FIPE</Label>
                {valorFipe > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {veiculoEncontrado?.fipeData?.valor ? 'Automático' : 'Manual'}
                  </Badge>
                )}
              </div>
              <FormField
                control={form.control}
                name="valor_fipe"
                render={({ field }) => (
                  <FormItem>
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
            </div>

            <Separator />

            {/* BLOCO 3: PLANOS - Sempre visível */}
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Shield className="h-4 w-4 text-primary" />
                Selecione o Plano
              </h3>

              {planosLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : valorFipe > 0 && planosComPrecos.length > 0 ? (
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
              ) : valorFipe > 0 ? (
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
                <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                  <p className="text-sm">Informe o valor FIPE para ver os planos disponíveis</p>
                </div>
              )}
            </div>

            {/* BLOCO 4: RESUMO INLINE (quando plano selecionado) */}
            {planoSelecionadoData && (
              <>
                <Separator />
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Veículo</p>
                        <p className="font-medium">
                          {getMarcaNome() && getModeloNome() 
                            ? `${getMarcaNome()} ${getModeloNome()} ${getAnoNome()}`
                            : 'Valor FIPE informado manualmente'
                          }
                        </p>
                        <p className="text-sm text-muted-foreground">FIPE: {formatCurrency(valorFipe)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{planoSelecionadoData.plano.nome}</p>
                        <p className="text-2xl font-bold text-primary">
                          {formatCurrency(planoSelecionadoData.totalMensal)}
                        </p>
                        <p className="text-xs text-muted-foreground">/mês</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t text-sm">
                      <div>
                        <span className="text-muted-foreground">Adesão:</span>{' '}
                        <strong>{formatCurrency(planoSelecionadoData.plano.valor_adesao)}</strong>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Validade:</span>
                        <FormField
                          control={form.control}
                          name="validade_dias"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-1 space-y-0">
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min={1} 
                                  max={30}
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 7)}
                                  className="w-14 h-7 text-center font-medium"
                                />
                              </FormControl>
                              <span className="text-muted-foreground">dias</span>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* BLOCO 5: AÇÕES */}
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  disabled={!planoSelecionadoData}
                  onClick={copiarValores}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copiar
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  disabled={!planoSelecionadoData}
                  onClick={enviarWhatsApp}
                >
                  <MessageCircle className="h-4 w-4 mr-1" />
                  WhatsApp
                </Button>
              </div>
              <Button 
                type="submit" 
                disabled={createCotacao.isPending || !planoSelecionadoData}
              >
                {createCotacao.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                Criar Cotação
              </Button>
            </div>
            
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
