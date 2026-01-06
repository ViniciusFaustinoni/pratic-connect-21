import { useState, useMemo } from 'react';
import { PlanoCard } from '@/components/vendas/PlanoCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// INTERFACE LEAD
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

// ============================================
// DADOS MOCK DE LEADS
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
// ============================================
// DADOS MOCK
// ============================================

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

// Gerar anos de 2026 até 2010
const ANOS = Array.from({ length: 17 }, (_, i) => 2026 - i);

// Valores FIPE mock baseados em marca/modelo/ano
const calcularFipeMock = (marca: string, _modelo: string, ano: number): number => {
  // Base: 30.000
  let valor = 30000;
  
  // Ajuste por marca
  const ajusteMarca: Record<string, number> = {
    Toyota: 1.3,
    Honda: 1.25,
    Hyundai: 1.15,
    Volkswagen: 1.1,
    Chevrolet: 1.05,
    Fiat: 1.0,
    Renault: 0.95,
    Nissan: 1.1,
    Jeep: 1.4,
    Ford: 1.0,
    Outras: 1.0,
  };
  
  valor *= ajusteMarca[marca] || 1.0;
  
  // Ajuste por ano (mais novo = mais caro)
  const anoAtual = new Date().getFullYear();
  const idadeVeiculo = anoAtual - ano;
  valor *= Math.max(0.5, 1 - (idadeVeiculo * 0.07));
  
  // Arredondar para centenas
  return Math.round(valor / 100) * 100;
};

