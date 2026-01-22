import { AlertCircle, Puzzle, Clock, MapPin, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { EncaixeCard } from '@/components/vistoriador/EncaixeCard';
import { useEncaixesDisponiveis } from '@/hooks/useEncaixesDisponiveis';
import { useQueryClient } from '@tanstack/react-query';

export default function VistoriadorEncaixes() {
  const queryClient = useQueryClient();
  const {
    encaixes,
    isLoading,
    temTarefasProximas,
    ultimaLocalizacao,
    config,
    podeVerEncaixes,
  } = useEncaixesDisponiveis();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['encaixes-disponiveis'] });
    queryClient.invalidateQueries({ queryKey: ['tarefas-proximas'] });
    queryClient.invalidateQueries({ queryKey: ['ultima-localizacao'] });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Puzzle className="h-6 w-6" />
            Encaixes
          </h1>
          <p className="text-sm text-muted-foreground">
            Serviços próximos disponíveis para você assumir
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      )}

      {/* Indisponível: Tem tarefas próximas */}
      {!isLoading && temTarefasProximas && (
        <Alert variant="default" className="border-primary/20 bg-primary/5">
          <Clock className="h-5 w-5 text-primary" />
          <AlertTitle>
            Você tem tarefas agendadas
          </AlertTitle>
          <AlertDescription>
            Os encaixes ficam disponíveis apenas quando você não tem tarefas nas próximas{' '}
            <strong>{config?.janelaHoras || 2} horas</strong>. Conclua suas tarefas atuais para
            ver encaixes disponíveis.
          </AlertDescription>
        </Alert>
      )}

      {/* Indisponível: Sem localização */}
      {!isLoading && !temTarefasProximas && !ultimaLocalizacao && (
        <Alert>
          <MapPin className="h-5 w-5" />
          <AlertTitle>Localização não encontrada</AlertTitle>
          <AlertDescription>
            Para ver encaixes disponíveis, você precisa ter concluído pelo menos uma tarefa
            anteriormente. Sua última localização será usada como referência para buscar
            serviços próximos.
          </AlertDescription>
        </Alert>
      )}

      {/* Explicação sobre encaixes */}
      {!isLoading && podeVerEncaixes && encaixes.length === 0 && (
        <Card>
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg">Nenhum encaixe disponível</CardTitle>
            <CardDescription>
              Não há serviços com encaixe habilitado em um raio de{' '}
              <strong>{config?.raioKm || 10} km</strong> da sua última localização.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Verificar Novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Lista de encaixes */}
      {!isLoading && podeVerEncaixes && encaixes.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {encaixes.length} encaixe{encaixes.length !== 1 ? 's' : ''} disponível
            {encaixes.length !== 1 ? 'is' : ''} próximo{encaixes.length !== 1 ? 's' : ''} de você
          </p>
          <div className="grid gap-4">
            {encaixes.map((encaixe) => (
              <EncaixeCard key={`${encaixe.tipo}-${encaixe.id}`} encaixe={encaixe} />
            ))}
          </div>
        </div>
      )}

      {/* Info card */}
      {!isLoading && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <h3 className="font-medium text-sm mb-2">Como funciona?</h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>
                • Encaixes são serviços próximos que você pode assumir se estiver disponível
              </li>
              <li>
                • Você só vê encaixes se não tiver tarefas nas próximas {config?.janelaHoras || 2} horas
              </li>
              <li>
                • São mostrados serviços em até {config?.raioKm || 10} km da sua última localização
              </li>
              <li>
                • Ao assumir, o serviço é atribuído automaticamente a você
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
