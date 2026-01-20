import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Car, Search, CheckCircle2, Shield, Check, AlertCircle, Copy, MessageCircle, Zap, User, Link, UserCheck, Phone, Mail, AlertTriangle, Info, MapPin, HelpCircle, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
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
import { useCreateCotacao, useUpdateCotacao } from '@/hooks/useCotacoes';
import { usePlanosCotacao, type PlanoCotacao } from '@/hooks/usePlanosCotacao';
import { useLead } from '@/hooks/useLeads';
import { useFipe, type PlateResult, type FipeMarca, type FipeModelo, type FipeAno } from '@/hooks/useFipe';
import { useVendedores } from '@/hooks/useVendedores';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { VehicleCategorySelect, CATEGORIAS_VEICULO } from '@/components/cotador/VehicleCategorySelect';
import { isCoberturaRemovida } from '@/data/restricoesCategorias';

// Regiões disponíveis no sistema
const REGIOES = [
  { value: 'rio_de_janeiro', label: 'Rio de Janeiro - Capital e Região Metropolitana' },
  { value: 'regiao_lagos', label: 'Região dos Lagos' },
  { value: 'sao_paulo', label: 'São Paulo - Capital e Região Metropolitana' },
  { value: 'interior_rj', label: 'Interior do Rio de Janeiro' },
  { value: 'interior_sp', label: 'Interior de São Paulo' },
];

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

// Interface para cotação base (duplicação)
export interface CotacaoBaseParaFormulario {
  valor_fipe: number | null;
  valor_adicional: number | null;
  valor_adesao: number | null;
  validade_dias: number | null;
  veiculo_marca: string | null;
  veiculo_modelo: string | null;
  veiculo_ano: number | null;
  veiculo_placa: string | null;
  codigo_fipe: string | null;
  categoria: string | null;
  regiao: string | null;
  nome_solicitante: string | null;
  telefone1_solicitante: string | null;
  email_solicitante: string | null;
  lead_id: string | null;
  plano_id: string | null;
  dados_extras?: {
    planos_comparacao?: {
      id: string;
      nome: string;
      codigo?: string;
      valorMensal: number;
      coberturas?: string[];
    }[];
  } | null;
}

export interface CotacaoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string;
  cotacaoBase?: CotacaoBaseParaFormulario | null;
  /** Cotação existente para edição (somente rascunhos) */
  cotacaoParaEditar?: CotacaoBaseParaFormulario & { id: string } | null;
  /** Callback após salvar com sucesso */
  onSuccess?: () => void;
}

