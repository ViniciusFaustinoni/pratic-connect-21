import { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useFipe } from '@/hooks/useFipe';
import { cn } from '@/lib/utils';

// ============================================
// INTERFACES
// ============================================

interface Lead {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  veiculo?: {
    marca: string;
    modelo: string;
    ano: number;
    placa?: string;
  };
}

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

interface Plano {
  id: string;
  nome: string;
  descricao: string;
  coberturas: string[];
  naoInclui: string[];
  valorAdesao: number;
  valorMensal: number;
  destaque: boolean;
}

type ModoEntrada = 'busca_placa' | 'manual';

// ============================================
// DADOS MOCK
// ============================================

const mockLeads: Lead[] = [
  { id: '1', nome: 'João Silva', telefone: '(11) 99999-1111', email: 'joao@email.com', veiculo: { marca: 'Volkswagen', modelo: 'Gol', ano: 2020, placa: 'ABC-1234' } },
  { id: '2', nome: 'Maria Oliveira', telefone: '(21) 98888-2222', email: 'maria@email.com', veiculo: { marca: 'Hyundai', modelo: 'HB20', ano: 2021 } },
  { id: '3', nome: 'Pedro Costa', telefone: '(31) 97777-3333', email: 'pedro@email.com', veiculo: { marca: 'Chevrolet', modelo: 'Onix', ano: 2022, placa: 'DEF-5678' } },
  { id: '4', nome: 'Ana Souza', telefone: '(41) 96666-4444', email: 'ana@email.com', veiculo: { marca: 'Fiat', modelo: 'Argo', ano: 2021 } },
  { id: '5', nome: 'Lucas Ferreira', telefone: '(51) 95555-5555', email: 'lucas@email.com', veiculo: { marca: 'Toyota', modelo: 'Corolla', ano: 2020, placa: 'GHI-9012' } },
  { id: '6', nome: 'Carla Mendes', telefone: '(61) 94444-6666', email: 'carla@email.com' },
  { id: '7', nome: 'Rafael Almeida', telefone: '(71) 93333-7777', email: 'rafael@email.com', veiculo: { marca: 'Honda', modelo: 'Civic', ano: 2019 } },
  { id: '8', nome: 'Fernanda Lima', telefone: '(81) 92222-8888', email: 'fernanda@email.com', veiculo: { marca: 'Nissan', modelo: 'Kicks', ano: 2022, placa: 'JKL-3456' } },
];

const MARCAS = [
  'Volkswagen', 'Chevrolet', 'Fiat', 'Ford', 'Hyundai', 
  'Toyota', 'Honda', 'Renault', 'Nissan', 'Jeep', 'Outras'
];

