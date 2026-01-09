import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, Car, Zap, Bike, Calendar, Star, Check, 
  AlertTriangle, Umbrella, Flame, CloudRain, Users,
  Wrench, Phone, MapPin, Key, Fuel, Clock, Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Tipos
interface Plano {
  id: string;
  nome: string;
  linha: string;
  descricao: string;
  coberturaFipe: number;
  cotaParticipacao: string;
  cotaMinima: string;
  coberturas: string[];
  publicoAlvo: string[];
  destaque?: boolean;
  cor: string;
}

interface BeneficioAdicional {
  nome: string;
  valorMensal: number;
  descricao: string;
  icone: React.ReactNode;
}

interface Cobertura {
  nome: string;
  descricao: string;
  detalhes: string;
  icone: React.ReactNode;
}

// Dados dos Planos conforme Manual do Consultor
const PLANOS: Plano[] = [
  // Linha SELECT
  {
    id: 'select-basic',
    nome: 'Select Basic',
    linha: 'SELECT',
    descricao: 'Proteção essencial para seu veículo',
    coberturaFipe: 100,
    cotaParticipacao: '6% FIPE (Passeio) | 8% FIPE (APP)',
    cotaMinima: 'R$ 1.200 (Passeio) | R$ 3.000 (APP)',
    coberturas: [
      'Roubo e Furto',
      'Colisão',
      'Perda Total',
      'Incêndio',
      'Alagamento',
      'Chuva de Granizo',
      'Assistência 24h (400km)',
    ],
    publicoAlvo: ['Passeio', 'APP'],
    cor: 'from-blue-500 to-blue-600',
  },
  {
    id: 'select-premium',
    nome: 'Select Premium',
    linha: 'SELECT',
    descricao: 'Proteção ampliada com benefícios extras',
    coberturaFipe: 100,
    cotaParticipacao: '6% FIPE (Passeio) | 8% FIPE (APP)',
    cotaMinima: 'R$ 1.200 (Passeio) | R$ 3.000 (APP)',
    coberturas: [
      'Roubo e Furto',
      'Colisão',
      'Perda Total',
      'Incêndio',
      'Alagamento',
      'Chuva de Granizo',
      'Assistência 24h (1000km)',
      'Danos a Terceiros R$ 40.000',
      'Proteção Vidros e Faróis',
      'Reboque Excedente',
    ],
    publicoAlvo: ['Passeio', 'APP'],
    destaque: true,
    cor: 'from-blue-600 to-indigo-600',
  },
  {
    id: 'select-exclusive',
    nome: 'Select Exclusive',
    linha: 'SELECT',
    descricao: 'Proteção máxima com todos os benefícios',
    coberturaFipe: 100,
    cotaParticipacao: '6% FIPE (Passeio) | 8% FIPE (APP)',
    cotaMinima: 'R$ 1.200 (Passeio) | R$ 3.000 (APP)',
    coberturas: [
      'Roubo e Furto',
      'Colisão',
      'Perda Total',
      'Incêndio',
      'Alagamento',
      'Chuva de Granizo',
      'Assistência 24h (1000km)',
      'Danos a Terceiros R$ 40.000',
      'Proteção Vidros e Faróis',
      'Reboque Excedente',
      'Proteção Kit Gás',
      '100% FIPE APP + 30 dias Carro Reserva',
    ],
    publicoAlvo: ['Passeio', 'APP'],
    cor: 'from-indigo-600 to-purple-600',
  },
  // Linha SELECT ONE
  {
    id: 'select-one',
    nome: 'Select One',
    linha: 'SELECT ONE',
    descricao: 'Plano completo em uma única opção',
    coberturaFipe: 100,
    cotaParticipacao: '6% FIPE (Passeio) | 8% FIPE (APP)',
    cotaMinima: 'R$ 1.200 (Passeio) | R$ 3.000 (APP)',
    coberturas: [
      'Roubo e Furto',
      'Colisão',
      'Perda Total',
      'Incêndio',
      'Alagamento',
      'Chuva de Granizo',
      'Danos a Terceiros R$ 100.000',
      'Proteção Vidros e Faróis',
      'Reboque Excedente',
      'Assistência 24h (1000km)',
      'Proteção Kit Gás',
      'Carro Reserva',
      'Clube Gás',
      'Rastreador',
    ],
    publicoAlvo: ['Passeio', 'APP'],
    destaque: true,
    cor: 'from-emerald-500 to-green-600',
  },
  // Linha ESPECIAL
  {
    id: 'especial',
    nome: 'Especial',
    linha: 'ESPECIAL',
    descricao: 'Para veículos de 2002 a 2008',
    coberturaFipe: 80,
    cotaParticipacao: '10% FIPE',
    cotaMinima: 'R$ 3.000',
    coberturas: [
      'Roubo e Furto',
      'Rastreador',
      'Assistência 24h (400km)',
    ],
    publicoAlvo: ['Veículos 2002-2008'],
    cor: 'from-orange-500 to-amber-600',
  },
  {
    id: 'especial-plus',
    nome: 'Especial Plus',
    linha: 'ESPECIAL',
    descricao: 'Especial com proteção para colisão',
    coberturaFipe: 80,
    cotaParticipacao: '10% FIPE',
    cotaMinima: 'R$ 3.000',
    coberturas: [
      'Roubo e Furto',
      'Colisão',
      'Perda Total',
      'Incêndio',
      'Alagamento',
      'Chuva de Granizo',
      'Rastreador',
      'Assistência 24h (400km)',
    ],
    publicoAlvo: ['Veículos 2002-2008'],
    cor: 'from-amber-500 to-orange-600',
  },
  // Linha LANÇAMENTO
  {
    id: 'lancamento-basic',
    nome: 'Lançamento Basic',
    linha: 'LANÇAMENTO',
    descricao: 'Para veículos 0km e 2024+',
    coberturaFipe: 100,
    cotaParticipacao: '10% FIPE',
    cotaMinima: 'R$ 3.000',
    coberturas: [
      'Roubo e Furto',
      'Colisão',
      'Perda Total',
      'Incêndio',
      'Alagamento',
      'Chuva de Granizo',
      'Assistência 24h (400km)',
    ],
    publicoAlvo: ['Veículos 2024+', '0km'],
    cor: 'from-violet-500 to-purple-600',
  },
  {
    id: 'lancamento-premium',
    nome: 'Lançamento Premium',
    linha: 'LANÇAMENTO',
    descricao: 'Proteção ampliada para novos',
    coberturaFipe: 100,
    cotaParticipacao: '10% FIPE',
    cotaMinima: 'R$ 3.000',
    coberturas: [
      'Roubo e Furto',
      'Colisão',
      'Perda Total',
      'Incêndio',
      'Alagamento',
      'Chuva de Granizo',
      'Assistência 24h (1000km)',
      'Danos a Terceiros R$ 40.000',
      'Proteção Vidros e Faróis',
      'Reboque Excedente',
    ],
    publicoAlvo: ['Veículos 2024+', '0km'],
    destaque: true,
    cor: 'from-purple-500 to-fuchsia-600',
  },
  {
    id: 'lancamento-exclusive',
    nome: 'Lançamento Exclusive',
    linha: 'LANÇAMENTO',
    descricao: 'Máxima proteção para seu 0km',
    coberturaFipe: 100,
    cotaParticipacao: '10% FIPE',
    cotaMinima: 'R$ 3.000',
    coberturas: [
      'Roubo e Furto',
      'Colisão',
      'Perda Total',
      'Incêndio',
      'Alagamento',
      'Chuva de Granizo',
      'Assistência 24h (1000km)',
      'Danos a Terceiros R$ 40.000',
      'Proteção Vidros e Faróis',
      'Reboque Excedente',
      'Proteção Kit Gás',
      '100% FIPE + 30 dias Carro Reserva (APP)',
    ],
    publicoAlvo: ['Veículos 2024+', '0km'],
    cor: 'from-fuchsia-500 to-pink-600',
  },
  // Linha ADVANCED (Motos)
  {
    id: 'advanced',
    nome: 'Advanced',
    linha: 'ADVANCED',
    descricao: 'Proteção para motocicletas',
    coberturaFipe: 100,
    cotaParticipacao: 'Conforme tabela',
    cotaMinima: 'FIPE > R$ 9.000',
    coberturas: [
      'Roubo e Furto',
      'Monitoramento 24h',
      'Assistência 24h (400km)',
    ],
    publicoAlvo: ['Motocicletas'],
    cor: 'from-red-500 to-rose-600',
  },
  {
    id: 'advanced-plus',
    nome: 'Advanced+',
    linha: 'ADVANCED',
    descricao: 'Proteção completa para motos',
    coberturaFipe: 100,
    cotaParticipacao: 'Conforme tabela (Part. R$ 750)',
    cotaMinima: 'FIPE > R$ 9.000',
    coberturas: [
      'Roubo e Furto',
      'Colisão',
      'Monitoramento 24h',
      'Danos a Terceiros R$ 10.000',
      'Assistência 24h (400km)',
    ],
    publicoAlvo: ['Motocicletas'],
    destaque: true,
    cor: 'from-rose-500 to-red-600',
  },
  // Linha ELÉTRICOS
  {
    id: 'eletricos',
    nome: 'Elétricos',
    linha: 'ELÉTRICOS',
    descricao: 'Proteção especializada para veículos elétricos',
    coberturaFipe: 100,
    cotaParticipacao: '10% FIPE',
    cotaMinima: 'Conforme tabela',
    coberturas: [
      'Roubo e Furto',
      'Colisão',
      'Incêndio',
      'Alagamento',
      'Chuva de Granizo',
      'Assistência 24h (1000km)',
      '30 dias Carro Reserva',
      'Danos a Terceiros R$ 40.000',
      'Reboque Excedente',
      'Cobertura APP 100%',
    ],
    publicoAlvo: ['Veículos Elétricos'],
    destaque: true,
    cor: 'from-teal-500 to-cyan-600',
  },
];

