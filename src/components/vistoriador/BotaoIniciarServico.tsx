import { Play, MapPin, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useIniciarServico } from '@/hooks/useIniciarServico';
import { cn } from '@/lib/utils';

interface BotaoIniciarServicoProps {
  className?: string;
}

export function BotaoIniciarServico({ className }: BotaoIniciarServicoProps) {
  const { iniciarServico, isLoading, geoState } = useIniciarServico();

  const getStatusMessage = () => {
    switch (geoState.status) {
      case 'requesting':
        return 'Obtendo sua localização...';
      case 'denied':
        return 'Localização negada';
      case 'unavailable':
        return 'Localização indisponível';
      default:
        return null;
    }
  };

  const statusMessage = getStatusMessage();

  return (
    <Card className={cn("border-2 border-dashed border-primary/30 bg-primary/5", className)}>
      <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
        {/* Ícone principal */}
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
            {isLoading ? (
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
            ) : (
              <Play className="h-12 w-12 text-primary ml-1" />
            )}
          </div>
          {geoState.status === 'granted' && (
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <MapPin className="h-4 w-4 text-primary-foreground" />
            </div>
          )}
        </div>

        {/* Título */}
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {isLoading ? 'Buscando tarefa...' : 'Pronto para começar?'}
        </h2>

        {/* Descrição */}
        <p className="text-muted-foreground mb-6 max-w-sm">
          {isLoading 
            ? 'Estamos encontrando a tarefa mais próxima de você'
            : 'Clique no botão abaixo para receber sua próxima tarefa automaticamente baseada na sua localização.'
          }
        </p>

        {/* Mensagem de status da geolocalização */}
        {statusMessage && (
          <Alert variant={geoState.status === 'denied' ? 'destructive' : 'default'} className="mb-4 max-w-sm">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {geoState.error || statusMessage}
            </AlertDescription>
          </Alert>
        )}

        {/* Botão principal */}
        <Button
          size="lg"
          onClick={iniciarServico}
          disabled={isLoading}
          className="h-14 px-8 text-lg font-semibold gap-3"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Buscando...
            </>
          ) : (
            <>
              <Play className="h-5 w-5" />
              Iniciar Serviço
            </>
          )}
        </Button>

        {/* Nota sobre localização */}
        <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          A localização é necessária para encontrar tarefas próximas
        </p>
      </CardContent>
    </Card>
  );
}
