import { useState, useMemo, useEffect } from 'react';
import { formatarMoeda } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Car, 
  Calculator, 
  Receipt, 
  FileSearch, 
  MessageSquare,
  AlertTriangle,
  Loader2,
  Users,
  ChevronsUpDown,
  X,
  ChevronRight,
  Search,
  Edit,
  Check,
  CheckCircle,
  Star,
  Mail,
  Printer,
  XCircle,
  FileText,
  AlertCircle,
  DollarSign,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useFipe } from '@/hooks/useFipe';
import { cn } from '@/lib/utils';
import { useDetectarTipoVeiculo } from '@/hooks/useDetectarTipoVeiculo';
import { useAllLeads, useUpdateLead } from '@/hooks/useLeads';
import { useCriarCotacao } from '@/hooks/useCotacao';
import { usePlanosCotacao, type PlanoCotacao, type PlanoNegadoInfo } from '@/hooks/usePlanosCotacao';

import { isCoberturaRemovida } from '@/data/restricoesCategorias';
import { VehicleCategorySelect, CATEGORIAS_VEICULO } from '@/components/cotador/VehicleCategorySelect';
import { useTemplateWhatsappCotacao, useTaxaAdesaoPercentual, useTaxaAdesaoMinimoBase, useTaxaAdesaoMinimoVolanteInterno, useTaxaAdesaoMinimoVolanteExterno, useTaxaRepasseVolante, useTaxaRepasseVolanteExterno, useCarenciaDiasPadrao, useMigracaoConfig } from '@/hooks/useConteudosSistema';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { BotaoGerarProposta } from '@/components/vendas/BotaoGerarProposta';
import { DadosProposta } from '@/types/proposta';
import { useVerificarPlacaDuplicada, type PlacaDuplicadaInfo } from '@/hooks/useVerificarPlaca';
import { PlacaDuplicadaModal } from '@/components/cotacoes/PlacaDuplicadaModal';
import { PlacaBlacklistModal } from '@/components/cotacoes/PlacaBlacklistModal';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Switch } from '@/components/ui/switch';
import { useAssociadoSearch, type AssociadoSearchResult } from '@/hooks/useAssociadoSearch';

// ============================================
// INTERFACES
// ============================================

type LeadDB = Tables<'leads'>;

interface VeiculoEncontrado {
  placa: string;
  marca: string;
  modelo: string;
  ano: string;
  cor?: string;
  combustivel?: string;
  codigoFipe?: string;
  valorFipe?: number;
}

// PlanoCalculado removido — usa PlanoCotacao do hook diretamente

type ModoEntrada = 'busca_placa' | 'manual';

// ============================================
// DADOS DE REFERÊNCIA
// ============================================

const MARCAS = [
  'Volkswagen', 'Chevrolet', 'Fiat', 'Ford', 'Hyundai', 
  'Toyota', 'Honda', 'Renault', 'Nissan', 'Jeep', 
  'Peugeot', 'Citroën', 'Mitsubishi', 'Kia', 'BYD', 'Caoa Chery', 'RAM',
  // Motos
  'Honda Motos', 'Yamaha', 'Suzuki', 'Kawasaki', 'BMW Motorrad', 'Dafra', 'Shineray', 'Haojue',
  'Outras'
];

const MODELOS_POR_MARCA: Record<string, string[]> = {
  Volkswagen: ['Gol', 'Voyage', 'Polo', 'Polo Track', 'Virtus', 'Nivus', 'T-Cross', 'Taos', 'Amarok', 'Saveiro', 'Fox', 'Up'],
  Chevrolet: ['Onix', 'Onix Plus', 'Tracker', 'S10', 'Spin', 'Cruze', 'Montana', 'Equinox', 'Trailblazer'],
  Fiat: ['Uno', 'Mobi', 'Argo', 'Cronos', 'Strada', 'Toro', 'Pulse', 'Fastback', 'Fiorino', 'Ducato'],
  Ford: ['Ka', 'Ka Sedan', 'EcoSport', 'Ranger', 'Territory', 'Bronco Sport', 'Maverick'],
  Hyundai: ['HB20', 'HB20S', 'HB20X', 'Creta', 'Tucson', 'Santa Fe', 'i30'],
  Toyota: ['Corolla', 'Corolla Cross', 'Yaris', 'Yaris Sedan', 'Hilux', 'SW4', 'RAV4', 'Camry'],
  Honda: ['Civic', 'City', 'HR-V', 'CR-V', 'Fit', 'WR-V', 'Accord'],
  Renault: ['Kwid', 'Sandero', 'Logan', 'Duster', 'Captur', 'Oroch', 'Master'],
  Nissan: ['Versa', 'Sentra', 'Kicks', 'Frontier', 'March'],
  Jeep: ['Renegade', 'Compass', 'Commander', 'Wrangler', 'Gladiator'],
  Peugeot: ['208', '2008', '3008', 'Partner', 'Expert'],
  Citroën: ['C3', 'C4 Cactus', 'Jumpy', 'Berlingo'],
  Mitsubishi: ['L200', 'Outlander', 'Eclipse Cross', 'Pajero Sport'],
  Kia: ['Sportage', 'Seltos', 'Cerato', 'Sorento', 'Carnival'],
  BYD: ['Dolphin', 'Seal', 'Song Plus', 'Yuan Plus', 'Han'],
  'Caoa Chery': ['Tiggo 5x', 'Tiggo 7', 'Tiggo 8', 'Arrizo 6'],
  RAM: ['Rampage', '1500', '2500', '3500'],
  // Motos
  'Honda Motos': ['CG 160', 'CG 125', 'Bros 160', 'Pop 110', 'Biz 125', 'PCX 160', 'CB 300', 'CB 500', 'XRE 190', 'XRE 300', 'Elite 125', 'ADV 150', 'Sahara 300'],
  Yamaha: ['Factor 150', 'Fazer 250', 'MT-03', 'MT-07', 'Crosser 150', 'Lander 250', 'NMAX 160', 'XTZ 250', 'R3', 'Fluo 125', 'Neo 125'],
  Suzuki: ['Intruder 125', 'GSX-S750', 'V-Strom 650', 'Burgman 125', 'DL 650'],
  Kawasaki: ['Ninja 300', 'Ninja 400', 'Z400', 'Z900', 'Versys 650', 'Vulcan S'],
  'BMW Motorrad': ['G 310 GS', 'G 310 R', 'F 850 GS', 'R 1250 GS', 'S 1000 RR'],
  Dafra: ['Apache 200', 'NH 190', 'Zig 50'],
  Shineray: ['Jet 50', 'Phoenix 50', 'Worker 150'],
  Haojue: ['NK 150', 'DR 160', 'DK 150'],
  Outras: ['Outro modelo'],
};

const ANOS = Array.from({ length: 17 }, (_, i) => 2026 - i);

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};


