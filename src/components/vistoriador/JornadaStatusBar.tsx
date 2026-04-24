import { Clock, Target, Coffee, TrendingUp, TrendingDown, AlertTriangle, Loader2, Play, Square } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useJornadaTrabalho, formatarMinutos } from '@/hooks/useJornadaTrabalho';
import { cn } from '@/lib/utils';

interface JornadaStatusBarProps {
  className?: string;
}

/**
 * Barra de status de jornada de trabalho
 * Mostra tempo trabalhado, tempo restante e progresso do dia.
 *
 * Almoço é 100% manual: o técnico inicia e finaliza pelos botões aqui.
 * Não há mais início automático de almoço para nenhum tipo de técnico.
 */
export function JornadaStatusBar({ className }: JornadaStatusBarProps) {
  const {
    status,
    minutosTrabalhados,
    minutosRestantes,
    percentualJornada,
    saldoAnterior,
    emAlmoco,
    minutosAlmoco,
    turno,
    isLoading,
    podeIniciarAlmoco,
    iniciarAlmoco,
    finalizarAlmoco,
    isIniciandoAlmoco,
    isFinalizandoAlmoco,
  } = useJornadaTrabalho();

  // Mostrar loading enquanto busca o turno
  if (isLoading) {
    return (
      <div className={cn(
        "bg-slate-800/80 border border-slate-700 rounded-lg p-3 flex items-center justify-center gap-2",
        className
      )}>
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Carregando jornada...</span>
      </div>
    );
  }

  // Se não tem turno ainda (pode estar sendo criado pelo useGarantirTurno)
  if (status === 'inativo') {
    return (
      <div className={cn(
        "bg-slate-800/80 border border-slate-700 rounded-lg p-3 flex items-center justify-center gap-2",
        className
      )}>
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Iniciando jornada...</span>
      </div>
    );
  }

  // Se encerrado, mostrar resumo
  if (status === 'encerrado') {
    return (
      <div className={cn(
        "bg-slate-700/50 border border-slate-600 rounded-lg p-3",
        className
      )}>
        <div className="flex items-center justify-center gap-2 text-slate-400">
          <Clock className="h-4 w-4" />
          <span className="text-sm">Turno encerrado</span>
        </div>
      </div>
    );
  }

  // Se em almoço, mostrar contador crescente + botão "Finalizar almoço".
  // Comportamento unificado: todo técnico controla manualmente.
  if (emAlmoco) {
    const passouDoLimite = minutosAlmoco > 60;
    const minutosAcrescimo = Math.max(0, minutosAlmoco - 60);
    return (
      <div className={cn(
        passouDoLimite
          ? "bg-red-900/30 border-red-700/50"
          : "bg-amber-900/30 border-amber-700/50",
        "border rounded-lg p-3 space-y-2",
        className
      )}>
        <div className="flex items-center justify-between">
          <div className={cn("flex items-center gap-2", passouDoLimite ? "text-red-400" : "text-amber-400")}>
            <Coffee className="h-4 w-4" />
            <span className="text-sm font-medium">Em almoço</span>
          </div>
          <span className={cn("text-sm font-mono", passouDoLimite ? "text-red-300" : "text-amber-300")}>
            {formatarMinutos(minutosAlmoco)}
          </span>
        </div>
        {passouDoLimite && (
          <div className="flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="h-3 w-3" />
            <span>+{formatarMinutos(minutosAcrescimo)} de acréscimo na jornada</span>
          </div>
        )}
        <Button
          onClick={() => finalizarAlmoco()}
          disabled={isFinalizandoAlmoco}
          size="sm"
          className="w-full bg-green-600 hover:bg-green-700 text-white"
        >
          <Square className="h-4 w-4 mr-2" />
          {isFinalizandoAlmoco ? 'Finalizando...' : 'Finalizar almoço'}
        </Button>
      </div>
    );
  }

  // Atraso de almoço registrado (já voltou do almoço)
  const atrasoRegistrado = turno?.minutos_atraso_almoco || 0;

  return (
    <div className={cn(
      "bg-slate-800/80 border border-slate-700 rounded-lg p-3 space-y-2",
      className
    )}>
      {/* Linha superior: Tempo trabalhado e restante */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-slate-300">
          <Clock className="h-4 w-4 text-blue-400" />
          <span>{formatarMinutos(minutosTrabalhados)} trabalhadas</span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Target className="h-4 w-4 text-green-400" />
          <span>{formatarMinutos(minutosRestantes)} restantes</span>
        </div>
      </div>

      {/* Barra de progresso */}
      <Progress 
        value={percentualJornada} 
        className="h-2"
      />

      {/* Botão manual "Iniciar almoço" disponível para qualquer técnico em turno ativo */}
      {podeIniciarAlmoco && (
        <Button
          onClick={() => iniciarAlmoco()}
          disabled={isIniciandoAlmoco}
          size="sm"
          className="w-full bg-amber-600 hover:bg-amber-700 text-white"
        >
          <Play className="h-4 w-4 mr-2" />
          {isIniciandoAlmoco ? 'Iniciando...' : 'Iniciar almoço'}
        </Button>
      )}

      {/* Acréscimo por atraso de almoço */}
      {atrasoRegistrado > 0 && (
        <div className="flex items-center justify-center gap-1 text-xs">
          <AlertTriangle className="h-3 w-3 text-amber-400" />
          <span className="text-amber-400">
            +{formatarMinutos(atrasoRegistrado)} de acréscimo por atraso no almoço
          </span>
        </div>
      )}

      {/* Saldo (se houver) */}
      {saldoAnterior !== 0 && (
        <div className="flex items-center justify-center gap-1 text-xs">
          {saldoAnterior > 0 ? (
            <>
              <TrendingUp className="h-3 w-3 text-green-400" />
              <span className="text-green-400">
                Crédito de {formatarMinutos(saldoAnterior)} do dia anterior
              </span>
            </>
          ) : (
            <>
              <TrendingDown className="h-3 w-3 text-red-400" />
              <span className="text-red-400">
                Débito de {formatarMinutos(Math.abs(saldoAnterior))} do dia anterior
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
