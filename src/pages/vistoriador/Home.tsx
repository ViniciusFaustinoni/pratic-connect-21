import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ClipboardList, Camera, Map, Phone, Car, MapPin, Clock, 
  ChevronRight, CheckCircle, Navigation, Eye, Wrench, 
  PlayCircle, PartyPopper, User
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// Dados Mock
const mockResumo = {
  totalTarefas: 4,
  concluidas: 2,
  emAndamento: 1,
  aguardando: 1,
};

const mockProximaTarefa = {
  id: '1',
  tipo: 'vistoria' as const,
  cliente: 'Pedro Costa',
  telefone: '11999998888',
  veiculo: 'Onix',
  placa: 'GHI-9012',
  endereco: 'Al. Santos, 200 - Pinheiros',
  horario: '14:00',
};

const mockUltimasAtividades = [
  { id: '1', hora: '10:30', tipo: 'instalacao' as const, cliente: 'Maria Santos' },
  { id: '2', hora: '09:00', tipo: 'vistoria' as const, cliente: 'João Silva' },
];

// Funções auxiliares
const getSaudacao = (): string => {
  const hora = new Date().getHours();
  if (hora >= 5 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 18) return 'Boa tarde';
  return 'Boa noite';
};

const abrirNavegacao = (endereco: string) => {
  const enderecoFormatado = encodeURIComponent(endereco);
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${enderecoFormatado}`, '_blank');
};

const ligarCoordenador = () => {
  window.open('tel:+5511999999999', '_self');
};

const VistoriadorHome = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const primeiroNome = useMemo(() => {
    if (!profile?.nome) return 'Profissional';
    return profile.nome.split(' ')[0];
  }, [profile?.nome]);

  const dataAtual = useMemo(() => {
    return format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR });
  }, []);

  const progressoPercentual = useMemo(() => {
    if (mockResumo.totalTarefas === 0) return 0;
    return Math.round((mockResumo.concluidas / mockResumo.totalTarefas) * 100);
  }, []);

  const temProximaTarefa = mockResumo.aguardando > 0 || mockResumo.emAndamento > 0;

  return (
    <div className="space-y-4 pb-4">
      {/* Saudação */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">
          {getSaudacao()}, {primeiroNome}! 👋
        </h1>
        <p className="text-muted-foreground capitalize">{dataAtual}</p>
      </div>

      {/* Card Resumo do Dia */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-primary" />
            Sua Rota de Hoje
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">
                {mockResumo.concluidas} de {mockResumo.totalTarefas} tarefas
              </span>
            </div>
            <Progress 
              value={progressoPercentual} 
              className="h-3"
              indicatorClassName="bg-primary"
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>{mockResumo.concluidas} Concluídas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-yellow-500" />
              <span>{mockResumo.emAndamento} Em andamento</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{mockResumo.aguardando} Aguardando</span>
            </div>
          </div>

          <Button 
            className="w-full" 
            onClick={() => navigate('/vistoriador/tarefas')}
          >
            Ver Rota Completa
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>

      {/* Próxima Tarefa */}
      {temProximaTarefa ? (
        <Card className="border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-orange-500" />
                Próxima Tarefa
              </CardTitle>
              <Badge 
                variant="secondary"
                className={cn(
                  mockProximaTarefa.tipo === 'vistoria' 
                    ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' 
                    : 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                )}
              >
                {mockProximaTarefa.tipo === 'vistoria' ? (
                  <Eye className="h-3 w-3 mr-1" />
                ) : (
                  <Wrench className="h-3 w-3 mr-1" />
                )}
                {mockProximaTarefa.tipo === 'vistoria' ? 'Vistoria' : 'Instalação'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{mockProximaTarefa.cliente}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span>{mockProximaTarefa.veiculo} - {mockProximaTarefa.placa}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{mockProximaTarefa.endereco}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-orange-600">{mockProximaTarefa.horario}</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => abrirNavegacao(mockProximaTarefa.endereco)}
              >
                <Navigation className="h-4 w-4 mr-2" />
                Navegar
              </Button>
              <Button 
                className="flex-1"
                onClick={() => navigate(`/vistoriador/vistoria/${mockProximaTarefa.id}`)}
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Iniciar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-green-500/50 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <PartyPopper className="h-12 w-12 text-green-500 mb-3" />
            <h3 className="font-semibold text-lg">Parabéns!</h3>
            <p className="text-muted-foreground">
              Você concluiu todas as tarefas de hoje!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Ações Rápidas */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Ações Rápidas</h2>
        <div className="grid grid-cols-2 gap-3">
          <Card 
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={() => navigate('/vistoriador/tarefas')}
          >
            <CardContent className="flex flex-col items-center justify-center py-6">
              <ClipboardList className="h-8 w-8 text-primary mb-2" />
              <span className="text-sm font-medium text-center">Minhas Tarefas</span>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={() => navigate('/vistoriador/registrar')}
          >
            <CardContent className="flex flex-col items-center justify-center py-6">
              <Camera className="h-8 w-8 text-primary mb-2" />
              <span className="text-sm font-medium text-center">Registrar Vistoria</span>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={() => navigate('/vistoriador/mapa')}
          >
            <CardContent className="flex flex-col items-center justify-center py-6">
              <Map className="h-8 w-8 text-primary mb-2" />
              <span className="text-sm font-medium text-center">Ver Mapa</span>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:bg-accent transition-colors"
            onClick={ligarCoordenador}
          >
            <CardContent className="flex flex-col items-center justify-center py-6">
              <Phone className="h-8 w-8 text-primary mb-2" />
              <span className="text-sm font-medium text-center">Contato Coordenador</span>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Últimas Atividades */}
      {mockUltimasAtividades.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Últimas Atividades</h2>
          <Card>
            <CardContent className="p-0">
              {mockUltimasAtividades.map((atividade, index) => (
                <div 
                  key={atividade.id}
                  className={cn(
                    "flex items-center gap-3 p-4",
                    index !== mockUltimasAtividades.length - 1 && "border-b"
                  )}
                >
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{atividade.hora}</span>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs",
                          atividade.tipo === 'vistoria' 
                            ? 'border-blue-500/30 text-blue-600' 
                            : 'border-purple-500/30 text-purple-600'
                        )}
                      >
                        {atividade.tipo === 'vistoria' ? 'Vistoria' : 'Instalação'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {atividade.cliente}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default VistoriadorHome;
