import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Eye, Wrench, User, Car, MapPin, Clock, 
  Navigation, Play, CheckCircle, XCircle, 
  PartyPopper, Loader2
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type TipoTarefa = 'vistoria' | 'instalacao';
type StatusTarefa = 'concluida' | 'em_andamento' | 'aguardando' | 'cancelada';

interface Tarefa {
  id: string;
  numero: number;
  tipo: TipoTarefa;
  status: StatusTarefa;
  horarioAgendado: string;
  horarioConclusao?: string;
  cliente: string;
  telefone: string;
  veiculo: string;
  ano: number;
  placa: string;
  endereco: string;
  motivoCancelamento?: string;
}

// Mock data
const mockTarefasHoje: Tarefa[] = [
  {
    id: '1',
    numero: 1,
    tipo: 'vistoria',
    status: 'concluida',
    horarioAgendado: '09:00',
    horarioConclusao: '09:45',
    cliente: 'João Silva',
    telefone: '11999991111',
    veiculo: 'VW Gol',
    ano: 2020,
    placa: 'ABC-1234',
    endereco: 'Av. Paulista, 1000 - Centro',
  },
  {
    id: '2',
    numero: 2,
    tipo: 'instalacao',
    status: 'concluida',
    horarioAgendado: '10:30',
    horarioConclusao: '11:15',
    cliente: 'Maria Santos',
    telefone: '11999992222',
    veiculo: 'HB20',
    ano: 2021,
    placa: 'DEF-5678',
    endereco: 'Rua Augusta, 500 - Centro',
  },
  {
    id: '3',
    numero: 3,
    tipo: 'vistoria',
    status: 'em_andamento',
    horarioAgendado: '14:00',
    cliente: 'Pedro Costa',
    telefone: '11999993333',
    veiculo: 'Onix',
    ano: 2022,
    placa: 'GHI-9012',
    endereco: 'Al. Santos, 200 - Pinheiros',
  },
  {
    id: '4',
    numero: 4,
    tipo: 'instalacao',
    status: 'aguardando',
    horarioAgendado: '15:30',
    cliente: 'Ana Souza',
    telefone: '11999994444',
    veiculo: 'Argo',
    ano: 2021,
    placa: 'JKL-3456',
    endereco: 'R. Oscar Freire, 100 - Pinheiros',
  },
];

const mockTarefasAmanha: Tarefa[] = [
  {
    id: '5',
    numero: 1,
    tipo: 'vistoria',
    status: 'aguardando',
    horarioAgendado: '08:30',
    cliente: 'Carlos Lima',
    telefone: '11999995555',
    veiculo: 'Civic',
    ano: 2023,
    placa: 'MNO-7890',
    endereco: 'Av. Brasil, 500 - Jardins',
  },
  {
    id: '6',
    numero: 2,
    tipo: 'instalacao',
    status: 'aguardando',
    horarioAgendado: '10:00',
    cliente: 'Fernanda Dias',
    telefone: '11999996666',
    veiculo: 'Corolla',
    ano: 2022,
    placa: 'PQR-1234',
    endereco: 'R. Estados Unidos, 200 - Jardins',
  },
  {
    id: '7',
    numero: 3,
    tipo: 'vistoria',
    status: 'aguardando',
    horarioAgendado: '14:30',
    cliente: 'Roberto Alves',
    telefone: '11999997777',
    veiculo: 'Tracker',
    ano: 2024,
    placa: 'STU-5678',
    endereco: 'Al. Lorena, 300 - Jardins',
  },
];