// Benefícios Adicionais
const BENEFICIOS_ADICIONAIS: BeneficioAdicional[] = [
  { nome: '1000km de Reboque', valorMensal: 2.90, descricao: 'Ampliação do reboque para 1000km', icone: <MapPin className="h-5 w-5" /> },
  { nome: 'Clube Gás', valorMensal: 10.00, descricao: 'Desconto em postos credenciados', icone: <Fuel className="h-5 w-5" /> },
  { nome: 'Danos a Terceiros R$ 15.000', valorMensal: 12.90, descricao: 'Cobertura para danos materiais e corporais', icone: <Users className="h-5 w-5" /> },
  { nome: 'Danos a Terceiros R$ 70.000', valorMensal: 20.00, descricao: 'Cobertura ampliada para terceiros', icone: <Users className="h-5 w-5" /> },
  { nome: 'Danos a Terceiros R$ 100.000', valorMensal: 40.00, descricao: 'Cobertura máxima para terceiros', icone: <Users className="h-5 w-5" /> },
  { nome: 'Proteção Passageiros (APP)', valorMensal: 4.90, descricao: 'Cobertura para acidentes pessoais', icone: <Shield className="h-5 w-5" /> },
  { nome: 'Rastreador', valorMensal: 30.00, descricao: 'Monitoramento 24h do veículo', icone: <MapPin className="h-5 w-5" /> },
  { nome: 'Carro Reserva 7 dias', valorMensal: 7.90, descricao: 'Veículo reserva por 7 dias', icone: <Car className="h-5 w-5" /> },
  { nome: 'Carro Reserva 15 dias', valorMensal: 15.90, descricao: 'Veículo reserva por 15 dias', icone: <Car className="h-5 w-5" /> },
  { nome: 'Carro Reserva 30 dias', valorMensal: 35.90, descricao: 'Veículo reserva por 30 dias', icone: <Car className="h-5 w-5" /> },
  { nome: 'Proteção Vidros e Faróis', valorMensal: 9.90, descricao: '60% de cobertura (carência 120 dias)', icone: <Wrench className="h-5 w-5" /> },
  { nome: 'Proteção Kit Gás', valorMensal: 9.90, descricao: 'Cobertura até R$ 2.200', icone: <Fuel className="h-5 w-5" /> },
  { nome: 'Reboque Excedente', valorMensal: 2.90, descricao: 'Km adicional após franquia', icone: <MapPin className="h-5 w-5" /> },
  { nome: '100% FIPE APP + 30 dias Reserva', valorMensal: 35.90, descricao: 'Combo para APP com carro reserva', icone: <Star className="h-5 w-5" /> },
];