const formatPlaca = (value: string): string => {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}`;
};

// Normalizar marca da API para o valor exato da lista MARCAS
const normalizarMarca = (marcaAPI: string): string => {
  if (!marcaAPI) return 'Outras';
  
  const marcaNormalizada = marcaAPI.toLowerCase().trim();
  
  // Mapeamento de variações comuns
  const mapeamento: Record<string, string> = {
    'toyota': 'Toyota',
    'volkswagen': 'Volkswagen',
    'vw': 'Volkswagen',
    'chevrolet': 'Chevrolet',
    'gm': 'Chevrolet',
    'fiat': 'Fiat',
    'ford': 'Ford',
    'hyundai': 'Hyundai',
    'honda': 'Honda',
    'renault': 'Renault',
    'nissan': 'Nissan',
    'jeep': 'Jeep',
    'peugeot': 'Peugeot',
    'citroën': 'Citroën',
    'citroen': 'Citroën',
    'mitsubishi': 'Mitsubishi',
    'kia': 'Kia',
    'byd': 'BYD',
    'caoa chery': 'Caoa Chery',
    'chery': 'Caoa Chery',
    'ram': 'RAM',
  };
  
  // Tenta encontrar no mapeamento
  if (mapeamento[marcaNormalizada]) {
    return mapeamento[marcaNormalizada];
  }
  
  // Tenta encontrar correspondência exata na lista MARCAS
  const marcaExata = MARCAS.find(m => m.toLowerCase() === marcaNormalizada);
  if (marcaExata) return marcaExata;
  
  // Tenta encontrar por inclusão parcial
  const marcaParcial = MARCAS.find(m => 
    marcaNormalizada.includes(m.toLowerCase()) || 
    m.toLowerCase().includes(marcaNormalizada)
  );
  if (marcaParcial) return marcaParcial;
  
  return 'Outras';
};

// Normalizar ano da API (formato "2013/2014") para número
const normalizarAno = (anoAPI: string): number => {
  if (!anoAPI) return new Date().getFullYear();
  
  // Se vier no formato "2013/2014", pegar o segundo (ano modelo)
  if (anoAPI.includes('/')) {
    const partes = anoAPI.split('/');
    const anoModelo = parseInt(partes[1], 10);
    if (!isNaN(anoModelo)) return anoModelo;
  }
  
  // Extrair apenas números
  const apenasNumeros = anoAPI.replace(/\D/g, '').slice(0, 4);
  const anoNumero = parseInt(apenasNumeros, 10);
  
  if (!isNaN(anoNumero) && anoNumero >= 1990 && anoNumero <= 2030) {
    return anoNumero;
  }
  
  return new Date().getFullYear();
};

// Função estimativa de FIPE — centralizada em src/utils/fipe.ts
import { estimarValorFipe } from '@/utils/fipe';

// mapearPlanosParaExibicao REMOVIDO — dados vêm direto do hook usePlanosCotacao

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function CotadorPage() {
  const navigate = useNavigate();
  const { data: templateWhatsapp } = useTemplateWhatsappCotacao();
  const { data: percentualAdesaoConfig = 1 } = useTaxaAdesaoPercentual();
  const { data: minimoAdesaoBase = 100 } = useTaxaAdesaoMinimoBase();
  const { data: minimoVolanteInterno = 150 } = useTaxaAdesaoMinimoVolanteInterno();
  const { data: minimoVolanteExterno = 50 } = useTaxaAdesaoMinimoVolanteExterno();
  const { data: repasseVolanteInterno = 50 } = useTaxaRepasseVolante();
  const { data: repasseVolanteExterno = 50 } = useTaxaRepasseVolanteExterno();
  const { data: carenciaDias = 120 } = useCarenciaDiasPadrao();
  const { data: migracaoConfig } = useMigracaoConfig();
  
  // Modo de entrada
  const [modo, setModo] = useState<ModoEntrada>('busca_placa');
  
  // Busca por placa
  const [placaBusca, setPlacaBusca] = useState('');
  const [buscandoPlaca, setBuscandoPlaca] = useState(false);
  const [veiculoEncontrado, setVeiculoEncontrado] = useState<VeiculoEncontrado | null>(null);
  const [erroBusca, setErroBusca] = useState<string | null>(null);

  // Formulário veículo (modo manual)
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [ano, setAno] = useState('');
  const [cor, setCor] = useState('');
  const [usoApp, setUsoApp] = useState(false);
  const [valorFipe, setValorFipe] = useState<number | null>(null);
  const [categoriaVeiculo, setCategoriaVeiculo] = useState<string | null>(null);
  const [regiao, setRegiao] = useState('rj');
  
  // Estados para valores customizados da API (fora das listas estáticas)
  const [modeloCustom, setModeloCustom] = useState<string | null>(null);
  const [anoCustom, setAnoCustom] = useState<number | null>(null);
  const [erroCategoriaVeiculo, setErroCategoriaVeiculo] = useState(false);
  
  // Valor extra do vendedor
  const [valorExtra, setValorExtra] = useState<number>(0);
  
  // Valor de adesão customizado pelo consultor
  const [valorAdesaoCustom, setValorAdesaoCustom] = useState<number | null>(null);

  // Cenário de adesão para vendedor externo
  const [cenarioExterno, setCenarioExterno] = useState<string | null>(null);
  const [tipoInstalacao, setTipoInstalacao] = useState<'rota' | 'base' | null>(null);

  // Mínimo efetivo — derivado abaixo após usePermissions

  // Lead
  const [leadSelecionado, setLeadSelecionado] = useState<LeadDB | null>(null);
  const [buscaLead, setBuscaLead] = useState('');
  const [comboboxAberto, setComboboxAberto] = useState(false);
  
  // Nome do associado (quando não vinculado a lead)
  const [nomeAssociado, setNomeAssociado] = useState('');

  // Indicação
  const [isIndicacao, setIsIndicacao] = useState(false);
  const [indicadorId, setIndicadorId] = useState<string | null>(null);
  const [indicadorNome, setIndicadorNome] = useState('');
  const [buscaIndicador, setBuscaIndicador] = useState('');

  // Cotação
  const [isCalculando, setIsCalculando] = useState(false);
  const [cotacaoCalculada, setCotacaoCalculada] = useState(false);
  const [planoSelecionadoTab, setPlanoSelecionadoTab] = useState<string>('total');
  const [planoFinalSelecionado, setPlanoFinalSelecionado] = useState<PlanoCotacao | null>(null);
  const [cotacaoSalva, setCotacaoSalva] = useState<any>(null);
  const [salvandoCotacao, setSalvandoCotacao] = useState(false);
  
  // Estado para modal de placa duplicada
  const [placaDuplicadaInfo, setPlacaDuplicadaInfo] = useState<PlacaDuplicadaInfo | null>(null);
  const [showPlacaDuplicadaModal, setShowPlacaDuplicadaModal] = useState(false);
  
  // Estado para modal de blacklist
  const [blacklistInfo, setBlacklistInfo] = useState<{
    id: string;
    motivo: string;
    tipo_reprovacao: string;
    created_at: string;
  } | null>(null);
  const [showBlacklistModal, setShowBlacklistModal] = useState(false);

  // Hook FIPE
  const { getByPlaca, loading: loadingFipe } = useFipe();
  
  // Hook para verificar placa duplicada
  const verificarPlacaDuplicada = useVerificarPlacaDuplicada();
  
  // Auth para obter profile do usuário atual
  const { profile } = useAuth();
  const { isVendedorExterno } = usePermissions();

  // Mínimo efetivo conforme tipo de instalação e role do consultor
  const minimoAdesaoVolante = isVendedorExterno ? minimoVolanteExterno : minimoVolanteInterno;
  const minimoAdesaoConfig = tipoInstalacao === 'rota' ? minimoAdesaoVolante : minimoAdesaoBase;
  const repasseVolante = isVendedorExterno ? repasseVolanteExterno : repasseVolanteInterno;

  // Hooks Supabase
  const { data: leadsData, isLoading: loadingLeads } = useAllLeads();
  
  // Detectar tipo de veículo automaticamente
  const tipoVeiculoDetectado = useMemo(() => {
    if (!marca && !modelo) return 'carro' as const;
    const tipo = detectarTipoVeiculo(undefined, modelo, marca);
    return tipo === 'moto' ? 'moto' as const : 'carro' as const;
  }, [marca, modelo]);

  // Hook de planos com filtro por uso (aplicativo vs passeio)
  const parametrosPlanos = useMemo(() => ({
    valorFipe: valorFipe || 0,
    regiao,
    combustivel: veiculoEncontrado?.combustivel || undefined,
    anoVeiculo: parseInt(ano) || undefined,
    tipoVeiculo: tipoVeiculoDetectado,
    usoApp: usoApp,
    categoria: categoriaVeiculo || undefined,
    marca: marca || undefined,
    modelo: modelo || undefined,
  }), [valorFipe, ano, usoApp, categoriaVeiculo, tipoVeiculoDetectado, marca, modelo, veiculoEncontrado?.combustivel, regiao]);
  
  const { planos: planosDB, planosNegados, isLoading: loadingPlanos } = usePlanosCotacao(parametrosPlanos);
  const criarCotacao = useCriarCotacao();
  const atualizarLead = useUpdateLead();
  const { data: resultadosBuscaIndicador = [], isLoading: isSearchingIndicador } = useAssociadoSearch(buscaIndicador);

  // Lista de leads
  const leads = leadsData || [];

  // Filtro de leads
  const leadsFiltrados = useMemo(() => {
    const termo = buscaLead.toLowerCase();
    if (!termo) return leads.slice(0, 15);
    return leads.filter(lead => 
      lead.nome?.toLowerCase().includes(termo) ||
      lead.telefone?.includes(termo) ||
      lead.email?.toLowerCase().includes(termo) ||
      lead.veiculo_placa?.toLowerCase().includes(termo)
    ).slice(0, 15);
  }, [buscaLead, leads]);

  // Modelos disponíveis (inclui modelo customizado da API se houver)
  const modelosDisponiveis = useMemo(() => {
    if (!marca) return [];
    const modelos = MODELOS_POR_MARCA[marca] || [];
    // Adiciona modelo customizado da API se não estiver na lista
    if (modeloCustom && !modelos.includes(modeloCustom)) {
      return [modeloCustom, ...modelos];
    }
    return modelos;
  }, [marca, modeloCustom]);
  
  // Anos disponíveis (inclui ano customizado da API se houver)
  const anosDisponiveis = useMemo(() => {
    if (anoCustom && !ANOS.includes(anoCustom)) {
      return [...ANOS, anoCustom].sort((a, b) => b - a);
    }
    return ANOS;
  }, [anoCustom]);

  // Planos calculados - vem direto do hook usePlanosCotacao
  const planos: PlanoCotacao[] = useMemo(() => {
    if (!valorFipe || !planosDB || planosDB.length === 0) return [];
    return planosDB as PlanoCotacao[];
  }, [valorFipe, planosDB]);

  // Plano atual selecionado nas tabs
  const planoAtual = useMemo(() => {
    return planos.find(p => p.id === planoSelecionadoTab) || planos[1] || planos[0] || null;
  }, [planos, planoSelecionadoTab]);

  // Auto-exibir planos quando valorFipe > 0 e há planos disponíveis
  useEffect(() => {
    if (valorFipe && valorFipe > 0 && planosDB && planosDB.length > 0) {
      if (!cotacaoCalculada) {
        setCotacaoCalculada(true);
        setPlanoSelecionadoTab(planosDB.find(p => p.destaque)?.id || planosDB[1]?.id || planosDB[0]?.id || '');
        // Inicializar adesão com 1% FIPE (mínimo R$ 100) — exceto se vendedor externo escolheu cenário isento
        const cenarioZeraAdesao = isVendedorExterno && (cenarioExterno === 'isenta_rota' || cenarioExterno === 'isenta_base');
        if (!cenarioZeraAdesao) {
          setValorAdesaoCustom(Math.max(minimoAdesaoConfig, Math.round(valorFipe * (percentualAdesaoConfig / 100) * 100) / 100));
        }
      }
    }
  }, [valorFipe, planosDB]);

  // Auto-atualizar tab quando lista de planos muda
  useEffect(() => {
    if (planos.length > 0 && !planos.find(p => p.id === planoSelecionadoTab)) {
      setPlanoSelecionadoTab(planos.find(p => p.destaque)?.id || planos[1]?.id || planos[0]?.id || '');
    }
  }, [planos]);

  // Dados para geração de proposta PDF
  const dadosProposta: DadosProposta | null = useMemo(() => {
    if (!cotacaoCalculada || !planoFinalSelecionado || !valorFipe) return null;
    
    return {
      cliente: {
        nome: leadSelecionado?.nome || nomeAssociado || 'Cliente',
        cpf: leadSelecionado?.cpf || '000.000.000-00',
        telefone: leadSelecionado?.telefone || '(00) 00000-0000',
        email: leadSelecionado?.email || '',
        cidade: '',
        estado: '',
      },
      veiculo: {
        marca: marca,
        modelo: modelo,
        ano: parseInt(ano) || new Date().getFullYear(),
        placa: veiculoEncontrado?.placa || placaBusca || 'AAA-0000',
        cor: cor || undefined,
        valorFipe: valorFipe,
      },
      plano: {
        nome: planoFinalSelecionado.nome,
        coberturas: planoFinalSelecionado.coberturas,
        valorAdesao: valorAdesaoCustom ?? planoFinalSelecionado.valorAdesao,
        valorMensal: planoFinalSelecionado.valorMensal,
        valorExtra: valorExtra > 0 ? valorExtra : undefined,
      },
      cotacao: {
        numero: cotacaoSalva?.numero || `COT-${Date.now()}`,
        dataValidade: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        vendedor: 'Vendedor',
        observacoes: undefined,
      },
    };
  }, [cotacaoCalculada, planoFinalSelecionado, valorFipe, leadSelecionado, nomeAssociado, marca, modelo, ano, veiculoEncontrado, placaBusca, cor, valorExtra, cotacaoSalva, valorAdesaoCustom]);

  // Verificar se pode calcular
  const podeCalcular = (modo === 'busca_placa' 
    ? veiculoEncontrado !== null 
    : marca && modelo && ano) && categoriaVeiculo;

  // ============================================
  // HANDLERS
  // ============================================

  const handleModoChange = (novoModo: ModoEntrada) => {
    setModo(novoModo);
    setVeiculoEncontrado(null);
    setErroBusca(null);
    setPlacaBusca('');
    setMarca('');
    setModelo('');
    setAno('');
    setCor('');
    setValorFipe(null);
    setCotacaoCalculada(false);
    setPlanoFinalSelecionado(null);
    setCotacaoSalva(null);
    setCategoriaVeiculo(null);
    setErroCategoriaVeiculo(false);
    setRegiao('rj');
    // Limpar valores customizados
    setModeloCustom(null);
    setAnoCustom(null);
    // Limpar valor extra
    setValorExtra(0);
  };
  
  // Handler para input de valor extra
  const handleValorExtraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    const numeric = parseInt(raw || '0') / 100;
    setValorExtra(numeric);
  };

  const handleBuscarPlaca = async () => {
    if (!placaBusca || placaBusca.length < 7) {
      toast.error('Digite uma placa válida');
      return;
    }

    setBuscandoPlaca(true);
    setErroBusca(null);
    
    try {
      // 1. PRIMEIRO: Verificar se está na BLACKLIST
      const placaNormalizada = placaBusca.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      const { data: blacklistData, error: blacklistError } = await supabase
        .from('blacklist_veiculos')
        .select('id, motivo, tipo_reprovacao, created_at')
        .eq('placa', placaNormalizada)
        .eq('ativo', true)
        .maybeSingle();
      
      if (!blacklistError && blacklistData) {
        // VEÍCULO BLOQUEADO - Interromper fluxo
        setBlacklistInfo(blacklistData);
        setShowBlacklistModal(true);
        setBuscandoPlaca(false);
        return;
      }
      
      // 2. Verificar se a placa já está em cotação de outro vendedor
      const placaDuplicada = await verificarPlacaDuplicada.mutateAsync(placaBusca);
      
      if (placaDuplicada) {
        // Verifica se é do mesmo vendedor ou de outro
        if (placaDuplicada.vendedorId !== profile?.id) {
          // Placa é de OUTRO vendedor - BLOQUEAR
          setPlacaDuplicadaInfo(placaDuplicada);
          setShowPlacaDuplicadaModal(true);
          setBuscandoPlaca(false);
          return; // Interrompe o fluxo
        } else {
          // Placa é do MESMO vendedor - Apenas informa
          toast.info(`Você já possui uma cotação ativa para esta placa: ${placaDuplicada.numero}`);
        }
      }
      
      // 3. Continuar com a busca do veículo
      const result = await getByPlaca(placaBusca.replace(/[^A-Za-z0-9]/g, ''));
      
      if (result.success && result.vehicleData) {
        const { vehicleData, fipeData } = result;
        
        // Normalizar dados para compatibilidade com as listas
        const marcaNormalizada = normalizarMarca(vehicleData.marca);
        const modeloOriginal = vehicleData.modelo; // Modelo exato da API
        const anoNormalizado = normalizarAno(vehicleData.ano);
        
        // Configurar modelo e ano customizados se não estiverem nas listas
        const modelosLista = MODELOS_POR_MARCA[marcaNormalizada] || [];
        if (!modelosLista.includes(modeloOriginal)) {
          setModeloCustom(modeloOriginal);
        } else {
          setModeloCustom(null);
        }
        
        if (!ANOS.includes(anoNormalizado)) {
          setAnoCustom(anoNormalizado);
        } else {
          setAnoCustom(null);
        }
        
        // Armazenar dados originais para exibição no card verde
        setVeiculoEncontrado({
          placa: vehicleData.placa,
          marca: vehicleData.marca, // Manter original para exibição
          modelo: vehicleData.modelo, // Manter original para exibição
          ano: vehicleData.ano, // Manter original para exibição (ex: "2013/2014")
          cor: vehicleData.cor,
          combustivel: vehicleData.combustivel,
          codigoFipe: fipeData?.codigo,
          valorFipe: fipeData?.valor,
        });

        // Usar valores normalizados para os selects
        setMarca(marcaNormalizada);
        setModelo(modeloOriginal);
        setAno(String(anoNormalizado));
        setCor(vehicleData.cor || '');
        
        // PRIORIZAR valor FIPE da API
        if (fipeData?.valor && fipeData.valor > 0) {
          setValorFipe(fipeData.valor);
        } else {
          // Fallback para estimativa apenas se API não retornar valor
          setValorFipe(estimarValorFipe(marcaNormalizada, anoNormalizado));
        }

        setPlanoFinalSelecionado(null);
        setCotacaoSalva(null);
        
        toast.success(`Veículo encontrado! ${vehicleData.marca} ${vehicleData.modelo} ${vehicleData.ano}`);
      } else {
        setErroBusca(result.error || 'Veículo não encontrado');
        toast.error('Veículo não encontrado. Tente preencher manualmente.');
      }
    } catch (error) {
      console.error('Erro ao buscar placa:', error);
      setErroBusca('Erro ao consultar. Tente novamente.');
      toast.error('Erro ao buscar placa. Tente novamente ou preencha manualmente.');
    } finally {
      setBuscandoPlaca(false);
    }
  };

  const handleMarcaChange = (novaMarca: string) => {
    setMarca(novaMarca);
    setModelo('');
    setValorFipe(null);
    setPlanoFinalSelecionado(null);
    setCotacaoSalva(null);
    // Limpar modelo customizado ao trocar marca
    setModeloCustom(null);
  };

  const handleSelecionarLead = (lead: LeadDB) => {
    setLeadSelecionado(lead);
    setComboboxAberto(false);
    setBuscaLead('');
    
    if (lead.veiculo_marca && lead.veiculo_modelo) {
      setMarca(lead.veiculo_marca);
      setModelo(lead.veiculo_modelo);
      if (lead.veiculo_ano) setAno(String(lead.veiculo_ano));
      if (lead.veiculo_placa) setPlacaBusca(lead.veiculo_placa);
      
      const fipe = estimarValorFipe(
        lead.veiculo_marca, 
        lead.veiculo_ano || new Date().getFullYear()
      );
      setValorFipe(fipe);
      setPlanoFinalSelecionado(null);
      setCotacaoSalva(null);
      toast.success('Dados do veículo preenchidos automaticamente');
    }
  };

  const handleLimparLead = () => {
    setLeadSelecionado(null);
  };

  const handleCalcular = async () => {
    // Validar categoria obrigatória
    if (!categoriaVeiculo) {
      setErroCategoriaVeiculo(true);
      toast.error('Selecione a categoria do veículo para continuar');
      document.getElementById('categoria-veiculo-select')?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      return;
    }

    if (!podeCalcular) return;

    setIsCalculando(true);
    await new Promise(resolve => setTimeout(resolve, 600));
    
    if (!valorFipe && marca && ano) {
      const fipe = estimarValorFipe(marca, parseInt(ano));
      setValorFipe(fipe);
    }
    
    setCotacaoCalculada(true);
    setPlanoSelecionadoTab(planosDB?.find(p => p.destaque)?.id || planosDB?.[1]?.id || planosDB?.[0]?.id || '');
    setPlanoFinalSelecionado(null);
    // Inicializar adesão com 1% FIPE (mínimo R$ 100) — exceto se vendedor externo já escolheu cenário com adesão zerada
    const fipeAtual = valorFipe || (marca && ano ? estimarValorFipe(marca, parseInt(ano)) : 0);
    const cenarioZeraAdesao = cenarioExterno === 'isenta_rota' || cenarioExterno === 'isenta_base';
    if (fipeAtual > 0 && !cenarioZeraAdesao) {
      setValorAdesaoCustom(Math.max(minimoAdesaoConfig, Math.round(fipeAtual * (percentualAdesaoConfig / 100) * 100) / 100));
    }
    setIsCalculando(false);
    
    toast.success('Cotação calculada com sucesso!');
  };

  const handleSelecionarPlano = (plano: PlanoCotacao) => {
    setPlanoFinalSelecionado(plano);
    toast.success(`Plano ${plano.nome} selecionado!`);
  };

  const handleSalvarEEnviarWhatsApp = async () => {
    if (!planoFinalSelecionado || !valorFipe) return;

    // Vendedor externo DEVE selecionar um cenário antes de salvar
    if (isVendedorExterno && !cenarioExterno) {
      toast.error('Selecione o cenário de adesão/instalação antes de salvar.');
      return;
    }

    // Validar adesão mínima (exceto cenários isentos)
    const cenarioIsento = cenarioExterno === 'isenta_rota' || cenarioExterno === 'isenta_base';
    if (!cenarioIsento && valorAdesaoCustom !== null && valorAdesaoCustom < minimoAdesaoConfig) {
      toast.error(`O valor de adesão (${formatCurrency(valorAdesaoCustom)}) está abaixo do mínimo configurado (${formatCurrency(minimoAdesaoConfig)}). Ajuste o valor para continuar.`);
      return;
    }
    
    setSalvandoCotacao(true);
    
    try {
      // Salvar cotação no banco
      const cotacaoData = await criarCotacao.mutateAsync({
        lead_id: leadSelecionado?.id || null,
        plano_id: planoFinalSelecionado.id,
        veiculo_marca: marca,
        veiculo_modelo: modelo,
        veiculo_ano: parseInt(ano),
        valor_fipe: valorFipe,
        codigo_fipe: veiculoEncontrado?.codigoFipe,
        uso_aplicativo: usoApp,
        regiao: regiao,
        categoria_veiculo: categoriaVeiculo || undefined,
        nome_solicitante: leadSelecionado?.nome || nomeAssociado || null,
        veiculo_placa: veiculoEncontrado?.placa || placaBusca.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || null,
        valor_adesao: valorAdesaoCustom ?? undefined,
        tipo_instalacao: tipoInstalacao || undefined,
        indicador_id: indicadorId || null,
        indicador_nome: indicadorNome || null,
      });

      setCotacaoSalva(cotacaoData);

      // Atualizar etapa do lead e salvar plano escolhido
      if (leadSelecionado?.id) {
        await atualizarLead.mutateAsync({
          id: leadSelecionado.id,
          etapa: 'cotacao_enviada',
          plano_escolhido_id: planoFinalSelecionado.id,
          plano_escolhido_nome: planoFinalSelecionado.nome,
          plano_escolhido_valor: planoFinalSelecionado.valorMensal,
          veiculo_fipe: valorFipe,
          veiculo_marca: marca,
          veiculo_modelo: modelo,
          veiculo_ano: parseInt(ano),
          veiculo_placa: veiculoEncontrado?.placa || placaBusca.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || undefined,
          proposta_enviada_em: new Date().toISOString(),
        });
      }

      // Preparar e enviar mensagem WhatsApp
      const nomeCliente = leadSelecionado ? `\n*Cliente:* ${leadSelecionado.nome}` : '';
      const placaInfo = veiculoEncontrado?.placa ? `\n*Placa:* ${veiculoEncontrado.placa}` : '';
      const numeroCotacao = cotacaoData?.numero || `COT-${Date.now().toString().slice(-6)}`;
      
      const mensagem = `
