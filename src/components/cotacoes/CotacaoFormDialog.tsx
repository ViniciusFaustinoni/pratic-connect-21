import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Car, Search, CheckCircle2, Shield, Check, AlertCircle, Copy, MessageCircle, Zap, User, Link, UserCheck, Phone, Mail, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LeadCombobox } from '@/components/leads/LeadCombobox';
import type { Lead } from '@/types/vendas';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CurrencyInput, TelefoneInput } from '@/components/inputs/MaskedInputs';
import { cotacaoSchema, type CotacaoFormData } from '@/lib/validations';
import { useCreateCotacao } from '@/hooks/useCotacoes';
import { usePlanosCotacao, type PlanoCotacao } from '@/hooks/usePlanosCotacao';
import { useLead } from '@/hooks/useLeads';
import { useFipe, type PlateResult, type FipeMarca, type FipeModelo, type FipeAno } from '@/hooks/useFipe';
import { useVendedores } from '@/hooks/useVendedores';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { VehicleCategorySelect, CATEGORIAS_VEICULO } from '@/components/cotador/VehicleCategorySelect';

// Alertas baseados na categoria selecionada
const ALERTAS_CATEGORIA: Record<string, { tipo: 'warning' | 'info'; mensagem: string }> = {
  leilao: {
    tipo: 'warning',
    mensagem: 'Veículos de leilão não possuem cobertura de incêndio.',
  },
  aplicativo: {
    tipo: 'info',
    mensagem: 'Categoria APP: cota de participação será 8% (mínimo R$ 3.000).',
  },
  chassi_remarcado: {
    tipo: 'warning',
    mensagem: 'Veículo sujeito à análise de aceitação prévia.',
  },
  taxi: {
    tipo: 'info',
    mensagem: 'Categoria especial: valores diferenciados podem ser aplicados.',
  },
  ex_taxi: {
    tipo: 'info',
    mensagem: 'Categoria especial: valores diferenciados podem ser aplicados.',
  },
  placa_vermelha: {
    tipo: 'info',
    mensagem: 'Veículo de aluguel: valores diferenciados podem ser aplicados.',
  },
  ressarcimento_integral: {
    tipo: 'warning',
    mensagem: 'Veículo com histórico de ressarcimento integral. Sujeito à análise.',
  },
};

interface CotacaoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string;
}