// Coberturas Detalhadas
const COBERTURAS: Cobertura[] = [
  {
    nome: 'Roubo e Furto',
    descricao: 'Proteção contra roubo e furto do veículo',
    detalhes: 'Indenização em até 60 dias úteis após conclusão do processo. Necessário B.O. e documentação completa.',
    icone: <AlertTriangle className="h-6 w-6" />,
  },
  {
    nome: 'Colisão',
    descricao: 'Cobertura para danos por colisão',
    detalhes: 'Reparo em oficina credenciada. Análise em até 7 dias úteis. Participação conforme plano.',
    icone: <Car className="h-6 w-6" />,
  },
  {
    nome: 'Perda Total',
    descricao: 'Quando os danos superam 75% do valor',
    detalhes: 'Indenização integral conforme tabela FIPE do plano contratado.',
    icone: <Shield className="h-6 w-6" />,
  },
  {
    nome: 'Incêndio',
    descricao: 'Proteção contra danos por fogo',
    detalhes: 'Cobertura para incêndio acidental ou criminoso, mediante comprovação.',
    icone: <Flame className="h-6 w-6" />,
  },
  {
    nome: 'Alagamento',
    descricao: 'Danos causados por enchentes',
    detalhes: 'Cobertura para danos mecânicos e elétricos causados por alagamento.',
    icone: <Umbrella className="h-6 w-6" />,
  },
  {
    nome: 'Chuva de Granizo',
    descricao: 'Proteção contra danos por granizo',
    detalhes: 'Reparo de amassados e danos causados por chuva de pedras.',
    icone: <CloudRain className="h-6 w-6" />,
  },
  {
    nome: 'Danos a Terceiros',
    descricao: 'Cobertura para danos materiais e corporais',
    detalhes: 'Valores de R$ 10.000 a R$ 100.000 conforme plano. Cobre danos a outros veículos e pessoas.',
    icone: <Users className="h-6 w-6" />,
  },
  {
    nome: 'Proteção Vidros e Faróis',
    descricao: 'Cobertura para cristais do veículo',
    detalhes: '60% de cobertura. Carência de 120 dias. Inclui para-brisa, vidros laterais e faróis.',
    icone: <Wrench className="h-6 w-6" />,
  },
  {
    nome: 'Assistência 24h',
    descricao: 'Socorro mecânico e guincho',
    detalhes: 'Reboque (400km ou 1000km), táxi, pane seca, troca de pneu, chaveiro, hospedagem.',
    icone: <Phone className="h-6 w-6" />,
  },
  {
    nome: 'Carro Reserva',
    descricao: 'Veículo substituto durante reparo',
    detalhes: 'Disponível por 7, 15 ou 30 dias. Valor máximo de R$ 2.200.',
    icone: <Car className="h-6 w-6" />,
  },
  {
    nome: 'Kit Gás',
    descricao: 'Proteção para sistema GNV',
    detalhes: 'Cobertura até R$ 2.200 para kit gás instalado no veículo.',
    icone: <Fuel className="h-6 w-6" />,
  },
  {
    nome: 'Rastreador',
    descricao: 'Monitoramento 24 horas',
    detalhes: 'Localização em tempo real, cerca virtual, histórico de rotas.',
    icone: <MapPin className="h-6 w-6" />,
  },
];