🚗 *COTAÇÃO DE PROTEÇÃO VEICULAR*
📋 *Nº ${numeroCotacao}*${nomeCliente}${placaInfo}

*Veículo:* ${marca} ${modelo} ${ano}${cor ? ` ${cor}` : ''}
*Valor FIPE:* ${formatCurrency(valorFipe)}
*Uso para App:* ${usoApp ? 'Sim' : 'Não'}

━━━━━━━━━━━━━━━━━━━━
📋 *PLANO ${planoFinalSelecionado.nome.toUpperCase()}*
━━━━━━━━━━━━━━━━━━━━

*Coberturas:*
${planoFinalSelecionado.coberturas.map(c => `✅ ${c}`).join('\n')}

${planoFinalSelecionado.naoInclui.length > 0 ? `*Não incluído:*\n${planoFinalSelecionado.naoInclui.map(c => `❌ ${c}`).join('\n')}\n` : ''}
━━━━━━━━━━━━━━━━━━━━
💰 *VALORES*
━━━━━━━━━━━━━━━━━━━━

*Taxa de Filiação:* ${formatCurrency(valorAdesaoCustom ?? planoFinalSelecionado.valorAdesao)}
*Mensalidade:* ${formatCurrency(planoFinalSelecionado.valorMensal)}
*1ª Parcela:* ${formatCurrency(valorAdesaoCustom ?? planoFinalSelecionado.valorAdesao)}