export function CotacaoFormDialog({ open, onOpenChange, leadId }: CotacaoFormDialogProps) {
  const navigate = useNavigate();
  const createCotacao = useCreateCotacao();
  const { data: lead } = useLead(leadId);
  const { getMarcas, getModelos, getAnos, getPreco, getByPlaca, buscarPorNome, loading: fipeLoading } = useFipe();
  const { data: vendedores = [], isLoading: vendedoresLoading } = useVendedores();
  
  // Estados para dados do cliente
  const [nomeCliente, setNomeCliente] = useState('');
  const [telefoneCliente, setTelefoneCliente] = useState('');
  const [emailCliente, setEmailCliente] = useState('');
  
  // Estados para busca por placa
  const [placa, setPlaca] = useState('');
  const [buscandoPlaca, setBuscandoPlaca] = useState(false);
  const [veiculoEncontrado, setVeiculoEncontrado] = useState<PlateResult | null>(null);

  // Estados para confirmação de valor de adesão
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<CotacaoFormData | null>(null);

  // Estados para seleção FIPE manual
  const [marcas, setMarcas] = useState<FipeMarca[]>([]);
  const [modelos, setModelos] = useState<FipeModelo[]>([]);
  const [anos, setAnos] = useState<FipeAno[]>([]);
  const [marcaSelecionada, setMarcaSelecionada] = useState('');
  const [modeloSelecionado, setModeloSelecionado] = useState('');
  const [anoSelecionado, setAnoSelecionado] = useState('');
  
  // Estado para categoria/deságio
  const [categoria, setCategoria] = useState<string | null>('nenhuma');
  
  // Loading states
  const [loadingMarcas, setLoadingMarcas] = useState(false);
  const [loadingModelos, setLoadingModelos] = useState(false);
  const [loadingAnos, setLoadingAnos] = useState(false);
  const [buscandoFipe, setBuscandoFipe] = useState(false);

  // Estado para plano selecionado
  const [planoSelecionadoData, setPlanoSelecionadoData] = useState<PlanoCotacao | null>(null);

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
      vendedor_id: null,
    },
  });

  const valorFipe = form.watch('valor_fipe');
  const planoId = form.watch('plano_id');
  const validadeDias = form.watch('validade_dias');
  const valorAdesao = form.watch('valor_adesao');
  
  // Extrair ano numérico para o hook de planos
  const anoTexto = useMemo(() => {
    if (veiculoEncontrado?.vehicleData?.ano) return veiculoEncontrado.vehicleData.ano;
    const ano = anos.find(a => a.codigo === anoSelecionado);
    return ano?.nome || '';
  }, [veiculoEncontrado, anos, anoSelecionado]);
  
  const anoNumerico = useMemo(() => {
    return anoTexto ? parseInt(anoTexto.split(' ')[0]) : undefined;
  }, [anoTexto]);

  // Hook de planos calculados dinamicamente do banco
  const { planos: planosCalculados, isLoading: planosLoading } = usePlanosCotacao({
    valorFipe,
    regiao: 'rj', // Default RJ - pode ser ajustado
    combustivel: veiculoEncontrado?.vehicleData?.combustivel || undefined,
    categoria: categoria || undefined,
    anoVeiculo: anoNumerico,
  });

  // Validação de dados do cliente
  const dadosClienteValidos = useMemo(() => {
    const nomeValido = nomeCliente.trim().length >= 3;
    const telefoneValido = telefoneCliente.replace(/\D/g, '').length >= 10;
    return nomeValido && telefoneValido;
  }, [nomeCliente, telefoneCliente]);

  // Alerta da categoria selecionada
  const alertaCategoria = useMemo(() => {
    if (!categoria) return null;
    return ALERTAS_CATEGORIA[categoria] || null;
  }, [categoria]);

  // Resetar formulário quando o modal abre sem leadId
  useEffect(() => {
    if (open && !leadId) {
      // Resetar todos os estados para começar limpo
      form.reset({
        lead_id: null,
        plano_id: '',
        valor_fipe: 0,
        valor_cota: 0,
        taxa_administrativa: 0,
        valor_rastreamento: 0,
        valor_adesao: 0,
        valor_total_mensal: 0,
        validade_dias: 7,
        vendedor_id: null,
      });
      setVeiculoEncontrado(null);
      setPlaca('');
      setPlanoSelecionadoData(null);
      setMarcaSelecionada('');
      setModeloSelecionado('');
      setAnoSelecionado('');
      setModelos([]);
      setAnos([]);
      setNomeCliente('');
      setTelefoneCliente('');
      setEmailCliente('');
      setCategoria('nenhuma');
    }
  }, [open, leadId, form]);

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

  // Função de fuzzy match para encontrar melhor modelo
  const fuzzyMatchModelo = (modeloVeiculo: string, modeloFipe: string): number => {
    if (!modeloVeiculo || !modeloFipe) return 0;
    
    const veiculoNorm = modeloVeiculo.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const fipeNorm = modeloFipe.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (fipeNorm.includes(veiculoNorm) || veiculoNorm.includes(fipeNorm)) {
      return 100;
    }
    
    const palavraChave = veiculoNorm.split(' ')[0];
    if (palavraChave.length >= 3 && fipeNorm.includes(palavraChave)) {
      return 50;
    }
    
    const veiculoParts = veiculoNorm.split(' ').filter(p => p.length >= 2);
    const fipeParts = fipeNorm.split(' ').filter(p => p.length >= 2);
    
    let matches = 0;
    for (const vPart of veiculoParts) {
      if (fipeParts.some(fPart => fPart.includes(vPart) || vPart.includes(fPart))) {
        matches++;
      }
    }
    
    if (veiculoParts[0] && fipeParts.some(fp => fp.includes(veiculoParts[0]))) {
      matches += 3;
    }
    
    return matches * 10;
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
        
        const marcaNome = resultado.vehicleData.marca?.toLowerCase() || '';
        const modeloNome = resultado.vehicleData.modelo || '';
        const anoVeiculo = resultado.vehicleData.ano?.split('/')[0] || '';

        let marcasCarregadas = marcas;
        if (marcasCarregadas.length === 0) {
          setLoadingMarcas(true);
          marcasCarregadas = await getMarcas('carros');
          setMarcas(marcasCarregadas);
          setLoadingMarcas(false);
        }

        const marcaEncontrada = marcasCarregadas.find(m => {
          const mNome = m.nome.toLowerCase();
          return mNome.includes(marcaNome) || 
                 marcaNome.includes(mNome.split(' ')[0]) ||
                 mNome.split(' - ').some(part => marcaNome.includes(part.toLowerCase()));
        });

        if (marcaEncontrada) {
          setMarcaSelecionada(marcaEncontrada.codigo);
          
          setLoadingModelos(true);
          const modelosData = await getModelos(marcaEncontrada.codigo, 'carros');
          setModelos(modelosData);
          setLoadingModelos(false);

          const modelosComScore = modelosData.map(m => ({
            ...m,
            score: fuzzyMatchModelo(modeloNome, m.nome)
          }));

          let melhorModelo = modelosComScore
            .filter(m => m.score > 0)
            .sort((a, b) => b.score - a.score)[0];

          if (!melhorModelo && modelosData.length > 0) {
            const nomeBase = modeloNome.toLowerCase().split(' ')[0];
            if (nomeBase.length >= 3) {
              const modeloFallback = modelosData.find(m => 
                m.nome.toLowerCase().includes(nomeBase)
              );
              if (modeloFallback) {
                melhorModelo = { ...modeloFallback, score: 1 };
              }
            }
          }

          if (melhorModelo) {
            setModeloSelecionado(melhorModelo.codigo.toString());

            setLoadingAnos(true);
            const anosData = await getAnos(marcaEncontrada.codigo, melhorModelo.codigo.toString(), 'carros');
            setAnos(anosData);
            setLoadingAnos(false);

            let anoEncontrado = anosData.find(a => {
              const anoFipe = a.nome.split(' ')[0];
              return anoFipe === anoVeiculo;
            });

            if (!anoEncontrado && anosData.length > 0) {
              const anoNum = parseInt(anoVeiculo);
              if (!isNaN(anoNum)) {
                const anosComDiff = anosData.map(a => {
                  const anoFipeNum = parseInt(a.nome.split(' ')[0]);
                  return { ...a, diff: Math.abs(anoFipeNum - anoNum) };
                }).filter(a => !isNaN(a.diff));
                
                anoEncontrado = anosComDiff.sort((a, b) => a.diff - b.diff)[0];
              }
              
              if (!anoEncontrado) {
                anoEncontrado = anosData[0];
              }
            }

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
      // Preencher dados do cliente do lead
      setNomeCliente(lead.nome || '');
      setTelefoneCliente(lead.telefone || '');
      setEmailCliente(lead.email || '');
      
      if (lead.veiculo_fipe) {
        form.setValue('valor_fipe', lead.veiculo_fipe);
      }
      if (lead.veiculo_placa) {
        setPlaca(lead.veiculo_placa);
      }
      if (lead.veiculo_marca && lead.veiculo_modelo) {
        setVeiculoEncontrado({
          success: true,
          vehicleData: {
            marca: lead.veiculo_marca,
            modelo: lead.veiculo_modelo,
            marca_modelo: `${lead.veiculo_marca} ${lead.veiculo_modelo}`,
            ano: lead.veiculo_ano ? String(lead.veiculo_ano) : '',
            placa: lead.veiculo_placa || '',
            cor: '',
            chassi: '',
            municipio: '',
            uf: '',
            combustivel: ''
          },
          fipeData: lead.veiculo_fipe ? {
            valor: lead.veiculo_fipe,
            codigo: null,
            mesReferencia: null
          } : null
        });
      }
    }
  }, [lead, form]);

  // Handler de seleção de plano
  const handleSelectPlano = (plano: PlanoCotacao) => {
    form.setValue('plano_id', plano.id);
    form.setValue('valor_cota', plano.valorCota || 0);
    form.setValue('taxa_administrativa', plano.taxaAdministrativa || 0);
    form.setValue('valor_rastreamento', plano.valorRastreamento || 0);
    form.setValue('valor_total_mensal', plano.valorMensal);
    setPlanoSelecionadoData(plano);
  };

  // Handler para mudança de categoria
  const handleCategoriaChange = (value: string) => {
    setCategoria(value);
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
Cliente: ${nomeCliente}
Veículo: ${veiculoInfo}
FIPE: ${formatCurrency(valorFipe)}
Plano: ${planoSelecionadoData.nome}
Valor Mensal: ${formatCurrency(planoSelecionadoData.valorMensal)}
Taxa de Filiação: ${formatCurrency(form.getValues('valor_adesao') || 0)}
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
    
    const telefoneFormatado = telefoneCliente.replace(/\D/g, '');
    const texto = encodeURIComponent(`*Cotação Protecar*
Cliente: ${nomeCliente}
Veículo: ${veiculoInfo}
FIPE: ${formatCurrency(valorFipe)}
Plano: ${planoSelecionadoData.nome}
Valor Mensal: ${formatCurrency(planoSelecionadoData.valorMensal)}
Taxa de Filiação: ${formatCurrency(form.getValues('valor_adesao') || 0)}`);
    
    const whatsappUrl = telefoneFormatado.length >= 10 
      ? `https://wa.me/55${telefoneFormatado}?text=${texto}`
      : `https://wa.me/?text=${texto}`;
    
    window.open(whatsappUrl, '_blank');
  };

  // Abre o popup de confirmação de adesão
  const onSubmit = (data: CotacaoFormData) => {
    // Validar dados do cliente
    if (!dadosClienteValidos) {
      toast.error('Preencha o nome e telefone do cliente!');
      return;
    }
    
    // Validação extra (redundante mas segura)
    if (data.valor_adesao <= 0) {
      toast.error('O valor de adesão deve ser maior que zero!');
      return;
    }
    
    // Guardar dados e abrir popup de confirmação
    setPendingFormData(data);
    setShowConfirmDialog(true);
  };

  // Handler quando confirmar no popup
  const handleConfirmSubmit = async () => {
    if (!pendingFormData) return;
    
    setShowConfirmDialog(false);
    
    try {
      // Extrair ano numérico do texto (ex: "2022 Gasolina" -> 2022)
      const anoTextoLocal = getAnoNome();
      const anoNumericoLocal = anoTextoLocal ? parseInt(anoTextoLocal.split(' ')[0]) : null;
      
      await createCotacao.mutateAsync({
        lead_id: pendingFormData.lead_id,
        plano_id: pendingFormData.plano_id,
        valor_fipe: pendingFormData.valor_fipe,
        valor_cota: pendingFormData.valor_cota,
        taxa_administrativa: pendingFormData.taxa_administrativa,
        valor_rastreamento: pendingFormData.valor_rastreamento,
        valor_adesao: pendingFormData.valor_adesao,
        valor_total_mensal: pendingFormData.valor_total_mensal,
        valor_assistencia: planoSelecionadoData?.valorAssistencia || 0,
        validade_dias: pendingFormData.validade_dias,
        status: 'rascunho',
        // Dados do veículo
        veiculo_marca: getMarcaNome() || null,
        veiculo_modelo: getModeloNome() || null,
        veiculo_ano: anoNumericoLocal,
        veiculo_placa: placa || veiculoEncontrado?.extractedPlate || null,
        codigo_fipe: veiculoEncontrado?.fipeData?.codigo || null,
        // Consultor responsável
        vendedor_id: pendingFormData.vendedor_id || null,
        // Dados do cliente (campos adicionais que serão salvos via lead ou observações)
        categoria: categoria && categoria !== 'nenhuma' ? categoria : null,
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
      setPendingFormData(null);
      setNomeCliente('');
      setTelefoneCliente('');
      setEmailCliente('');
      setCategoria('nenhuma');
      
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
            
            {/* BLOCO 0: DADOS DO CLIENTE */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Dados do Cliente
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Nome do Cliente */}
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-sm">
                    Nome do Cliente <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="Nome completo do cliente"
                    value={nomeCliente}
                    onChange={(e) => setNomeCliente(e.target.value)}
                    className={cn(
                      nomeCliente.trim().length > 0 && nomeCliente.trim().length < 3 && "border-destructive"
                    )}
                  />
                  {nomeCliente.trim().length > 0 && nomeCliente.trim().length < 3 && (
                    <p className="text-xs text-destructive">Nome deve ter pelo menos 3 caracteres</p>
                  )}
                </div>
                
                {/* Telefone/WhatsApp */}
                <div className="space-y-1.5">
                  <Label className="text-sm flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    Telefone/WhatsApp <span className="text-destructive">*</span>
                  </Label>
                  <TelefoneInput
                    value={telefoneCliente}
                    onChange={setTelefoneCliente}
                    className={cn(
                      telefoneCliente.length > 0 && telefoneCliente.replace(/\D/g, '').length < 10 && "border-destructive"
                    )}
                  />
                  {telefoneCliente.length > 0 && telefoneCliente.replace(/\D/g, '').length < 10 && (
                    <p className="text-xs text-destructive">Telefone inválido</p>
                  )}
                </div>
                
                {/* E-mail */}
                <div className="space-y-1.5">
                  <Label className="text-sm flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    E-mail (opcional)
                  </Label>
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={emailCliente}
                    onChange={(e) => setEmailCliente(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* BLOCO 0.5: VINCULAR A LEAD (opcional) - só aparece quando não tem leadId */}
            {!leadId && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Link className="h-4 w-4 text-primary" />
                  Vincular a Lead (opcional)
                </h3>
                
                <LeadCombobox
                  value={form.watch('lead_id')}
                  onSelect={(selectedLeadId, selectedLead) => {
                    form.setValue('lead_id', selectedLeadId);
                    if (selectedLead) {
                      // Preencher dados do cliente
                      setNomeCliente(selectedLead.nome || '');
                      setTelefoneCliente(selectedLead.telefone || '');
                      setEmailCliente(selectedLead.email || '');
                      // Preencher dados do veículo se disponíveis
                      if (selectedLead.veiculo_fipe) {
                        form.setValue('valor_fipe', selectedLead.veiculo_fipe);
                      }
                      if (selectedLead.veiculo_placa) {
                        setPlaca(selectedLead.veiculo_placa);
                      }
                      // Preencher veículo encontrado para exibição
                      if (selectedLead.veiculo_marca && selectedLead.veiculo_modelo) {
                        setVeiculoEncontrado({
                          success: true,
                          vehicleData: {
                            marca: selectedLead.veiculo_marca,
                            modelo: selectedLead.veiculo_modelo,
                            marca_modelo: `${selectedLead.veiculo_marca} ${selectedLead.veiculo_modelo}`,
                            ano: selectedLead.veiculo_ano ? String(selectedLead.veiculo_ano) : '',
                            placa: selectedLead.veiculo_placa || '',
                            cor: '',
                            chassi: '',
                            municipio: '',
                            uf: '',
                            combustivel: ''
                          },
                          fipeData: selectedLead.veiculo_fipe ? {
                            valor: selectedLead.veiculo_fipe,
                            codigo: null,
                            mesReferencia: null
                          } : null
                        });
                      }
                      toast.success(`Dados de ${selectedLead.nome} carregados`);
                    } else {
                      // Limpar dados se desvincular
                      setVeiculoEncontrado(null);
                      setPlaca('');
                      form.setValue('valor_fipe', 0);
                      setNomeCliente('');
                      setTelefoneCliente('');
                      setEmailCliente('');
                    }
                  }}
                  placeholder="Buscar lead por nome ou telefone..."
                />
                
                <p className="text-xs text-muted-foreground">
                  Vincule a um lead para que esta cotação apareça no histórico dele
                </p>
              </div>
            )}

            {/* BLOCO 0.6: CONSULTOR RESPONSÁVEL */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                Consultor Responsável
              </h3>
              
              <FormField
                control={form.control}
                name="vendedor_id"
                render={({ field }) => (
                  <FormItem>
                    <Select 
                      onValueChange={(value) => field.onChange(value === '_none' ? null : value)} 
                      value={field.value || '_none'}
                      disabled={vendedoresLoading}
                    >
                      <FormControl>
                        <SelectTrigger>
                          {vendedoresLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <SelectValue placeholder="Selecione um consultor" />
                          )}
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="_none">Não atribuído</SelectItem>
                        {vendedores.map((v) => (
                          <SelectItem key={v.id} value={v.user_id}>
                            {v.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

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

              {/* Divisor e Seleção manual - só aparece se FIPE não retornou dados */}
              {!(veiculoEncontrado?.success && veiculoEncontrado.vehicleData && valorFipe > 0) && (
                <>
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
                </>
              )}
            </div>

            <Separator />

            {/* BLOCO 1.5: VALOR FIPE */}
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

            {/* BLOCO 2: CONDIÇÕES ESPECIAIS / DESÁGIOS */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Condições Especiais / Deságios
              </h3>
              
              <VehicleCategorySelect
                value={categoria}
                onChange={handleCategoriaChange}
              />

              {/* Alerta dinâmico baseado na categoria */}
              {alertaCategoria && (
                <Alert 
                  className={
                    alertaCategoria.tipo === 'warning' 
                      ? 'border-amber-500/50 bg-amber-500/10' 
                      : 'border-blue-500/50 bg-blue-500/10'
                  }
                >
                  {alertaCategoria.tipo === 'warning' ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Info className="h-4 w-4 text-blue-500" />
                  )}
                  <AlertDescription className={
                    alertaCategoria.tipo === 'warning'
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-blue-700 dark:text-blue-400'
                  }>
                    {alertaCategoria.mensagem}
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            {/* BLOCO 2.5: TAXA DE FILIAÇÃO */}
            <div>
              <Label className="text-sm font-semibold">Taxa de Filiação *</Label>
              <FormField
                control={form.control}
                name="valor_adesao"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <CurrencyInput 
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="R$ 0,00"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Informe a taxa de filiação que será cobrada do associado
              </p>
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
              ) : valorFipe > 0 && planosCalculados.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {planosCalculados.map((plano) => (
                    <Card 
                      key={plano.id}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-md",
                        planoId === plano.id 
                          ? "ring-2 ring-primary border-primary bg-primary/5" 
                          : "hover:border-primary/50",
                        plano.destaque && "border-amber-500/50"
                      )}
                      onClick={() => handleSelectPlano(plano)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-sm">{plano.nome}</h4>
                          {planoId === plano.id ? (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          ) : plano.destaque ? (
                            <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600">
                              Recomendado
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xl font-bold text-primary mb-3">
                          {formatCurrency(plano.valorMensal)}
                          <span className="text-xs font-normal text-muted-foreground">/mês</span>
                        </p>
                        <ul className="text-xs space-y-1 text-muted-foreground">
                          {plano.valorCota !== undefined && (
                            <li>• Cota: {formatCurrency(plano.valorCota)}</li>
                          )}
                          {plano.taxaAdministrativa !== undefined && (
                            <li>• Taxa: {formatCurrency(plano.taxaAdministrativa)}</li>
                          )}
                          {plano.valorRastreamento !== undefined && (
                            <li>• Rast.: {formatCurrency(plano.valorRastreamento)}</li>
                          )}
                          {(plano.valorAssistencia || 0) > 0 && (
                            <li>• Assist.: {formatCurrency(plano.valorAssistencia || 0)}</li>
                          )}
                        </ul>
                        <Separator className="my-3" />
                        <div className="text-xs flex items-center gap-1">
                          <span className="text-muted-foreground">Filiação: </span>
                          <span className="font-medium text-primary">{formatCurrency(valorAdesao || 0)}</span>
                        </div>
                        {plano.alertaDesagio && (
                          <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {plano.alertaDesagio}
                          </p>
                        )}
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
                      Verifique se há planos cadastrados para a faixa de R$ {valorFipe.toLocaleString('pt-BR')}
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
                        <p className="text-xs text-muted-foreground">Cliente</p>
                        <p className="font-medium">{nomeCliente || 'Não informado'}</p>
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
                        <p className="text-xs text-muted-foreground">{planoSelecionadoData.nome}</p>
                        <p className="text-2xl font-bold text-primary">
                          {formatCurrency(planoSelecionadoData.valorMensal)}
                        </p>
                        <p className="text-xs text-muted-foreground">/mês</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t text-sm">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Filiação:</span>
                          <FormField
                            control={form.control}
                            name="valor_adesao"
                            render={({ field }) => (
                              <FormItem className="flex items-center gap-1 space-y-0">
                                <FormControl>
                                  <CurrencyInput 
                                    value={field.value}
                                    onChange={field.onChange}
                                    className={cn(
                                      "w-28 h-7 text-center font-medium",
                                      field.value <= 0 && "border-destructive bg-destructive/5"
                                    )}
                                    placeholder="R$ 0,00"
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        {valorAdesao <= 0 && (
                          <p className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            A taxa de filiação não pode ser zero
                          </p>
                        )}
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
                disabled={createCotacao.isPending || !planoSelecionadoData || valorAdesao <= 0 || !dadosClienteValidos}
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

      {/* Dialog de Confirmação de Taxa de Filiação */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Taxa de Filiação</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>Você está definindo a taxa de filiação como:</p>
                <div className="text-3xl font-bold text-center text-primary py-4 bg-primary/5 rounded-lg">
                  {formatCurrency(pendingFormData?.valor_adesao || 0)}
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Cliente: <strong>{nomeCliente}</strong>
                </p>
                <p className="text-sm text-muted-foreground text-center">
                  Este valor será cobrado do associado. Confirma?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingFormData(null)}>
              Revisar Valor
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSubmit}>
              Confirmar e Criar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