// Ícones por linha de plano
const LINHA_ICONES: Record<string, React.ReactNode> = {
  'SELECT': <Shield className="h-6 w-6" />,
  'SELECT ONE': <Star className="h-6 w-6" />,
  'ESPECIAL': <Calendar className="h-6 w-6" />,
  'LANÇAMENTO': <Zap className="h-6 w-6" />,
  'ADVANCED': <Bike className="h-6 w-6" />,
  'ELÉTRICOS': <Zap className="h-6 w-6" />,
};

// Formatação de moeda
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Componente Card de Plano
function PlanoCard({ plano }: { plano: Plano }) {
  return (
    <Card className={cn(
      'relative overflow-hidden transition-all hover:shadow-lg',
      plano.destaque && 'ring-2 ring-primary'
    )}>
      {/* Barra superior colorida */}
      <div className={cn('h-2 bg-gradient-to-r', plano.cor)} />
      
      {/* Badge destaque */}
      {plano.destaque && (
        <Badge className="absolute top-4 right-4 bg-primary text-primary-foreground">
          ⭐ Recomendado
        </Badge>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg bg-gradient-to-br text-white', plano.cor)}>
            {LINHA_ICONES[plano.linha]}
          </div>
          <div>
            <Badge variant="outline" className="mb-1 text-xs">
              {plano.linha}
            </Badge>
            <CardTitle className="text-lg">{plano.nome}</CardTitle>
          </div>
        </div>
        <CardDescription className="mt-2">{plano.descricao}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Cobertura FIPE */}
        <div className="flex items-center gap-2">
          <Badge className={cn(
            'text-sm px-3 py-1',
            plano.coberturaFipe === 100 
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' 
              : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100'
          )}>
            {plano.coberturaFipe}% FIPE
          </Badge>
        </div>

        {/* Público Alvo */}
        <div className="flex flex-wrap gap-1">
          {plano.publicoAlvo.map((publico) => (
            <Badge key={publico} variant="secondary" className="text-xs">
              {publico}
            </Badge>
          ))}
        </div>

        {/* Coberturas */}
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-muted-foreground">Coberturas inclusas:</p>
          <div className="grid gap-1">
            {plano.coberturas.slice(0, 6).map((cobertura) => (
              <div key={cobertura} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span>{cobertura}</span>
              </div>
            ))}
            {plano.coberturas.length > 6 && (
              <div className="flex items-center gap-2 text-sm text-primary">
                <Plus className="h-4 w-4 flex-shrink-0" />
                <span>+{plano.coberturas.length - 6} coberturas</span>
              </div>
            )}
          </div>
        </div>

        {/* Participação */}
        <div className="pt-3 border-t space-y-1">
          <p className="text-xs text-muted-foreground">Cota de Participação</p>
          <p className="text-sm font-medium">{plano.cotaParticipacao}</p>
          <p className="text-xs text-muted-foreground">Mínimo: {plano.cotaMinima}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Página Principal
export default function PlanosBeneficios() {
  const [activeTab, setActiveTab] = useState('planos');

  // Agrupar planos por linha
  const planosPorLinha = PLANOS.reduce((acc, plano) => {
    if (!acc[plano.linha]) {
      acc[plano.linha] = [];
    }
    acc[plano.linha].push(plano);
    return acc;
  }, {} as Record<string, Plano[]>);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Planos e Benefícios</h1>
        <p className="text-muted-foreground">
          Conheça todos os planos da Praticcar e suas coberturas. Proteção completa para veículos de passeio, APP, motos e elétricos.
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="planos">Planos</TabsTrigger>
          <TabsTrigger value="coberturas">Coberturas</TabsTrigger>
          <TabsTrigger value="adicionais">Adicionais</TabsTrigger>
          <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
        </TabsList>

        {/* Tab Planos */}
        <TabsContent value="planos" className="space-y-8">
          {Object.entries(planosPorLinha).map(([linha, planos]) => (
            <div key={linha} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  {LINHA_ICONES[linha]}
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Linha {linha}</h2>
                  <p className="text-sm text-muted-foreground">
                    {linha === 'SELECT' && 'Para veículos de passeio e APP'}
                    {linha === 'SELECT ONE' && 'Plano completo em uma única opção'}
                    {linha === 'ESPECIAL' && 'Para veículos de 2002 a 2008'}
                    {linha === 'LANÇAMENTO' && 'Para veículos 0km e 2024+'}
                    {linha === 'ADVANCED' && 'Para motocicletas'}
                    {linha === 'ELÉTRICOS' && 'Para veículos elétricos'}
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {planos.map((plano) => (
                  <PlanoCard key={plano.id} plano={plano} />
                ))}
              </div>
            </div>
          ))}
        </TabsContent>

        {/* Tab Coberturas */}
        <TabsContent value="coberturas" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {COBERTURAS.map((cobertura) => (
              <Card key={cobertura.nome}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      {cobertura.icone}
                    </div>
                    <CardTitle className="text-lg">{cobertura.nome}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm font-medium">{cobertura.descricao}</p>
                  <p className="text-sm text-muted-foreground">{cobertura.detalhes}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab Adicionais */}
        <TabsContent value="adicionais" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Benefícios Adicionais</CardTitle>
              <CardDescription>
                Complemente seu plano com benefícios extras conforme sua necessidade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {BENEFICIOS_ADICIONAIS.map((beneficio) => (
                  <div 
                    key={beneficio.nome} 
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        {beneficio.icone}
                      </div>
                      <div>
                        <p className="font-medium">{beneficio.nome}</p>
                        <p className="text-sm text-muted-foreground">{beneficio.descricao}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-lg font-bold whitespace-nowrap ml-4">
                      {formatCurrency(beneficio.valorMensal)}/mês
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Comparativo */}
        <TabsContent value="comparativo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Comparativo de Planos</CardTitle>
              <CardDescription>
                Veja as diferenças entre cada plano e escolha o ideal para você
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Plano</th>
                    <th className="text-center py-3 px-2 font-medium">FIPE</th>
                    <th className="text-center py-3 px-2 font-medium">Roubo</th>
                    <th className="text-center py-3 px-2 font-medium">Colisão</th>
                    <th className="text-center py-3 px-2 font-medium">Terceiros</th>
                    <th className="text-center py-3 px-2 font-medium">Vidros</th>
                    <th className="text-center py-3 px-2 font-medium">Reboque</th>
                    <th className="text-center py-3 px-2 font-medium">Reserva</th>
                  </tr>
                </thead>
                <tbody>
                  {PLANOS.map((plano) => (
                    <tr key={plano.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <div className={cn('w-2 h-2 rounded-full bg-gradient-to-r', plano.cor)} />
                          <span className="font-medium">{plano.nome}</span>
                        </div>
                      </td>
                      <td className="text-center py-3 px-2">
                        <Badge variant={plano.coberturaFipe === 100 ? 'default' : 'secondary'}>
                          {plano.coberturaFipe}%
                        </Badge>
                      </td>
                      <td className="text-center py-3 px-2">
                        <Check className="h-4 w-4 text-green-500 mx-auto" />
                      </td>
                      <td className="text-center py-3 px-2">
                        {plano.coberturas.some(c => c.includes('Colisão')) 
                          ? <Check className="h-4 w-4 text-green-500 mx-auto" />
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>
                      <td className="text-center py-3 px-2">
                        {plano.coberturas.find(c => c.includes('Terceiros'))
                          ? <span className="text-xs">{plano.coberturas.find(c => c.includes('Terceiros'))?.replace('Danos a Terceiros ', '')}</span>
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>
                      <td className="text-center py-3 px-2">
                        {plano.coberturas.some(c => c.includes('Vidros')) 
                          ? <Check className="h-4 w-4 text-green-500 mx-auto" />
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>
                      <td className="text-center py-3 px-2">
                        {plano.coberturas.find(c => c.includes('Assistência'))
                          ? <span className="text-xs">{plano.coberturas.find(c => c.includes('Assistência'))?.match(/\d+km/)?.[0] || '400km'}</span>
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>
                      <td className="text-center py-3 px-2">
                        {plano.coberturas.some(c => c.includes('Carro Reserva') || c.includes('Reserva')) 
                          ? <Check className="h-4 w-4 text-green-500 mx-auto" />
                          : <span className="text-muted-foreground">—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