// Planos mock
const calcularPlanos = (valorFipe: number, usoApp: boolean) => {
  const multiplicadorApp = usoApp ? 1.3 : 1.0;
  
  return [
    {
      id: 'basico',
      nome: 'Plano Básico',
      descricao: 'Cobertura até 100% FIPE',
      coberturas: [
        'Proteção contra roubo/furto',
        'Proteção contra colisão',
        'Proteção contra incêndio',
        'Assistência 24h',
      ],
      valorAdesao: 350 * multiplicadorApp,
      valorMensal: Math.round((valorFipe * 0.004) * multiplicadorApp * 100) / 100,
      destaque: false,
    },
    {
      id: 'completo',
      nome: 'Plano Completo',
      descricao: '100% FIPE + Vidros + App Rastreamento',
      coberturas: [
        'Proteção contra roubo/furto',
        'Proteção contra colisão',
        'Proteção contra incêndio',
        'Assistência 24h',
        'Proteção de vidros',
        'App de rastreamento',
        'Carro reserva (7 dias)',
      ],
      valorAdesao: 450 * multiplicadorApp,
      valorMensal: Math.round((valorFipe * 0.0055) * multiplicadorApp * 100) / 100,
      destaque: true,
    },
    {
      id: 'premium',
      nome: 'Plano Premium',
      descricao: 'Cobertura total + benefícios exclusivos',
      coberturas: [
        'Proteção contra roubo/furto',
        'Proteção contra colisão',
        'Proteção contra incêndio',
        'Assistência 24h Premium',
        'Proteção de vidros',
        'App de rastreamento',
        'Carro reserva (15 dias)',
        'Proteção para terceiros',
        'Desconto em rede credenciada',
      ],
      valorAdesao: 600 * multiplicadorApp,
      valorMensal: Math.round((valorFipe * 0.007) * multiplicadorApp * 100) / 100,
      destaque: false,
    },
  ];
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function CotadorPage() {
  // Estado do formulário
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [ano, setAno] = useState('');
  const [usoApp, setUsoApp] = useState(false);
  
  // Estado da cotação
  const [valorFipe, setValorFipe] = useState<number | null>(null);
  const [isCalculando, setIsCalculando] = useState(false);
  const [cotacaoCalculada, setCotacaoCalculada] = useState(false);
  const [planoSelecionado, setPlanoSelecionado] = useState<string | null>(null);

  // Estado do lead
  const [leadSelecionado, setLeadSelecionado] = useState<Lead | null>(null);
  const [buscaLead, setBuscaLead] = useState('');
  const [comboboxAberto, setComboboxAberto] = useState(false);

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

  // Selecionar lead
  const handleSelecionarLead = (lead: Lead) => {
    setLeadSelecionado(lead);
    setComboboxAberto(false);
    setBuscaLead('');
    
    // Auto-preencher campos do veículo se existirem
    if (lead.veiculo) {
      setMarca(lead.veiculo.marca);
      setModelo(lead.veiculo.modelo);
      setAno(lead.veiculo.ano.toString());
      // Calcular FIPE automaticamente
      const fipe = calcularFipeMock(lead.veiculo.marca, lead.veiculo.modelo, lead.veiculo.ano);
      setValorFipe(fipe);
      setCotacaoCalculada(false);
      setPlanoSelecionado(null);
      toast.success('Dados do veículo preenchidos automaticamente');
    }
  };

  // Limpar lead
  const handleLimparLead = () => {
    setLeadSelecionado(null);
    // Manter os dados do veículo
  };

  // Modelos disponíveis baseado na marca
  const modelosDisponiveis = useMemo(() => {
    if (!marca) return [];
    return MODELOS_POR_MARCA[marca] || [];
  }, [marca]);

  // Quando marca muda, limpar modelo
  const handleMarcaChange = (novaMarca: string) => {
    setMarca(novaMarca);
    setModelo('');
    setValorFipe(null);
    setCotacaoCalculada(false);
    setPlanoSelecionado(null);
  };

  // Verificar se pode calcular
  const podeCalcular = marca && modelo && ano;

  // Calcular cotação
  const handleCalcular = async () => {
    if (!podeCalcular) return;

    setIsCalculando(true);
    
    // Simular delay de API
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const fipe = calcularFipeMock(marca, modelo, parseInt(ano));
    setValorFipe(fipe);
    setCotacaoCalculada(true);
    setPlanoSelecionado(null);
    setIsCalculando(false);
    
    toast.success('Cotação calculada com sucesso!');
  };

  // Planos calculados
  const planos = useMemo(() => {
    if (!valorFipe) return [];
    return calcularPlanos(valorFipe, usoApp);
  }, [valorFipe, usoApp]);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Enviar WhatsApp
  const handleEnviarWhatsApp = () => {
    if (!planoSelecionado || !valorFipe) return;
    
    const plano = planos.find(p => p.id === planoSelecionado);
    if (!plano) return;

    const nomeCliente = leadSelecionado ? `\n*Cliente:* ${leadSelecionado.nome}` : '';
    const mensagem = `
🚗 *COTAÇÃO DE PROTEÇÃO VEICULAR*${nomeCliente}

*Veículo:* ${marca} ${modelo} ${ano}
*Valor FIPE:* ${formatCurrency(valorFipe)}

*Plano:* ${plano.nome}
*Adesão:* ${formatCurrency(plano.valorAdesao)}
*Mensalidade:* ${formatCurrency(plano.valorMensal)}

*Coberturas:*
${plano.coberturas.map(c => `✓ ${c}`).join('\n')}

_Cotação válida por 7 dias_
    `.trim();

    // Se tiver lead, usa o telefone dele
    const telefone = leadSelecionado?.telefone.replace(/\D/g, '') || '';
    const url = telefone 
      ? `https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`
      : `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');
    
    toast.success('Cotação preparada para envio!');
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cotador</h1>
        <p className="text-muted-foreground">Gere cotações rapidamente para seus leads</p>
      </div>

      {/* GRID PRINCIPAL */}
      <div className="grid gap-6 lg:grid-cols-2">
        
        {/* CARD ESQUERDO - DADOS DO VEÍCULO */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Dados do Veículo
            </CardTitle>
            <CardDescription>
              Informe os dados para calcular a cotação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Campo Vincular Lead (opcional) */}
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
                // Lead selecionado - mostrar card resumo
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
                // Combobox de busca
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

            <div className="border-t pt-4" />

            {/* Marca */}
            <div className="space-y-2">
              <Label>Marca *</Label>
              <Select value={marca} onValueChange={handleMarcaChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a marca" />
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
                  <SelectValue placeholder="Selecione o modelo" />
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
                  setValorFipe(null);
                  setCotacaoCalculada(false);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o ano" />
                </SelectTrigger>
                <SelectContent>
                  {ANOS.map((a) => (
                    <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Valor FIPE */}
            <div className="space-y-2">
              <Label>Valor FIPE</Label>
              <div className="relative">
                <Input
                  readOnly
                  value={valorFipe ? formatCurrency(valorFipe) : ''}
                  placeholder="Calculado automaticamente"
                  className="pr-10"
                />
                {valorFipe && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">✓</span>
                )}
              </div>
            </div>

            {/* Uso para aplicativo */}
            <div className="space-y-2">
              <Label>Uso para aplicativo?</Label>
              <RadioGroup
                value={usoApp ? 'sim' : 'nao'}
                onValueChange={(v) => {
                  setUsoApp(v === 'sim');
                  if (cotacaoCalculada) {
                    // Recalcular planos se já calculou
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
                    Valores podem ser maiores para veículos de aplicativo
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
              // Estado inicial
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <FileSearch className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-sm">
                  Preencha os dados do veículo
                  <br />
                  e clique em Calcular Cotação
                </p>
              </div>
            ) : (
              // Planos
              <div className="space-y-4">
                {planos.map((plano) => (
                  <PlanoCard
                    key={plano.id}
                    plano={plano}
                    selecionado={planoSelecionado === plano.id}
                    onSelecionar={() => setPlanoSelecionado(plano.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* BOTÃO ENVIAR WHATSAPP */}
      {cotacaoCalculada && (
        <Card>
          <CardContent className="py-4">
            <Button
              onClick={handleEnviarWhatsApp}
              disabled={!planoSelecionado}
              className="w-full"
              size="lg"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Enviar Cotação por WhatsApp
            </Button>
            {!planoSelecionado && (
              <p className="text-center text-sm text-muted-foreground mt-2">
                Selecione um plano para enviar a cotação
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
