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
  FileText,
  AlertCircle,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useFipe } from '@/hooks/useFipe';
import { cn } from '@/lib/utils';
import { useAllLeads, useUpdateLead } from '@/hooks/useLeads';
import { usePlanosCotacao, useCriarCotacao } from '@/hooks/useCotacao';
import { VehicleCategorySelect, CATEGORIAS_VEICULO } from '@/components/cotador/VehicleCategorySelect';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

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

interface PlanoCalculado {
  id: string;
  idReal: string; // ID real do plano no banco
  codigo: string;
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
// DADOS DE REFERÊNCIA
// ============================================

const MARCAS = [
  'Volkswagen', 'Chevrolet', 'Fiat', 'Ford', 'Hyundai', 
  'Toyota', 'Honda', 'Renault', 'Nissan', 'Jeep', 
  'Peugeot', 'Citroën', 'Mitsubishi', 'Kia', 'BYD', 'Caoa Chery', 'RAM', 'Outras'
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

// Mapear planos do banco para interface de exibição
const mapearPlanosParaExibicao = (
  planosDB: any[],
  valorFipe: number,
  usoApp: boolean
): PlanoCalculado[] => {
  const multiplicadorApp = usoApp ? 1.3 : 1.0;
  
  // Ordenar por valor de adesão (basico, completo, premium)
  const planosOrdenados = [...planosDB].sort((a, b) => 
    (a.valor_adesao || 0) - (b.valor_adesao || 0)
  );

  return planosOrdenados.map((plano, index) => {
    // Calcular valor mensal baseado no FIPE
    const basePercentual = index === 0 ? 0.004 : index === 1 ? 0.0055 : 0.007;
    const valorMensal = Math.round((valorFipe * basePercentual) * multiplicadorApp * 100) / 100;
    const valorAdesao = Math.round((plano.valor_adesao || 350) * multiplicadorApp);

    // Identificar tipo de plano
    const isBasico = plano.codigo === 'BASICO';
    const isCompleto = plano.codigo === 'TOTAL';
    const isPremium = plano.codigo === 'PREMIUM';

    // Coberturas do banco ou padrão
    const coberturas = plano.coberturas?.length > 0 ? plano.coberturas : [
      'Colisão (100% FIPE)',
      'Roubo e Furto (100% FIPE)',
      'Incêndio Total',
      'Perda Total',
      ...(isCompleto || isPremium ? ['Vidros completos', 'App de Rastreamento 24h'] : []),
      ...(isPremium ? ['Carro reserva (7 dias)', 'Proteção para terceiros'] : []),
      isBasico ? 'Assistência 24h básica' : 'Assistência 24h completa',
    ];

    // Itens não incluídos
    const naoInclui = isBasico 
      ? ['Vidros', 'App de rastreamento', 'Carro reserva']
      : isCompleto 
        ? ['Carro reserva', 'Proteção para terceiros']
        : [];

    return {
      id: plano.codigo?.toLowerCase() || `plano-${index}`,
      idReal: plano.id,
      codigo: plano.codigo || '',
      nome: plano.nome || `Plano ${index + 1}`,
      descricao: plano.descricao || 
        (isBasico ? 'Proteção essencial para seu veículo' :
         isCompleto ? 'O mais vendido - melhor custo-benefício' :
         'Proteção máxima com todos os benefícios'),
      coberturas,
      naoInclui,
      valorAdesao,
      valorMensal,
      destaque: isCompleto,
    };
  });
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function CotadorPage() {
  const navigate = useNavigate();
  
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
  const [erroCategoriaVeiculo, setErroCategoriaVeiculo] = useState(false);

  // Lead
  const [leadSelecionado, setLeadSelecionado] = useState<LeadDB | null>(null);
  const [buscaLead, setBuscaLead] = useState('');
  const [comboboxAberto, setComboboxAberto] = useState(false);

  // Cotação
  const [isCalculando, setIsCalculando] = useState(false);
  const [cotacaoCalculada, setCotacaoCalculada] = useState(false);
  const [planoSelecionadoTab, setPlanoSelecionadoTab] = useState<string>('total');
  const [planoFinalSelecionado, setPlanoFinalSelecionado] = useState<PlanoCalculado | null>(null);
  const [cotacaoSalva, setCotacaoSalva] = useState<any>(null);
  const [salvandoCotacao, setSalvandoCotacao] = useState(false);

  // Hook FIPE
  const { getByPlaca, loading: loadingFipe } = useFipe();

  // Hooks Supabase
  const { data: leadsData, isLoading: loadingLeads } = useAllLeads();
  const { data: planosDB, isLoading: loadingPlanos } = usePlanosCotacao();
  const criarCotacao = useCriarCotacao();
  const atualizarLead = useUpdateLead();

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

  // Modelos disponíveis
  const modelosDisponiveis = useMemo(() => {
    if (!marca) return [];
    return MODELOS_POR_MARCA[marca] || [];
  }, [marca]);

  // Planos calculados
  const planos = useMemo(() => {
    if (!valorFipe || !planosDB || planosDB.length === 0) {
      // Fallback para planos mock se não tiver dados do banco
      if (!valorFipe) return [];
      return calcularPlanosMock(valorFipe, usoApp);
    }
    return mapearPlanosParaExibicao(planosDB, valorFipe, usoApp);
  }, [valorFipe, usoApp, planosDB]);

  // Plano atual selecionado nas tabs
  const planoAtual = useMemo(() => {
    return planos.find(p => p.id === planoSelecionadoTab || p.codigo?.toLowerCase() === planoSelecionadoTab) || planos[1] || planos[0] || null;
  }, [planos, planoSelecionadoTab]);

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
    setCotacaoCalculada(false);
    setPlanoFinalSelecionado(null);
    setCotacaoSalva(null);
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
      
      const fipe = calcularFipeMock(
        lead.veiculo_marca, 
        lead.veiculo_modelo, 
        lead.veiculo_ano || new Date().getFullYear()
      );
      setValorFipe(fipe);
      setCotacaoCalculada(false);
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
    
    if (!valorFipe && marca && modelo && ano) {
      const fipe = calcularFipeMock(marca, modelo, parseInt(ano));
      setValorFipe(fipe);
    }
    
    setCotacaoCalculada(true);
    setPlanoSelecionadoTab(planosDB?.find(p => p.codigo === 'TOTAL')?.codigo?.toLowerCase() || 'total');
    setPlanoFinalSelecionado(null);
    setIsCalculando(false);
    
    toast.success('Cotação calculada com sucesso!');
  };

  const handleSelecionarPlano = (plano: PlanoCalculado) => {
    setPlanoFinalSelecionado(plano);
    toast.success(`Plano ${plano.nome} selecionado!`);
  };

  const handleSalvarEEnviarWhatsApp = async () => {
    if (!planoFinalSelecionado || !valorFipe) return;
    
    setSalvandoCotacao(true);
    
    try {
      // Salvar cotação no banco
      const cotacaoData = await criarCotacao.mutateAsync({
        lead_id: leadSelecionado?.id || null,
        plano_id: planoFinalSelecionado.idReal,
        veiculo_marca: marca,
        veiculo_modelo: modelo,
        veiculo_ano: parseInt(ano),
        valor_fipe: valorFipe,
        codigo_fipe: veiculoEncontrado?.codigoFipe,
        uso_aplicativo: usoApp,
        categoria_veiculo: categoriaVeiculo || undefined,
      });

      setCotacaoSalva(cotacaoData);

      // Atualizar etapa do lead se vinculado
      if (leadSelecionado?.id) {
        await atualizarLead.mutateAsync({
          id: leadSelecionado.id,
          etapa: 'cotacao_enviada'
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

*Adesão:* ${formatCurrency(planoFinalSelecionado.valorAdesao)}
*Mensalidade:* ${formatCurrency(planoFinalSelecionado.valorMensal)}
*1ª Parcela:* ${formatCurrency(planoFinalSelecionado.valorAdesao + planoFinalSelecionado.valorMensal)}

_Cotação válida por 7 dias_

✨ *Benefícios exclusivos PRATIC:*
• Cobertura 100% da tabela FIPE
• Sem análise de perfil
• Aprovação em até 24h
• App exclusivo para associados
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

  const handleEnviarEmail = () => {
    toast.info('Funcionalidade de email será implementada em breve');
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
                      {leadSelecionado.nome?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{leadSelecionado.nome}</p>
                    <p className="text-sm text-muted-foreground">{leadSelecionado.telefone}</p>
                  </div>
                  {leadSelecionado.veiculo_modelo && (
                    <Badge variant="secondary">
                      {leadSelecionado.veiculo_modelo} {leadSelecionado.veiculo_ano}
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
                      disabled={loadingLeads}
                    >
                      {loadingLeads ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Carregando leads...
                        </>
                      ) : (
                        'Buscar lead por nome, telefone ou placa...'
                      )}
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
                                    {lead.nome?.charAt(0) || '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{lead.nome}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {lead.telefone}
                                    {lead.veiculo_modelo && ` • ${lead.veiculo_modelo} ${lead.veiculo_ano || ''}`}
                                  </p>
                                </div>
                                {lead.veiculo_placa && (
                                  <Badge variant="outline" className="text-xs">
                                    {lead.veiculo_placa}
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
    </div>
  );
}

// Fallback para planos mock se não houver dados do banco
function calcularPlanosMock(valorFipe: number, usoApp: boolean): PlanoCalculado[] {
  const multiplicadorApp = usoApp ? 1.3 : 1.0;
  
  return [
    {
      id: 'basico',
      idReal: '',
      codigo: 'BASICO',
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
      id: 'total',
      idReal: '',
      codigo: 'TOTAL',
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
      idReal: '',
      codigo: 'PREMIUM',
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
}