export function CotacaoFormDialog({ open, onOpenChange, leadId, cotacaoBase, cotacaoParaEditar, onSuccess }: CotacaoFormDialogProps) {
  const navigate = useNavigate();
  const createCotacao = useCreateCotacao();
  const updateCotacao = useUpdateCotacao();
  const isEditando = !!cotacaoParaEditar;
  const { data: lead } = useLead(leadId);
  const { getMarcas, getModelos, getAnos, getPreco, getByPlaca, buscarPorNome, loading: fipeLoading } = useFipe();
  const { data: vendedores = [], isLoading: vendedoresLoading } = useVendedores();
  const { user } = useAuth();
  const { userId, isDiretor, isGerente, isSupervisor } = usePermissions();
  
  // Apenas liderança (diretor, gerente, supervisor) pode atribuir vendedor manualmente
  const podeAtribuirVendedor = isDiretor || isGerente || isSupervisor;
  
  // Estados para dados do associado
  const [nomeAssociado, setNomeAssociado] = useState('');
  const [telefoneAssociado, setTelefoneAssociado] = useState('');
  const [emailAssociado, setEmailAssociado] = useState('');
  
  // Estado para uso do veículo (passeio ou aplicativo)
  const [usoVeiculo, setUsoVeiculo] = useState<'particular' | 'aplicativo'>('particular');
  
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
  
  // Estado para região selecionada
  const [regiaoSelecionada, setRegiaoSelecionada] = useState<string>('');
  
  // Loading states
  const [loadingMarcas, setLoadingMarcas] = useState(false);
  const [loadingModelos, setLoadingModelos] = useState(false);
  const [loadingAnos, setLoadingAnos] = useState(false);
  const [buscandoFipe, setBuscandoFipe] = useState(false);

  // Estado para planos selecionados (múltipla seleção - sem limite)
  const [planosSelecionados, setPlanosSelecionados] = useState<PlanoCotacao[]>([]);
  
  // Estado para controlar quais planos têm benefícios expandidos
  const [expandedPlanos, setExpandedPlanos] = useState<Record<string, boolean>>({});
  
  // Toggle para expandir/recolher benefícios de um plano
  const toggleExpandPlano = useCallback((planoId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedPlanos(prev => ({ ...prev, [planoId]: !prev[planoId] }));
  }, []);

  const form = useForm<CotacaoFormData>({
    resolver: zodResolver(cotacaoSchema),
    defaultValues: {
      lead_id: leadId || null,
      plano_id: '',
      valor_fipe: 0,
      valor_adicional: 0,
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
  const valorAdicional = form.watch('valor_adicional') || 0;
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
    valorAdicional,
    regiao: 'rj', // Default RJ - pode ser ajustado
    combustivel: veiculoEncontrado?.vehicleData?.combustivel || undefined,
    categoria: usoVeiculo === 'aplicativo' ? 'aplicativo' : (categoria || undefined),
    anoVeiculo: anoNumerico,
    usoApp: usoVeiculo === 'aplicativo',
  });

  // Validação de dados do associado
  const dadosAssociadoValidos = useMemo(() => {
    const nomeValido = nomeAssociado.trim().length >= 3;
    const telefoneValido = telefoneAssociado.replace(/\D/g, '').length >= 10;
    return nomeValido && telefoneValido;
  }, [nomeAssociado, telefoneAssociado]);

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
        valor_adicional: 0,
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
      setPlanosSelecionados([]);
      setMarcaSelecionada('');
      setModeloSelecionado('');
      setAnoSelecionado('');
      setModelos([]);
      setAnos([]);
      setNomeAssociado('');
      setTelefoneAssociado('');
      setEmailAssociado('');
      setCategoria('nenhuma');
      setUsoVeiculo('particular');
      setRegiaoSelecionada('');
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

  // Buscar por placa - SIMPLIFICADO: NÃO chama API FIPE após ter dados
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
        // Armazenar dados do veículo - SEM chamar API FIPE adicional
        setVeiculoEncontrado(resultado);
        
        // Limpar seleções manuais (não serão usadas)
        setMarcaSelecionada('');
        setModeloSelecionado('');
        setAnoSelecionado('');
        setModelos([]);
        setAnos([]);

        // Preencher valor FIPE diretamente dos dados retornados
        if (resultado.fipeData?.valor) {
          form.setValue('valor_fipe', resultado.fipeData.valor);
          toast.success(`Veículo encontrado! FIPE: R$ ${resultado.fipeData.valor.toLocaleString('pt-BR')}`);
        } else {
          // Se não veio FIPE, tentar buscar por nome (fallback único)
          const anoVeiculo = resultado.vehicleData.ano?.split('/')[0] || '';
          try {
            const fipeResult = await buscarPorNome(
              resultado.vehicleData.marca,
              resultado.vehicleData.modelo,
              anoVeiculo,
              'carros'
            );
            if (fipeResult?.valorNumerico) {
              form.setValue('valor_fipe', fipeResult.valorNumerico);
              toast.success(`Veículo encontrado! FIPE: ${fipeResult.valor}`);
            } else {
              toast.success(`Veículo encontrado: ${resultado.vehicleData.marca} ${resultado.vehicleData.modelo}`);
              toast.info('Informe o valor FIPE manualmente se necessário');
            }
          } catch {
            toast.success(`Veículo encontrado: ${resultado.vehicleData.marca} ${resultado.vehicleData.modelo}`);
            toast.info('Informe o valor FIPE manualmente se necessário');
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
      // Preencher dados do associado do lead
      setNomeAssociado(lead.nome || '');
      setTelefoneAssociado(lead.telefone || '');
      setEmailAssociado(lead.email || '');
      
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

  // Efeito para preencher o formulário com dados da cotação base (duplicação)
  useEffect(() => {
    if (cotacaoBase && open) {
      // Preencher dados do formulário
      if (cotacaoBase.valor_fipe) {
        form.setValue('valor_fipe', cotacaoBase.valor_fipe);
      }
      if (cotacaoBase.valor_adicional) {
        form.setValue('valor_adicional', cotacaoBase.valor_adicional);
      }
      if (cotacaoBase.valor_adesao) {
        form.setValue('valor_adesao', cotacaoBase.valor_adesao);
      }
      if (cotacaoBase.validade_dias) {
        form.setValue('validade_dias', cotacaoBase.validade_dias);
      }
      if (cotacaoBase.lead_id) {
        form.setValue('lead_id', cotacaoBase.lead_id);
      }
      if (cotacaoBase.plano_id) {
        form.setValue('plano_id', cotacaoBase.plano_id);
      }
      
      // Preencher dados do solicitante
      setNomeAssociado(cotacaoBase.nome_solicitante || '');
      setTelefoneAssociado(cotacaoBase.telefone1_solicitante || '');
      setEmailAssociado(cotacaoBase.email_solicitante || '');
      
      // Preencher placa
      if (cotacaoBase.veiculo_placa) {
        setPlaca(cotacaoBase.veiculo_placa);
      }
      
      // Preencher categoria
      if (cotacaoBase.categoria) {
        setCategoria(cotacaoBase.categoria);
      }
      
      // Preencher região
      if (cotacaoBase.regiao) {
        setRegiaoSelecionada(cotacaoBase.regiao);
      }
      
      // Preencher dados do veículo encontrado
      if (cotacaoBase.veiculo_marca && cotacaoBase.veiculo_modelo) {
        setVeiculoEncontrado({
          success: true,
          vehicleData: {
            marca: cotacaoBase.veiculo_marca,
            modelo: cotacaoBase.veiculo_modelo,
            marca_modelo: `${cotacaoBase.veiculo_marca} ${cotacaoBase.veiculo_modelo}`,
            ano: cotacaoBase.veiculo_ano ? String(cotacaoBase.veiculo_ano) : '',
            placa: cotacaoBase.veiculo_placa || '',
            cor: '',
            chassi: '',
            municipio: '',
            uf: '',
            combustivel: ''
          },
          fipeData: cotacaoBase.valor_fipe ? {
            valor: cotacaoBase.valor_fipe,
            codigo: cotacaoBase.codigo_fipe,
            mesReferencia: null
          } : null
        });
      }
    }
  }, [cotacaoBase, open, form]);

  const handleTogglePlano = (plano: PlanoCotacao) => {
    setPlanosSelecionados(prev => {
      const jaExiste = prev.some(p => p.id === plano.id);
      if (jaExiste) {
        // Remove o plano
        const novos = prev.filter(p => p.id !== plano.id);
        // Se restam planos, atualiza o form com o primeiro
        if (novos.length > 0) {
          const primeiro = novos[0];
          form.setValue('plano_id', primeiro.id);
          form.setValue('valor_cota', primeiro.valorCota || 0);
          form.setValue('taxa_administrativa', primeiro.taxaAdministrativa || 0);
          form.setValue('valor_rastreamento', primeiro.valorRastreamento || 0);
          const adicional = form.getValues('valor_adicional') || 0;
          form.setValue('valor_total_mensal', primeiro.valorMensal + adicional);
        } else {
          form.setValue('plano_id', '');
        }
        return novos;
      }
      // Adiciona o plano (sem limite de quantidade)
      const novos = [...prev, plano];
      // Se for o primeiro, define no form
      if (novos.length === 1) {
        form.setValue('plano_id', plano.id);
        form.setValue('valor_cota', plano.valorCota || 0);
        form.setValue('taxa_administrativa', plano.taxaAdministrativa || 0);
        form.setValue('valor_rastreamento', plano.valorRastreamento || 0);
        const adicional = form.getValues('valor_adicional') || 0;
        form.setValue('valor_total_mensal', plano.valorMensal + adicional);
      }
      return novos;
    });
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
    if (planosSelecionados.length === 0) return;
    
    const veiculoInfo = getMarcaNome() && getModeloNome() 
      ? `${getMarcaNome()} ${getModeloNome()} ${getAnoNome()}`
      : 'Veículo não informado';
    
    let texto = `*Cotação Praticcar*\n` +
      `Associado: ${nomeAssociado}\n` +
      `Veículo: ${veiculoInfo}\n` +
      `Uso: ${usoVeiculo === 'particular' ? 'Passeio' : 'Aplicativo'}\n` +
      `FIPE: ${formatCurrency(valorFipe)}\n\n`;
    
    if (planosSelecionados.length === 1) {
      const plano = planosSelecionados[0];
      texto += `Plano: ${plano.nome}\n` +
        `Proteção Mensal: ${formatCurrency(plano.valorMensal + valorAdicional)}\n`;
    } else {
      texto += `*Comparativo de Planos:*\n`;
      planosSelecionados.forEach((plano, idx) => {
        texto += `${idx + 1}. ${plano.nome}: ${formatCurrency(plano.valorMensal + valorAdicional)}/mês\n`;
      });
    }
    
    texto += `\nTaxa de Filiação: ${formatCurrency(form.getValues('valor_adesao') || 0)}\n` +
      `Validade: ${validadeDias} dias`;
    
    navigator.clipboard.writeText(texto);
    toast.success('Valores copiados!');
  };

  // Enviar por WhatsApp
  const enviarWhatsApp = () => {
    if (planosSelecionados.length === 0) return;
    
    const veiculoInfo = getMarcaNome() && getModeloNome() 
      ? `${getMarcaNome()} ${getModeloNome()} ${getAnoNome()}`
      : 'Veículo não informado';
    
    const telefoneFormatado = telefoneAssociado.replace(/\D/g, '');
    
    let texto = `*Cotação Praticcar*\n` +
      `Associado: ${nomeAssociado}\n` +
      `Veículo: ${veiculoInfo}\n` +
      `Uso: ${usoVeiculo === 'particular' ? 'Passeio' : 'Aplicativo'}\n` +
      `FIPE: ${formatCurrency(valorFipe)}\n\n`;
    
    if (planosSelecionados.length === 1) {
      const plano = planosSelecionados[0];
      texto += `Plano: ${plano.nome}\n` +
        `Proteção Mensal: ${formatCurrency(plano.valorMensal + valorAdicional)}\n`;
    } else {
      texto += `*Comparativo de Planos:*\n`;
      planosSelecionados.forEach((plano, idx) => {
        texto += `${idx + 1}. ${plano.nome}: ${formatCurrency(plano.valorMensal + valorAdicional)}/mês\n`;
      });
    }
    
    texto += `\nTaxa de Filiação: ${formatCurrency(form.getValues('valor_adesao') || 0)}\n` +
      `Validade: ${validadeDias} dias`;
    
    const whatsappUrl = telefoneFormatado.length >= 10 
      ? `https://wa.me/55${telefoneFormatado}?text=${encodeURIComponent(texto)}`
      : `https://wa.me/?text=${encodeURIComponent(texto)}`;
    
    window.open(whatsappUrl, '_blank');
  };

  // Abre o popup de confirmação de adesão
  const onSubmit = (data: CotacaoFormData) => {
    // Validar dados do associado
    if (!dadosAssociadoValidos) {
      toast.error('Preencha o nome e telefone do associado!');
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
      
      const valorAdicionalAtual = pendingFormData.valor_adicional || 0;
      
      const cotacaoData = {
        lead_id: pendingFormData.lead_id || null,
        plano_id: pendingFormData.plano_id,
        valor_fipe: pendingFormData.valor_fipe,
        valor_adicional: valorAdicionalAtual,
        valor_cota: pendingFormData.valor_cota,
        taxa_administrativa: pendingFormData.taxa_administrativa,
        valor_rastreamento: pendingFormData.valor_rastreamento,
        valor_adesao: pendingFormData.valor_adesao,
        valor_total_mensal: pendingFormData.valor_total_mensal,
        valor_assistencia: planosSelecionados[0]?.valorAssistencia || 0,
        validade_dias: pendingFormData.validade_dias,
        // Dados do veículo
        veiculo_marca: getMarcaNome() || null,
        veiculo_modelo: getModeloNome() || null,
        veiculo_ano: anoNumericoLocal,
        veiculo_placa: placa || veiculoEncontrado?.extractedPlate || null,
        veiculo_cor: veiculoEncontrado?.vehicleData?.cor || null,
        codigo_fipe: veiculoEncontrado?.fipeData?.codigo || null,
        // Dados do solicitante (para exibição no card quando não há lead)
        nome_solicitante: nomeAssociado.trim() || null,
        telefone1_solicitante: telefoneAssociado.replace(/\D/g, '') || null,
        email_solicitante: emailAssociado.trim() || null,
        // Categoria do veículo
        categoria: categoria && categoria !== 'nenhuma' ? categoria : null,
        // Região selecionada
        regiao: regiaoSelecionada || null,
        // Planos para comparação (múltiplos planos selecionados)
        dados_extras: {
          planos_comparacao: planosSelecionados.map(p => ({
            id: p.id,
            nome: p.nome,
            codigo: p.codigo,
            valorMensal: p.valorMensal + valorAdicionalAtual,
            valorAdesao: form.getValues('valor_adesao') || 0,
            coberturas: p.coberturas || [],
            naoInclui: p.naoInclui || [],
            coberturaFipe: p.coberturaFipe || 100,
            cota: p.cota,
            cotaPercentual: p.cotaPercentual,
            cotaMinima: p.cotaMinima,
            cotaDesagio: p.cotaDesagio,
            cotaMinimaDesagio: p.cotaMinimaDesagio,
            adicionalMensal: p.adicionalMensal,
            anoMinimo: p.anoMinimo,
            alertaDesagio: p.alertaDesagio,
            coberturasRemovidas: p.coberturasRemovidas || [],
          }))
        },
      };

      if (isEditando && cotacaoParaEditar) {
        // Modo edição: atualizar cotação existente
        await updateCotacao.mutateAsync({
          id: cotacaoParaEditar.id,
          ...cotacaoData,
        });
        
        toast.success('Cotação atualizada com sucesso!');
        
        // Callback de sucesso (para registrar histórico, etc)
        onSuccess?.();
      } else {
        // Modo criação: criar nova cotação
        await createCotacao.mutateAsync({
          ...cotacaoData,
          status: 'rascunho',
          // Consultor responsável - liderança escolhe, demais auto-atribuição
          // IMPORTANTE: Nunca deixar vendedor_id como null para garantir visibilidade via RLS
          vendedor_id: podeAtribuirVendedor 
            ? (pendingFormData.vendedor_id || userId || user?.id) 
            : (userId || user?.id),
        });
        
        toast.success('Cotação criada com sucesso!');
        
        // Redirecionar para a página de cotações
        navigate('/vendas/cotacoes');
      }
      
      // Resetar estados
      form.reset();
      setVeiculoEncontrado(null);
      setPlaca('');
      setPlanosSelecionados([]);
      setMarcaSelecionada('');
      setModeloSelecionado('');
      setAnoSelecionado('');
      setModelos([]);
      setAnos([]);
      setPendingFormData(null);
      setNomeAssociado('');
      setTelefoneAssociado('');
      setEmailAssociado('');
      setCategoria('nenhuma');
      setUsoVeiculo('particular');
      setRegiaoSelecionada('');
      
      // Fechar modal
      onOpenChange(false);
    } catch (error) {
      toast.error(isEditando ? 'Erro ao atualizar cotação' : 'Erro ao criar cotação');
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
            
            {/* BLOCO 0: DADOS DO ASSOCIADO */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Dados do Associado
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Nome do Associado */}
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-sm">
                    Nome do Associado <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="Nome completo do associado"
                    value={nomeAssociado}
                    onChange={(e) => setNomeAssociado(e.target.value)}
                    className={cn(
                      nomeAssociado.trim().length > 0 && nomeAssociado.trim().length < 3 && "border-destructive"
                    )}
                  />
                  {nomeAssociado.trim().length > 0 && nomeAssociado.trim().length < 3 && (
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
                    value={telefoneAssociado}
                    onChange={setTelefoneAssociado}
                    className={cn(
                      telefoneAssociado.length > 0 && telefoneAssociado.replace(/\D/g, '').length < 10 && "border-destructive"
                    )}
                  />
                  {telefoneAssociado.length > 0 && telefoneAssociado.replace(/\D/g, '').length < 10 && (
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
                    value={emailAssociado}
                    onChange={(e) => setEmailAssociado(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* BLOCO: REGIÃO */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Região
              </h3>
              
              <Select
                value={regiaoSelecionada}
                onValueChange={setRegiaoSelecionada}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a região" />
                </SelectTrigger>
                <SelectContent>
                  {REGIOES.map((regiao) => (
                    <SelectItem key={regiao.value} value={regiao.value}>
                      {regiao.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                A região define a tabela de preços aplicada
              </p>
            </div>

            <Separator />

            {/* BLOCO 0.3: USO DO VEÍCULO */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Car className="h-4 w-4 text-primary" />
                Uso do Veículo
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                {/* Passeio */}
                <div
                  onClick={() => setUsoVeiculo('particular')}
                  className={cn(
                    "relative cursor-pointer rounded-lg border-2 p-4 transition-all hover:shadow-md",
                    usoVeiculo === 'particular'
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full",
                      usoVeiculo === 'particular'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}>
                      <Car className="h-5 w-5" />
                    </div>
                    <div>
                      <p className={cn(
                        "font-semibold",
                        usoVeiculo === 'particular' && "text-primary"
                      )}>Passeio</p>
                      <p className="text-xs text-muted-foreground">Uso particular</p>
                    </div>
                  </div>
                  {usoVeiculo === 'particular' && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    </div>
                  )}
                </div>
                
                {/* Aplicativo */}
                <div
                  onClick={() => setUsoVeiculo('aplicativo')}
                  className={cn(
                    "relative cursor-pointer rounded-lg border-2 p-4 transition-all hover:shadow-md",
                    usoVeiculo === 'aplicativo'
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full",
                      usoVeiculo === 'aplicativo'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}>
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <p className={cn(
                        "font-semibold",
                        usoVeiculo === 'aplicativo' && "text-primary"
                      )}>Aplicativo</p>
                      <p className="text-xs text-muted-foreground">Uber, 99, etc</p>
                    </div>
                  </div>
                  {usoVeiculo === 'aplicativo' && (
                    <div className="absolute top-2 right-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    </div>
                  )}
                </div>
              </div>
              
              {/* Alerta quando aplicativo é selecionado */}
              {usoVeiculo === 'aplicativo' && (
                <Alert className="border-blue-500/50 bg-blue-500/10">
                  <Info className="h-4 w-4 text-blue-500" />
                  <AlertDescription className="text-blue-700 dark:text-blue-400">
                    Categoria APP: cota de participação será 8% (mínimo R$ 3.000).
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            {/* BLOCO 0.6: CONSULTOR RESPONSÁVEL - Apenas para liderança (diretor/gerente/supervisor) */}
            {podeAtribuirVendedor && (
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
            )}

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
                          disabled={buscandoFipe || !!veiculoEncontrado?.fipeData?.valor}
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

            {/* BLOCO 1.6: VALOR ADICIONAL (equipamentos/agregados) */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Label className="text-sm font-semibold">Valor Adicional</Label>
                <div className="relative group">
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 text-xs bg-popover text-popover-foreground border rounded-md shadow-md z-50">
                    Valor fixo que será acrescido à mensalidade (equipamentos, som, rodas, acessórios, etc.)
                  </div>
                </div>
              </div>
              <FormField
                control={form.control}
                name="valor_adicional"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <CurrencyInput 
                        value={field.value || 0} 
                        onChange={field.onChange}
                        placeholder="R$ 0,00"
                      />
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
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Selecione o Plano
                </h3>
                {planosSelecionados.length > 0 && (
                  <Badge variant="outline" className="text-primary">
                    {planosSelecionados.length} selecionado{planosSelecionados.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>

              {planosLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : valorFipe > 0 && planosCalculados.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {planosCalculados.map((plano) => {
                    const indexSelecionado = planosSelecionados.findIndex(p => p.id === plano.id);
                    const isSelecionado = indexSelecionado >= 0;
                    const ordemSelecao = indexSelecionado + 1;
                    
                    return (
                      <Card 
                        key={plano.id}
                        className={cn(
                          "cursor-pointer transition-all hover:shadow-md relative",
                          isSelecionado 
                            ? "ring-2 ring-primary border-primary bg-primary/5" 
                            : "hover:border-primary/50",
                          plano.destaque && !isSelecionado && "border-amber-500/50"
                        )}
                        onClick={() => handleTogglePlano(plano)}
                      >
                        {/* Badge de ordem no canto */}
                        {isSelecionado && (
                          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center z-10">
                            {ordemSelecao}º
                          </div>
                        )}
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold text-sm">{plano.nome}</h4>
                            {isSelecionado ? (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            ) : plano.destaque ? (
                              <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600">
                                Recomendado
                              </Badge>
                            ) : null}
                          </div>
                        <p className="text-xl font-bold text-primary mb-3">
                          {formatCurrency(plano.valorMensal + valorAdicional)}
                          <span className="text-xs font-normal text-muted-foreground">/mês</span>
                        </p>
                        <ul className="text-xs space-y-1 text-muted-foreground">
                          {plano.coberturas.slice(0, 4).map((cobertura, idx) => {
                            const isRemovida = isCoberturaRemovida(cobertura, categoria);
                            return (
                              <li key={idx} className="flex items-center gap-1">
                                {isRemovida ? (
                                  <>
                                    <X className="h-3 w-3 text-destructive shrink-0" />
                                    <span className="truncate line-through text-muted-foreground/60">{cobertura}</span>
                                    <span className="text-[10px] text-destructive">(não cobre)</span>
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-3 w-3 text-green-500 shrink-0" />
                                    <span className="truncate">{cobertura}</span>
                                  </>
                                )}
                              </li>
                            );
                          })}
                          <AnimatePresence initial={false}>
                            {expandedPlanos[plano.id] && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2, ease: "easeInOut" }}
                                className="overflow-hidden"
                              >
                                {plano.coberturas.slice(4).map((cobertura, idx) => {
                                  const isRemovida = isCoberturaRemovida(cobertura, categoria);
                                  return (
                                    <li key={idx + 4} className="flex items-center gap-1 mt-1">
                                      {isRemovida ? (
                                        <>
                                          <X className="h-3 w-3 text-destructive shrink-0" />
                                          <span className="truncate line-through text-muted-foreground/60">{cobertura}</span>
                                          <span className="text-[10px] text-destructive">(não cobre)</span>
                                        </>
                                      ) : (
                                        <>
                                          <Check className="h-3 w-3 text-green-500 shrink-0" />
                                          <span className="truncate">{cobertura}</span>
                                        </>
                                      )}
                                    </li>
                                  );
                                })}
                              </motion.div>
                            )}
                          </AnimatePresence>
                          {plano.coberturas.length > 4 && (
                            <li className="pt-1">
                              <button
                                type="button"
                                onClick={(e) => toggleExpandPlano(plano.id, e)}
                                className="flex items-center gap-1 text-primary hover:underline text-xs font-medium"
                              >
                                {expandedPlanos[plano.id] ? (
                                  <>
                                    <ChevronUp className="h-3 w-3" />
                                    Ver menos
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown className="h-3 w-3" />
                                    Ver mais {plano.coberturas.length - 4}
                                  </>
                                )}
                              </button>
                            </li>
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
                    );
                  })}
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

            {/* BLOCO 4: RESUMO INLINE (quando planos selecionados) */}
            {planosSelecionados.length > 0 && (
              <>
                <Separator />
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4">
                    {/* Info do Associado e Veículo */}
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Associado</p>
                        <p className="font-medium">{nomeAssociado || 'Não informado'}</p>
                        <p className="text-xs text-muted-foreground mt-2">Veículo</p>
                        <p className="font-medium">
                          {getMarcaNome() && getModeloNome() 
                            ? `${getMarcaNome()} ${getModeloNome()} ${getAnoNome()}`
                            : 'Valor FIPE informado manualmente'
                          }
                        </p>
                        <p className="text-sm text-muted-foreground">FIPE: {formatCurrency(valorFipe)}</p>
                      </div>
                    </div>

                    {/* Grade de Planos para Comparação */}
                    <div className={cn(
                      "grid gap-3 mb-4 mx-auto max-w-5xl",
                      planosSelecionados.length === 1 && "grid-cols-1 max-w-md",
                      planosSelecionados.length === 2 && "grid-cols-1 md:grid-cols-2 max-w-2xl",
                      planosSelecionados.length === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
                      planosSelecionados.length >= 4 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                    )}>
                      {planosSelecionados.map((plano, idx) => {
                        const isExpanded = expandedPlanos[`preview-${plano.id}`];
                        const LIMIT = 5;
                        const hasMore = plano.coberturas.length > LIMIT;
                        
                        return (
                          <Card key={plano.id} className="border-primary/30 bg-background">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Badge variant="secondary" className="text-xs font-bold">
                                  {idx + 1}º
                                </Badge>
                                <p className="font-semibold truncate">{plano.nome}</p>
                              </div>
                              <p className="text-2xl font-bold text-primary mb-3">
                                {formatCurrency(plano.valorMensal + valorAdicional)}
                                <span className="text-sm font-normal text-muted-foreground">/mês</span>
                              </p>
                              {/* Lista de benefícios com Ver mais */}
                              <ul className="text-sm space-y-1.5 text-muted-foreground">
                                {plano.coberturas.slice(0, LIMIT).map((cobertura, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                    <span>{cobertura}</span>
                                  </li>
                                ))}
                                <AnimatePresence initial={false}>
                                  {isExpanded && hasMore && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: "auto", opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2, ease: "easeInOut" }}
                                      className="overflow-hidden"
                                    >
                                      {plano.coberturas.slice(LIMIT).map((cobertura, i) => (
                                        <li key={i + LIMIT} className="flex items-start gap-2 mt-1.5">
                                          <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                          <span>{cobertura}</span>
                                        </li>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                                {hasMore && (
                                  <li className="pt-1">
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandPlano(`preview-${plano.id}`)}
                                      className="flex items-center gap-1 text-primary hover:underline text-sm font-medium"
                                    >
                                      {isExpanded ? (
                                        <>
                                          <ChevronUp className="h-4 w-4" />
                                          Ver menos
                                        </>
                                      ) : (
                                        <>
                                          <ChevronDown className="h-4 w-4" />
                                          Ver mais {plano.coberturas.length - LIMIT}
                                        </>
                                      )}
                                    </button>
                                  </li>
                                )}
                              </ul>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    {/* Campos de Filiação e Validade */}
                    <div className="flex flex-wrap items-center gap-4 pt-3 border-t text-sm">
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
            <div className="flex items-center justify-end pt-2 border-t">
              <Button 
                type="submit" 
                disabled={(createCotacao.isPending || updateCotacao.isPending) || planosSelecionados.length === 0 || valorAdesao <= 0 || !dadosAssociadoValidos}
              >
                {(createCotacao.isPending || updateCotacao.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Check className="h-4 w-4 mr-1" />
                )}
                {isEditando ? 'Salvar Alterações' : 'Criar Cotação'}
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
                  Associado: <strong>{nomeAssociado}</strong>
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