_Cotação válida por 7 dias_

${templateWhatsapp || '✨ *Benefícios exclusivos PRATIC:*\n• Cobertura 100% da tabela FIPE\n• Sem análise de perfil\n• Aprovação em até 24h\n• App exclusivo para associados'}
      `.trim();

      const telefone = leadSelecionado?.telefone?.replace(/\D/g, '') || '';
      const url = telefone 
        ? `https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`
        : `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
      window.open(url, '_blank');

      // Atualizar status da cotação para enviada
      if (cotacaoData?.id) {
        await supabase
          .from('cotacoes')
          .update({ status: 'enviada' })
          .eq('id', cotacaoData.id);
      }
      
      toast.success('Cotação salva e enviada com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar cotação:', error);
      toast.error('Erro ao salvar cotação. Tente novamente.');
    } finally {
      setSalvandoCotacao(false);
    }
  };

  const handleEnviarEmail = async () => {
    if (!cotacaoSalva) {
      toast.error('Salve a cotação primeiro antes de enviar por email');
      return;
    }
    
    const emailDestino = leadSelecionado?.email;
    if (!emailDestino) {
      toast.error('O lead não possui email cadastrado');
      return;
    }
    
    try {
      // Preparar dados para o email
      const dadosEmail = {
        template: 'boleto-gerado' as const, // Template genérico para cotação
        to: emailDestino,
        data: {
          nome: leadSelecionado?.nome || nomeAssociado || 'Cliente',
          plano: planoFinalSelecionado?.nome || 'Plano selecionado',
          valor: planoFinalSelecionado ? formatCurrency(planoFinalSelecionado.valorMensal) : 'N/A',
          veiculo: `${marca} ${modelo} ${ano}`,
          numero_cotacao: cotacaoSalva?.numero || '',
        },
      };
      
      // Por enquanto, mostra preview do email que seria enviado
      toast.info(
        `Email seria enviado para ${emailDestino} com os dados da cotação. ` +
        `Funcionalidade de envio real requer configuração do Resend.`,
        { duration: 5000 }
      );
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      toast.error('Erro ao enviar email');
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  const handleGerarContrato = () => {
    if (!cotacaoSalva) {
      toast.error('Salve a cotação primeiro antes de gerar o contrato');
      return;
    }
    navigate(`/vendas/contratos/novo?cotacao=${cotacaoSalva.id}`);
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <Link to="/vendas" className="hover:text-foreground transition-colors">Vendas</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">Cotador</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cotador Rápido</h1>
            <p className="text-muted-foreground">Gere cotações em menos de 30 segundos</p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/vendas/cotacoes">Ver Histórico</Link>
          </Button>
        </div>
      </div>

      {/* SELETOR DE MODO */}
      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <p className="font-medium text-foreground mb-4">
            Como deseja informar o veículo?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card Busca por Placa */}
            <div
              onClick={() => handleModoChange('busca_placa')}
              className={cn(
                "p-4 rounded-lg cursor-pointer transition-all",
                modo === 'busca_placa'
                  ? "border-2 border-primary bg-background shadow-sm"
                  : "border border-border bg-background hover:border-muted-foreground/50"
              )}
            >
              <Search className={cn(
                "h-8 w-8 mb-2",
                modo === 'busca_placa' ? "text-primary" : "text-muted-foreground"
              )} />
              <p className="font-semibold">Buscar por Placa</p>
              <p className="text-sm text-muted-foreground">
                Consulta automática FIPE + dados do veículo
              </p>
            </div>
            
            {/* Card Manual */}
            <div
              onClick={() => handleModoChange('manual')}
              className={cn(
                "p-4 rounded-lg cursor-pointer transition-all",
                modo === 'manual'
                  ? "border-2 border-primary bg-background shadow-sm"
                  : "border border-border bg-background hover:border-muted-foreground/50"
              )}
            >
              <Edit className={cn(
                "h-8 w-8 mb-2",
                modo === 'manual' ? "text-primary" : "text-muted-foreground"
              )} />
              <p className="font-semibold">Preencher Manual</p>
              <p className="text-sm text-muted-foreground">
                Selecione marca, modelo e ano manualmente
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GRID PRINCIPAL */}
      <div className="grid gap-6 lg:grid-cols-2">
        
        {/* CARD ESQUERDO - DADOS DO VEÍCULO */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Dados do Veículo
              </CardTitle>
              <Badge variant={modo === 'busca_placa' ? 'default' : 'secondary'}>
                {modo === 'busca_placa' ? (
                  <>
                    <Search className="h-3 w-3 mr-1" />
                    Busca por Placa
                  </>
                ) : (
                  <>
                    <Edit className="h-3 w-3 mr-1" />
                    Manual
                  </>
                )}
              </Badge>
            </div>
            <CardDescription>
              {modo === 'busca_placa' 
                ? 'Digite a placa para buscar automaticamente'
                : 'Selecione marca, modelo e ano do veículo'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {/* CONTEÚDO CONDICIONAL POR MODO */}
            {modo === 'busca_placa' ? (
              <>
                {/* Input de Placa + Botão Buscar */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite a placa: ABC-1234"
                    value={placaBusca}
                    onChange={(e) => {
                      setPlacaBusca(formatPlaca(e.target.value));
                      setErroBusca(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleBuscarPlaca()}
                    className="flex-1 uppercase font-mono text-lg"
                    maxLength={8}
                  />
                  <Button
                    onClick={handleBuscarPlaca}
                    disabled={buscandoPlaca || loadingFipe || placaBusca.length < 7}
                  >
                    {buscandoPlaca || loadingFipe ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-1" />
                        Buscar
                      </>
                    )}
                  </Button>
                </div>

                {/* Estado: Buscando */}
                {buscandoPlaca && (
                  <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Consultando veículo...</span>
                    </div>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-8 w-1/3" />
                  </div>
                )}

                {/* Estado: Veículo Encontrado */}
                {!buscandoPlaca && veiculoEncontrado && (
                  <div className="rounded-lg border-2 border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-lg text-foreground">
                          {veiculoEncontrado.marca} {veiculoEncontrado.modelo} {veiculoEncontrado.ano}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {veiculoEncontrado.cor && `Cor: ${veiculoEncontrado.cor} • `}
                          Placa: {veiculoEncontrado.placa}
                        </p>
                        <div className="mt-3">
                          <p className="text-sm text-muted-foreground">Valor FIPE</p>
                          <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                            {veiculoEncontrado.valorFipe ? formatCurrency(veiculoEncontrado.valorFipe) : formatCurrency(valorFipe || 0)}
                          </p>
                          {veiculoEncontrado.codigoFipe && (
                            <p className="text-xs text-muted-foreground">
                              Código: {veiculoEncontrado.codigoFipe}
                            </p>
                          )}
                        </div>
                      </div>
                      <CheckCircle className="h-6 w-6 text-green-600 shrink-0" />
                    </div>
                  </div>
                )}

                {/* Estado: Erro */}
                {!buscandoPlaca && erroBusca && (
                  <div className="rounded-lg border-2 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-4">
                    <div className="flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-700 dark:text-red-400">
                          Veículo não encontrado
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {erroBusca}
                        </p>
                        <Button
                          variant="link"
                          onClick={() => handleModoChange('manual')}
                          className="h-auto p-0 mt-2 text-primary"
                        >
                          <Edit className="h-3 w-3 mr-1" />
                          Preencher manualmente
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Estado: Aguardando */}
                {!buscandoPlaca && !veiculoEncontrado && !erroBusca && (
                  <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-center">
                    <Search className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Digite a placa e clique em Buscar para consultar o veículo
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* MODO MANUAL: Selects */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Marca */}
                  <div className="space-y-2">
                    <Label>Marca *</Label>
                    <Select value={marca} onValueChange={handleMarcaChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {MARCAS.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Modelo */}
                  <div className="space-y-2">
                    <Label>Modelo *</Label>
                    <Select
                      value={modelo}
                      onValueChange={(v) => {
                        setModelo(v);
                        setValorFipe(null);
                      }}
                      disabled={!marca}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {modelosDisponiveis.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Ano */}
                  <div className="space-y-2">
                    <Label>Ano *</Label>
                    <Select
                      value={ano}
                      onValueChange={(v) => {
                        setAno(v);
                        if (marca && v) {
                          const fipe = estimarValorFipe(marca, parseInt(v));
                          setValorFipe(fipe);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {anosDisponiveis.map((a) => (
                          <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Cor */}
                  <div className="space-y-2">
                    <Label>Cor (opcional)</Label>
                    <Input
                      value={cor}
                      onChange={(e) => setCor(e.target.value)}
                      placeholder="Ex: Prata"
                    />
                  </div>
                </div>

                {/* Card FIPE (modo manual) */}
                <div className={cn(
                  "rounded-lg border-2 p-4",
                  valorFipe 
                    ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900"
                    : "border-muted bg-muted/30"
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Valor FIPE</p>
                      {valorFipe ? (
                        <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                          {formatCurrency(valorFipe)}
                        </p>
                      ) : (
                        <p className="text-muted-foreground">
                          Selecione marca, modelo e ano
                        </p>
                      )}
                    </div>
                    {valorFipe && (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        <span className="text-sm font-medium">Consultado</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            <div className="border-t pt-4" />

            {/* CAMPOS COMUNS (ambos os modos) */}
            
            {/* Nome do Associado */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Nome do Associado <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Nome completo do associado"
                value={nomeAssociado}
                onChange={(e) => setNomeAssociado(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Informe o nome do cliente para identificar a cotação
              </p>
            </div>

            {/* Indicação */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <Label htmlFor="indicacao-switch-cotador" className="cursor-pointer text-sm">
                    Este cliente foi indicado por um associado?
                  </Label>
                </div>
                <Switch
                  id="indicacao-switch-cotador"
                  checked={isIndicacao}
                  onCheckedChange={(checked) => {
                    setIsIndicacao(checked);
                    if (!checked) {
                      setIndicadorId(null);
                      setIndicadorNome('');
                      setBuscaIndicador('');
                    }
                  }}
                />
              </div>

              {isIndicacao && (
                <div className="space-y-2 pl-6 border-l-2 border-primary/20">
                  <Label>
                    Associado indicador <span className="text-destructive">*</span>
                  </Label>

                  {indicadorId ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <Users className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium text-sm flex-1">{indicadorNome}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setIndicadorId(null);
                          setIndicadorNome('');
                          setBuscaIndicador('');
                        }}
                        className="p-1 rounded hover:bg-muted transition-colors"
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Input
                        value={buscaIndicador}
                        onChange={(e) => setBuscaIndicador(e.target.value)}
                        placeholder="Buscar por nome, telefone ou CPF..."
                      />
                      {buscaIndicador.length >= 2 && (
                        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-auto">
                          {isSearchingIndicador ? (
                            <div className="p-3 text-sm text-muted-foreground text-center">
                              Buscando...
                            </div>
                          ) : resultadosBuscaIndicador.length === 0 ? (
                            <div className="p-3 text-sm text-muted-foreground text-center">
                              Nenhum associado encontrado
                            </div>
                          ) : (
                            resultadosBuscaIndicador.map((assoc) => (
                              <button
                                key={assoc.id}
                                type="button"
                                onClick={() => {
                                  setIndicadorId(assoc.id);
                                  setIndicadorNome(assoc.nome);
                                  setBuscaIndicador('');
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center gap-3"
                              >
                                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-medium truncate">{assoc.nome}</span>
                                  <span className="text-xs text-muted-foreground">
                                    CPF: {assoc.cpf}
                                    {assoc.telefone && ` • Tel: ${assoc.telefone}`}
                                  </span>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Região de atendimento */}
            <div className="space-y-2">
              <Label>Região de atendimento</Label>
              <Select value={regiao} onValueChange={setRegiao}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a região" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rj">Rio de Janeiro</SelectItem>
                  <SelectItem value="lagos">Região dos Lagos</SelectItem>
                  <SelectItem value="sp">São Paulo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Uso para aplicativo */}
            <div className="space-y-2">
              <Label>Uso para aplicativo? (Uber, 99, etc)</Label>
              <RadioGroup
                value={usoApp ? 'sim' : 'nao'}
                onValueChange={(v) => {
                  setUsoApp(v === 'sim');
                  if (cotacaoCalculada) {
                    setCotacaoCalculada(true);
                  }
                }}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="nao" id="nao" />
                  <Label htmlFor="nao" className="font-normal cursor-pointer">Não</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sim" id="sim" />
                  <Label htmlFor="sim" className="font-normal cursor-pointer">Sim</Label>
                </div>
              </RadioGroup>
              
              {usoApp && (
                <Alert variant="default" className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Veículos de aplicativo têm condições especiais. Os valores podem ser ajustados.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Categoria / Situação do Veículo */}
            <div className="space-y-2">
              <VehicleCategorySelect
                value={categoriaVeiculo}
                onChange={(value) => {
                  setCategoriaVeiculo(value);
                  setErroCategoriaVeiculo(false);
                  // Regras de negócio
                  if (value === 'leilao') {
                    toast.warning('Veículos de leilão não possuem cobertura de incêndio em nenhum plano.');
                  }
                  if (value === 'aplicativo') {
                    setUsoApp(true);
                    toast.info('Uso para aplicativo selecionado automaticamente.');
                  }
                  if (value === 'taxi' || value === 'ex_taxi') {
                    toast.info('Táxis têm condições especiais de cobertura.');
                  }
                  if (value === 'chassi_remarcado') {
                    toast.info('Chassi remarcado requer análise adicional.');
                  }
                }}
                error={erroCategoriaVeiculo}
              />
              {erroCategoriaVeiculo && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Selecione a categoria do veículo para continuar
                </p>
              )}
            </div>

            {/* Valor Extra do Vendedor */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <Label htmlFor="valorExtra">Valor Extra (Vendedor)</Label>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Valor adicional para margem de negociação
              </p>
              <Input
                id="valorExtra"
                type="text"
                placeholder="R$ 0,00"
                value={valorExtra > 0 ? formatarMoeda(valorExtra) : ''}
                onChange={handleValorExtraChange}
              />
              {valorExtra > 0 && (
                <p className="text-xs text-green-600 mt-1">
                  + {formatarMoeda(valorExtra)} será adicionado à mensalidade
                </p>
              )}
            </div>

            {/* Cenário de Adesão para Vendedor Externo */}
            {isVendedorExterno && (
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  <Label className="font-semibold">Cenário de Adesão / Instalação</Label>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Selecione o cenário que se aplica a esta cotação
                </p>
                <RadioGroup
                  value={cenarioExterno || ''}
                  onValueChange={(v) => {
                    setCenarioExterno(v);
                    switch (v) {
                      case 'cobra_rota':
                        setTipoInstalacao('rota');
                        // Mantém adesão editável (valor sugerido)
                        break;
                      case 'isenta_rota':
                        setTipoInstalacao('rota');
                        setValorAdesaoCustom(0);
                        break;
                      case 'isenta_base':
                        setTipoInstalacao('base');
                        setValorAdesaoCustom(0);
                        break;
                      case 'cobra_base':
                        setTipoInstalacao('base');
                        // Mantém adesão editável (valor sugerido)
                        break;
                    }
                  }}
                  className="grid grid-cols-1 gap-3"
                >
                  <label
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      cenarioExterno === 'cobra_rota' ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <RadioGroupItem value="cobra_rota" className="mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Cobrar adesão + Instalação na rota</p>
                      <p className="text-xs text-muted-foreground">{formatCurrency(repasseVolante)} descontado da adesão para cobrir a rota. Sem desconto no recorrente.</p>
                    </div>
                  </label>
                  <label
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      cenarioExterno === 'isenta_rota' ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <RadioGroupItem value="isenta_rota" className="mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Isentar adesão + Instalação na rota</p>
                      <p className="text-xs text-muted-foreground">Adesão zerada. Desconto de rota abatido do recorrente do consultor.</p>
                    </div>
                  </label>
                  <label
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      cenarioExterno === 'isenta_base' ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <RadioGroupItem value="isenta_base" className="mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Isentar adesão + Instalação na base</p>
                      <p className="text-xs text-muted-foreground">Sem adesão, sem cobrança. Zero a zero.</p>
                    </div>
                  </label>
                  <label
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      cenarioExterno === 'cobra_base' ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <RadioGroupItem value="cobra_base" className="mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Cobrar adesão + Instalação na base</p>
                      <p className="text-xs text-muted-foreground">Adesão integral para o consultor. Nada para a empresa.</p>
                    </div>
                  </label>
                </RadioGroup>
              </div>
            )}

            {/* Botão Calcular */}
            <Button
              onClick={handleCalcular}
              disabled={!podeCalcular || isCalculando || loadingPlanos}
              className="w-full"
              size="lg"
            >
              {isCalculando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Calculando...
                </>
              ) : (
                <>
                  <Calculator className="h-4 w-4 mr-2" />
                  Calcular Cotação
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* CARD DIREITO - RESULTADO */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Resultado da Cotação
            </CardTitle>
            <CardDescription>
              {cotacaoCalculada 
                ? `${marca} ${modelo} ${ano} • FIPE: ${formatCurrency(valorFipe!)}`
                : 'Preencha os dados e clique em calcular'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!cotacaoCalculada ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <FileSearch className="h-16 w-16 mb-4 opacity-20" />
                <p className="font-medium">Nenhuma cotação gerada</p>
                <p className="text-sm mt-1">
                  Preencha os dados do veículo e clique em "Calcular Cotação" para ver os planos disponíveis
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Tabs de planos */}
                <div className="flex border-b">
                  {planos.map((plano) => (
                    <button
                      key={plano.id}
                      onClick={() => setPlanoSelecionadoTab(plano.id)}
                      className={cn(
                        "flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors relative",
                        planoSelecionadoTab === plano.id
                          ? "border-primary text-primary bg-primary/5"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {plano.nome}
                      {plano.destaque && (
                        <Badge 
                          variant="secondary" 
                          className="absolute -top-1 -right-1 text-[10px] px-1.5 py-0"
                        >
                          Popular
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>

                {/* Detalhes do plano */}
                {planoAtual && (
                  <div className="space-y-4">
                    {/* Header do plano */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold">{planoAtual.nome}</h3>
                          {planoAtual.destaque && (
                            <Badge className="bg-amber-500 text-white">
                              <Star className="h-3 w-3 mr-1" />
                              Recomendado
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{planoAtual.descricao}</p>
                      </div>
                    </div>

                    {/* Coberturas */}
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Coberturas incluídas:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {planoAtual.coberturas.map((cobertura, i) => {
                          const isRemovida = isCoberturaRemovida(cobertura, categoriaVeiculo);
                          return (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              {isRemovida ? (
                                <>
                                  <X className="h-4 w-4 text-destructive shrink-0" />
                                  <span className="text-muted-foreground line-through">{cobertura}</span>
                                  <span className="text-xs text-destructive">(não cobre)</span>
                                </>
                              ) : (
                                <>
                                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                                  <span>{cobertura}</span>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {planoAtual.naoInclui.length > 0 && (
                        <>
                          <p className="text-sm font-medium mt-4">Não incluído:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {planoAtual.naoInclui.map((item, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                                <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Preços */}
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase">Adesão</p>
                          <p className="text-lg font-bold">{formatCurrency(valorAdesaoCustom ?? planoAtual.valorAdesao)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase">Mensal</p>
                          <p className="text-lg font-bold">{formatCurrency(planoAtual.valorMensal)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase">1ª Parcela</p>
                          <p className="text-lg font-bold text-primary">
                            {formatCurrency(valorAdesaoCustom ?? planoAtual.valorAdesao)}
                          </p>
                        </div>
                      </div>
                      
                      {/* Linha de valor extra - só aparece quando > 0 */}
                      {valorExtra > 0 && (
                        <div className="border-t pt-3 space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-green-600 font-medium">+ Extra vendedor:</span>
                            <span className="text-green-600 font-medium">{formatarMoeda(valorExtra)}</span>
                          </div>
                          <div className="flex justify-between font-semibold">
                            <span>Total mensal:</span>
                            <span className="text-primary">{formatarMoeda(planoAtual.valorMensal + valorExtra)}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Botão selecionar */}
                    <Button 
                      onClick={() => handleSelecionarPlano(planoAtual)}
                      className="w-full"
                      size="lg"
                      variant={planoFinalSelecionado?.id === planoAtual.id ? "default" : "outline"}
                    >
                      {planoFinalSelecionado?.id === planoAtual.id ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Plano Selecionado
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Selecionar este plano
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* SEÇÃO: RESUMO DA COTAÇÃO */}
      {planoFinalSelecionado && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Resumo da Cotação
              {cotacaoSalva && (
                <Badge variant="secondary" className="ml-auto">
                  #{cotacaoSalva.numero}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Grid de informações */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Cliente</p>
                <p className="font-medium">{leadSelecionado?.nome || 'Não vinculado'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Veículo</p>
                <p className="font-medium">{marca} {modelo} {ano}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Placa</p>
                <p className="font-medium">{veiculoEncontrado?.placa || placaBusca || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Plano</p>
                <p className="font-medium">{planoFinalSelecionado.nome}</p>
              </div>
            </div>

            {/* Blocos informativos dinâmicos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Repasse volante */}
              {tipoInstalacao === 'rota' && (
                <Alert className="border-amber-500/50 bg-amber-500/10">
                  <DollarSign className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-sm">
                    <span className="font-medium">Repasse obrigatório:</span> {formatCurrency(repasseVolante)} será descontado (instalação rota).
                  </AlertDescription>
                </Alert>
              )}

              {/* Carência */}
              <Alert className="border-blue-500/50 bg-blue-500/10">
                <AlertCircle className="h-4 w-4 text-blue-500" />
                <AlertDescription className="text-sm">
                  <span className="font-medium">Carência:</span>{' '}
                  {migracaoConfig?.isentar_carencia && cenarioExterno === 'cobra_rota'
                    ? 'Sem carência (migração aprovada)'
                    : `${carenciaDias} dias`}
                </AlertDescription>
              </Alert>
            </div>

            {/* Alerta de adesão abaixo do mínimo */}
            {valorAdesaoCustom !== null && valorAdesaoCustom > 0 && valorAdesaoCustom < minimoAdesaoConfig && !(cenarioExterno === 'isenta_rota' || cenarioExterno === 'isenta_base') && (
              <Alert className="border-destructive/50 bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-sm text-destructive">
                  Valor de adesão ({formatCurrency(valorAdesaoCustom)}) abaixo do mínimo configurado ({formatCurrency(minimoAdesaoConfig)}).
                </AlertDescription>
              </Alert>
            )}

            {/* Box de valores */}
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-1">Adesão</p>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={valorAdesaoCustom ?? ''}
                    onChange={(e) => setValorAdesaoCustom(parseFloat(e.target.value) || 0)}
                    className={cn(
                      "text-center font-bold text-lg h-10",
                      valorAdesaoCustom !== null && valorAdesaoCustom > 0 && valorAdesaoCustom < minimoAdesaoConfig && !(cenarioExterno === 'isenta_rota' || cenarioExterno === 'isenta_base')
                        ? "border-destructive text-destructive"
                        : ""
                    )}
                    disabled={isVendedorExterno && (cenarioExterno === 'isenta_rota' || cenarioExterno === 'isenta_base')}
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Sugerido: {percentualAdesaoConfig}% da FIPE (mín. {formatCurrency(minimoAdesaoConfig)})
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Mensal</p>
                  <p className="text-xl font-bold">
                    {formatCurrency(planoFinalSelecionado.valorMensal + valorExtra)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">1ª Parcela</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(valorAdesaoCustom ?? planoFinalSelecionado.valorAdesao)}
                  </p>
                </div>
              </div>
              
              {valorExtra > 0 && (
                <div className="text-center pt-2 border-t">
                  <p className="text-sm text-green-600">
                    Inclui {formatarMoeda(valorExtra)} de valor extra do vendedor
                  </p>
                </div>
              )}
            </div>

            {/* Botões de ação */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleSalvarEEnviarWhatsApp}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                size="lg"
                disabled={salvandoCotacao}
              >
                {salvandoCotacao ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {cotacaoSalva ? 'Reenviar WhatsApp' : 'Salvar e Enviar WhatsApp'}
                  </>
                )}
              </Button>
              {cotacaoSalva && (
                <Button
                  onClick={handleGerarContrato}
                  variant="outline"
                  className="flex-1"
                  size="lg"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Gerar Contrato
                </Button>
              )}
              {dadosProposta && (
                <BotaoGerarProposta 
                  dados={dadosProposta}
                  disabled={!planoFinalSelecionado}
                  variant="outline"
                />
              )}
              <Button
                onClick={handleEnviarEmail}
                variant="outline"
                size="lg"
              >
                <Mail className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleImprimir}
                variant="ghost"
                size="lg"
              >
                <Printer className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Modal de Placa Duplicada */}
      <PlacaDuplicadaModal
        open={showPlacaDuplicadaModal}
        onOpenChange={setShowPlacaDuplicadaModal}
        placa={placaBusca}
        info={placaDuplicadaInfo}
      />
      
      {/* Modal Veículo na Blacklist */}
      <PlacaBlacklistModal
        open={showBlacklistModal}
        onOpenChange={setShowBlacklistModal}
        placa={placaBusca}
        info={blacklistInfo}
      />
    </div>
  );
}