const mockTarefasSemana: Tarefa[] = [...mockTarefasHoje, ...mockTarefasAmanha, 
  {
    id: '8',
    numero: 1,
    tipo: 'instalacao',
    status: 'aguardando',
    horarioAgendado: '09:00',
    cliente: 'Juliana Martins',
    telefone: '11999998888',
    veiculo: 'T-Cross',
    ano: 2023,
    placa: 'VWX-9012',
    endereco: 'R. Haddock Lobo, 400 - Cerqueira César',
  },
  {
    id: '9',
    numero: 2,
    tipo: 'vistoria',
    status: 'aguardando',
    horarioAgendado: '11:00',
    cliente: 'Marcelo Oliveira',
    telefone: '11999999999',
    veiculo: 'Compass',
    ano: 2024,
    placa: 'YZA-3456',
    endereco: 'Av. Rebouças, 600 - Pinheiros',
  },
];

const statusConfig: Record<StatusTarefa, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType; cardClasses: string }> = {
  concluida: {
    label: 'Concluída',
    variant: 'default',
    icon: CheckCircle,
    cardClasses: 'bg-green-50 dark:bg-green-950/30 border-l-4 border-l-green-500',
  },
  em_andamento: {
    label: 'Em Andamento',
    variant: 'secondary',
    icon: Loader2,
    cardClasses: 'bg-yellow-50 dark:bg-yellow-950/30 border-l-4 border-l-yellow-500',
  },
  aguardando: {
    label: 'Aguardando',
    variant: 'outline',
    icon: Clock,
    cardClasses: 'bg-muted/50 border-l-4 border-l-muted-foreground/30',
  },
  cancelada: {
    label: 'Cancelada',
    variant: 'destructive',
    icon: XCircle,
    cardClasses: 'bg-red-50 dark:bg-red-950/30 border-l-4 border-l-red-500',
  },
};

const tipoConfig: Record<TipoTarefa, { label: string; icon: React.ElementType; classes: string }> = {
  vistoria: {
    label: 'VISTORIA DE ENTRADA',
    icon: Eye,
    classes: 'text-blue-600 dark:text-blue-400',
  },
  instalacao: {
    label: 'INSTALAÇÃO',
    icon: Wrench,
    classes: 'text-purple-600 dark:text-purple-400',
  },
};

interface TarefaCardProps {
  tarefa: Tarefa;
  onNavegar: (endereco: string) => void;
  onIniciar: (tarefa: Tarefa) => void;
}

