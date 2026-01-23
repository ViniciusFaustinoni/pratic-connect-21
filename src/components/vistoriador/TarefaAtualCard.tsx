import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, Phone, Car, Clock, Navigation, Play, 
  CheckCircle2, User, ChevronRight, Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TarefaAtual, useIniciarTarefa } from '@/hooks/useTarefaAtual';
import { useIniciarServico } from '@/hooks/useIniciarServico';
import { TIPO_SERVICO_LABELS, isInstalacao } from '@/hooks/useServicos';
import { cn } from '@/lib/utils';

interface TarefaAtualCardProps {
  tarefa: TarefaAtual;
}

export function TarefaAtualCard({ tarefa }: TarefaAtualCardProps) {
  const navigate = useNavigate();
  const [showConcluirDialog, setShowConcluirDialog] = useState(false);
  const { mutate: iniciarTarefa, isPending: isIniciando } = useIniciarTarefa();
  const { buscarProximaTarefa, isLoading: isBuscandoProxima } = useIniciarServico();

  const enderecoCompleto = [
    tarefa.endereco.logradouro,
    tarefa.endereco.numero,
    tarefa.endereco.bairro,
    tarefa.endereco.cidade,
    tarefa.endereco.uf
  ].filter(Boolean).join(', ') || 'Endereço não informado';

  const abrirNavegacao = () => {
    if (tarefa.endereco.latitude && tarefa.endereco.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${tarefa.endereco.latitude},${tarefa.endereco.longitude}`;
      window.open(url, '_blank');
    }
  };

  const ligarCliente = () => {
    if (tarefa.cliente.telefone) {
      window.open(`tel:${tarefa.cliente.telefone}`, '_self');
    }
  };

  const handleIniciarTarefa = () => {
    iniciarTarefa({ tarefaId: tarefa.id });
  };

  const handleExecutar = () => {
    // Sempre usar o ID do serviço (tabela unificada)
    const path = isInstalacao(tarefa.tipo) ? 'instalacao' : 'vistoria';
    navigate(`/instalador/${path}/${tarefa.id}`);
  };

  const isEmRota = tarefa.status === 'em_rota';
  const isEmAndamento = tarefa.status === 'em_andamento';

  return (
    <>
      <Card className="border-primary/50 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={isInstalacao(tarefa.tipo) ? 'default' : 'secondary'}>
                {TIPO_SERVICO_LABELS[tarefa.tipo] || tarefa.tipo}
              </Badge>
              <Badge 
                variant="outline"
                className={cn(
                  isEmAndamento && "bg-warning/20 text-warning-foreground border-warning/30",
                  isEmRota && "bg-primary/20 text-primary border-primary/30"
                )}
              >
                {isEmAndamento ? 'Em Andamento' : 'Em Rota'}
              </Badge>
            </div>
            {tarefa.distancia_km !== undefined && (
              <span className="text-sm text-muted-foreground">
                {tarefa.distancia_km.toFixed(1)} km
              </span>
            )}
          </div>
          <CardTitle className="text-lg mt-2">
            Tarefa Atual
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Cliente */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{tarefa.cliente.nome}</p>
              <p className="text-sm text-muted-foreground">{tarefa.cliente.telefone}</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={ligarCliente}
              disabled={!tarefa.cliente.telefone}
            >
              <Phone className="h-4 w-4" />
            </Button>
          </div>

          {/* Veículo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center flex-shrink-0">
              <Car className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">
                {tarefa.veiculo.marca} {tarefa.veiculo.modelo}
              </p>
              <p className="text-sm text-muted-foreground font-mono">
                {tarefa.veiculo.placa}
              </p>
            </div>
          </div>

          {/* Endereço */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/50 flex items-center justify-center flex-shrink-0">
              <MapPin className="h-5 w-5 text-accent-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{enderecoCompleto}</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={abrirNavegacao}
              disabled={!tarefa.endereco.latitude}
            >
              <Navigation className="h-4 w-4" />
            </Button>
          </div>

          {/* Horário */}
          {tarefa.hora_agendada && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  Agendado para {tarefa.hora_agendada.slice(0, 5)}
                </p>
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {isEmRota ? (
              <>
                <Button
                  variant="outline"
                  onClick={abrirNavegacao}
                  disabled={!tarefa.endereco.latitude}
                  className="gap-2"
                >
                  <Navigation className="h-4 w-4" />
                  Navegar
                </Button>
                <Button
                  onClick={handleIniciarTarefa}
                  disabled={isIniciando}
                  className="gap-2"
                >
                  {isIniciando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Cheguei no Local
                </Button>
              </>
            ) : (
              <Button
                onClick={handleExecutar}
                className="col-span-2 gap-2"
              >
                <ChevronRight className="h-4 w-4" />
                Executar {TIPO_SERVICO_LABELS[tarefa.tipo] || tarefa.tipo}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialog para buscar próxima tarefa após conclusão */}
      <AlertDialog open={showConcluirDialog} onOpenChange={setShowConcluirDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Tarefa Concluída!
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deseja buscar a próxima tarefa mais próxima de você?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Encerrar por hoje</AlertDialogCancel>
            <AlertDialogAction
              onClick={buscarProximaTarefa}
              disabled={isBuscandoProxima}
            >
              {isBuscandoProxima ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Buscando...
                </>
              ) : (
                'Buscar Próxima'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
