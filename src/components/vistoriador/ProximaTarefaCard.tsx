import { Car, MapPin, Clock, Play, Loader2, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TIPO_SERVICO_LABELS } from '@/hooks/useServicos';
import { useIniciarRota } from '@/hooks/useTarefaAtual';
import type { TarefaAtribuida } from '@/hooks/useTarefasAtribuidas';

interface ProximaTarefaCardProps {
  tarefa: TarefaAtribuida;
  /** Quando true, desabilita "Iniciar rota" (já existe uma tarefa em execução) */
  bloqueado: boolean;
}

export function ProximaTarefaCard({ tarefa, bloqueado }: ProximaTarefaCardProps) {
  const { mutate: iniciarRota, isPending } = useIniciarRota();

  const tipoLabel = (TIPO_SERVICO_LABELS as Record<string, string>)[tarefa.tipo] || tarefa.tipo;
  const veiculo = [tarefa.marca, tarefa.modelo].filter(Boolean).join(' ') || 'Veículo';
  const local = [tarefa.bairro, tarefa.cidade].filter(Boolean).join(' · ') || 'Local não informado';
  const hora = tarefa.hora_agendada?.slice(0, 5) || (tarefa.periodo === 'tarde' ? 'Tarde' : 'Manhã');

  return (
    <Card className="border-slate-700 bg-slate-800">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="border-blue-500 text-blue-300 text-[10px]">
            {tipoLabel}
          </Badge>
          {tarefa.permite_encaixe && (
            <Badge variant="outline" className="border-amber-500 text-amber-300 text-[10px] gap-1">
              <Zap className="h-3 w-3" /> Encaixe
            </Badge>
          )}
          <span className="ml-auto text-xs text-slate-400 flex items-center gap-1">
            <Clock className="h-3 w-3" /> {hora}
          </span>
        </div>

        <p className="text-sm font-medium text-white truncate">{tarefa.cliente_nome}</p>

        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Car className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {veiculo}
            {tarefa.placa ? ` · ${tarefa.placa}` : ''}
          </span>
        </div>

        <div className="flex items-center gap-1 text-xs text-slate-400">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{local}</span>
        </div>

        <Button
          size="sm"
          className={cn('w-full mt-2', bloqueado && 'opacity-60')}
          disabled={bloqueado || isPending}
          onClick={() => iniciarRota({ tarefaId: tarefa.id })}
          title={bloqueado ? 'Finalize a tarefa em execução antes de iniciar outra' : undefined}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          {bloqueado ? 'Aguardando finalizar atual' : 'Iniciar rota'}
        </Button>
      </CardContent>
    </Card>
  );
}