const TarefaCard = ({ tarefa, onNavegar, onIniciar }: TarefaCardProps) => {
  const statusInfo = statusConfig[tarefa.status];
  const tipoInfo = tipoConfig[tarefa.tipo];
  const StatusIcon = statusInfo.icon;
  const TipoIcon = tipoInfo.icon;

  return (
    <Card className={cn('overflow-hidden', statusInfo.cardClasses)}>
      <CardContent className="p-4 space-y-3">
        {/* Header: Número + Horário + Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-muted-foreground">#{tarefa.numero}</span>
            <div className="flex items-center gap-1 text-sm font-medium">
              <Clock className="h-3.5 w-3.5" />
              {tarefa.horarioAgendado}
            </div>
          </div>
          <Badge variant={statusInfo.variant} className="gap-1">
            <StatusIcon className={cn("h-3 w-3", tarefa.status === 'em_andamento' && "animate-spin")} />
            {statusInfo.label}
          </Badge>
        </div>

        {/* Tipo da Tarefa */}
        <div className={cn("flex items-center gap-2 font-bold text-sm", tipoInfo.classes)}>
          <TipoIcon className="h-4 w-4" />
          {tipoInfo.label}
        </div>

        {/* Informações do Cliente e Veículo */}
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium">{tarefa.cliente}</span>
          </div>
          <div className="flex items-center gap-2">
            <Car className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{tarefa.veiculo} {tarefa.ano} - {tarefa.placa}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">{tarefa.endereco}</span>
          </div>
        </div>

        {/* Rodapé: Ações ou Info de Conclusão */}
        {tarefa.status === 'concluida' && tarefa.horarioConclusao && (
          <div className="pt-2 border-t text-sm text-muted-foreground flex items-center gap-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Concluída às {tarefa.horarioConclusao}
          </div>
        )}

        {tarefa.status === 'cancelada' && tarefa.motivoCancelamento && (
          <div className="pt-2 border-t text-sm text-destructive flex items-center gap-1">
            <XCircle className="h-4 w-4" />
            {tarefa.motivoCancelamento}
          </div>
        )}

        {(tarefa.status === 'em_andamento' || tarefa.status === 'aguardando') && (
          <div className="pt-2 border-t flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1"
              onClick={() => onNavegar(tarefa.endereco)}
            >
              <Navigation className="h-4 w-4 mr-1" />
              Navegar
            </Button>
            <Button 
              size="sm" 
              className="flex-1"
              onClick={() => onIniciar(tarefa)}
            >
              <Play className="h-4 w-4 mr-1" />
              {tarefa.status === 'em_andamento' ? 'Continuar' : 'Iniciar'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

interface ListaTarefasProps {
  tarefas: Tarefa[];
  onNavegar: (endereco: string) => void;
  onIniciar: (tarefa: Tarefa) => void;
}

const ListaTarefas = ({ tarefas, onNavegar, onIniciar }: ListaTarefasProps) => {
  if (tarefas.length === 0) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="p-8 text-center">
          <PartyPopper className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium">Você não tem tarefas para este período.</p>
          <p className="text-muted-foreground">Aproveite! 🎉</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {tarefas.map((tarefa) => (
        <TarefaCard
          key={tarefa.id}
          tarefa={tarefa}
          onNavegar={onNavegar}
          onIniciar={onIniciar}
        />
      ))}
    </div>
  );
};

const VistoriadorTarefas = () => {
  const navigate = useNavigate();
  const [tabAtiva, setTabAtiva] = useState('hoje');

  const dataAtual = new Date();
  const dataFormatada = format(dataAtual, "EEEE, d 'de' MMMM", { locale: ptBR });
  const dataCapitalizada = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);

  const abrirNavegacao = (endereco: string) => {
    const enderecoFormatado = encodeURIComponent(endereco);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${enderecoFormatado}`, '_blank');
  };

  const navegarParaTarefa = (tarefa: Tarefa) => {
    const rota = tarefa.tipo === 'vistoria' 
      ? `/vistoriador/vistoria/${tarefa.id}`
      : `/vistoriador/instalacao/${tarefa.id}`;
    navigate(rota);
  };

  const getTarefasPorTab = () => {
    switch (tabAtiva) {
      case 'amanha':
        return mockTarefasAmanha;
      case 'semana':
        return mockTarefasSemana;
      default:
        return mockTarefasHoje;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Minhas Tarefas</h1>
          <Badge variant="secondary" className="text-sm">
            {mockTarefasHoje.length} tarefas
          </Badge>
        </div>
        <p className="text-muted-foreground">{dataCapitalizada}</p>
      </div>

      {/* Tabs */}
      <Tabs value={tabAtiva} onValueChange={setTabAtiva} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="hoje" className="text-xs sm:text-sm">
            Hoje ({mockTarefasHoje.length})
          </TabsTrigger>
          <TabsTrigger value="amanha" className="text-xs sm:text-sm">
            Amanhã ({mockTarefasAmanha.length})
          </TabsTrigger>
          <TabsTrigger value="semana" className="text-xs sm:text-sm">
            Semana ({mockTarefasSemana.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hoje" className="mt-4">
          <ListaTarefas
            tarefas={mockTarefasHoje}
            onNavegar={abrirNavegacao}
            onIniciar={navegarParaTarefa}
          />
        </TabsContent>

        <TabsContent value="amanha" className="mt-4">
          <ListaTarefas
            tarefas={mockTarefasAmanha}
            onNavegar={abrirNavegacao}
            onIniciar={navegarParaTarefa}
          />
        </TabsContent>

        <TabsContent value="semana" className="mt-4">
          <ListaTarefas
            tarefas={mockTarefasSemana}
            onNavegar={abrirNavegacao}
            onIniciar={navegarParaTarefa}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VistoriadorTarefas;
