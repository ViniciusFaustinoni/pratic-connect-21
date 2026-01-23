import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ClipboardList, Camera, Map, Phone, Loader2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useTarefaAtual } from '@/hooks/useTarefaAtual';
import { BotaoIniciarServico } from '@/components/vistoriador/BotaoIniciarServico';
import { TarefaAtualCard } from '@/components/vistoriador/TarefaAtualCard';

// Funções auxiliares
const getSaudacao = (): string => {
  const hora = new Date().getHours();
  if (hora >= 5 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 18) return 'Boa tarde';
  return 'Boa noite';
};

const ligarCoordenador = () => {
  window.open('tel:+5511999999999', '_self');
};

const VistoriadorHome = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: tarefaAtual, isLoading } = useTarefaAtual();
  
  const primeiroNome = useMemo(() => {
    if (!profile?.nome) return 'Profissional';
    return profile.nome.split(' ')[0];
  }, [profile?.nome]);

  const dataAtual = useMemo(() => {
    return format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Saudação */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">
          {getSaudacao()}, {primeiroNome}! 👋
        </h1>
        <p className="text-muted-foreground capitalize">{dataAtual}</p>
      </div>

      {/* Tarefa Atual ou Botão Iniciar */}
      <div className="max-w-lg">
        {tarefaAtual ? (
          <TarefaAtualCard tarefa={tarefaAtual} />
        ) : (
          <BotaoIniciarServico />
        )}
      </div>

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
    </div>
  );
};

export default VistoriadorHome;