const MODELOS_POR_MARCA: Record<string, string[]> = {
  Volkswagen: ['Gol', 'Voyage', 'Polo', 'Virtus', 'T-Cross', 'Nivus', 'Taos', 'Saveiro'],
  Chevrolet: ['Onix', 'Onix Plus', 'Tracker', 'S10', 'Spin', 'Montana', 'Cruze'],
  Fiat: ['Uno', 'Mobi', 'Argo', 'Cronos', 'Strada', 'Toro', 'Pulse', 'Fastback'],
  Ford: ['Ka', 'Ka Sedan', 'EcoSport', 'Ranger', 'Territory', 'Bronco Sport'],
  Hyundai: ['HB20', 'HB20S', 'Creta', 'Tucson', 'Santa Fe'],
  Toyota: ['Corolla', 'Corolla Cross', 'Yaris', 'Hilux', 'SW4', 'RAV4'],
  Honda: ['Civic', 'City', 'HR-V', 'CR-V', 'Fit', 'WR-V'],
  Renault: ['Kwid', 'Sandero', 'Logan', 'Duster', 'Captur', 'Oroch'],
  Nissan: ['Versa', 'Kicks', 'Frontier', 'Sentra'],
  Jeep: ['Renegade', 'Compass', 'Commander', 'Gladiator'],
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

const calcularFipeMock = (marca: string, _modelo: string, ano: number): number => {
  let valor = 30000;
  const ajusteMarca: Record<string, number> = {
    Toyota: 1.3, Honda: 1.25, Hyundai: 1.15, Volkswagen: 1.1, Chevrolet: 1.05,
    Fiat: 1.0, Renault: 0.95, Nissan: 1.1, Jeep: 1.4, Ford: 1.0, Outras: 1.0,
  };
  valor *= ajusteMarca[marca] || 1.0;
  const anoAtual = new Date().getFullYear();
  const idadeVeiculo = anoAtual - ano;
  valor *= Math.max(0.5, 1 - (idadeVeiculo * 0.07));
  return Math.round(valor / 100) * 100;
};

const calcularPlanos = (valorFipe: number, usoApp: boolean): Plano[] => {
  const multiplicadorApp = usoApp ? 1.3 : 1.0;
  
  return [
    {
      id: 'basico',
      nome: 'Básico',
      descricao: 'Proteção essencial para seu veículo',
      coberturas: [
        'Colisão (100% FIPE)',
        'Roubo e Furto (100% FIPE)',
        'Incêndio Total',
        'Perda Total',
        'Assistência 24h básica',
      ],
      naoInclui: ['Vidros', 'App de rastreamento', 'Carro reserva'],
      valorAdesao: Math.round(350 * multiplicadorApp),
      valorMensal: Math.round((valorFipe * 0.004) * multiplicadorApp * 100) / 100,
      destaque: false,
    },
    {
      id: 'completo',
      nome: 'Completo',
      descricao: 'O mais vendido - melhor custo-benefício',
      coberturas: [
        'Colisão (100% FIPE)',
        'Roubo e Furto (100% FIPE)',
        'Incêndio Total',
        'Perda Total',
        'Vidros completos',
        'App de Rastreamento 24h',
        'Assistência 24h completa',
        'Reboque ilimitado',
      ],
      naoInclui: ['Carro reserva', 'Proteção para terceiros'],
      valorAdesao: Math.round(450 * multiplicadorApp),
      valorMensal: Math.round((valorFipe * 0.0055) * multiplicadorApp * 100) / 100,
      destaque: true,
    },
    {
      id: 'premium',
      nome: 'Premium',
      descricao: 'Proteção máxima com todos os benefícios',
      coberturas: [
        'Colisão (100% FIPE)',
        'Roubo e Furto (100% FIPE)',
        'Incêndio Total',
        'Perda Total',
        'Vidros completos',
        'App de Rastreamento 24h',
        'Assistência 24h VIP',
        'Reboque ilimitado',
        'Carro reserva (7 dias)',
        'Proteção para terceiros',
        'Faróis e lanternas',
        'Retrovisores',
      ],
      naoInclui: [],
      valorAdesao: Math.round(550 * multiplicadorApp),
      valorMensal: Math.round((valorFipe * 0.007) * multiplicadorApp * 100) / 100,
      destaque: false,
    },
  ];
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function CotadorPage() {
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

  // Lead
  const [leadSelecionado, setLeadSelecionado] = useState<Lead | null>(null);
  const [buscaLead, setBuscaLead] = useState('');
  const [comboboxAberto, setComboboxAberto] = useState(false);

  // Cotação
  const [isCalculando, setIsCalculando] = useState(false);
  const [cotacaoCalculada, setCotacaoCalculada] = useState(false);
  const [planoSelecionadoTab, setPlanoSelecionadoTab] = useState<string>('completo');
  const [planoFinalSelecionado, setPlanoFinalSelecionado] = useState<Plano | null>(null);

  // Hook FIPE
  const { getByPlaca, loading: loadingFipe } = useFipe();

  // Filtro de leads
  const leadsFiltrados = useMemo(() => {
    const termo = buscaLead.toLowerCase();
    if (!termo) return mockLeads;
    return mockLeads.filter(lead => 
      lead.nome.toLowerCase().includes(termo) ||
      lead.telefone.includes(termo) ||
      lead.email?.toLowerCase().includes(termo) ||
      lead.veiculo?.modelo.toLowerCase().includes(termo) ||
      lead.veiculo?.placa?.toLowerCase().includes(termo)
    );
  }, [buscaLead]);

  // Modelos disponíveis
  const modelosDisponiveis = useMemo(() => {
    if (!marca) return [];
    return MODELOS_POR_MARCA[marca] || [];
  }, [marca]);

  // Planos calculados
  const planos = useMemo(() => {
    if (!valorFipe) return [];
    return calcularPlanos(valorFipe, usoApp);
  }, [valorFipe, usoApp]);

  // Plano atual selecionado nas tabs
  const planoAtual = useMemo(() => {
    return planos.find(p => p.id === planoSelecionadoTab) || null;
  }, [planos, planoSelecionadoTab]);

  // Verificar se pode calcular
  const podeCalcular = modo === 'busca_placa' 
    ? veiculoEncontrado !== null 
    : marca && modelo && ano;

  // ============================================
  // HANDLERS
  // ============================================

  const handleModoChange = (novoModo: ModoEntrada) => {
    setModo(novoModo);
    // Limpar estados ao trocar modo
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
  };

  const handleBuscarPlaca = async () => {
    if (!placaBusca || placaBusca.length < 7) {
      toast.error('Digite uma placa válida');
      return;
    }

    setBuscandoPlaca(true);
    setErroBusca(null);
    
    try {
      const result = await getByPlaca(placaBusca.replace(/[^A-Za-z0-9]/g, ''));
      
      if (result.success && result.vehicleData) {
        const { vehicleData, fipeData } = result;
        
        setVeiculoEncontrado({
          placa: vehicleData.placa,
          marca: vehicleData.marca,
          modelo: vehicleData.modelo,
          ano: vehicleData.ano,
          cor: vehicleData.cor,
          combustivel: vehicleData.combustivel,
          codigoFipe: fipeData?.codigo,
          valorFipe: fipeData?.valor,
        });

        // Preencher campos
        setMarca(vehicleData.marca);
        setModelo(vehicleData.modelo);
        setAno(vehicleData.ano);
        setCor(vehicleData.cor || '');
        
        if (fipeData?.valor) {
          setValorFipe(fipeData.valor);
        } else {
          const anoNum = parseInt(vehicleData.ano) || new Date().getFullYear();
          setValorFipe(calcularFipeMock(vehicleData.marca, vehicleData.modelo, anoNum));
        }

        setCotacaoCalculada(false);
        setPlanoFinalSelecionado(null);
        
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
    setCotacaoCalculada(false);
    setPlanoFinalSelecionado(null);
  };

  const handleSelecionarLead = (lead: Lead) => {
    setLeadSelecionado(lead);
    setComboboxAberto(false);
    setBuscaLead('');
    
    if (lead.veiculo) {
      setMarca(lead.veiculo.marca);
      setModelo(lead.veiculo.modelo);
      setAno(lead.veiculo.ano.toString());
      if (lead.veiculo.placa) {
        setPlacaBusca(lead.veiculo.placa);
      }
      const fipe = calcularFipeMock(lead.veiculo.marca, lead.veiculo.modelo, lead.veiculo.ano);
      setValorFipe(fipe);
      setCotacaoCalculada(false);
      setPlanoFinalSelecionado(null);
      toast.success('Dados do veículo preenchidos automaticamente');
    }
  };

  const handleLimparLead = () => {
    setLeadSelecionado(null);
  };

  const handleCalcular = async () => {
    if (!podeCalcular) return;

    setIsCalculando(true);
    await new Promise(resolve => setTimeout(resolve, 600));
    
    if (!valorFipe && marca && modelo && ano) {
      const fipe = calcularFipeMock(marca, modelo, parseInt(ano));
      setValorFipe(fipe);
    }
    
    setCotacaoCalculada(true);
    setPlanoSelecionadoTab('completo');
    setPlanoFinalSelecionado(null);
    setIsCalculando(false);
    
    toast.success('Cotação calculada com sucesso!');
  };

  const handleSelecionarPlano = (plano: Plano) => {
    setPlanoFinalSelecionado(plano);
    toast.success(`Plano ${plano.nome} selecionado!`);
  };

  const handleEnviarWhatsApp = () => {
    if (!planoFinalSelecionado || !valorFipe) return;
    
    const nomeCliente = leadSelecionado ? `\n*Cliente:* ${leadSelecionado.nome}` : '';
    const placaInfo = veiculoEncontrado?.placa ? `\n*Placa:* ${veiculoEncontrado.placa}` : '';
    
    const mensagem = `
🚗 *COTAÇÃO DE PROTEÇÃO VEICULAR*${nomeCliente}${placaInfo}

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

*Adesão:* ${formatCurrency(planoFinalSelecionado.valorAdesao)}
*Mensalidade:* ${formatCurrency(planoFinalSelecionado.valorMensal)}
*1ª Parcela:* ${formatCurrency(planoFinalSelecionado.valorAdesao + planoFinalSelecionado.valorMensal)}

_Cotação válida por 7 dias_
    `.trim();

    const telefone = leadSelecionado?.telefone.replace(/\D/g, '') || '';
    const url = telefone 
      ? `https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`
      : `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
    
    toast.success('Cotação preparada para envio!');
  };

  const handleEnviarEmail = () => {
    toast.info('Funcionalidade de email será implementada em breve');
  };

  const handleImprimir = () => {
    window.print();
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
        <h1 className="text-2xl font-bold tracking-tight">Cotador Rápido</h1>
        <p className="text-muted-foreground">Gere cotações em menos de 30 segundos</p>
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
                        setCotacaoCalculada(false);
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
                        // Calcular FIPE automaticamente ao preencher todos
                        if (marca && modelo && v) {
                          const fipe = calcularFipeMock(marca, modelo, parseInt(v));
                          setValorFipe(fipe);
                        }
                        setCotacaoCalculada(false);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {ANOS.map((a) => (
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
            
            {/* Vincular Lead */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Vincular a Lead (opcional)
                </Label>
                {leadSelecionado && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLimparLead}
                    className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Remover
                  </Button>
                )}
              </div>

              {leadSelecionado ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {leadSelecionado.nome.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{leadSelecionado.nome}</p>
                    <p className="text-sm text-muted-foreground">{leadSelecionado.telefone}</p>
                  </div>
                  {leadSelecionado.veiculo && (
                    <Badge variant="secondary">
                      {leadSelecionado.veiculo.modelo} {leadSelecionado.veiculo.ano}
                    </Badge>
                  )}
                </div>
              ) : (
                <Popover open={comboboxAberto} onOpenChange={setComboboxAberto}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboboxAberto}
                      className="w-full justify-between font-normal text-muted-foreground"
                    >
                      Buscar lead por nome, telefone ou placa...
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Digite para buscar..." 
                        value={buscaLead}
                        onValueChange={setBuscaLead}
                      />
                      <CommandList>
                        <CommandEmpty>
                          <div className="py-6 text-center text-sm text-muted-foreground">
                            Nenhum lead encontrado
                          </div>
                        </CommandEmpty>
                        <CommandGroup>
                          {leadsFiltrados.map((lead) => (
                            <CommandItem
                              key={lead.id}
                              value={lead.id}
                              onSelect={() => handleSelecionarLead(lead)}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center gap-3 w-full">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="text-xs">
                                    {lead.nome.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{lead.nome}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {lead.telefone}
                                    {lead.veiculo && ` • ${lead.veiculo.modelo} ${lead.veiculo.ano}`}
                                  </p>
                                </div>
                                {lead.veiculo?.placa && (
                                  <Badge variant="outline" className="text-xs">
                                    {lead.veiculo.placa}
                                  </Badge>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
              
              <p className="text-xs text-muted-foreground">
                Vincule a um lead para manter histórico e facilitar conversão
              </p>
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

            {/* Botão Calcular */}
            <Button
              onClick={handleCalcular}
              disabled={!podeCalcular || isCalculando}
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
                      {plano.id === 'completo' && (
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
                        {planoAtual.coberturas.map((cobertura, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500 shrink-0" />
                            <span>{cobertura}</span>
                          </div>
                        ))}
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
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase">Adesão</p>
                          <p className="text-lg font-bold">{formatCurrency(planoAtual.valorAdesao)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase">Mensal</p>
                          <p className="text-lg font-bold">{formatCurrency(planoAtual.valorMensal)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase">1ª Parcela</p>
                          <p className="text-lg font-bold text-primary">
                            {formatCurrency(planoAtual.valorAdesao + planoAtual.valorMensal)}
                          </p>
                        </div>
                      </div>
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
                <p className="font-medium">{veiculoEncontrado?.placa || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Plano</p>
                <p className="font-medium">{planoFinalSelecionado.nome}</p>
              </div>
            </div>

            {/* Box de valores */}
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Adesão</p>
                  <p className="text-xl font-bold">{formatCurrency(planoFinalSelecionado.valorAdesao)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Mensal</p>
                  <p className="text-xl font-bold">{formatCurrency(planoFinalSelecionado.valorMensal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">1ª Parcela</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(planoFinalSelecionado.valorAdesao + planoFinalSelecionado.valorMensal)}
                  </p>
                </div>
              </div>
            </div>

            {/* Botões de ação */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleEnviarWhatsApp}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Enviar por WhatsApp
              </Button>
              <Button
                onClick={handleEnviarEmail}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                <Mail className="h-4 w-4 mr-2" />
                Enviar por Email
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
    </div>
  );
}
